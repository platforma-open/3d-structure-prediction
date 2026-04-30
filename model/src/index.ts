import type {
  AnchoredPColumnSelector,
  AxisId,
  InferOutputsType,
  PColumnIdAndSpec,
  PFrameHandle,
  PlDataTableModel,
  PObjectId,
} from "@platforma-sdk/model";
import {
  BlockModelV3,
  createDiscoveredPColumnId,
  createPFrameForGraphs,
  createPlDataTableV3,
  OutputColumnProvider,
  parseResourceMap,
} from "@platforma-sdk/model";
import { blockDataModel } from "./dataModel";
import type { BlockArgs, BlockData, PredictionMode, PredictionSummary } from "./types";

export * from "./types";
export { blockDataModel } from "./dataModel";

export const confidenceMetricOptions = [
  { label: "CDR-H3 mean", value: "cdrh3Mean" },
  { label: "Overall mean", value: "overallMean" },
] as const;

export const predictionModeOptions = [
  { label: "ABodyBuilder2 (VH + VL)", value: "ABodyBuilder2" },
  { label: "NanoBodyBuilder2 (VHH / VH only)", value: "NanoBodyBuilder2" },
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
  const parts: string[] = [];
  parts.push(args.mode === "NanoBodyBuilder2" ? "NBB2" : "ABB2");
  const metric = args.confidenceMetric === "overallMean" ? "mean" : "CDRH3";
  const threshold = args.confidenceThresholdAngstroms ?? 2.5;
  parts.push(`${metric} ≤ ${threshold.toFixed(1)} Å`);
  const batch = args.batchSize ?? 50;
  parts.push(`batches of ${batch}`);
  return parts.join(", ");
}

export const platforma = BlockModelV3.create(blockDataModel)

  .args<BlockArgs>((data) => {
    if (data.datasetRef === undefined) throw new Error("VDJ dataset is required");
    if (data.heavyChainRef === undefined) throw new Error("Heavy chain sequence is required");
    if (data.mode === "ABodyBuilder2" && data.lightChainRef === undefined) {
      throw new Error("Light chain sequence is required in paired (ABodyBuilder2) mode");
    }
    return {
      defaultBlockLabel: data.defaultBlockLabel,
      customBlockLabel: data.customBlockLabel,
      datasetRef: data.datasetRef,
      heavyChainRef: data.heavyChainRef,
      lightChainRef: data.lightChainRef,
      mode: data.mode,
      confidenceMetric: data.confidenceMetric,
      confidenceThresholdAngstroms: data.confidenceThresholdAngstroms,
      batchSize: data.batchSize,
      torchSeed: data.torchSeed,
      mem: data.mem,
      cpu: data.cpu,
    };
  })

  .output("datasetOptions", (ctx) =>
    ctx.resultPool.getOptions(
      [
        {
          axes: [{ name: "pl7.app/sampleId" }, { name: "pl7.app/vdj/clonotypeKey" }],
          annotations: { "pl7.app/isAnchor": "true" },
        },
        {
          axes: [{ name: "pl7.app/sampleId" }, { name: "pl7.app/vdj/scClonotypeKey" }],
          annotations: { "pl7.app/isAnchor": "true" },
        },
      ],
      { label: { includeNativeLabel: false } },
    ),
  )

  /**
   * AA sequence options anchored to the selected dataset. The dropdown labels
   * carry chain info (IGH/IGK/IGL or scClonotypeChain A/B), which the user uses
   * to assign columns to heavy vs light. Same shape as `clonotype-clustering`.
   */
  .output("sequenceOptions", (ctx) => {
    const ref = ctx.data.datasetRef;
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

  .output(
    "effectiveMode",
    (ctx): PredictionMode =>
      ctx.data.lightChainRef !== undefined ? "ABodyBuilder2" : "NanoBodyBuilder2",
  )

  .output("datasetSpec", (ctx) =>
    ctx.data.datasetRef !== undefined
      ? ctx.resultPool.getPColumnSpecByRef(ctx.data.datasetRef)
      : undefined,
  )

  .output("isSingleCell", (ctx) => {
    if (ctx.data.datasetRef === undefined) return undefined;
    const spec = ctx.resultPool.getPColumnSpecByRef(ctx.data.datasetRef);
    if (spec === undefined) return undefined;
    return spec.axesSpec[1]?.name === "pl7.app/vdj/scClonotypeKey";
  })

  .outputWithStatus("structuresTable", (ctx): PlDataTableModel | undefined => {
    const acc = ctx.outputs?.resolve("structuresTable");
    if (acc === undefined) return undefined;
    const snapshots = new OutputColumnProvider(acc).getAllColumns();
    if (snapshots.length === 0) return undefined;
    return createPlDataTableV3(ctx, {
      columns: snapshots.map((s) => ({
        column: {
          ...s,
          id: createDiscoveredPColumnId({
            column: s.id as PObjectId,
            path: [],
            columnQualifications: [],
            queriesQualifications: {},
          }),
        },
        originalId: s.id as PObjectId,
        qualifications: { forQueries: {}, forHit: [] },
        path: [],
        isPrimary: true,
      })),
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

  // Aggregate stats produced by the Python wrapper. Schema is documented in
  // run_immunebuilder.py:_build_summary — keep this output's shape in sync.
  .output("failureStats", (ctx) => {
    const raw = ctx.outputs?.resolve("summary")?.getDataAsJson();
    return raw as PredictionSummary | undefined;
  })

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
    if (ctx.data.datasetRef === undefined) return undefined;
    const spec = ctx.resultPool.getPColumnSpecByRef(ctx.data.datasetRef);
    const axis = spec?.axesSpec[1];
    if (axis === undefined) return undefined;
    return { type: axis.type, name: axis.name, domain: axis.domain };
  })

  // Heuristic scFv detector: a bulk dataset where both heavy and light
  // chain sequence columns sit on the same clonotypeKey axis is suspicious.
  // sc datasets are excluded because pairing is normal there.
  .output("isScFvSuspect", (ctx): boolean => {
    const ref = ctx.data.datasetRef;
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

  .output("predictionLogHandle", (ctx) => ctx.outputs?.resolve("predictionLog")?.getLogHandle())

  .title(() => "3D Structure Prediction")

  .subtitle((ctx) => ctx.data.customBlockLabel || ctx.data.defaultBlockLabel)

  .sections((_ctx) => [
    { type: "link", href: "/", label: "Structures" },
    { type: "link", href: "/mean-error", label: "Mean error distribution" },
    { type: "link", href: "/cdrh3-error", label: "CDR-H3 error distribution" },
  ])

  .done();

export type BlockOutputs = InferOutputsType<typeof platforma>;
