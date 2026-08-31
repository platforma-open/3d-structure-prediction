# @platforma-open/milaboratories.3d-structure-prediction.ui

## 1.1.11

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

- Updated dependencies [cf1b0d2]
- Updated dependencies [87ed719]
  - @platforma-open/milaboratories.3d-structure-prediction.model@1.2.1

## 1.1.10

### Patch Changes

- Updated dependencies [2c439e0]
  - @platforma-open/milaboratories.3d-structure-prediction.model@1.2.0

## 1.1.9

### Patch Changes

- 9f50d67: Remove the pre-flight prerun; derive the clonotype-count size check synchronously in the model.

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

- Updated dependencies [9f50d67]
  - @platforma-open/milaboratories.3d-structure-prediction.model@1.1.4

## 1.1.8

### Patch Changes

- 4da9f99: Migrate block onto the structurer (block-tools 2.11.0). Adopts the canonical tool-managed
  layout — tsconfig, oxlint/oxfmt, turbo, block index, workflow/test config — and bumps the SDK
  to latest (model/ui-vue 1.79.x, workflow-tengo 6.6.2, tengo-builder 4.0.8, @platforma-sdk/test
  1.79.12). Adds the root `upgrade-sdk` script for future SDK upgrades.
- Updated dependencies [4da9f99]
  - @platforma-open/milaboratories.3d-structure-prediction.model@1.1.3

## 1.1.7

### Patch Changes

- 671e8b8: Fix species/mode warning banners flashing a stale prediction mode

  The accuracy warning banners now read the executed mode (`data.mode`) instead of
  a lagging server-derived output, and mode auto-selection is keyed on the instant
  local light-chain selection. Picking a species (e.g. camelid) no longer briefly
  shows the ABodyBuilder2 "human and mouse" warning, and a manual override in
  Advanced settings now sticks until the light chain selection next changes.

- Updated dependencies [671e8b8]
  - @platforma-open/milaboratories.3d-structure-prediction.model@1.1.2

## 1.1.6

### Patch Changes

- 0979056: Species selector now starts unset and is genuinely required — removed the implicit "human" default and added an `.args()` gate so Run stays disabled until the user picks a species. Existing pre-species projects keep migrating to "human" so their Run stays unlocked. Accuracy-guidance banners no longer render with an empty species.
- Updated dependencies [0979056]
  - @platforma-open/milaboratories.3d-structure-prediction.model@1.1.1

## 1.1.5

### Patch Changes

- Updated dependencies [35caf17]
  - @platforma-open/milaboratories.3d-structure-prediction.model@1.1.0

## 1.1.4

### Patch Changes

- 49b6d30: Update workflow version
- Updated dependencies [49b6d30]
  - @platforma-open/milaboratories.3d-structure-prediction.model@1.0.4

## 1.1.3

### Patch Changes

- 0aae4c9: Add a pre-flight clonotype-count check. The prerun counts distinct clonotypes in the selected dataset (after the optional filter) and disables Run with an explanatory alert when the count exceeds 10 000.
- Updated dependencies [0aae4c9]
  - @platforma-open/milaboratories.3d-structure-prediction.model@1.0.3

## 1.1.2

### Patch Changes

- ffe0150: SDK Update
- Updated dependencies [ffe0150]
  - @platforma-open/milaboratories.3d-structure-prediction.model@1.0.2

## 1.1.1

### Patch Changes

- 4438d9d: Clarify NanoBodyBuilder2 usage in the settings panel: relabel the light chain dropdown as optional with a tooltip, and expand the mode-info alert to note that NanoBodyBuilder2 is camelid-VHH-trained, so for conventional heavy-only inputs (e.g. human bulk IGH-only) the produced structure has VHH-biased framework geometry.

  Drop the user-facing CPU and memory inputs (per-batch resources are fixed). Each prediction batch now requests 4 CPU cores and 4 GiB of memory.

  Stop writing a wall-clock `prediction-date` REMARK into emitted PDBs. The timestamp made every PDB byte-different on every run, breaking the platforma backend's content-addressed caching — downstream nodes that consumed merged PDB ResourceMaps hit `CIDConflictError`. The other provenance REMARKs (immunebuilder version, torch seed, block version, numbering scheme) plus the seeded ensemble fully determine the prediction.

  Make the saved Python wrapper log byte-stable for identical inputs: drop the per-line UTC timestamp prefix and remove every wall-clock duration printed by `_log` (`predictor ready in Xs`, `predicted in Xs`, `elapsed=Xs`). The exec template saves stdout via `saveStdoutStream()` into the regular file output set, so its content hash flows into the resource CID; timestamped logs would re-introduce the same `CIDConflictError` failure mode as the PDB date.

  Set `stepCache: 30 * times.minute` on the `processColumn` call so per-batch outputs stay reachable for the dedup/recovery path across project re-renders, matching the convention used by mixcr-clonotyping and miltenyi-tcr-bcr-clonotyping.

  Add the species selector (spec R44): `human | mouse | camelid | rat | rabbit | other`, default `human`. Species is included in the block subtitle (R56) alongside the engine. The mode-info banner now splits into two cases: when the species is `camelid` and the light chain is unset we treat it as a true VHH input (informational); for any other species combined with heavy-only input we surface a warning that NanoBodyBuilder2's framework geometry is biased away from conventional VH. A separate warning fires for ABodyBuilder2 runs on species outside the training distribution (anything other than human or mouse). Species is held in `BlockData` only — the workflow does not consume it yet, so switching species does not invalidate cached predictions. Upstream clonotyping blocks do not propagate species through PColumn specs today, so the selector is user-supplied; once upstream wires `pl7.app/species` onto the clonotype-axis domain, this block can pre-fill the default.

- Updated dependencies [4438d9d]
  - @platforma-open/milaboratories.3d-structure-prediction.model@1.0.1

## 1.1.0

### Minor Changes

- 1c6cabd: Open a 3D structure preview on row click. Adds a slide-modal that renders the predicted PDB via `<PlStructureViewer>` from `@milaboratories/structure-viewer`, with a single-PDB download inside the modal. Bulk export keeps its existing toolbar button.

## 1.0.1

### Patch Changes

- 18ecc0d: Remove duplicated plot headers
