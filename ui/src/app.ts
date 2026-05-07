import {
  defaultBlockLabelFor,
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

  // Sync data.mode with the effective mode derived from lightChainRef.
  // Users can override via the advanced settings; this only flips it when
  // the derived value diverges from what's stored.
  watchEffect(() => {
    const derived = app.model.outputs.effectiveMode;
    if (derived && app.model.data.mode !== derived) {
      app.model.data.mode = derived;
    }
  });

  // Keep defaultBlockLabel in sync with current data (R56 subtitle).
  watchEffect(() => {
    app.model.data.defaultBlockLabel = defaultBlockLabelFor({
      mode: app.model.data.mode,
      confidenceMetric: app.model.data.confidenceMetric,
      confidenceThresholdAngstroms: app.model.data.confidenceThresholdAngstroms,
      batchSize: app.model.data.batchSize,
    });
  });

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
});
