"""ImmuneBuilder batch runner for the Platforma 3D Structure Prediction block.

Reads a batch TSV of clonotypes and predicts structures via ABodyBuilder2 or
NanoBodyBuilder2 (spec R22). Emits:

- Per-clonotype PDB files named `<sha1(clonotypeKey)>.pdb` (R30).
- `manifest.tsv`  : (clonotypeKey, pdb_filename).
- `confidence.tsv`: aggregate + per-residue confidence (Å error, R32-R36)
                    plus failureReason (R40) and warning columns.

Dependencies (ImmuneBuilder, torch) ride the venv that pl-pkg's install-deps
creates. ANARCI and pdbfixer are not on PyPI; the atls runenv builds them
from source and stages them in the runenv's site-packages. The SDK's venv
is created without --system-site-packages, so we bootstrap the runenv's
site-packages onto sys.path here before any project-level imports run.
"""

from __future__ import annotations

import os as _os
import sys as _sys
import sysconfig as _sysconfig

_runenv_root = _os.environ.get("PYTHONHOME")
if _runenv_root:
    # Pick up packages staged via runenv-python-builder's `copyFiles` directive
    # (e.g. `{site-packages}/anarci`, `{site-packages}/pdbfixer`).
    _py_ver_short = f"python{_sys.version_info.major}.{_sys.version_info.minor}"
    _candidates = [
        _os.path.join(_runenv_root, "lib", _py_ver_short, "site-packages"),
        _os.path.join(_runenv_root, "Lib", "site-packages"),  # Windows layout
    ]
    _platlib = _sysconfig.get_paths().get("platlib")
    if _platlib:
        _candidates.append(_platlib)
    for _candidate in _candidates:
        if _os.path.isdir(_candidate) and _candidate not in _sys.path:
            _sys.path.append(_candidate)

    # ANARCI shells out to `hmmscan` (HMMER); the binary ships in the runenv's
    # bin/ via copyFiles, but only the venv's bin is on PATH by default.
    _runenv_bin = _os.path.join(_runenv_root, "bin")
    if _os.path.isdir(_runenv_bin):
        _path_env = _os.environ.get("PATH", "")
        if _runenv_bin not in _path_env.split(_os.pathsep):
            _os.environ["PATH"] = _runenv_bin + _os.pathsep + _path_env

import argparse
import csv
import hashlib
import json
import os
import sys
import time
import traceback
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path


def _log(message: str) -> None:
    """Line-buffered log entry to stderr.

    Workflow uses `printErrStreamToStdout` + `saveStdoutStream`; the resulting
    log handle is consumed by `PlLogView` in the UI. Every line is timestamped
    so users can track progress across long-running batches.
    """
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"[{ts}] {message}", file=sys.stderr, flush=True)

from numbering import cdrh3_length as imgt_cdrh3_length
from numbering import extract_numbered_residues
from pdb_writer import augment_pdb
from sanitize import sanitize_pair

CONFIDENCE_FIELDS = [
    "clonotypeKey",
    "meanError",
    "cdrh1Error",
    "cdrh2Error",
    "cdrh3Error",
    "cdrl1Error",
    "cdrl2Error",
    "cdrl3Error",
    "perResidueError",
    "cdrh3Length",
    "failureReason",
    "warning",
]

MANIFEST_FIELDS = ["clonotypeKey", "pdb_filename"]


def indexed_filename(row_idx: int) -> str:
    return f"pdb_{row_idx:05d}.pdb"


def sha1_filename(key: str) -> str:
    """Retained for manifest metadata — downstream blocks can SHA-1 keys to cross-reference."""
    return hashlib.sha1(key.encode("utf-8")).hexdigest() + ".pdb"


def get_immunebuilder_version() -> str:
    try:
        from importlib.metadata import version as _version
        return _version("ImmuneBuilder")
    except Exception:
        return "unknown"


def get_block_version() -> str:
    return os.environ.get("BLOCK_VERSION", "unknown")


def pick_key_column(fieldnames: list[str]) -> str:
    for name in fieldnames:
        if name.lower() == "clonotypekey" or name.lower().endswith("clonotypekey"):
            return name
    return fieldnames[0]


