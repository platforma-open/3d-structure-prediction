import type {
  AnchoredPColumnSelector,
  AxisId,
  DatasetOption,
  DatasetSelection,
  InferOutputsType,
  PColumnIdAndSpec,
  PFrameHandle,
  PlDataTableModel,
  PlRef,
  PObjectSpec,
} from "@platforma-sdk/model";
import {
  BlockModelV3,
  buildDatasetOptions,
  createPFrameForGraphs,
  createPlDataTableV3,
  isPColumnSpec,
  OutputColumnProvider,
  parseResourceMap,
} from "@platforma-sdk/model";
import { blockDataModel } from "./dataModel";
import type { BlockArgs, BlockData, PredictionSummary } from "./types";

/** Extract the user-picked primary column PlRef from a `DatasetSelection`. */
function datasetColumnRef(dataset: DatasetSelection | undefined): PlRef | undefined {
  return dataset?.primary.column;
}

/**
 * Source-block trace marker that flags filters originating from antibody-tcr
 * Lead Selection — those are the only ones we want to surface as filter
 * options on the 3D-structure-prediction dataset selector.
 */
const LEAD_SELECTION_TRACE_TYPE = "milaboratories.antibody-tcr-lead-selection";

function hasLeadSelectionTrace(annotations: Record<string, string> | undefined): boolean {
  const raw = annotations?.["pl7.app/trace"];
  if (!raw) return false;
  try {
    const parsed: unknown = JSON.parse(raw);
    return (
      Array.isArray(parsed) &&
      parsed.some(
        (e) =>
          typeof e === "object" &&
          e !== null &&
          (e as { type?: unknown }).type === LEAD_SELECTION_TRACE_TYPE,
      )
    );
  } catch {
    return false;
  }
}

export * from "./types";
export { blockDataModel } from "./dataModel";

/**
 * Maximum number of distinct clonotypes the block is allowed to run on.
 * Above this, the prerun gate trips and `.args()` throws so the Run button
 * stays disabled. Exposed so the UI can show the same number in the alert.
 */
export const MAX_CLONOTYPES = 10_000;

export const confidenceMetricOptions = [
  { label: "CDR-H3 mean", value: "cdrh3Mean" },
  { label: "Overall mean", value: "overallMean" },
] as const;

export const predictionModeOptions = [
  { label: "ABodyBuilder2 (VH + VL)", value: "ABodyBuilder2" },
  { label: "NanoBodyBuilder2 (VHH / VH only)", value: "NanoBodyBuilder2" },
] as const;

export const speciesOptions = [
  { label: "Human", value: "human" },
  { label: "Mouse", value: "mouse" },
  { label: "Camelid (VHH/nanobody)", value: "camelid" },
  { label: "Rat", value: "rat" },
  { label: "Rabbit", value: "rabbit" },
  { label: "Other", value: "other" },
] as const;

const VDJ_FEATURES = ["VDJRegion", "VDJRegionInFrame"];

/**
 * AA sequence column matchers anchored to the selected dataset's clonotype axis.
 * For single-cell data, restrict to "primary" chains so only one heavy + one light
 * column appears per chain class.
 */
function sequenceMatchersForDataset(isSingleCell: boolean): AnchoredPColumnSelector[] {
  return VDJ_FEATURES.map((feature) => {
    const baseDomain: Record<string, string> = {
      "pl7.app/alphabet": "aminoacid",
      "pl7.app/vdj/feature": feature,
    };
    if (isSingleCell) {
      baseDomain["pl7.app/vdj/scClonotypeChain/index"] = "primary";
    }
    return {
      axes: [{ anchor: "main", idx: 1 }],
      name: "pl7.app/vdj/sequence",
      domain: baseDomain,
    };
  });
}

/**
 * Anchored matcher restricted to a specific chain (axis-domain `pl7.app/vdj/chain`).
 * Used by the scFv-suspicion heuristic to count heavy vs light columns on the same
 * bulk clonotype axis without committing to a per-feature filter.
 */
function sequenceMatchersForChain(chain: string): AnchoredPColumnSelector[] {
  return VDJ_FEATURES.map((feature) => ({
    axes: [{ anchor: "main", idx: 1, domain: { "pl7.app/vdj/chain": chain } }],
    name: "pl7.app/vdj/sequence",
    domain: {
      "pl7.app/alphabet": "aminoacid",
      "pl7.app/vdj/feature": feature,
    },
  }));
}

