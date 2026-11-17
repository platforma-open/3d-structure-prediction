---
"@platforma-open/milaboratories.3d-structure-prediction.model": patch
"@platforma-open/milaboratories.3d-structure-prediction.ui": patch
---

Run without the block's window being opened. The block's arguments waited for the clonotype count, and only an open window writes that count into the data. A block made from a project template, or started by "Run All", had no window to do it and was left out with "Checking dataset size…". A missing count now holds the run back only while a window is checking it, after a person changed the dataset, its subset or the heavy chain there. A count above 10,000 clonotypes holds the run back as before. The cost: a block that no window has opened runs without the size check.
