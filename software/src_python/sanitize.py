"""Sequence sanitization pipeline for antibody structure prediction.

Implements R9-R14 from the block spec. Order matters — stop-codon detection
must run before non-standard-AA stripping, otherwise `*` gets removed and the
check never fires. R15 (VHH hallmark check) runs post-prediction on the
IMGT-numbered antibody — see `numbering.vhh_hallmarks_present`.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

STANDARD_AA = set("ACDEFGHIKLMNPQRSTVWY")
NON_STANDARD_STRIPPED = set("BJXZ")
GAP_CHARS = set("-.")

VH_LENGTH_RANGE = (108, 135)
VL_LENGTH_RANGE = (102, 120)

# Pyroglutamate normalization: leading pE, pyroGlu, <pE> → E.
PYROGLU_PATTERNS = [
    re.compile(r"^<\s*pE\s*>", re.IGNORECASE),
    re.compile(r"^pyroGlu", re.IGNORECASE),
    re.compile(r"^pE", re.IGNORECASE),
]

# Signal peptide heuristic (R14). M/signal ↦ mature VH start.
SIGNAL_PEPTIDE_RE = re.compile(
    r"^M[LVIAFWCM]{3,15}(E[VI]QL|Q[VI]QL|DIQM|EIVLT|QVQLV|QLVQS|DVQL)"
)


@dataclass
class SanitizationResult:
    vh: str = ""
    vl: str = ""
    failure_reason: str = ""
    warnings: list[str] = field(default_factory=list)

    @property
    def success(self) -> bool:
        return not self.failure_reason


def normalize(seq: str) -> str:
    """Uppercase, strip whitespace, remove gap chars, normalize pyroGlu prefix."""
    if seq is None:
        return ""
    # Strip whitespace first so pyroGlu patterns can match the leading text.
    s = seq.strip()
    for pat in PYROGLU_PATTERNS:
        if pat.match(s):
            s = pat.sub("E", s, count=1)
            break
    s = s.upper()
    s = "".join(c for c in s if c not in GAP_CHARS and not c.isspace())
    return s


def has_stop_codon(seq: str) -> bool:
    return "*" in seq


def strip_non_standard(seq: str) -> str:
    return "".join(c for c in seq if c not in NON_STANDARD_STRIPPED)


def in_length_range(seq: str, kind: str) -> bool:
    lo, hi = VH_LENGTH_RANGE if kind == "H" else VL_LENGTH_RANGE
    return lo <= len(seq) <= hi


def detect_signal_peptide(seq: str) -> bool:
    return bool(SIGNAL_PEPTIDE_RE.match(seq))


def sanitize_chain(raw: str, kind: str) -> tuple[str, str, list[str]]:
    """Run the full sanitization pipeline on a single chain.

    Returns (clean_seq, failure_reason, warnings). Empty failure_reason means
    success. The caller decides what to do with warnings (they do not fail).
    """
    warnings: list[str] = []

    normalized = normalize(raw)
    if not normalized:
        return "", "empty_sequence", warnings

    # R10 — stop codon before stripping.
    if has_stop_codon(normalized):
        return "", "stop_codon_mid_sequence", warnings

    # R11 — strip non-standard AAs.
    stripped = strip_non_standard(normalized)
    if not stripped or len(stripped) < 20:
        return "", "non_standard_aa_only_after_strip", warnings

    # R13 — length bounds.
    if not in_length_range(stripped, kind):
        return "", "length_out_of_range", warnings

    # R14 — signal peptide warning on VH only.
    if kind == "H" and detect_signal_peptide(stripped):
        warnings.append("probable_signal_peptide")

    # Reject any remaining character outside the standard 20-aa alphabet.
    bad = set(stripped) - STANDARD_AA
    if bad:
        return "", "non_standard_aa_residue", warnings

    return stripped, "", warnings


def sanitize_pair(
    vh_raw: str,
    vl_raw: str | None,
    mode: str,
) -> SanitizationResult:
    """Sanitize a (VH, VL) pair according to the mode.

    `mode` is "ABodyBuilder2" (paired) or "NanoBodyBuilder2" (VH-only).
    """
    result = SanitizationResult()

    vh, vh_reason, vh_warnings = sanitize_chain(vh_raw, "H")
    result.warnings.extend(vh_warnings)
    if vh_reason:
        result.failure_reason = vh_reason
        return result
    result.vh = vh

    if mode == "ABodyBuilder2":
        if vl_raw is None or not vl_raw.strip():
            result.failure_reason = "light_chain_missing_in_paired_mode"
            return result
        vl, vl_reason, vl_warnings = sanitize_chain(vl_raw, "L")
        result.warnings.extend(vl_warnings)
        if vl_reason:
            result.failure_reason = vl_reason
            return result
        result.vl = vl
    elif mode == "NanoBodyBuilder2":
        # R15 hallmark check runs post-prediction in run_immunebuilder.py
        # against IMGT-numbered residues (see numbering.vhh_hallmarks_present).
        pass
    else:
        result.failure_reason = f"unknown_mode:{mode}"

    return result
