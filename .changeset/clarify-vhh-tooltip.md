---
'@platforma-open/milaboratories.3d-structure-prediction.ui': patch
'@platforma-open/milaboratories.3d-structure-prediction.model': patch
'@platforma-open/milaboratories.3d-structure-prediction.workflow': patch
'@platforma-open/milaboratories.3d-structure-prediction.software': patch
---

Clarify NanoBodyBuilder2 usage in the settings panel: relabel the light chain dropdown as optional with a tooltip, and expand the mode-info alert to note that NanoBodyBuilder2 is camelid-VHH-trained, so for conventional heavy-only inputs (e.g. human bulk IGH-only) the produced structure has VHH-biased framework geometry.

Drop the user-facing CPU and memory inputs (per-batch resources are fixed). Each prediction batch now requests 4 CPU cores and 4 GiB of memory.

Stop writing a wall-clock `prediction-date` REMARK into emitted PDBs. The timestamp made every PDB byte-different on every run, breaking the platforma backend's content-addressed caching — downstream nodes that consumed merged PDB ResourceMaps hit `CIDConflictError`. The other provenance REMARKs (immunebuilder version, torch seed, block version, numbering scheme) plus the seeded ensemble fully determine the prediction.

Make the saved Python wrapper log byte-stable for identical inputs: drop the per-line UTC timestamp prefix and remove every wall-clock duration printed by `_log` (`predictor ready in Xs`, `predicted in Xs`, `elapsed=Xs`). The exec template saves stdout via `saveStdoutStream()` into the regular file output set, so its content hash flows into the resource CID; timestamped logs would re-introduce the same `CIDConflictError` failure mode as the PDB date.

Set `stepCache: 30 * times.minute` on the `processColumn` call so per-batch outputs stay reachable for the dedup/recovery path across project re-renders, matching the convention used by mixcr-clonotyping and miltenyi-tcr-bcr-clonotyping.

Add the species selector (spec R44): `human | mouse | camelid | rat | rabbit | other`, default `human`. Species is included in the block subtitle (R56) alongside the engine. The mode-info banner now splits into two cases: when the species is `camelid` and the light chain is unset we treat it as a true VHH input (informational); for any other species combined with heavy-only input we surface a warning that NanoBodyBuilder2's framework geometry is biased away from conventional VH. A separate warning fires for ABodyBuilder2 runs on species outside the training distribution (anything other than human or mouse). Species is held in `BlockData` only — the workflow does not consume it yet, so switching species does not invalidate cached predictions. Upstream clonotyping blocks do not propagate species through PColumn specs today, so the selector is user-supplied; once upstream wires `pl7.app/species` onto the clonotype-axis domain, this block can pre-fill the default.
