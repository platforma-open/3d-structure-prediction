---
'@platforma-open/milaboratories.3d-structure-prediction.model': patch
'@platforma-open/milaboratories.3d-structure-prediction.ui': patch
'@platforma-open/milaboratories.3d-structure-prediction.workflow': patch
'@platforma-open/milaboratories.3d-structure-prediction.software': patch
---

Migrate block onto the structurer (block-tools 2.11.0). Adopts the canonical tool-managed
layout — tsconfig, oxlint/oxfmt, turbo, block index, workflow/test config — and bumps the SDK
to latest (model/ui-vue 1.79.x, workflow-tengo 6.6.2, tengo-builder 4.0.8, @platforma-sdk/test
1.79.12). Adds the root `upgrade-sdk` script for future SDK upgrades.