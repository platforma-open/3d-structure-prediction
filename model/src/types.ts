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
  customBlockLabel: string;
  defaultBlockLabel: string;

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
 *
 * Fresh blocks start with no default but it is required to run: `.args()`
 * throws while `species` is undefined, so the user must consciously pick one
 * and see the relevant accuracy guidance before Run unlocks. (Pre-species v1
 * projects migrate to "human" to keep their Run unlocked.)
 */
export type BlockData = {
  customBlockLabel: string;

  dataset?: DatasetSelection;
  heavyChainRef?: SUniversalPColumnId;
  lightChainRef?: SUniversalPColumnId;

  mode: PredictionMode;
  species?: Species;

  confidenceMetric: ConfidenceMetric;
  confidenceThresholdAngstroms: number;

  batchSize: number;
  torchSeed: number;

  tableState: PlDataTableStateV2;
  graphStateMeanV2: GraphMakerState;
  graphStateCdrh3V2: GraphMakerState;
  scFvAlertDismissed: boolean;
  failureAlertDismissed: boolean;
  lastClonotypeCount?: number;
};

/**
 * Result of the `clonotypeCount` model output. Carries the count alongside an
 * `inputKey` fingerprint of the selections it was computed from. Model outputs
 * recompute asynchronously after `data` changes, so the UI must reject a stale
 * result (one whose `inputKey` no longer matches the live selection) before
 * mirroring `count` into `data.lastClonotypeCount` — otherwise a previous
 * dataset's count could re-arm the Run gate on a freshly-swapped, much larger
 * input. See `clonotypeCountInputKey` in `index.ts`.
 */
export type ClonotypeCountResult = {
  count: number | undefined;
  inputKey: string;
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
