---
'@platforma-open/milaboratories.3d-structure-prediction.workflow': patch
'@platforma-open/milaboratories.3d-structure-prediction.software': patch
---

Load ImmuneBuilder model weights from a published Platforma asset (`immunebuilder-weights-assets`) instead of downloading them from Zenodo at runtime. The matching per-mode asset is mounted into each batch workdir and passed to ImmuneBuilder via `--weights-dir`. Removes the pre-warmup step, the per-batch warmup sentinel wiring, and the Docker image weight bake.
