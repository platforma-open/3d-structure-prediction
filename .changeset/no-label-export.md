---
'@platforma-open/milaboratories.3d-structure-prediction.workflow': patch
'@platforma-open/milaboratories.3d-structure-prediction': patch
---

Stop exporting the `clonotypeLabel` copy to the result pool

The block copies the upstream `pl7.app/label` column into its confidence table so its own
structures table can show Clone Id. That copy also went out in `exports.structures`. Downstream
blocks then saw two or more `pl7.app/label` columns on the clonotype axis, one per prediction run,
each covering only the records that run predicted. Which one they read depended on block order,
and a run over a different subset gave them no label for most records.

The structures table output is unchanged. The export pframe now omits `clonotypeLabel`.
