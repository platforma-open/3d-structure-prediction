---
"@platforma-open/milaboratories.3d-structure-prediction": major
"@platforma-open/milaboratories.3d-structure-prediction.workflow": major
"@platforma-open/milaboratories.3d-structure-prediction.model": major
"@platforma-open/milaboratories.3d-structure-prediction.ui": major
"@platforma-open/milaboratories.3d-structure-prediction.software": major
---

Spec-alignment release (breaking output schema).

- Confidence metric is now **per-residue ensemble error in Ångstroms** (lower = better), not pLDDT. All PColumn names are renamed from `pl7.app/structure/plddt/*` to `pl7.app/structure/confidence/*` with annotation `pl7.app/structure/confidenceMetric: "predictedErrorAngstroms"`. Default threshold switched from `70` (pLDDT) to `2.5` Å.
- Mode selection: ABodyBuilder2 for paired VH+VL, NanoBodyBuilder2 for VH-only (VHH). Auto-detected from presence of the light chain reference.
- Sequence sanitization pipeline added: pyroGlu normalization, stop-codon detection, non-standard AA stripping, length bounds, signal-peptide flagging, VHH-hallmark check. Failures reported per row via nullable `failureReason` column; soft warnings via `warning` column.
- PDB output now carries IMGT CDR range and provenance records (`REMARK 99 CDR*`, `REMARK 99 PROVENANCE`), with B-factor clamped to [0.00, 99.99]. Torch seed pinned (default 42) for reproducible PDBs.
- Per-residue output changed from a 2D Xsv (clonotypeKey × residueIdx) to a JSON-encoded String PColumn (R34). Downstream blocks must JSON.parse `perResidueError`; each entry is `{pos: "<string>", chain: "H"|"L", errorAngstroms: <float>}` with `pos` carrying IMGT insertion codes where present.
- New subset PColumns annotated with `pl7.app/isSubset: "true"`: `predictionSuccessful` (failureReason IS NULL) and `confident` (predictionSuccessful AND selected metric ≤ threshold). Consumable by Structure Clustering, Lead Selection, etc.
- Chain-aware column discovery: heavy chain dropdown scoped to `pl7.app/vdj/chain ∈ {IGH, IGHeavy}` + `feature ∈ {VDJRegion, VDJRegionInFrame}`; light chain scoped to `IGK/IGL/IGLight`. scFv-like datasets produce a dismissible warning.
- UI additions: species selector, confidence metric selector, per-threshold slider (0.5–6.0 Å), mode-flip banner, confidence histogram page (mean error + CDR-H3 error), GPU-availability notice, custom block title.
- Block runs in `runenv-python-3:3.12.10-atls`; all dependencies are pinned via the runenv (no per-block pip install).
