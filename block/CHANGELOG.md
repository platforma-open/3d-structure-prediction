# @platforma-open/milaboratories.3d-structure-prediction

## 1.2.1

### Patch Changes

- 49704f6: Rename clonotype row-axis label column header from "Clone" to "Clone Id" to match the upstream dataset label
- Updated dependencies [49704f6]
  - @platforma-open/milaboratories.3d-structure-prediction.workflow@1.2.1

## 1.2.0

### Minor Changes

- 37da856: Export only confident structures. The PDB ResourceMap now contains only confident clonotypes — prediction succeeded AND the selected error metric is within threshold — and the `confident` / `predictionSuccessful` subset filter columns are no longer exported. Downstream blocks consume confident structures directly, with no all-vs-confident selection to make. The results table still shows every clonotype and every column (confidence values, failure reasons, warnings); failed and unconfident clonotypes simply have no downloadable PDB. Confident filtering is applied once, in the Python wrapper's manifest, so the PDB map is built by the existing stable path (no post-hoc rebuild).

  Clonotypes whose prediction succeeded but whose error exceeds the confidence threshold now carry a failure reason — "Prediction confidence above threshold (<value> Å)" — so the table explains why they have no downloadable structure (their error values remain visible).

  Output column traces are now rooted in the Lead Selection filter when present, so predictions off the same dataset with different filters carry distinguishable provenance (dataset → lead selection → prediction) in downstream labels.

  The error-distribution histogram now shows the confidence threshold as a dashed vertical line (via a `pl7.app/graph/thresholds` annotation on the selected-metric column) — on the CDR-H3 page for the `cdrh3Mean` metric, or the Mean page for `overallMean`.

### Patch Changes

- Updated dependencies [37da856]
  - @platforma-open/milaboratories.3d-structure-prediction.workflow@1.2.0

## 1.1.3

### Patch Changes

- Updated dependencies [671e8b8]
  - @platforma-open/milaboratories.3d-structure-prediction.ui@1.1.7
  - @platforma-open/milaboratories.3d-structure-prediction.model@1.1.2

## 1.1.2

### Patch Changes

- Updated dependencies [8aeaff0]
  - @platforma-open/milaboratories.3d-structure-prediction.workflow@1.1.2

## 1.1.1

### Patch Changes

- Updated dependencies [0979056]
  - @platforma-open/milaboratories.3d-structure-prediction.model@1.1.1
  - @platforma-open/milaboratories.3d-structure-prediction.ui@1.1.6
  - @platforma-open/milaboratories.3d-structure-prediction.workflow@1.1.1

## 1.1.0

### Minor Changes

- 35caf17: Make subset columns (`confident`, `predictionSuccessful`) distinguishable per block instance. The spec domain now carries `pl7.app/structure/prediction/blockId`, so two 3D-prediction instances on the same dataset no longer collapse into one entry in downstream dataset selectors. The trace label uses the instance's `customBlockLabel` / `defaultBlockLabel` instead of the hardcoded `"3D Structure Prediction"`, so consumers can tell instances apart.

### Patch Changes

- Updated dependencies [35caf17]
  - @platforma-open/milaboratories.3d-structure-prediction.workflow@1.1.0
  - @platforma-open/milaboratories.3d-structure-prediction.model@1.1.0
  - @platforma-open/milaboratories.3d-structure-prediction.ui@1.1.5

## 1.0.11

### Patch Changes

- Updated dependencies [374ef16]
  - @platforma-open/milaboratories.3d-structure-prediction.workflow@1.0.8

## 1.0.10

### Patch Changes

- 49b6d30: Update workflow version
- Updated dependencies [49b6d30]
  - @platforma-open/milaboratories.3d-structure-prediction.model@1.0.4
  - @platforma-open/milaboratories.3d-structure-prediction.ui@1.1.4
  - @platforma-open/milaboratories.3d-structure-prediction.workflow@1.0.7

## 1.0.9

### Patch Changes

- Updated dependencies [0aae4c9]
  - @platforma-open/milaboratories.3d-structure-prediction.workflow@1.0.6
  - @platforma-open/milaboratories.3d-structure-prediction.model@1.0.3
  - @platforma-open/milaboratories.3d-structure-prediction.ui@1.1.3

## 1.0.8

### Patch Changes

- Updated dependencies [ffe0150]
  - @platforma-open/milaboratories.3d-structure-prediction.model@1.0.2
  - @platforma-open/milaboratories.3d-structure-prediction.ui@1.1.2

## 1.0.7

### Patch Changes

- Updated dependencies [4438d9d]
  - @platforma-open/milaboratories.3d-structure-prediction.ui@1.1.1
  - @platforma-open/milaboratories.3d-structure-prediction.model@1.0.1
  - @platforma-open/milaboratories.3d-structure-prediction.workflow@1.0.5

## 1.0.6

### Patch Changes

- Updated dependencies [1c6cabd]
  - @platforma-open/milaboratories.3d-structure-prediction.ui@1.1.0

## 1.0.5

### Patch Changes

- @platforma-open/milaboratories.3d-structure-prediction.workflow@1.0.4

## 1.0.4

### Patch Changes

- @platforma-open/milaboratories.3d-structure-prediction.workflow@1.0.3

## 1.0.3

### Patch Changes

- @platforma-open/milaboratories.3d-structure-prediction.workflow@1.0.2

## 1.0.2

### Patch Changes

- Updated dependencies [18ecc0d]
  - @platforma-open/milaboratories.3d-structure-prediction.ui@1.0.1

## 1.0.1

### Patch Changes

- @platforma-open/milaboratories.3d-structure-prediction.workflow@1.0.1
