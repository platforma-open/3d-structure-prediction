---
'@platforma-open/milaboratories.3d-structure-prediction.workflow': patch
'@platforma-open/milaboratories.3d-structure-prediction.model': patch
'@platforma-open/milaboratories.3d-structure-prediction.ui': patch
---

Remove the pre-flight prerun; derive the clonotype-count size check synchronously in the model.

The distinct-clonotype count that gates the Run button is now computed in the
`clonotypeCount` model output via `getNumberOfRows`, which reads Parquet chunk
row stats from result-pool resource metadata without a workflow round-trip.
When a lead-selection filter is applied, the clonotype-keyed subset column's
row count is used; otherwise the heavy-chain column's. The prerun template and
`wf.setPreRun` wiring are removed. The 10,000-clonotype hard gate (and the
`data.lastClonotypeCount` mirror that feeds `.args()`) are unchanged — the size
check just resolves near-instantly instead of waiting on a prerun.

The `clonotypeCount` output now carries an `inputKey` fingerprint of the
selections it was computed from. The UI mirrors the count into
`data.lastClonotypeCount` only when that fingerprint matches the live
selection, closing a race where a stale count from the previous dataset
(observed during the output's async recompute) could re-arm the Run gate on a
freshly-swapped, much larger input.