# @platforma-open/milaboratories.3d-structure-prediction.workflow

## 1.2.1

### Patch Changes

- 49704f6: Rename clonotype row-axis label column header from "Clone" to "Clone Id" to match the upstream dataset label

## 1.2.0

### Minor Changes

- 37da856: Export only confident structures. The PDB ResourceMap now contains only confident clonotypes — prediction succeeded AND the selected error metric is within threshold — and the `confident` / `predictionSuccessful` subset filter columns are no longer exported. Downstream blocks consume confident structures directly, with no all-vs-confident selection to make. The results table still shows every clonotype and every column (confidence values, failure reasons, warnings); failed and unconfident clonotypes simply have no downloadable PDB. Confident filtering is applied once, in the Python wrapper's manifest, so the PDB map is built by the existing stable path (no post-hoc rebuild).

  Clonotypes whose prediction succeeded but whose error exceeds the confidence threshold now carry a failure reason — "Prediction confidence above threshold (<value> Å)" — so the table explains why they have no downloadable structure (their error values remain visible).

  Output column traces are now rooted in the Lead Selection filter when present, so predictions off the same dataset with different filters carry distinguishable provenance (dataset → lead selection → prediction) in downstream labels.

  The error-distribution histogram now shows the confidence threshold as a dashed vertical line (via a `pl7.app/graph/thresholds` annotation on the selected-metric column) — on the CDR-H3 page for the `cdrh3Mean` metric, or the Mean page for `overallMean`.

### Patch Changes

- Updated dependencies [37da856]
  - @platforma-open/milaboratories.3d-structure-prediction.software@1.1.0

## 1.1.2

### Patch Changes

- 8aeaff0: Load ImmuneBuilder model weights from a published Platforma asset (`immunebuilder-weights-assets`) instead of downloading them from Zenodo at runtime. The matching per-mode asset is mounted into each batch workdir and passed to ImmuneBuilder via `--weights-dir`. Removes the pre-warmup step, the per-batch warmup sentinel wiring, and the Docker image weight bake.
- Updated dependencies [8aeaff0]
  - @platforma-open/milaboratories.3d-structure-prediction.software@1.0.7

## 1.1.1

### Patch Changes

- 0979056: Species selector now starts unset and is genuinely required — removed the implicit "human" default and added an `.args()` gate so Run stays disabled until the user picks a species. Existing pre-species projects keep migrating to "human" so their Run stays unlocked. Accuracy-guidance banners no longer render with an empty species.

## 1.1.0

### Minor Changes

- 35caf17: Make subset columns (`confident`, `predictionSuccessful`) distinguishable per block instance. The spec domain now carries `pl7.app/structure/prediction/blockId`, so two 3D-prediction instances on the same dataset no longer collapse into one entry in downstream dataset selectors. The trace label uses the instance's `customBlockLabel` / `defaultBlockLabel` instead of the hardcoded `"3D Structure Prediction"`, so consumers can tell instances apart.

## 1.0.8

### Patch Changes

- 374ef16: Annotate the `pdbsMap` output column with `pl7.app/isAnchor: "true"` so downstream consumers can surface it as a primary dataset in `PlDatasetSelector` instead of `PlDropdownRef`. No behavior change for existing consumers.

## 1.0.7

### Patch Changes

- 49b6d30: Update workflow version
- Updated dependencies [49b6d30]
  - @platforma-open/milaboratories.3d-structure-prediction.software@1.0.6

## 1.0.6

### Patch Changes

- 0aae4c9: Add a pre-flight clonotype-count check. The prerun counts distinct clonotypes in the selected dataset (after the optional filter) and disables Run with an explanatory alert when the count exceeds 10 000.

## 1.0.5

### Patch Changes

- 4438d9d: Clarify NanoBodyBuilder2 usage in the settings panel: relabel the light chain dropdown as optional with a tooltip, and expand the mode-info alert to note that NanoBodyBuilder2 is camelid-VHH-trained, so for conventional heavy-only inputs (e.g. human bulk IGH-only) the produced structure has VHH-biased framework geometry.

  Drop the user-facing CPU and memory inputs (per-batch resources are fixed). Each prediction batch now requests 4 CPU cores and 4 GiB of memory.

  Stop writing a wall-clock `prediction-date` REMARK into emitted PDBs. The timestamp made every PDB byte-different on every run, breaking the platforma backend's content-addressed caching — downstream nodes that consumed merged PDB ResourceMaps hit `CIDConflictError`. The other provenance REMARKs (immunebuilder version, torch seed, block version, numbering scheme) plus the seeded ensemble fully determine the prediction.

  Make the saved Python wrapper log byte-stable for identical inputs: drop the per-line UTC timestamp prefix and remove every wall-clock duration printed by `_log` (`predictor ready in Xs`, `predicted in Xs`, `elapsed=Xs`). The exec template saves stdout via `saveStdoutStream()` into the regular file output set, so its content hash flows into the resource CID; timestamped logs would re-introduce the same `CIDConflictError` failure mode as the PDB date.

  Set `stepCache: 30 * times.minute` on the `processColumn` call so per-batch outputs stay reachable for the dedup/recovery path across project re-renders, matching the convention used by mixcr-clonotyping and miltenyi-tcr-bcr-clonotyping.

  Add the species selector (spec R44): `human | mouse | camelid | rat | rabbit | other`, default `human`. Species is included in the block subtitle (R56) alongside the engine. The mode-info banner now splits into two cases: when the species is `camelid` and the light chain is unset we treat it as a true VHH input (informational); for any other species combined with heavy-only input we surface a warning that NanoBodyBuilder2's framework geometry is biased away from conventional VH. A separate warning fires for ABodyBuilder2 runs on species outside the training distribution (anything other than human or mouse). Species is held in `BlockData` only — the workflow does not consume it yet, so switching species does not invalidate cached predictions. Upstream clonotyping blocks do not propagate species through PColumn specs today, so the selector is user-supplied; once upstream wires `pl7.app/species` onto the clonotype-axis domain, this block can pre-fill the default.

- Updated dependencies [4438d9d]
  - @platforma-open/milaboratories.3d-structure-prediction.software@1.0.5

## 1.0.4

### Patch Changes

- Updated dependencies [7a0fedd]
  - @platforma-open/milaboratories.3d-structure-prediction.software@1.0.4

## 1.0.3

### Patch Changes

- Updated dependencies [53a03a1]
  - @platforma-open/milaboratories.3d-structure-prediction.software@1.0.3

## 1.0.2

### Patch Changes

- Updated dependencies [4f126ee]
  - @platforma-open/milaboratories.3d-structure-prediction.software@1.0.2

## 1.0.1

### Patch Changes

- Updated dependencies [9f63d06]
  - @platforma-open/milaboratories.3d-structure-prediction.software@1.0.1
