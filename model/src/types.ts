import type { GraphMakerState } from "@milaboratories/graph-maker";
import type {
  DatasetSelection,
  PlDataTableStateV2,
  PrimaryRef,
  SUniversalPColumnId,
} from "@platforma-sdk/model";

export type PredictionMode = "ABodyBuilder2" | "NanoBodyBuilder2";
export type ConfidenceMetric = "cdrh3Mean" | "overallMean";
export type Species = "human" | "mouse" | "camelid" | "rat" | "rabbit" | "other";

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
};

/**
 * Unified V3 data model — what the user manipulates in the UI and what
 * `.args()` derives the workflow args from. Block args (possibly incomplete)
 * live alongside UI state. `dataset` is the opaque `DatasetSelection` emitted
 * by `PlDatasetSelector` (carries the user-picked primary + optional filter).
 *
 * `species` is intentionally UI-only (not in `BlockArgs`): the workflow does
 * not consume it yet, and threading it through would invalidate cached
 * predictions on every species switch. Wire it into `BlockArgs` when/if
 * downstream output (e.g. PDB provenance) starts to depend on it.
 */
export type BlockData = {
  defaultBlockLabel: string;
  customBlockLabel: string;

  dataset?: DatasetSelection;
  heavyChainRef?: SUniversalPColumnId;
  lightChainRef?: SUniversalPColumnId;

  mode: PredictionMode;
  species: Species;

  confidenceMetric: ConfidenceMetric;
  confidenceThresholdAngstroms: number;

  batchSize: number;
  torchSeed: number;

  tableState: PlDataTableStateV2;
  graphStateMeanV2: GraphMakerState;
  graphStateCdrh3V2: GraphMakerState;
  scFvAlertDismissed: boolean;
  failureAlertDismissed: boolean;
};

/**
 * Previous-version `BlockData` schema (pre-species). Kept so the data-model
 * migration can typecheck `prev` cleanly. Remove only after dropping the
 * matching migration step in `dataModel.ts`.
 */
export type BlockData_Ver_v1 = Omit<BlockData, "species">;

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
