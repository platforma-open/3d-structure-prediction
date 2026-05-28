---
'@platforma-open/milaboratories.3d-structure-prediction.workflow': minor
'@platforma-open/milaboratories.3d-structure-prediction.model': minor
'@platforma-open/milaboratories.3d-structure-prediction': minor
---

Make subset columns (`confident`, `predictionSuccessful`) distinguishable per block instance. The spec domain now carries `pl7.app/structure/prediction/blockId`, so two 3D-prediction instances on the same dataset no longer collapse into one entry in downstream dataset selectors. The trace label uses the instance's `customBlockLabel` / `defaultBlockLabel` instead of the hardcoded `"3D Structure Prediction"`, so consumers can tell instances apart.