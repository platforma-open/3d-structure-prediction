---
'@platforma-open/milaboratories.3d-structure-prediction.ui': patch
'@platforma-open/milaboratories.3d-structure-prediction.model': patch
---

Fix species/mode warning banners flashing a stale prediction mode

The accuracy warning banners now read the executed mode (`data.mode`) instead of
a lagging server-derived output, and mode auto-selection is keyed on the instant
local light-chain selection. Picking a species (e.g. camelid) no longer briefly
shows the ABodyBuilder2 "human and mouse" warning, and a manual override in
Advanced settings now sticks until the light chain selection next changes.
