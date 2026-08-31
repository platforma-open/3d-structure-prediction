# @platforma-open/milaboratories.3d-structure-prediction.software

## 1.1.2

### Patch Changes

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

## 1.1.1

### Patch Changes

- 4da9f99: Migrate block onto the structurer (block-tools 2.11.0). Adopts the canonical tool-managed
  layout — tsconfig, oxlint/oxfmt, turbo, block index, workflow/test config — and bumps the SDK
  to latest (model/ui-vue 1.79.x, workflow-tengo 6.6.2, tengo-builder 4.0.8, @platforma-sdk/test
  1.79.12). Adds the root `upgrade-sdk` script for future SDK upgrades.

## 1.1.0

### Minor Changes

- 37da856: Export only confident structures. The PDB ResourceMap now contains only confident clonotypes — prediction succeeded AND the selected error metric is within threshold — and the `confident` / `predictionSuccessful` subset filter columns are no longer exported. Downstream blocks consume confident structures directly, with no all-vs-confident selection to make. The results table still shows every clonotype and every column (confidence values, failure reasons, warnings); failed and unconfident clonotypes simply have no downloadable PDB. Confident filtering is applied once, in the Python wrapper's manifest, so the PDB map is built by the existing stable path (no post-hoc rebuild).

  Clonotypes whose prediction succeeded but whose error exceeds the confidence threshold now carry a failure reason — "Prediction confidence above threshold (<value> Å)" — so the table explains why they have no downloadable structure (their error values remain visible).

  Output column traces are now rooted in the Lead Selection filter when present, so predictions off the same dataset with different filters carry distinguishable provenance (dataset → lead selection → prediction) in downstream labels.

  The error-distribution histogram now shows the confidence threshold as a dashed vertical line (via a `pl7.app/graph/thresholds` annotation on the selected-metric column) — on the CDR-H3 page for the `cdrh3Mean` metric, or the Mean page for `overallMean`.

## 1.0.7

### Patch Changes

- 8aeaff0: Load ImmuneBuilder model weights from a published Platforma asset (`immunebuilder-weights-assets`) instead of downloading them from Zenodo at runtime. The matching per-mode asset is mounted into each batch workdir and passed to ImmuneBuilder via `--weights-dir`. Removes the pre-warmup step, the per-batch warmup sentinel wiring, and the Docker image weight bake.

## 1.0.6

### Patch Changes

- 49b6d30: Update workflow version

## 1.0.5

### Patch Changes

- 4438d9d: Clarify NanoBodyBuilder2 usage in the settings panel: relabel the light chain dropdown as optional with a tooltip, and expand the mode-info alert to note that NanoBodyBuilder2 is camelid-VHH-trained, so for conventional heavy-only inputs (e.g. human bulk IGH-only) the produced structure has VHH-biased framework geometry.

  Drop the user-facing CPU and memory inputs (per-batch resources are fixed). Each prediction batch now requests 4 CPU cores and 4 GiB of memory.

  Stop writing a wall-clock `prediction-date` REMARK into emitted PDBs. The timestamp made every PDB byte-different on every run, breaking the platforma backend's content-addressed caching — downstream nodes that consumed merged PDB ResourceMaps hit `CIDConflictError`. The other provenance REMARKs (immunebuilder version, torch seed, block version, numbering scheme) plus the seeded ensemble fully determine the prediction.

  Make the saved Python wrapper log byte-stable for identical inputs: drop the per-line UTC timestamp prefix and remove every wall-clock duration printed by `_log` (`predictor ready in Xs`, `predicted in Xs`, `elapsed=Xs`). The exec template saves stdout via `saveStdoutStream()` into the regular file output set, so its content hash flows into the resource CID; timestamped logs would re-introduce the same `CIDConflictError` failure mode as the PDB date.

  Set `stepCache: 30 * times.minute` on the `processColumn` call so per-batch outputs stay reachable for the dedup/recovery path across project re-renders, matching the convention used by mixcr-clonotyping and miltenyi-tcr-bcr-clonotyping.

  Add the species selector (spec R44): `human | mouse | camelid | rat | rabbit | other`, default `human`. Species is included in the block subtitle (R56) alongside the engine. The mode-info banner now splits into two cases: when the species is `camelid` and the light chain is unset we treat it as a true VHH input (informational); for any other species combined with heavy-only input we surface a warning that NanoBodyBuilder2's framework geometry is biased away from conventional VH. A separate warning fires for ABodyBuilder2 runs on species outside the training distribution (anything other than human or mouse). Species is held in `BlockData` only — the workflow does not consume it yet, so switching species does not invalidate cached predictions. Upstream clonotyping blocks do not propagate species through PColumn specs today, so the selector is user-supplied; once upstream wires `pl7.app/species` onto the clonotype-axis domain, this block can pre-fill the default.

## 1.0.4

### Patch Changes

- 7a0fedd: Fix docker permissions

## 1.0.3

### Patch Changes

- 53a03a1: Fix dependency resolution for docker

## 1.0.2

### Patch Changes

- 4f126ee: Use custom Dockerfile

## 1.0.1

### Patch Changes

- 9f63d06: Bump pdbfixer to dependencies
