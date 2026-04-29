---
"@platforma-open/milaboratories.3d-structure-prediction": minor
"@platforma-open/milaboratories.3d-structure-prediction.workflow": minor
"@platforma-open/milaboratories.3d-structure-prediction.model": minor
"@platforma-open/milaboratories.3d-structure-prediction.ui": minor
"@platforma-open/milaboratories.3d-structure-prediction.software": minor
---

Spec polish PR. Closes the bulk of the M2 acceptance items left after the first spec-alignment release.

- New `summary.json` aggregate output from the Python wrapper feeds three UI alerts: scFv suspicion (R7), failure-rate >10% with per-reason breakdown (R58), empty-input pre-flight, and "no clonotypes pass threshold" soft warning. Dismissals persist via `UiState`.
- ImmuneBuilder log viewer (R57) accessible from the page header — `predictionLogHandle` model output wraps the workflow's stdout stream, rendered via `PlLogView` in a slide-modal.
- Light-chain auto-pick: when both IGK and IGL columns exist on the dataset and the user hasn't chosen one yet, IGK pre-fills (more common in human/mouse).
- CDR-H3 column carries `pl7.app/description` annotation explaining accuracy degradation for CDR-H3 ≥ 20 aa (R55).
- PDB provenance now stamps the runtime block id (`REMARK 99 PROVENANCE block-version=...`) instead of `unknown`.
- Per-row PDB download (R52) and bulk-zip export (R53). PDBs are now exposed as a File-typed `ResourceMap` PColumn keyed by clonotypeKey, built from the prediction workdir via a `processWorkdir` template. The structures table grows a download cell button on the clonotype-key column; the page header gets an `Export PDBs` archive button (`PlBtnExportArchive`) that streams the per-clonotype files into a single zip. Failed predictions have no PDB entry, so they are silently skipped from the archive.

Documents M0 numbering verification (IMGT direct from ImmuneBuilder default `numbering_scheme='imgt'`, no post-hoc renumbering) in `tasks/text/work/projects/3d-structures-and-clustering/m0-numbering-spike.md`.
