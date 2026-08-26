---
'@platforma-open/milaboratories.3d-structure-prediction.model': patch
'@platforma-open/milaboratories.3d-structure-prediction': patch
---

Accept synthetic-repertoire-profiler VDJ datasets

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
