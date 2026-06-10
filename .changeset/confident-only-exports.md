---
'@platforma-open/milaboratories.3d-structure-prediction.workflow': minor
'@platforma-open/milaboratories.3d-structure-prediction.software': minor
'@platforma-open/milaboratories.3d-structure-prediction': minor
---

Export only confident structures. The PDB ResourceMap now contains only confident clonotypes — prediction succeeded AND the selected error metric is within threshold — and the `confident` / `predictionSuccessful` subset filter columns are no longer exported. Downstream blocks consume confident structures directly, with no all-vs-confident selection to make. The results table still shows every clonotype and every column (confidence values, failure reasons, warnings); failed and unconfident clonotypes simply have no downloadable PDB. Confident filtering is applied once, in the Python wrapper's manifest, so the PDB map is built by the existing stable path (no post-hoc rebuild).

Clonotypes whose prediction succeeded but whose error exceeds the confidence threshold now carry a failure reason — "Prediction confidence above threshold (<value> Å)" — so the table explains why they have no downloadable structure (their error values remain visible).

Output column traces are now rooted in the Lead Selection filter when present, so predictions off the same dataset with different filters carry distinguishable provenance (dataset → lead selection → prediction) in downstream labels.
