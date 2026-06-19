# @platforma-open/milaboratories.3d-structure-prediction.model

## 1.1.3

### Patch Changes

- 4da9f99: Migrate block onto the structurer (block-tools 2.11.0). Adopts the canonical tool-managed
  layout — tsconfig, oxlint/oxfmt, turbo, block index, workflow/test config — and bumps the SDK
  to latest (model/ui-vue 1.79.x, workflow-tengo 6.6.2, tengo-builder 4.0.8, @platforma-sdk/test
  1.79.12). Adds the root `upgrade-sdk` script for future SDK upgrades.

## 1.1.2

### Patch Changes

- 671e8b8: Fix species/mode warning banners flashing a stale prediction mode

  The accuracy warning banners now read the executed mode (`data.mode`) instead of
  a lagging server-derived output, and mode auto-selection is keyed on the instant
  local light-chain selection. Picking a species (e.g. camelid) no longer briefly
  shows the ABodyBuilder2 "human and mouse" warning, and a manual override in
  Advanced settings now sticks until the light chain selection next changes.

## 1.1.1

### Patch Changes

- 0979056: Species selector now starts unset and is genuinely required — removed the implicit "human" default and added an `.args()` gate so Run stays disabled until the user picks a species. Existing pre-species projects keep migrating to "human" so their Run stays unlocked. Accuracy-guidance banners no longer render with an empty species.

## 1.1.0

### Minor Changes

- 35caf17: Make subset columns (`confident`, `predictionSuccessful`) distinguishable per block instance. The spec domain now carries `pl7.app/structure/prediction/blockId`, so two 3D-prediction instances on the same dataset no longer collapse into one entry in downstream dataset selectors. The trace label uses the instance's `customBlockLabel` / `defaultBlockLabel` instead of the hardcoded `"3D Structure Prediction"`, so consumers can tell instances apart.

## 1.0.4

### Patch Changes

- 49b6d30: Update workflow version

## 1.0.3

### Patch Changes

- 0aae4c9: Add a pre-flight clonotype-count check. The prerun counts distinct clonotypes in the selected dataset (after the optional filter) and disables Run with an explanatory alert when the count exceeds 10 000.

## 1.0.2

### Patch Changes

- ffe0150: SDK Update

## 1.0.1

### Patch Changes

- 4438d9d: Clarify NanoBodyBuilder2 usage in the settings panel: relabel the light chain dropdown as optional with a tooltip, and expand the mode-info alert to note that NanoBodyBuilder2 is camelid-VHH-trained, so for conventional heavy-only inputs (e.g. human bulk IGH-only) the produced structure has VHH-biased framework geometry.

  Drop the user-facing CPU and memory inputs (per-batch resources are fixed). Each prediction batch now requests 4 CPU cores and 4 GiB of memory.

  Stop writing a wall-clock `prediction-date` REMARK into emitted PDBs. The timestamp made every PDB byte-different on every run, breaking the platforma backend's content-addressed caching — downstream nodes that consumed merged PDB ResourceMaps hit `CIDConflictError`. The other provenance REMARKs (immunebuilder version, torch seed, block version, numbering scheme) plus the seeded ensemble fully determine the prediction.

  Make the saved Python wrapper log byte-stable for identical inputs: drop the per-line UTC timestamp prefix and remove every wall-clock duration printed by `_log` (`predictor ready in Xs`, `predicted in Xs`, `elapsed=Xs`). The exec template saves stdout via `saveStdoutStream()` into the regular file output set, so its content hash flows into the resource CID; timestamped logs would re-introduce the same `CIDConflictError` failure mode as the PDB date.

  Set `stepCache: 30 * times.minute` on the `processColumn` call so per-batch outputs stay reachable for the dedup/recovery path across project re-renders, matching the convention used by mixcr-clonotyping and miltenyi-tcr-bcr-clonotyping.

  Add the species selector (spec R44): `human | mouse | camelid | rat | rabbit | other`, default `human`. Species is included in the block subtitle (R56) alongside the engine. The mode-info banner now splits into two cases: when the species is `camelid` and the light chain is unset we treat it as a true VHH input (informational); for any other species combined with heavy-only input we surface a warning that NanoBodyBuilder2's framework geometry is biased away from conventional VH. A separate warning fires for ABodyBuilder2 runs on species outside the training distribution (anything other than human or mouse). Species is held in `BlockData` only — the workflow does not consume it yet, so switching species does not invalidate cached predictions. Upstream clonotyping blocks do not propagate species through PColumn specs today, so the selector is user-supplied; once upstream wires `pl7.app/species` onto the clonotype-axis domain, this block can pre-fill the default.
