---
'@platforma-open/milaboratories.3d-structure-prediction.model': patch
'@platforma-open/milaboratories.3d-structure-prediction.ui': patch
'@platforma-open/milaboratories.3d-structure-prediction.workflow': patch
---

Species selector now starts unset and is genuinely required — removed the implicit "human" default and added an `.args()` gate so Run stays disabled until the user picks a species. Existing pre-species projects keep migrating to "human" so their Run stays unlocked. Accuracy-guidance banners no longer render with an empty species.