export function defaultBlockLabelFor(args: Partial<BlockData>): string {
  // `.args()` guarantees species is set before Run, but `.subtitle()` calls
  // this for unconfigured blocks too — surface "No species" rather than
  // silently defaulting to "Human" and hiding the unset state.
  const speciesLabel = args.species
    ? (speciesOptions.find((o) => o.value === args.species)?.label ?? args.species)
    : "No species";
  const engine = args.mode === "NanoBodyBuilder2" ? "NBB2" : "ABB2";
  const metric = args.confidenceMetric === "overallMean" ? "mean" : "CDRH3";
  const threshold = args.confidenceThresholdAngstroms ?? 2.5;
  return `${speciesLabel} ${engine}, ${metric} ≤ ${threshold.toFixed(1)} Å`;
}

export const platforma = BlockModelV3.create(blockDataModel)

  .args<BlockArgs>((data) => {
    if (data.dataset === undefined) throw new Error("VDJ dataset is required");
    if (data.heavyChainRef === undefined) throw new Error("Heavy chain sequence is required");
    // UI-only field, but required: force a conscious pick so the user sees the
    // species-specific accuracy guidance instead of silently defaulting.
    if (data.species === undefined) throw new Error("Species is required");
    if (data.mode === "ABodyBuilder2" && data.lightChainRef === undefined) {
      throw new Error("Light chain sequence is required in paired (ABodyBuilder2) mode");
    }
    if (data.lightChainRef !== undefined && data.heavyChainRef === data.lightChainRef) {
      throw new Error("Heavy and light chain sequences must be different columns");
    }
    // Pre-flight gate. Inputs are picked but the prerun pipeline writes a
    // distinct-clonotype count back into data via app.ts. Until that lands,
    // and when it exceeds the limit, Run stays disabled.
    if (data.lastClonotypeCount === undefined) {
      throw new Error("Checking dataset size…");
    }
    if (data.lastClonotypeCount > MAX_CLONOTYPES) {
      throw new Error(
        `Dataset has ${data.lastClonotypeCount.toLocaleString()} clonotypes ` +
          `(max ${MAX_CLONOTYPES.toLocaleString()}). Apply a stricter filter and try again.`,
      );
    }
    return {
      customBlockLabel: data.customBlockLabel,
      defaultBlockLabel: defaultBlockLabelFor(data),
      // Flatten the DatasetSelection into a PrimaryRef — the workflow's
      // tableBuilder.addPrimary detects the optional filter and inner-joins it.
      dataset: data.dataset.primary,
      heavyChainRef: data.heavyChainRef,
      lightChainRef: data.lightChainRef,
      mode: data.mode,
      confidenceMetric: data.confidenceMetric,
      confidenceThresholdAngstroms: data.confidenceThresholdAngstroms,
      batchSize: data.batchSize,
      torchSeed: data.torchSeed,
    };
  })

  // Prerun args — staging phase only needs dataset + heavy chain to count
  // distinct clonotype keys. Returning `undefined` defers the prerun until
  // both inputs are picked so we don't fire it on every keystroke.
  .prerunArgs((data) => {
    if (data.dataset === undefined) return undefined;
    if (data.heavyChainRef === undefined) return undefined;
    return {
      dataset: data.dataset.primary,
      heavyChainRef: data.heavyChainRef,
    };
  })

  // Distinct clonotype count from the prerun pre-flight. The prerun saves a
  // single-row TSV (`count\n<n>\n`) via `df.saveContent`; we parse the integer
  // here. Surfaced both to the UI alert and (via `app.ts` mirroring) to
  // `data.lastClonotypeCount` which `.args()` uses as the Run gate.
  .output("clonotypeCount", (ctx): number | undefined => {
    const acc = ctx.prerun?.resolve({
      field: "clonotypeCount",
      assertFieldType: "Input",
      allowPermanentAbsence: true,
    });
    const raw = acc?.getDataAsString();
    if (raw === undefined) return undefined;
    const lines = raw.trim().split("\n");
    if (lines.length < 2) return undefined;
    const n = Number(lines[1].trim());
    return Number.isFinite(n) ? n : undefined;
  })

  // Datasets surfaced in `PlDatasetSelector`. Restricted to clonotype-keyed
  // anchor PColumns; the `filter` predicate narrows discovered filter columns
  // to those originating from antibody-tcr Lead Selection — the canonical
  // workflow for "predict structures of selected leads". Filter labels are
  // derived by the SDK via `deriveDistinctLabels`.
  .output("datasetOptions", (ctx): DatasetOption[] | undefined =>
    buildDatasetOptions(ctx, {
      primary: (spec: PObjectSpec): boolean => {
        if (!isPColumnSpec(spec)) return false;
        if (spec.annotations?.["pl7.app/isAnchor"] !== "true") return false;
        if (spec.axesSpec.length < 2) return false;
        if (spec.axesSpec[0]?.name !== "pl7.app/sampleId") return false;
        const rowAxis = spec.axesSpec[1]?.name;
        return rowAxis === "pl7.app/vdj/clonotypeKey" || rowAxis === "pl7.app/vdj/scClonotypeKey";
      },
      filter: (spec: PObjectSpec): boolean => hasLeadSelectionTrace(spec.annotations),
    }),
  )

  /**
   * AA sequence options anchored to the selected dataset. The dropdown labels
   * carry chain info (IGH/IGK/IGL or scClonotypeChain A/B), which the user uses
   * to assign columns to heavy vs light. Same shape as `clonotype-clustering`.
   */
  .output("sequenceOptions", (ctx) => {
    const ref = datasetColumnRef(ctx.data.dataset);
    if (ref === undefined) return undefined;

    const datasetSpec = ctx.resultPool.getPColumnSpecByRef(ref);
    if (datasetSpec === undefined) return undefined;

    const isSingleCell = datasetSpec.axesSpec[1]?.name === "pl7.app/vdj/scClonotypeKey";

    return ctx.resultPool.getCanonicalOptions(
      { main: ref },
      sequenceMatchersForDataset(isSingleCell),
      {
        ignoreMissingDomains: true,
        labelOps: { includeNativeLabel: true },
      },
    );
  })

  .output("datasetSpec", (ctx) => {
    const ref = datasetColumnRef(ctx.data.dataset);
    return ref !== undefined ? ctx.resultPool.getPColumnSpecByRef(ref) : undefined;
  })

  .output("isSingleCell", (ctx) => {
    const ref = datasetColumnRef(ctx.data.dataset);
    if (ref === undefined) return undefined;
    const spec = ctx.resultPool.getPColumnSpecByRef(ref);
    if (spec === undefined) return undefined;
    return spec.axesSpec[1]?.name === "pl7.app/vdj/scClonotypeKey";
  })

  .outputWithStatus("structuresTable", (ctx): PlDataTableModel | undefined => {
    const acc = ctx.outputs?.resolve("structuresTable");
    if (acc === undefined) return undefined;
    const snapshots = new OutputColumnProvider(acc).getAllColumns();
    if (snapshots.length === 0) return undefined;

    // Pick any value-bearing snapshot as the row-axis anchor. Discovery is
    // axis-driven, so the specific column doesn't matter — only its axesSpec.
    const anchorSpec = (snapshots.find((s) => s.spec.name !== "pl7.app/label") ?? snapshots[0])
      .spec;

    // Use the discoverColumnOptions form so V3 runs `getMatchingLabelColumns`
    // and surfaces `pl7.app/label` columns as axis-value substitutions
    // (matches V2 behavior). Sources are limited to our own output PFrame
    // (`OutputColumnProvider(acc)`) — the label column we emit from the
    // python wrapper is part of `acc` and gets discovered there. maxHops: 0
    // disables linker-chain traversal since our PFrame is self-contained.
    return createPlDataTableV3(ctx, {
      columns: {
        sources: [new OutputColumnProvider(acc)],
        anchors: { main: anchorSpec },
        selector: { mode: "enrichment", maxHops: 0 },
      },
      tableState: ctx.data.tableState,
    });
  })

  // Single-column pFrames for each histogram. Splitting avoids GraphMaker
  // pre-filling extra slots (color/facet) with sibling columns when given a
  // multi-column source, which produces overlapping or empty plots.
  .outputWithStatus("meanErrorPf", (ctx): PFrameHandle | undefined => {
    const pCols = ctx.outputs?.resolve("structuresTable")?.getPColumns();
    if (pCols === undefined) return undefined;
    const col = pCols.find((c) => c.spec.name === "pl7.app/structure/confidence/mean");
    if (!col) return undefined;
    return createPFrameForGraphs(ctx, [col]);
  })

  .outputWithStatus("cdrh3ErrorPf", (ctx): PFrameHandle | undefined => {
    const pCols = ctx.outputs?.resolve("structuresTable")?.getPColumns();
    if (pCols === undefined) return undefined;
    const col = pCols.find((c) => c.spec.name === "pl7.app/structure/confidence/cdrh3");
    if (!col) return undefined;
    return createPFrameForGraphs(ctx, [col]);
  })

  .output("meanErrorSpec", (ctx): PColumnIdAndSpec | undefined => {
    const pCols = ctx.outputs?.resolve("structuresTable")?.getPColumns();
    if (pCols === undefined) return undefined;
    const col = pCols.find((c) => c.spec.name === "pl7.app/structure/confidence/mean");
    return col ? { columnId: col.id, spec: col.spec } : undefined;
  })

  .output("cdrh3ErrorSpec", (ctx): PColumnIdAndSpec | undefined => {
    const pCols = ctx.outputs?.resolve("structuresTable")?.getPColumns();
    if (pCols === undefined) return undefined;
    const col = pCols.find((c) => c.spec.name === "pl7.app/structure/confidence/cdrh3");
    return col ? { columnId: col.id, spec: col.spec } : undefined;
  })

  // Aggregate stats are not produced in batch mode — each batch has its own
  // summary, cross-batch aggregation is not currently wired. Returning
  // undefined keeps the UI alerts (failure-rate, etc.) from throwing; they
  // simply don't render.
  .output("failureStats", (_ctx): PredictionSummary | undefined => undefined)

  // PDB ResourceMap: clonotypeKey → File handle. Built by the
  // build-pdbs-map workdir processor template. Used by the UI for per-row
  // download and for the bulk-zip export. Failed clonotypes have no entry.
  .output("pdbsMap", (ctx) => {
    const pCols = ctx.outputs?.resolve("pdbsMap")?.getPColumns();
    if (pCols === undefined) return undefined;
    const pdbCol = pCols.find((c) => c.spec.name === "pl7.app/structure/pdb");
    if (pdbCol === undefined) return undefined;
    const parsed = parseResourceMap(pdbCol.data, (acc) => acc.getRemoteFileHandle(), false);
    if (!parsed.isComplete) return undefined;
    return parsed.data;
  })

  // PFrame handle the UI can use to fetch the clonotype-axis label column
  // asynchronously via getColumnsFull / getSingleColumnData. resultPool.findLabels
  // is sync but can't read Parquet-stored label columns — going through the
  // PFrame driver handles both JSON and Parquet storage transparently.
  // createPFrameForGraphs auto-enriches with all compatible label columns from
  // the result pool, so we just seed it with any structures column on the
  // clonotype axis.
  .output("clonotypeLabelsPf", (ctx): PFrameHandle | undefined => {
    const pCols = ctx.outputs?.resolve("structuresTable")?.getPColumns();
    if (pCols === undefined || pCols.length === 0) return undefined;
    return createPFrameForGraphs(ctx, [pCols[0]]);
  })

  // Axis identifier for the clonotype-key column in the structures table.
  // Used by the UI to wire `show-cell-button-for-axis-id` for per-row PDB download.
  .output("clonotypeAxisId", (ctx): AxisId | undefined => {
    const ref = datasetColumnRef(ctx.data.dataset);
    if (ref === undefined) return undefined;
    const spec = ctx.resultPool.getPColumnSpecByRef(ref);
    const axis = spec?.axesSpec[1];
    if (axis === undefined) return undefined;
    return { type: axis.type, name: axis.name, domain: axis.domain };
  })

  // Heuristic scFv detector: a bulk dataset where both heavy and light
  // chain sequence columns sit on the same clonotypeKey axis is suspicious.
  // sc datasets are excluded because pairing is normal there.
  .output("isScFvSuspect", (ctx): boolean => {
    const ref = datasetColumnRef(ctx.data.dataset);
    if (ref === undefined) return false;
    const datasetSpec = ctx.resultPool.getPColumnSpecByRef(ref);
    if (!datasetSpec) return false;
    if (datasetSpec.axesSpec[1]?.name !== "pl7.app/vdj/clonotypeKey") return false;
    const heavyOpts = ctx.resultPool.getCanonicalOptions(
      { main: ref },
      sequenceMatchersForChain("IGH").concat(sequenceMatchersForChain("IGHeavy")),
      { ignoreMissingDomains: true },
    );
    const lightOpts = ctx.resultPool.getCanonicalOptions(
      { main: ref },
      sequenceMatchersForChain("IGK")
        .concat(sequenceMatchersForChain("IGL"))
        .concat(sequenceMatchersForChain("IGLight")),
      { ignoreMissingDomains: true },
    );
    return (heavyOpts?.length ?? 0) > 0 && (lightOpts?.length ?? 0) > 0;
  })

  .title(() => "3D Structure Prediction")

  .subtitle((ctx) => ctx.data.customBlockLabel || defaultBlockLabelFor(ctx.data))

  .sections((_ctx) => [
    { type: "link", href: "/", label: "Structures" },
    { type: "link", href: "/mean-error", label: "Mean error distribution" },
    { type: "link", href: "/cdrh3-error", label: "CDR-H3 error distribution" },
  ])

  .done();

export type BlockOutputs = InferOutputsType<typeof platforma>;
