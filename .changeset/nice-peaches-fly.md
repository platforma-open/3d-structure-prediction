---
'@platforma-open/milaboratories.3d-structure-prediction.workflow': patch
'@platforma-open/milaboratories.3d-structure-prediction.model': patch
'@platforma-open/milaboratories.3d-structure-prediction.ui': patch
---

Add a Logs tab that streams per-batch ImmuneBuilder stdout so users can monitor prediction progress while batches are running.
Add a pre-flight clonotype-count check. The prerun counts distinct clonotypes in the selected dataset (after the optional filter) and disables Run with an explanatory alert when the count exceeds 10 000.
