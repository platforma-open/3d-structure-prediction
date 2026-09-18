---
'@platforma-open/milaboratories.3d-structure-prediction.workflow': patch
'@platforma-open/milaboratories.3d-structure-prediction': patch
---

Keep the echoed Clone Id label out of the result pool

The block echoes the dataset's `pl7.app/label` column into its structures frame, so its own table
can show Clone Id on the clonotype rows. That frame also went to `exports`, which put a second
`pl7.app/label` column for the clonotype axis into the result pool.

A downstream block that asks for "the label column on this axis" then gets two answers. The copy
covers only the clonotypes this run predicted, so picking it loses labels for every other record.
3D Structure Clustering hit this and fell back to the raw clonotype key. Structure-Based
Liabilities showed two Clone Id columns.

The label column now goes to `outputs` only. The block's own table is unchanged, and the pool holds
just the source column again.
