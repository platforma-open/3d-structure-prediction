import { assertParamsObject, defineBlockKind } from "@platforma-sdk/block-kind";
import { name, version } from "../package.json" with { type: "json" };

/**
 * The prediction engine. ABodyBuilder2 folds a paired heavy + light record;
 * NanoBodyBuilder2 folds a single VHH / VH chain.
 */
export type PredictionMode = "ABodyBuilder2" | "NanoBodyBuilder2";

/** Which per-residue error figure gates a prediction as confident. */
export type ConfidenceMetric = "cdrh3Mean" | "overallMean";

/** Source species of the input repertoire. Drives the accuracy guidance shown in the UI. */
export type Species = "human" | "mouse" | "camelid" | "rat" | "rabbit" | "other";

const PREDICTION_MODES = ["ABodyBuilder2", "NanoBodyBuilder2"] as const;
const CONFIDENCE_METRICS = ["cdrh3Mean", "overallMean"] as const;
const SPECIES = ["human", "mouse", "camelid", "rat", "rabbit", "other"] as const;

/**
 * This block's init-params contract — what a project template supplies to seed a
 * new instance.
 *
 * These are the four settings that change what the prediction produces. The
 * block's input selections are deliberately absent: `dataset`, `heavyChainRef`
 * and `lightChainRef` are anchor-bound references (`DatasetSelection` /
 * `SUniversalPColumnId`) whose meaning depends on the anchor map of the project
 * that made them, so they cannot travel in a template. View state — table and
 * graph state, dismissed alerts, the mirrored clonotype count — is not
 * configuration and is absent for that reason.
 *
 * Every field is optional so a template can seed any subset; the model's `init`
 * keeps a default behind each one.
 */
export type BlockParams = {
  mode?: PredictionMode;
  species?: Species;
  confidenceMetric?: ConfidenceMetric;
  confidenceThresholdAngstroms?: number;
};

/**
 * Reject a value that is not one of a closed set.
 *
 * The three unions above are the block's own vocabulary, so there is no SDK
 * guard to reach for and the closed sets live here beside the types they check.
 */
function oneOf<T extends string>(key: string, value: unknown, allowed: readonly T[]): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new Error(
      `'${key}' must be one of: ${allowed.join(", ")}. Got: ${JSON.stringify(value)}`,
    );
  }
  return value as T;
}

/**
 * The same contract at runtime, for params arriving from a template file rather
 * than from typed code — the only point that can catch a hand-written entry
 * being wrong.
 *
 * Each field is checked only when present, because all four are optional. Keys
 * the contract does not name are dropped by not being read; refusing them would
 * mean holding a list of field names as strings that nothing keeps in step with
 * the type.
 *
 * The threshold is checked as a finite number and no further. The UI clamps it
 * to 0.5–6.0 Å, but encoding that range here would make the kind refuse a file
 * this block itself exported the day that clamp changes. Range is meaning; the
 * kind checks the envelope.
 */
function parseInitializationParams(value: unknown): BlockParams {
  assertParamsObject(value);

  const params: BlockParams = {};

  if (value.mode !== undefined) {
    params.mode = oneOf("mode", value.mode, PREDICTION_MODES);
  }

  if (value.species !== undefined) {
    params.species = oneOf("species", value.species, SPECIES);
  }

  if (value.confidenceMetric !== undefined) {
    params.confidenceMetric = oneOf("confidenceMetric", value.confidenceMetric, CONFIDENCE_METRICS);
  }

  if (value.confidenceThresholdAngstroms !== undefined) {
    const threshold = value.confidenceThresholdAngstroms;
    if (typeof threshold !== "number" || !Number.isFinite(threshold)) {
      throw new Error(
        `'confidenceThresholdAngstroms' must be a finite number. Got: ${JSON.stringify(threshold)}`,
      );
    }
    params.confidenceThresholdAngstroms = threshold;
  }

  return params;
}

// Identity (`name`/`version`) comes from this package's own `package.json`, so
// the on-wire `{name}@{version}` reference can never drift from what npm
// publishes; the bundler inlines the JSON import.
export const kind = defineBlockKind<BlockParams>({
  name,
  version,
  parseInitializationParams,
});
