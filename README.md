# 3D Structure Prediction

Predict 3D structures of antibody and nanobody variable domains directly from sequence. This Platforma block runs ImmuneBuilder over your clonotypes and produces IMGT-numbered per-clonotype PDB files with per-residue confidence in Ångströms, ready for structural developability analysis.

Open-source analysis block for Platforma, the biologics discovery platform by MiLaboratories. For the full no-code workflow, see [platforma.bio](https://platforma.bio/).

## What it does

Structure answers questions sequence cannot — whether a liability motif is actually solvent-exposed, how hydrophobic the surface around the CDRs really is, whether a cysteine is bonded. Getting there used to mean a crystallography campaign or an expensive general-purpose folding run. ImmuneBuilder makes it a routine step: it is trained specifically on antibody structures from SAbDab, runs orders of magnitude faster than AlphaFold-Multimer on this problem, and reaches CDR-H3 accuracy comparable to experimental structures.

The block picks the model from your input. Configure a heavy chain and a light chain and it uses **ABodyBuilder2** for conventional paired antibodies; configure a heavy chain alone and it uses **NanoBodyBuilder2** for VHH nanobodies. You can override the choice if needed.

Each prediction runs an ensemble of four predictors, and the spread between them is the confidence measure: **per-residue ensemble disagreement**, reported as the standard deviation of Cα positions in Ångströms. Lower is better. Framework regions typically resolve under 1 Å; CDR-H3, the hardest loop, ranges from roughly 1 Å for short loops to several Å for long flexible ones. Confidence is exported at whole-structure level, per CDR, and per residue, so you can filter on the loop that matters for your downstream question rather than on a single global number.

A confidence threshold — by default 2.5 Å on CDR-H3 mean error, switchable to overall mean — decides which predictions are exported as structures. Confidence metrics are reported for every clonotype either way, so a candidate that missed the threshold is visible along with the reason, rather than silently vanishing.

Quality problems are surfaced rather than swallowed. Sequences are sanitized before prediction, and every row carries plain-text **Failure reason** and **Warnings** columns: empty or out-of-range sequences, mid-sequence stop codons, non-standard residues, probable signal peptides left on the VH, unusually long CDR-H3 loops, and VHH inputs missing the camelid hallmark residues. Those show up in the table where you can act on them.

Predicted structures are IMGT-numbered with CDR boundaries written into each PDB, which is what lets downstream structural analysis attribute a finding to a specific region.

## Inputs & outputs

* **Input:** a V(D)J clonotype dataset with full variable-region amino acid sequences — a heavy chain column, and optionally a light chain column, whose presence selects the paired-antibody model. Species is selected from human, mouse, camelid, rat, rabbit, or other.
* **Output:** per-clonotype PDB structures for predictions meeting the confidence threshold; mean error and per-CDR error in Ångströms (CDR-H1/H2/H3, plus CDR-L1/L2/L3 for paired input); per-residue error; CDR-H3 length; and Failure reason and Warnings columns. Confidence distributions are plotted for mean error and CDR-H3 error.

## Specifications

| | |
|---|---|
| Block title in app | 3D Structure Prediction |
| Engine | [ImmuneBuilder](https://github.com/oxpig/ImmuneBuilder) — ABodyBuilder2 for paired VH + VL, NanoBodyBuilder2 for VHH |
| Model selection | Automatic from configured chains; manual override available |
| Species | Human, mouse, camelid (VHH/nanobody), rat, rabbit, other |
| Confidence measure | Per-residue ensemble disagreement (standard deviation of Cα positions across four ensemble members), in Ångströms |
| Confidence filter | CDR-H3 mean or overall mean, with a user-set threshold (default 2.5 Å) |
| Numbering | IMGT, via [ANARCI](https://github.com/oxpig/ANARCI), with CDR boundaries written into each PDB |
| Other settings | Batch size, random seed |
| Outputs | Per-clonotype PDB, mean and per-CDR error, per-residue error, CDR-H3 length, failure reasons, warnings |

## Use cases

* **Structural developability:** feed predicted structures into [3D Structure-Based Liabilities](https://github.com/platforma-open/3D-Structure-Based-Liabilities) to filter liability motifs by solvent exposure and compute surface hydrophobicity and charge-patch metrics.
* **Exposure-aware liability triage:** distinguish a buried motif from an exposed one, which sequence scanning cannot do.
* **Nanobody modeling:** predict VHH structures with a model built for single-domain formats rather than one calibrated on paired antibodies.
* **Confidence-gated selection:** advance only candidates whose CDR-H3 is modeled well enough to support structural conclusions.
* **Input QC:** catch signal peptides, truncated sequences, and non-standard residues before they propagate downstream.
* **Structure export:** obtain IMGT-numbered PDB files for use in external structural tools or visualization.

## FAQ

### Why ImmuneBuilder rather than a general-purpose structure predictor?

It is specialized for antibodies, which makes it both far faster and, on this problem, at least as accurate. Running a general folding model over thousands of clonotypes is impractical; ImmuneBuilder makes per-clonotype prediction across a whole repertoire feasible.

### What does the confidence value actually mean?

Each prediction is made by four models. The reported value is how much they disagree about where each Cα atom sits, in Ångströms. Broad agreement means the region is well determined; wide spread means the model is uncertain — typically in long, flexible CDR-H3 loops. It is a measure of model self-consistency, not a validation against an experimental structure.

### What happens to predictions below the confidence threshold?

Their confidence metrics, CDR-H3 length, and any warnings are still reported, so you can see them and why they scored as they did. Only predictions meeting the threshold are exported as PDB structures, which keeps low-confidence models from being used as though they were reliable.

### Which threshold should I use?

The default — 2.5 Å on CDR-H3 mean error — is a reasonable benchmark-quality bar, since CDR-H3 is the hardest loop and usually the region downstream analysis cares about. Switch to overall mean when the whole domain matters more than the binding loop, and loosen or tighten the value according to how much structural precision your downstream question needs.

### How do I predict nanobodies?

Configure only a heavy chain column. The block selects NanoBodyBuilder2 automatically. Set species to camelid so the VHH hallmark check applies.

### What are the warning columns telling me?

That something about the input is unusual but not fatal: a probable signal peptide still attached to the VH, a CDR-H3 long enough that prediction is harder, or a VHH lacking the camelid hallmark residues. Predictions still run; the warning tells you to weigh the result accordingly. Failure reasons, by contrast, mark rows that could not be predicted at all — empty sequences, mid-sequence stop codons, non-standard residues, or lengths outside the workable range.

### Does it need a GPU?

No. Predictions run on CPU, batched across clonotypes, with batch size configurable.

### Are results reproducible?

Yes, given the same input and seed. The random seed is exposed in advanced settings.

## Citation

If you use this block in your research, please cite ImmuneBuilder and ANARCI:

> Abanades, B., Wong, W. K., Boyles, F., Georges, G., Bujotzek, A., & Deane, C. M. (2023). ImmuneBuilder: Deep-Learning models for predicting the structures of immune proteins. *Communications Biology* **6**, 575. [https://doi.org/10.1038/s42003-023-04927-7](https://doi.org/10.1038/s42003-023-04927-7)

> Dunbar, J., & Deane, C. M. (2016). ANARCI: antigen receptor numbering and receptor classification. *Bioinformatics* **32**(2), 298–300. [https://doi.org/10.1093/bioinformatics/btv552](https://doi.org/10.1093/bioinformatics/btv552)

## Part of the Platforma ecosystem

This block is part of [Platforma](https://platforma.bio/) by [MiLaboratories](https://github.com/milaboratory), built on [ImmuneBuilder](https://github.com/oxpig/ImmuneBuilder) and [ANARCI](https://github.com/oxpig/ANARCI) from the [Oxford Protein Informatics Group](https://www.stats.ox.ac.uk/research/oxford-protein-informatics-group). Explore the other open-source blocks at [github.com/platforma-open](https://github.com/platforma-open) and the docs for antibody discovery at [docs.platforma.bio/biology-guides/antibody-discovery](https://docs.platforma.bio/biology-guides/antibody-discovery/).
