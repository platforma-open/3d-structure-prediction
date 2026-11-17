# @platforma-open/milaboratories.3d-structure-prediction.kind

## 1.1.0

### Minor Changes

- 18ff332: Keep the input dataset and the chains in a project template. A project made from a template came with 3D Structure Prediction without its dataset and chain columns, so they had to be picked by hand. The kind now carries `dataset`, `heavyChainRef` and `lightChainRef`, and the block made from a template points at the dataset and the sequence columns the original project folded.
