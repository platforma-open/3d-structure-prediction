---
'@platforma-open/milaboratories.3d-structure-prediction.model': minor
'@platforma-open/milaboratories.3d-structure-prediction.ui': minor
'@platforma-open/milaboratories.3d-structure-prediction': minor
---

Warn when the input defines sub-regions, and when any prediction fails

Two advisory alerts. Neither gates Run, and neither needs a workflow change, so
projects already computed benefit without re-running.

**Sub-regions in the input.** A synthetic-repertoire-profiler run whose region
partition has children produces variants that are designed constructs — a grafted
insert occupying a CDR slot, say — rather than plain V domains. ImmuneBuilder and
the ANARCI numbering step it relies on assume canonical VDJ architecture, so such
sequences may fold with unreliable geometry. The alert sits under the dataset
selector, where its cause is, and appears before the user works down to Run.

The check is spec-only. The profiler emits its
`pl7.app/repertoire/subdividedRegions` column *only* when some parent actually
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
