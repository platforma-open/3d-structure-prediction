"""IMGT numbering helpers.

ImmuneBuilder runs ANARCI internally and exposes numbered residues on the
Antibody object. Default scheme is typically Chothia unless configured. Until
runtime testing confirms the scheme emitted by `antibody.numbered_sequences`,
we trust what comes out and record the scheme in provenance; if a Chothia
fallback is needed, switch to post-hoc renumbering via the `anarci` CLI here.

IMGT CDR ranges (per spec R27):
  CDRH1: 27-38   CDRH2: 56-65   CDRH3: 105-117
  CDRL1: 27-38   CDRL2: 56-65   CDRL3: 105-117
"""

from __future__ import annotations

from dataclasses import dataclass

IMGT_CDR_RANGES: dict[str, dict[str, tuple[int, int]]] = {
    "H": {"CDR1": (27, 38), "CDR2": (56, 65), "CDR3": (105, 117)},
    "L": {"CDR1": (27, 38), "CDR2": (56, 65), "CDR3": (105, 117)},
}


@dataclass
class NumberedResidue:
    chain: str  # "H" or "L"
    pos: str  # IMGT position as string; may include insertion code (e.g. "111A").
    aa: str

    @property
    def imgt_int(self) -> int:
        digits = "".join(c for c in self.pos if c.isdigit())
        return int(digits) if digits else 0

    @property
    def region(self) -> str:
        ranges = IMGT_CDR_RANGES.get(self.chain, {})
        n = self.imgt_int
        for name, (lo, hi) in ranges.items():
            if lo <= n <= hi:
                return name
        return "FR"


def extract_numbered_residues(antibody) -> list[NumberedResidue]:
    """Pull residue numbering out of an ImmuneBuilder Antibody.

    `antibody.numbered_sequences` is {'H': [((pos, ins), aa), ...], 'L': ...}.
    For VHH only 'H' is present. Residues are returned in N-to-C order per
    chain, heavy first then light.
    """
    out: list[NumberedResidue] = []
    numbered = getattr(antibody, "numbered_sequences", {}) or {}
    for chain in ("H", "L"):
        chain_data = numbered.get(chain, [])
        for entry in chain_data:
            (pos, ins), aa = entry
            pos_str = f"{pos}{ins.strip()}" if ins and ins.strip() else str(pos)
            out.append(NumberedResidue(chain=chain, pos=pos_str, aa=aa))
    return out


def cdr_ranges_in_pdb_notation(chain: str) -> dict[str, tuple[str, str]]:
    """Return CDR ranges formatted for REMARK 99 CDR* records.

    Example: {"CDR1": ("H27", "H38"), ...} for chain H.
    """
    ranges = IMGT_CDR_RANGES.get(chain, {})
    return {
        name: (f"{chain}{lo}", f"{chain}{hi}")
        for name, (lo, hi) in ranges.items()
    }


def cdrh3_length(residues: list[NumberedResidue]) -> int:
    """Count residues in CDRH3."""
    return sum(1 for r in residues if r.chain == "H" and r.region == "CDR3")
