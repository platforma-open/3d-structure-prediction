---
'@platforma-open/milaboratories.3d-structure-prediction.model': patch
'@platforma-open/milaboratories.3d-structure-prediction.workflow': patch
'@platforma-open/milaboratories.3d-structure-prediction.software': patch
'@platforma-open/milaboratories.3d-structure-prediction.ui': patch
'@platforma-open/milaboratories.3d-structure-prediction': patch
---

Migrate to the latest block template and add the mandatory kind package

Refreshed onto block-tools 2.14.3 via `upgrade-sdk`, and added the `kind/`
package every block must now declare. The kind carries the block's identity
(`{name}@{version}`, read from its own `package.json`) and its init-params
contract.

`BlockParams` is the four settings that change what a prediction produces:
`mode`, `species`, `confidenceMetric` and `confidenceThresholdAngstroms`. All
are optional, so a project template can seed any subset and the model's `init`
keeps a default behind each. `.templateParams` projects the same four back, so
export and apply are inverses. Input selections are excluded by construction —
`dataset`, `heavyChainRef` and `lightChainRef` are anchor-bound references that
cannot travel between projects. The three setting vocabularies moved from
`model/src/types.ts` into the kind, which owns them; the model re-exports them
so every consumer keeps working.

Author-code fixes the upgrade required:

- `OutputColumnProvider` is gone from `@platforma-sdk/model`. The structures
  table now uses `AccessorColumnsProvider` (a memoised factory, not a
  constructor) and `getColumns()` / `getSpec()`.
- The test used the facade's old `blockSpec` export, which the slim facade
  replaced with a from-pack-v2 `BlockPointer`.
- `@platforma-sdk/ui-vue` is held at 1.83.0. 1.83.1 stopped publishing
  `dist/components/*.vue.d.ts` that its own `lib.d.ts` re-exports, and the slim
  facade inlines the model's whole public type surface, so `BlockData`'s
  `GraphMakerState` reaches those missing files through graph-maker and the
  facade build fails. Same pin and reason as `sequence-properties`.
- The model declares `@platforma-sdk/ui-vue` directly so graph-maker's peer
  resolves to the catalog version instead of floating to the newest published
  one.

The software package moves from `pl-pkg` to `block-tools software build`.
