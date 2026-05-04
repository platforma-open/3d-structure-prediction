# PlDatasetSelector follow-up plan

Three observed problems in the 3D-structure-prediction block, all rooted in the
SDK's `buildDatasetOptions`. Tracked against
[Phase 05: Filter Column API](../../docs/text/work/projects/pframes-api/05-filter-column-api.md).

## Problems

1. **Filters from the block itself appear in the dropdown.** After the block runs,
   its own subset PColumns (`subset/confident`, `subset/predictionSuccessful`,
   annotated `pl7.app/isSubset: "true"`) match filter discovery against the
   selected dataset.
2. **No block-side API to restrict filter eligibility.** `buildDatasetOptions`
   exposes `primary` and `withEnrichments` predicates but none for filters.
   The block has to post-filter the returned `DatasetOption[]`.
3. **Filter dropdown disappears after the block runs.** The post-run state
   makes `buildDatasetOptions` throw, and the model's try/catch falls back to
   a no-filter list.

## Root cause

`buildDatasetOptions`
(`platforma/sdk/model/src/components/PlDatasetSelector/build_dataset_options.ts:45`)
builds its `ColumnCollection` from `collectCtxColumnSnapshotProviders(ctx)`,
which unions `ctx.outputs` + `ctx.prerun` + `ctx.resultPool`
(`ctx_column_sources.ts:17-33`).

Filter discovery runs against that union. Two consequences:

- Block outputs annotated `pl7.app/isSubset: "true"` enter the candidate set.
- `filterMatchesToOptions` then throws — `buildRefMap` is built from
  `ctx.resultPool.getSpecs().entries` only, so block-output columns have no
  PlRef. `filter_discovery.ts:60-62` raises
  `no PlRef found for filter column …`.

The current 3D model wraps `buildDatasetOptions` in try/catch and degrades to
a plain dataset list (`model/src/index.ts:164-210`) — exactly the
"selector disappears" symptom.

## Proposed SDK changes

All in `platforma/sdk/model/src/components/PlDatasetSelector/`.

### A. Scope filter discovery to the result pool

Filters are user-selectable inputs; they must have a PlRef. Build a separate
`ColumnCollection` for filter discovery sourced from the result pool only
(`ResultPoolColumnSnapshotProvider`). Drop `ctx.outputs` / `ctx.prerun` from
the filter path.

Enrichment discovery keeps the union — enrichments are resolved by spec, not
by ref, so missing PlRefs are irrelevant there.

Resolves problems 1 and 3.

### B. Add a `filters` predicate to `BuildDatasetOptions`

```ts
type BuildDatasetOptions = {
  primary?: ...;
  withEnrichments?: ...;
  // NEW — same shape as primary/withEnrichments
  filters?:
    | MultiColumnSelector
    | MultiColumnSelector[]
    | ((spec: PObjectSpec) => boolean);
  labelOptions?: DeriveLabelsOptions;
  enrichmentMaxHops?: number;
};
```

Default = accept all. Predicate is intersected with the existing
`pl7.app/isSubset: "true"` constraint inside `findFilterColumns`.

Resolves problem 2.

### C. Make `filterMatchesToOptions` defensive

Drop entries whose `refsByObjectId.get(...)` returns `undefined` instead of
throwing. Defence in depth — change A removes the known trigger, but a silent
skip is the correct behaviour for "cannot expose this as a selectable
option" regardless of source. Removes the need for any try/catch in callers.

### D. (Deferred) Filter-label algorithm

Open Question in spec line 111. The lead-selection case is covered by
`pl7.app/label` + trace-derived label. Revisit when a block needs cross-axis
provenance.

## Block-side cleanup (after SDK lands)

Replace `model/src/index.ts:164-210` (the try/catch + post-filter loop) with:

```ts
.output("datasetOptions", (ctx) =>
  buildDatasetOptions(ctx, {
    primary: (spec) =>
      isPColumnSpec(spec)
      && spec.annotations?.["pl7.app/isAnchor"] === "true"
      && spec.axesSpec[0]?.name === "pl7.app/sampleId"
      && (spec.axesSpec[1]?.name === "pl7.app/vdj/clonotypeKey"
        || spec.axesSpec[1]?.name === "pl7.app/vdj/scClonotypeKey"),
    filters: (spec) =>
      readTrace(spec.annotations).some(
        (e) => e.type === LEAD_SELECTION_TRACE_TYPE,
      ),
  }),
)
```

`leadSelectionLabel()` overrides remain a separate concern — handled either by
a future `labelOptions` callback or a thin `.map` over the result. Not in
scope here.

## Scope

- In: SDK changes A + B + C; integration-test block update; 3D block migration.
- Out: filter-label algorithm rework (D); changes to
  `PlDatasetSelector.vue` (the Vue component is correct — the bug is upstream).

Backwards-compatible: callers without a `filters` predicate keep current
behaviour minus the spurious self-filter pollution.

## Acceptance

- 3D block: filter dropdown stays populated with lead-selection filters before
  and after a run.
- 3D block: model uses `filters:` predicate; no try/catch around
  `buildDatasetOptions`.
- `etc/blocks/filter-column-test`: still works unchanged (no `filters`
  predicate set — accepts all).
- SDK tests cover: filter discovery ignores `ctx.outputs` columns; `filters`
  predicate narrows results; `filterMatchesToOptions` skips ref-less entries.
