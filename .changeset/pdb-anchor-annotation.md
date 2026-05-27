---
'@platforma-open/milaboratories.3d-structure-prediction.workflow': patch
---

Annotate the `pdbsMap` output column with `pl7.app/isAnchor: "true"` so downstream consumers can surface it as a primary dataset in `PlDatasetSelector` instead of `PlDropdownRef`. No behavior change for existing consumers.
