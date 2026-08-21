# @platforma-open/milaboratories.3d-structure-prediction

## 1.3.1

### Patch Changes

- 957bc71: Pass `--registry-serve-url` when publishing the block

  The release run failed at the facade's `prepublishOnly`:

  ```
  > block-tools pack && block-tools publish -r 's3://…/pub/releases/?region=eu-central-1'
  error: required option '--registry-serve-url <url>' not specified
  ```

  `block-tools` made `--registry-serve-url` a required option for `publish`, and the script
  predates that. The block was bumped from block-tools 2.11.0 to 2.14.3 in the previous release,
  which is what surfaced it — the component packages published to npm first, then the facade failed,
  so the block itself was never published at that version.

  The script now matches the form the already-migrated blocks use, `--registry-serve-url
https://blocks.pl-open.science` included.

  The redundant `block-tools pack &&` prefix goes with it: `build` already runs
  `shx rm -rf ./block-pack && block-tools pack`, and CI publishes with `build-script-name: 'build'`,
  so the pack had already happened by the time `prepublishOnly` fired.

  This changeset exists to produce a version bump, so the release pipeline runs again and actually
  publishes the block.

## 1.3.0

### Minor Changes

- 2c439e0: Accept imported antibody sets keyed on `pl7.app/variantKey`

  The dataset selector admitted only `pl7.app/vdj/clonotypeKey` and
  `pl7.app/vdj/scClonotypeKey` row axes. `import-vdj-data` now emits bare antibody sets —
  amino-acid variable domains with no gene calls and no counts — on the shared
  `pl7.app/variantKey` axis, so such a set never appeared in the picker at all: an empty
  dropdown rather than an error.

  The axis name alone cannot admit them. Three producers key on `pl7.app/variantKey` and only
  the run-id in the axis domain separates them: `pl7.app/peptide/extractionRunId` for
  peptide-extraction, `pl7.app/repertoire/extractionRunId` for synthetic-repertoire-profiler,
  and `pl7.app/vdj/clonotypingRunId` for imported receptor sets. Only the last is foldable;
  matching on the name would offer peptides and amplicon variants to an antibody structure
  predictor. The test lives in `isFoldableRowAxis`.

  Nothing else changes. The sequence matchers already find the imported amino-acid
  `VDJRegionInFrame` columns, the label column resolves through the same anchored selector, and
  the workflow takes its batch key from the input spec, so output columns land on whichever axis
  the dataset uses.

  `isSingleCell` stays `false` for an imported paired set, and `isScFvSuspect` stays keyed on
  `clonotypeKey`; both are correct as they stand and are now commented with why.

### Patch Changes

- Updated dependencies [2c439e0]
  - @platforma-open/milaboratories.3d-structure-prediction.model@1.2.0
  - @platforma-open/milaboratories.3d-structure-prediction.ui@1.1.10

## 1.2.3

### Patch Changes

- Updated dependencies [9f50d67]
  - @platforma-open/milaboratories.3d-structure-prediction.workflow@1.2.3
  - @platforma-open/milaboratories.3d-structure-prediction.model@1.1.4
  - @platforma-open/milaboratories.3d-structure-prediction.ui@1.1.9

## 1.2.2

### Patch Changes

- Updated dependencies [4da9f99]
  - @platforma-open/milaboratories.3d-structure-prediction.model@1.1.3
  - @platforma-open/milaboratories.3d-structure-prediction.ui@1.1.8
  - @platforma-open/milaboratories.3d-structure-prediction.workflow@1.2.2

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
