"""PDB writer that augments ImmuneBuilder output with REMARKs.

ImmuneBuilder writes a standard PDB. Per spec R26/R28/R29 we need to:
 - Clamp per-atom B-factor to [0.00, 99.99] to fit PDB `%6.2f` precision.
 - Inject a TITLE line identifying the predictor.
 - Inject REMARK 99 PROVENANCE block (version, seed, block version).
 - Inject REMARK 99 CDR* records with IMGT CDR ranges.

PDB content must be byte-stable for identical inputs so the platforma
backend can cache and reuse downstream results — a wall-clock prediction
timestamp would break every run's CID, so we omit it. The seed + version
fields plus the input sequences are sufficient to reproduce the prediction.

The cleanest approach is: let ImmuneBuilder write a temp PDB, then post-
process the lines — injecting REMARKs after TITLE and clamping B-factors on
ATOM/HETATM lines in one pass.
"""

from __future__ import annotations

from pathlib import Path

from numbering import IMGT_CDR_RANGES, cdr_ranges_in_pdb_notation

B_FACTOR_MIN = 0.00
B_FACTOR_MAX = 99.99


def _clamp_b_factor(line: str) -> tuple[str, bool]:
    """Clamp B-factor column on ATOM/HETATM lines. Returns (new_line, clamped)."""
    if not (line.startswith("ATOM") or line.startswith("HETATM")):
        return line, False
    if len(line) < 66:
        return line, False
    raw = line[60:66]
    try:
        value = float(raw)
    except ValueError:
        return line, False
    clamped = max(B_FACTOR_MIN, min(B_FACTOR_MAX, value))
    if clamped == value:
        return line, False
    return f"{line[:60]}{clamped:6.2f}{line[66:]}", True


def _cdr_remark_lines(mode: str) -> list[str]:
    """Emit REMARK 99 CDR* lines (IMGT ranges)."""
    lines: list[str] = []
    chains = ["H"] if mode == "NanoBodyBuilder2" else ["H", "L"]
    for chain in chains:
        for cdr_name, (lo, hi) in cdr_ranges_in_pdb_notation(chain).items():
            # e.g. "REMARK 99 PLATFORMA CDRH1 H27-H38"
            label = f"CDR{chain}{cdr_name[-1]}"  # CDR1 → CDRH1 / CDRL1
            lines.append(f"REMARK  99 PLATFORMA {label} {lo}-{hi}")
    return lines


def _provenance_remark_lines(
    *,
    immunebuilder_version: str,
    torch_seed: int,
    block_version: str,
    numbering_scheme: str,
) -> list[str]:
    return [
        "REMARK  99 PROVENANCE",
        f"REMARK  99 PROVENANCE immunebuilder-version={immunebuilder_version}",
        f"REMARK  99 PROVENANCE torch-seed={torch_seed}",
        f"REMARK  99 PROVENANCE block-version={block_version}",
        f"REMARK  99 PROVENANCE numbering-scheme={numbering_scheme}",
    ]


def _title_line(mode: str) -> str:
    builder = "ABodyBuilder2" if mode == "ABodyBuilder2" else "NanoBodyBuilder2"
    return f"TITLE     {builder} prediction (Platforma Structure Prediction block)"


def augment_pdb(
    source_path: Path,
    dest_path: Path,
    *,
    mode: str,
    immunebuilder_version: str,
    torch_seed: int,
    block_version: str,
    numbering_scheme: str,
) -> dict:
    """Rewrite source_path → dest_path with TITLE + REMARK injections + B clamping.

    Returns stats dict: {clamped_count: int, injected_remarks: int}.
    """
    with open(source_path, "r") as f:
        src_lines = [line.rstrip("\n") for line in f]

    title = _title_line(mode)
    provenance = _provenance_remark_lines(
        immunebuilder_version=immunebuilder_version,
        torch_seed=torch_seed,
        block_version=block_version,
        numbering_scheme=numbering_scheme,
    )
    cdr = _cdr_remark_lines(mode)
    injected = [title, *provenance, *cdr]

    out_lines: list[str] = []
    clamped = 0
    header_done = False

    for line in src_lines:
        # Skip any existing TITLE that ImmuneBuilder might have put down.
        if not header_done and line.startswith("TITLE"):
            continue
        if not header_done and line.startswith(("ATOM", "HETATM", "MODEL")):
            # Inject our block before the coordinate section starts.
            out_lines.extend(injected)
            header_done = True

        new_line, was_clamped = _clamp_b_factor(line)
        out_lines.append(new_line)
        if was_clamped:
            clamped += 1

    # If the PDB had no ATOM/HETATM/MODEL lines at all (shouldn't happen),
    # still emit the REMARKs so downstream parsers don't break.
    if not header_done:
        out_lines = injected + out_lines

    with open(dest_path, "w") as f:
        f.write("\n".join(out_lines))
        f.write("\n")

    return {
        "clamped_count": clamped,
        "injected_remarks": len(injected),
    }