@dataclass
class RowResult:
    clonotype_key: str
    mean_error: str = ""
    cdrh1: str = ""
    cdrh2: str = ""
    cdrh3: str = ""
    cdrl1: str = ""
    cdrl2: str = ""
    cdrl3: str = ""
    per_residue_json: str = ""
    cdrh3_len: str = ""
    failure_reason: str = ""
    warnings: list[str] = field(default_factory=list)
    pdb_filename: str = ""

    @property
    def warning_str(self) -> str:
        return ";".join(self.warnings)

    def to_tsv_row(self) -> dict[str, str]:
        return {
            "clonotypeKey": self.clonotype_key,
            "meanError": self.mean_error,
            "cdrh1Error": self.cdrh1,
            "cdrh2Error": self.cdrh2,
            "cdrh3Error": self.cdrh3,
            "cdrl1Error": self.cdrl1,
            "cdrl2Error": self.cdrl2,
            "cdrl3Error": self.cdrl3,
            "perResidueError": self.per_residue_json,
            "cdrh3Length": self.cdrh3_len,
            "failureReason": self.failure_reason,
            "warning": self.warning_str,
        }


def _mean(values: list[float]) -> float | None:
    valid = [v for v in values if v is not None]
    return sum(valid) / len(valid) if valid else None


def _region_errors(per_residue, chain: str, cdr_name: str) -> list[float]:
    target = f"CDR{cdr_name[-1]}"  # "CDR1" or similar
    return [
        r["errorAngstroms"]
        for r in per_residue
        if r["chain"] == chain and r.get("_region") == target
    ]


def _load_predictor(mode: str):
    if mode == "ABodyBuilder2":
        from ImmuneBuilder import ABodyBuilder2
        return ABodyBuilder2()
    if mode == "NanoBodyBuilder2":
        from ImmuneBuilder import NanoBodyBuilder2
        return NanoBodyBuilder2()
    raise ValueError(f"unknown mode: {mode}")


def _set_seed(seed: int) -> None:
    import random
    import numpy as np
    random.seed(seed)
    np.random.seed(seed)
    try:
        import torch
        torch.manual_seed(seed)
        if torch.cuda.is_available():
            torch.cuda.manual_seed_all(seed)
    except Exception:
        pass


def _predict_one(predictor, mode: str, vh: str, vl: str | None):
    sequences = {"H": vh}
    if mode == "ABodyBuilder2" and vl:
        sequences["L"] = vl
    return predictor.predict(sequences)


def _per_residue_records(antibody) -> list[dict]:
    """Extract per-residue error records.

    ImmuneBuilder stores ensemble disagreement on `antibody.error_estimates`;
    `error_estimates.mean(0).sqrt().cpu().numpy()` produces a 1D array of
    per-residue RMSD in Å indexed in the order of `numbered_sequences` flattened
    (heavy chain then light). This is the same array that gets written to the
    B-factor column of the saved PDB (see `ImmuneBuilder.util.add_errors_as_bfactors`).

    Returns a list of dicts shaped per spec R34:
        {"pos": "<string>", "chain": "H"|"L", "errorAngstroms": <float>}
    Stores an additional `_region` marker (stripped before JSON emission) so
    we can aggregate per-CDR quickly in `_region_errors`.
    """
    records: list[dict] = []
    residues = extract_numbered_residues(antibody)

    err_array = None
    if hasattr(antibody, "error_estimates"):
        try:
            err_array = antibody.error_estimates.mean(0).sqrt().cpu().numpy()
        except Exception:
            err_array = None

    for idx, r in enumerate(residues):
        if err_array is not None and idx < len(err_array):
            err_val = float(err_array[idx])
        else:
            err_val = 0.0
        records.append({
            "pos": r.pos,
            "chain": r.chain,
            "errorAngstroms": err_val,
            "_region": r.region,
        })
    return records


def _json_safe_per_residue(records: list[dict]) -> str:
    cleaned = [
        {"pos": r["pos"], "chain": r["chain"], "errorAngstroms": r["errorAngstroms"]}
        for r in records
    ]
    return json.dumps(cleaned, separators=(",", ":"))


def _format_number(value: float | None, digits: int = 3) -> str:
    if value is None:
        return ""
    return f"{value:.{digits}f}"


def _format_int(value: int | None) -> str:
    return "" if value is None else str(value)


def _metric_value(result: RowResult, metric: str) -> float | None:
    src = result.cdrh3 if metric == "cdrh3Mean" else result.mean_error
    if not src:
        return None
    try:
        return float(src)
    except ValueError:
        return None


def _build_summary(
    results: list[RowResult],
    metric: str,
    threshold: float,
) -> dict:
    """Aggregate per-row stats into the schema the model + UI consume.

    Schema is part of the contract between this script and the block model
    (model.failureStats); keep the field names stable.
    """
    by_failure: dict[str, int] = {}
    by_warning: dict[str, int] = {}
    metric_values: list[float] = []
    confident = 0
    succeeded = 0

    for r in results:
        if r.failure_reason:
            by_failure[r.failure_reason] = by_failure.get(r.failure_reason, 0) + 1
        else:
            succeeded += 1
            v = _metric_value(r, metric)
            if v is not None:
                metric_values.append(v)
                if v <= threshold:
                    confident += 1
        for w in r.warnings:
            by_warning[w] = by_warning.get(w, 0) + 1

    summary: dict = {
        "totalRows": len(results),
        "succeeded": succeeded,
        "failed": len(results) - succeeded,
        "byFailureReason": by_failure,
        "byWarning": by_warning,
        "metric": metric,
        "thresholdAngstroms": threshold,
        "confidentCount": confident,
    }
    if metric_values:
        summary["metricMean"] = sum(metric_values) / len(metric_values)
        summary["metricMin"] = min(metric_values)
        summary["metricMax"] = max(metric_values)
    return summary


