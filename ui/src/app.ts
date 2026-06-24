import {
  clonotypeCountInputKey,
  platforma,
} from "@platforma-open/milaboratories.3d-structure-prediction.model";
import { defineAppV3 } from "@platforma-sdk/ui-vue";
import { watch, watchEffect } from "vue";
import Cdrh3ErrorPage from "./pages/Cdrh3ErrorPage.vue";
import MainPage from "./pages/MainPage.vue";
import MeanErrorPage from "./pages/MeanErrorPage.vue";

export const sdkPlugin = defineAppV3(platforma, () => ({
  showErrorsNotification: true,
  routes: {
    "/": () => MainPage,
    "/mean-error": () => MeanErrorPage,
    "/cdrh3-error": () => Cdrh3ErrorPage,
  },
}));

export const useApp = sdkPlugin.useApp;

// Plugin-load gate: V3's `app.model.data` is only available once the plugin
// finishes loading, so reactive sync effects are wired up here rather than
// inside the defineAppV3 factory (which has no `app` arg in V3).
const unwatch = watch(sdkPlugin, ({ loaded }) => {
  if (!loaded) return;
  unwatch();
  const app = useApp();

  // Auto-select the prediction mode from the light-chain selection: paired
  // VH+VL → ABodyBuilder2, lone heavy chain → NanoBodyBuilder2. Keyed on the
  // instant local `lightChainRef` (not the lagging server-derived output) so
  // the species/mode warning banners react in lockstep with the dropdowns —
  // reading the output here let the banners flash a stale mode for a few
  // seconds. `mode` is not a dependency, so a manual override in Advanced
  // settings sticks until the user next changes the light chain selection.
  watch(
    () => app.model.data.lightChainRef,
    (lightChainRef) => {
      app.model.data.mode = lightChainRef !== undefined ? "ABodyBuilder2" : "NanoBodyBuilder2";
    },
  );

  // Auto-pick the light chain when the user hasn't chosen one yet:
  // prefer IGK (more common in human/mouse), fall back to IGL, then any
  // option carrying a light-chain marker.
  watchEffect(() => {
    if (app.model.data.lightChainRef !== undefined) return;
    const opts = app.model.outputs.sequenceOptions ?? [];
    if (opts.length === 0) return;
    const igk = opts.find((o) => o.label.includes("IGK"));
    const igl = opts.find((o) => o.label.includes("IGL"));
    const ilight = opts.find((o) => o.label.includes("IGLight"));
    const pick = igk ?? igl ?? ilight;
    if (pick) {
      app.model.data.lightChainRef = pick.value;
    }
  });

  // Mirror the model-derived distinct-clonotype count back into data so that
  // `.args()` can see it (V3 args() only receives data, not ctx). The count is
  // a pure synchronous derivation from result-pool stats, so every client
  // converges to the same value. The throw in `.args()` is what disables the
  // Run button when the count is missing or above MAX_CLONOTYPES.
  //
  // Outputs recompute asynchronously after a `data` change, so right after the
  // user swaps dataset/filter/heavy chain `outputs.clonotypeCount` still holds
  // the PREVIOUS selection's count. Mirroring it then would overwrite the
  // just-cleared `lastClonotypeCount` with a stale (possibly small) value and
  // re-enable Run on a much larger input. Guard with the result's `inputKey`:
  // only mirror once it matches the live selection.
  watchEffect(() => {
    const result = app.model.outputs.clonotypeCount;
    if (result === undefined) return;
    if (result.inputKey !== clonotypeCountInputKey(app.model.data)) return;
    if (result.count !== app.model.data.lastClonotypeCount) {
      app.model.data.lastClonotypeCount = result.count;
    }
  });

  // Stale-count guard: switching dataset or filter must clear the cached
  // count so the previous (smaller) value can't briefly keep Run enabled on
  // a swap to a much larger input. The model output re-derives, and the
  // inputKey check above gates the refill so only the matching count lands.
  watch(
    () => [
      app.model.data.dataset?.primary?.column,
      app.model.data.dataset?.primary?.filter,
      app.model.data.heavyChainRef,
    ],
    () => {
      app.model.data.lastClonotypeCount = undefined;
    },
  );
});
