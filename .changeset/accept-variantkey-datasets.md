---
'@platforma-open/milaboratories.3d-structure-prediction.model': minor
'@platforma-open/milaboratories.3d-structure-prediction': minor
---

Accept imported antibody sets keyed on `pl7.app/variantKey`

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
