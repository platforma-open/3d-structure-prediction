# @platforma-open/milaboratories.3d-structure-prediction

## 1.4.1

### Patch Changes

- 3377669: Keep the echoed Clone Id label out of the result pool

  The block echoes the dataset's `pl7.app/label` column into its structures frame, so its own table
  can show Clone Id on the clonotype rows. That frame also went to `exports`, which put a second
  `pl7.app/label` column for the clonotype axis into the result pool.

  A downstream block that asks for "the label column on this axis" then gets two answers. The copy
  covers only the clonotypes this run predicted, so picking it loses labels for every other record.
  3D Structure Clustering hit this and fell back to the raw clonotype key. Structure-Based
  Liabilities showed two Clone Id columns.

  The label column now goes to `outputs` only. The block's own table is unchanged, and the pool holds
  just the source column again.

## 1.4.0

### Minor Changes

- f7ec7ea: Warn when the input defines sub-regions, and when any prediction fails

  Two advisory alerts. Neither gates Run, and neither needs a workflow change, so
  projects already computed benefit without re-running.

  **Sub-regions in the input.** A synthetic-repertoire-profiler run whose region
  partition has children produces variants that are designed constructs — a grafted
  insert occupying a CDR slot, say — rather than plain V domains. ImmuneBuilder and
  the ANARCI numbering step it relies on assume canonical VDJ architecture, so such
  sequences may fold with unreliable geometry. The alert sits under the dataset
  selector, where its cause is, and appears before the user works down to Run.

  The check is spec-only. The profiler emits its
  `pl7.app/repertoire/subdividedRegions` column _only_ when some parent actually
  subdivides something, so the column's presence in the result pool is the whole
  answer — no data read and no workflow round-trip, which is what lets the warning
  land before a fold is paid for rather than after. It is scoped by
  `pl7.app/repertoire/extractionRunId`, the profiler block's own id, so a second
  profiler elsewhere in the project cannot trigger it. That column sits on
  `[parentId]` and shares no axis with the dataset anchor, so no anchored query can
  reach it — the same reason antibody-sequence-liabilities resolves it with a bare
  `wf.query`. That block needs per-variant, per-region detail because it skips
  individual liability rules per region; this one folds the whole variant sequence,
  so dataset-level presence is all the warning needs.

  **Failures in the results.** The per-clonotype "Failure reason" column is
  annotated `optional`, so it is off until the user adds it from the columns panel —
  a run with failures looked identical to a clean one. An alert above the table now
  says when the column holds anything, and points at it.

  That check costs one call: `getColumnUniqueValues` has the PFrame driver compute
  the column's distinct values server-side, so neither the model nor the page ever
  walks the rows. The model contributes only a single-column pFrame and the column's
  id, mirroring the existing `meanErrorPf` / `meanErrorSpec` pair. Blank cells are
  filtered explicitly — a run where every prediction succeeded still writes one row
  per clonotype with the reason left empty, so the blank comes back as a legitimate
  distinct value and counting it would have fired the alert on every successful run.
  The limit sits above one for the same reason, so a real reason cannot be crowded
  out of the set by an empty string and a null both appearing.

  No counts and no reason list: those would mean pulling the whole column, and the
  column itself carries the detail once it is switched on. The wording deliberately
  covers predictions that succeeded but fall above the confidence threshold — those
  carry a failure reason too, and have no exported structure either.

### Patch Changes

- 8fbe07b: Update SDK

## 1.3.2

### Patch Changes

- cf1b0d2: Accept synthetic-repertoire-profiler VDJ datasets

  The dataset picker now admits a `pl7.app/variantKey` row axis that declares
  `pl7.app/modality: vdj`, alongside the existing import-vdj-data sets. Only the
  amino-acid-keyed side of a profiler run is offered — the nucleotide one carries
  no AA sequence to fold.

  Sequence discovery follows the producer. The profiler names its columns
  `pl7.app/sequence` with a `pl7.app/feature` domain, not `pl7.app/vdj/sequence`
  with `pl7.app/vdj/feature`, so the chain dropdowns match on the profiler's names
  for a profiler dataset. Only the whole-variant sequence is offered; the per-region
  columns (FR1 … CDR3 … FR4) are not foldable on their own.

  A profiler run frames variants against a single parent and carries no chain key,
  so it yields one sequence column. Such a dataset runs in NanoBodyBuilder2 mode;
  ABodyBuilder2 has no column for the light slot and Run stays disabled.

- 87ed719: Migrate to the latest block template and add the mandatory kind package

  Refreshed onto block-tools 2.14.3 via `upgrade-sdk`, and added the `kind/`
  package every block must now declare. The kind carries the block's identity
  (`{name}@{version}`, read from its own `package.json`) and its init-params
  contract.

  `BlockParams` is the four settings that change what a prediction produces:
  `mode`, `species`, `confidenceMetric` and `confidenceThresholdAngstroms`. All
  are optional, so a project template can seed any subset and the model's `init`
  keeps a default behind each. `.templateParams` projects the same four back, so
  export and apply are inverses. Input selections are excluded by construction —
  `dataset`, `heavyChainRef` and `lightChainRef` are anchor-bound references that
  cannot travel between projects. The three setting vocabularies moved from
  `model/src/types.ts` into the kind, which owns them; the model re-exports them
  so every consumer keeps working.

  Author-code fixes the upgrade required:

  - `OutputColumnProvider` is gone from `@platforma-sdk/model`. The structures
    table now uses `AccessorColumnsProvider` (a memoised factory, not a
    constructor) and `getColumns()` / `getSpec()`.
  - The test used the facade's old `blockSpec` export, which the slim facade
    replaced with a from-pack-v2 `BlockPointer`.
  - `@platforma-sdk/ui-vue` is on 1.83.3, which publishes the
    `dist/components/*.vue.d.ts` its own `lib.d.ts` re-exports again. 1.83.1 had
    dropped them, and the slim facade inlines the model's whole public type
    surface, so `BlockData`'s `GraphMakerState` reached those missing files
    through graph-maker and the facade build failed.
  - The model declares `@platforma-sdk/ui-vue` directly so graph-maker's peer
    resolves to the catalog version instead of floating to the newest published
    one.

  The software package moves from `pl-pkg` to `block-tools software build`.

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