def process_batch(
    input_tsv: Path,
    pdb_dir: Path,
    manifest_tsv: Path,
    confidence_tsv: Path,
    summary_json: Path | None,
    mode: str,
    seed: int,
    metric: str,
    threshold: float,
) -> None:
    pdb_dir.mkdir(parents=True, exist_ok=True)
    manifest_tsv.parent.mkdir(parents=True, exist_ok=True)
    confidence_tsv.parent.mkdir(parents=True, exist_ok=True)

    with open(input_tsv, newline="") as f:
        reader = csv.DictReader(f, delimiter="\t")
        fieldnames = reader.fieldnames or []
        key_col = pick_key_column(fieldnames)
        rows = list(reader)

    ib_version = get_immunebuilder_version()
    block_version = get_block_version()

    _log(
        f"start mode={mode} rows={len(rows)} seed={seed} metric={metric} "
        f"threshold={threshold} immunebuilder={ib_version} block={block_version}"
    )

    if not rows:
        _log("no input rows; skipping ImmuneBuilder load and emitting empty outputs")

    _set_seed(seed)
    if rows:
        _log(f"loading {mode} ensemble (4 models)")
        predictor_t0 = time.time()
        predictor = _load_predictor(mode)
        _log(f"predictor ready in {time.time() - predictor_t0:.1f}s")
    else:
        predictor = None

    # Intra-batch dedup cache (R16). Key: (clean_vh, clean_vl).
    prediction_cache: dict[tuple[str, str], object] = {}
    results: list[RowResult] = []

    n = len(rows)
    log_every = max(1, n // 20) if n > 20 else 1
    fail_count = 0
    success_count = 0
    cache_hits = 0
    run_t0 = time.time()

    for row_idx, row in enumerate(rows):
        key = row.get(key_col, "")
        # Use the human-readable label (e.g. CDR3 sequence) for log lines
        # when the workflow provides one; fall back to the raw key.
        label = row.get("clonotypeLabel") or key
        result = RowResult(clonotype_key=key)
        prefix = f"[{row_idx + 1}/{n}] {label}"

        sanitized = sanitize_pair(
            row.get("heavyChain", ""),
            row.get("lightChain", "") if mode == "ABodyBuilder2" else None,
            mode,
        )
        result.warnings.extend(sanitized.warnings)

        if not sanitized.success:
            result.failure_reason = sanitized.failure_reason
            fail_count += 1
            _log(f"{prefix} FAIL sanitize reason={sanitized.failure_reason}")
            results.append(result)
            continue

        if sanitized.warnings:
            _log(f"{prefix} warning {','.join(sanitized.warnings)}")

        cache_key = (sanitized.vh, sanitized.vl)
        antibody = prediction_cache.get(cache_key)
        if antibody is None:
            try:
                pred_t0 = time.time()
                antibody = _predict_one(predictor, mode, sanitized.vh, sanitized.vl)
                pred_dt = time.time() - pred_t0
                prediction_cache[cache_key] = antibody
                if (row_idx + 1) % log_every == 0 or row_idx == 0:
                    _log(f"{prefix} predicted in {pred_dt:.1f}s")
            except Exception as exc:  # noqa: BLE001
                fail_count += 1
                _log(f"{prefix} FAIL ImmuneBuilder {type(exc).__name__}: {exc}")
                traceback.print_exc(file=sys.stderr)
                result.failure_reason = f"immunebuilder_exception:{type(exc).__name__}"
                results.append(result)
                continue
        else:
            cache_hits += 1
            _log(f"{prefix} dedup-cache hit (skipping ImmuneBuilder call)")

        pdb_filename = indexed_filename(row_idx)
        raw_pdb_path = pdb_dir / ("_raw_" + pdb_filename)
        final_pdb_path = pdb_dir / pdb_filename
        try:
            antibody.save(str(raw_pdb_path))
            augment_pdb(
                raw_pdb_path,
                final_pdb_path,
                mode=mode,
                immunebuilder_version=ib_version,
                torch_seed=seed,
                block_version=block_version,
                numbering_scheme="imgt",
            )
            try:
                raw_pdb_path.unlink()
            except FileNotFoundError:
                pass
        except Exception as exc:  # noqa: BLE001
            fail_count += 1
            _log(f"{prefix} FAIL save/augment {type(exc).__name__}: {exc}")
            traceback.print_exc(file=sys.stderr)
            result.failure_reason = f"immunebuilder_exception:{type(exc).__name__}"
            results.append(result)
            continue

        residues = _per_residue_records(antibody)
        per_res_json = _json_safe_per_residue(residues)
        all_err = [r["errorAngstroms"] for r in residues]
        mean_err = _mean(all_err)
        cdrh1 = _mean(_region_errors(residues, "H", "CDR1"))
        cdrh2 = _mean(_region_errors(residues, "H", "CDR2"))
        cdrh3 = _mean(_region_errors(residues, "H", "CDR3"))

        result.per_residue_json = per_res_json
        result.mean_error = _format_number(mean_err)
        result.cdrh1 = _format_number(cdrh1)
        result.cdrh2 = _format_number(cdrh2)
        result.cdrh3 = _format_number(cdrh3)

        if mode == "ABodyBuilder2":
            result.cdrl1 = _format_number(_mean(_region_errors(residues, "L", "CDR1")))
            result.cdrl2 = _format_number(_mean(_region_errors(residues, "L", "CDR2")))
            result.cdrl3 = _format_number(_mean(_region_errors(residues, "L", "CDR3")))

        nb = imgt_cdrh3_length(extract_numbered_residues(antibody))
        result.cdrh3_len = _format_int(nb)
        if nb >= 20:
            result.warnings.append("long_cdrh3")
        result.pdb_filename = pdb_filename

        success_count += 1
        if (row_idx + 1) % log_every == 0 or row_idx == 0 or row_idx == n - 1:
            _log(
                f"{prefix} OK mean={result.mean_error}Å cdrh3={result.cdrh3}Å "
                f"cdrh3Length={result.cdrh3_len}"
            )

        results.append(result)

    with open(manifest_tsv, "w", newline="") as f:
        writer = csv.DictWriter(
            f, fieldnames=MANIFEST_FIELDS, delimiter="\t", lineterminator="\n"
        )
        writer.writeheader()
        for r in results:
            if r.pdb_filename:
                writer.writerow({"clonotypeKey": r.clonotype_key, "pdb_filename": r.pdb_filename})

    with open(confidence_tsv, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CONFIDENCE_FIELDS, delimiter="\t")
        writer.writeheader()
        for r in results:
            writer.writerow(r.to_tsv_row())

    summary = _build_summary(results, metric, threshold)
    if summary_json is not None:
        summary_json.parent.mkdir(parents=True, exist_ok=True)
        with open(summary_json, "w") as f:
            json.dump(summary, f)

    elapsed = time.time() - run_t0 if rows else 0.0
    _log(
        f"done total={summary['totalRows']} succeeded={summary['succeeded']} "
        f"failed={summary['failed']} confident={summary['confidentCount']} "
        f"cache_hits={cache_hits} elapsed={elapsed:.1f}s"
    )
    if summary["byFailureReason"]:
        for reason, n_fail in sorted(
            summary["byFailureReason"].items(), key=lambda kv: -kv[1]
        ):
            _log(f"  failure: {n_fail} × {reason}")
    if summary["byWarning"]:
        for warning, n_warn in sorted(
            summary["byWarning"].items(), key=lambda kv: -kv[1]
        ):
            _log(f"  warning: {n_warn} × {warning}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["ABodyBuilder2", "NanoBodyBuilder2"], required=True)
    parser.add_argument("--input", required=True, help="Batch TSV with clonotypeKey, heavyChain[, lightChain]")
    parser.add_argument("--output-dir", required=True, help="Directory for per-clonotype PDB files")
    parser.add_argument("--manifest", required=True, help="Path to manifest.tsv")
    parser.add_argument("--confidence", required=True, help="Path to confidence.tsv")
    parser.add_argument("--summary", default=None, help="Path to summary.json (aggregate stats for the model)")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--metric", choices=["cdrh3Mean", "overallMean"], default="cdrh3Mean")
    parser.add_argument("--threshold", type=float, default=2.5,
                        help="Confidence threshold (Å) used to derive confidentCount in summary.json")
    args = parser.parse_args()

    process_batch(
        input_tsv=Path(args.input),
        pdb_dir=Path(args.output_dir),
        manifest_tsv=Path(args.manifest),
        confidence_tsv=Path(args.confidence),
        summary_json=Path(args.summary) if args.summary else None,
        mode=args.mode,
        seed=args.seed,
        metric=args.metric,
        threshold=args.threshold,
    )


if __name__ == "__main__":
    main()
