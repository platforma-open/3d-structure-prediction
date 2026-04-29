# Overview

Predicts 3D structures of antibody variable domains directly from sequence, producing per-clonotype PDB files with residue-level confidence scores. Structure-based analysis becomes an integrated step in the discovery pipeline rather than an external detour: predicted structures feed downstream blocks for structural clustering, paratope analysis, structure-based liability assessment, and humanization without leaving Platforma.

The block uses [ImmuneBuilder](https://github.com/oxpig/ImmuneBuilder) — a deep-learning model trained on the SAbDab database that runs an ensemble of four predictors per antibody. **ABodyBuilder2** handles conventional paired antibodies (VH + VL) and is automatically engaged when both heavy and light chain sequence columns are available; **NanoBodyBuilder2** handles VHH nanobodies (heavy chain only) and is selected when no light chain is configured. ImmuneBuilder is fast (orders of magnitude faster than AlphaFold-Multimer for antibodies) and produces models comparable in CDR-H3 accuracy to experimental crystal structures.

Confidence is reported as the **per-residue ensemble disagreement in Ångströms** — the standard deviation of Cα positions across the four ensemble members. Lower values mean higher confidence; framework regions typically resolve to under 1 Å, while CDR-H3 (the most challenging loop) ranges from ~1 Å for short loops to several Å for long, flexible ones. The block exports both whole-structure and per-CDR aggregates, so users can filter on the loop quality that matters for their downstream task. A user-configurable confidence threshold (default 2.5 Å on CDR-H3) flags benchmark-quality predictions and produces a `confident` subset column for direct use in lead selection or clustering.

Predicted structures are IMGT-numbered with CDR boundary annotations baked into each PDB, so downstream blocks consume them without re-running ANARCI. The block also tracks per-row outcomes — sanitization rejections, signal-peptide warnings, long-CDR-H3 flags, and prediction failures — so quality issues surface in the table rather than silently corrupting downstream analysis.

ImmuneBuilder is developed by the [Oxford Protein Informatics Group](https://www.stats.ox.ac.uk/research/oxford-protein-informatics-group). For more information, please see: [https://github.com/oxpig/ImmuneBuilder](https://github.com/oxpig/ImmuneBuilder) and cite the following publication if used in your research:

> Abanades B, Wong WK, Boyles F, Georges G, Bujotzek A, Deane CM. *ImmuneBuilder: Deep-Learning models for predicting the structures of immune proteins.* Communications Biology, 6, 575 (2023). [https://doi.org/10.1038/s42003-023-04927-7](https://doi.org/10.1038/s42003-023-04927-7)

Residue numbering uses [ANARCI](https://github.com/oxpig/ANARCI):

> Dunbar J and Deane CM. *ANARCI: antigen receptor numbering and receptor classification.* Bioinformatics, 32(2):298-300 (2016). [https://doi.org/10.1093/bioinformatics/btv552](https://doi.org/10.1093/bioinformatics/btv552)
