# syntax=docker/dockerfile:1
#
# Cloud-side image for the 3D-structure-prediction block.
#
# Why this exists: pl-pkg's auto-generated Dockerfile uses python:3.12-slim
# and installs only requirements.txt deps. ImmuneBuilder relies at import
# time on `anarci` and `pdbfixer`, neither of which are usable from PyPI
# (anarci is yanked; pdbfixer is sdist-only and lacks several runtime
# pieces). Locally the runenv ships hand-bundled anarci + HMMER + databases;
# the cloud autogen ignores all that. This Dockerfile closes the gap by
# pulling those packages from bioconda, then layering ImmuneBuilder + torch
# via pip on top.
#
# pl-pkg invokes `docker build <context> -f Dockerfile`. Context is set to
# `src_python` in package.json, so all COPY paths below are relative to
# software/src_python/.

FROM mambaorg/micromamba:1.5.10

USER root

# anarci and hmmer are deliberately left unpinned: bioconda's recipe builds
# the HMM database at install time and the database depends on the HMMER
# version, so locking the hash for both pkgs at once is fragile across
# bioconda updates. After the first successful CI build, run
#   micromamba list -n base anarci hmmer
# inside the image and copy the resulting build strings here if you need
# bit-identical reproducibility.
RUN micromamba install -y -n base -c bioconda -c conda-forge \
        python=3.12.10 \
        anarci \
        hmmer \
        biopython=1.85 \
        openmm=8.3.1 \
        pdbfixer=1.12.0 \
        numpy=2.4.3 \
        scipy=1.17.1 \
    && micromamba clean --all --yes

# Activate the base env for every subsequent RUN/CMD layer so pip and
# python resolve to /opt/conda/{bin,lib}.
ARG MAMBA_DOCKERFILE_ACTIVATE=1
ENV PATH=/opt/conda/bin:$PATH

# Make conda's libstdc++ (and friends) win over the older system libs in
# /lib/x86_64-linux-gnu. Pip-installed extension wheels (manylinux2014+)
# expect a recent CXXABI; the base image's system libstdc++ predates it.
ENV LD_LIBRARY_PATH=/opt/conda/lib

# Layer pip-only deps (ImmuneBuilder + CPU torch). Anything bioconda
# already provides is re-resolved by pip; pinned versions in
# requirements.txt match the conda packages so this is a no-op for those.
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir \
        --extra-index-url https://download.pytorch.org/whl/cpu \
        -r /tmp/requirements.txt

# Block sources (everything in src_python/).
WORKDIR /app
COPY . /app/
ENV PYTHONPATH=/app

CMD ["python", "/app/run_immunebuilder.py"]