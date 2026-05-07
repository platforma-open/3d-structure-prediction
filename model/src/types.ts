import type { GraphMakerState } from "@milaboratories/graph-maker";
import type {
  DatasetSelection,
  PlDataTableStateV2,
  PrimaryRef,
  SUniversalPColumnId,
} from "@platforma-sdk/model";

export type PredictionMode = "ABodyBuilder2" | "NanoBodyBuilder2";
export type ConfidenceMetric = "cdrh3Mean" | "overallMean";

/**
 * Args sent to the workflow — the validated output of `.args(...)`. The
 * workflow side reads these via `wf.prepare`/`wf.body`. `dataset` is a
 * `PrimaryRef` so the workflow's `tableBuilder.addPrimary(args.dataset)`
 * inner-joins the optional filter automatically.
 */
export type BlockArgs = {
  defaultBlockLabel: string;
  customBlockLabel: string;

  dataset: PrimaryRef;
  heavyChainRef: SUniversalPColumnId;
  lightChainRef?: SUniversalPColumnId;

  mode: PredictionMode;

  confidenceMetric: ConfidenceMetric;
  confidenceThresholdAngstroms: number;

  batchSize: number;
  torchSeed: number;
  mem?: number;
  cpu?: number;
};

/**
 * Unified V3 data model — what the user manipulates in the UI and what
 * `.args()` derives the workflow args from. Block args (possibly incomplete)
 * live alongside UI state. `dataset` is the opaque `DatasetSelection` emitted
 * by `PlDatasetSelector` (carries the user-picked primary + optional filter).
 */
export type BlockData = {
  defaultBlockLabel: string;
  customBlockLabel: string;

  dataset?: DatasetSelection;
  heavyChainRef?: SUniversalPColumnId;
  lightChainRef?: SUniversalPColumnId;

  mode: PredictionMode;

  confidenceMetric: ConfidenceMetric;
  confidenceThresholdAngstroms: number;

  batchSize: number;
  torchSeed: number;
  mem?: number;
  cpu?: number;

  tableState: PlDataTableStateV2;
  graphStateMeanV2: GraphMakerState;
  graphStateCdrh3V2: GraphMakerState;
  scFvAlertDismissed: boolean;
  failureAlertDismissed: boolean;
};

/**
 * Aggregate stats emitted by `run_immunebuilder.py`'s `--summary` output.
 * Keep this in lock-step with `_build_summary` in that file.
 */
export type PredictionSummary = {
  totalRows: number;
  succeeded: number;
  failed: number;
  byFailureReason: Record<string, number>;
  byWarning: Record<string, number>;
  metric: ConfidenceMetric;
  thresholdAngstroms: number;
  confidentCount: number;
  metricMean?: number;
  metricMin?: number;
  metricMax?: number;
};
