<script setup lang="ts">
import {
  confidenceMetricOptions,
  defaultBlockLabelFor,
  MAX_CLONOTYPES,
  predictionModeOptions,
  speciesOptions,
} from "@platforma-open/milaboratories.3d-structure-prediction.model";
import type { PlStructureViewerProps } from "@milaboratories/structure-viewer";
import { PlStructureViewer } from "@milaboratories/structure-viewer";
import type { ImportFileHandle, PFrameHandle, PTableKey } from "@platforma-sdk/model";
import { getColumnsFull, getSingleColumnData } from "@platforma-sdk/model";
import type { FileExportEntry } from "@platforma-sdk/ui-vue";
import {
  PlAccordionSection,
  PlAgDataTableV2,
  PlAlert,
  PlBlockPage,
  PlBtnExportArchive,
  PlBtnGhost,
  PlBtnGroup,
  PlDatasetSelector,
  PlDropdown,
  PlNumberField,
  PlSlideModal,
  usePlDataTableSettingsV2,
} from "@platforma-sdk/ui-vue";
import { computed, ref, watch } from "vue";
import { useApp } from "../app";

const app = useApp();

const settingsOpen = ref(
  app.model.data.dataset === undefined || app.model.data.heavyChainRef === undefined,
);

function onDatasetChange() {
  app.model.data.heavyChainRef = undefined;
  app.model.data.lightChainRef = undefined;
}

const effectiveMode = computed(() => app.model.outputs.effectiveMode);

// ABB2 was trained predominantly on human and mouse; everything else carries
// a confidence caveat per spec R44.
const nonStandardAbb2Species = computed(
  () =>
    app.model.data.species !== undefined &&
    app.model.data.species !== "human" &&
    app.model.data.species !== "mouse",
);

// Species/mode guidance is only meaningful once the user has at least picked
// a heavy chain — earlier the banners would fire on the initial empty form.
const chainGuidanceVisible = computed(() => app.model.data.heavyChainRef !== undefined);

// Each chain dropdown hides whatever the other has already picked, so the user
// can't accidentally point both selectors at the same sequence column.
const heavyChainOptions = computed(() => {
  const opts = app.model.outputs.sequenceOptions ?? [];
  const taken = app.model.data.lightChainRef;
  return taken === undefined ? opts : opts.filter((o) => o.value !== taken);
});
const lightChainOptions = computed(() => {
  const opts = app.model.outputs.sequenceOptions ?? [];
  const taken = app.model.data.heavyChainRef;
  return taken === undefined ? opts : opts.filter((o) => o.value !== taken);
});

// Confidence-threshold helper: format and constrain.
function setThreshold(value: number | undefined) {
  if (value === undefined) return;
  app.model.data.confidenceThresholdAngstroms = Math.min(6.0, Math.max(0.5, value));
}

const tableSettings = usePlDataTableSettingsV2({
  model: () => app.model.outputs.structuresTable,
});

// Distinct clonotype count from the prerun pre-flight check. Drives both the
// "too large" warning alert below and (via app.ts mirroring into
// data.lastClonotypeCount) the Run-button gate in .args().
const clonotypeCount = computed(() => app.model.outputs.clonotypeCount);
const clonotypeCountTooHigh = computed(
  () => clonotypeCount.value !== undefined && clonotypeCount.value > MAX_CLONOTYPES,
);

// scFv suspicion alert (R7) — heuristic from the result-pool side: dataset has
// both heavy and light VDJRegion columns on the same bulk clonotype axis.
// Temporarily disabled: too noisy for the current set of bulk inputs. To
// re-enable, restore the original visibility computed:
//   () => app.model.outputs.isScFvSuspect === true && !app.model.data.scFvAlertDismissed
const scFvAlertVisible = computed(() => false);
function dismissScFvAlert() {
  app.model.data.scFvAlertDismissed = true;
}

// Failure summary alert (R58) — surfaced when >10% of submitted sequences fail.
const failureStats = computed(() => app.model.outputs.failureStats);
const failureRate = computed(() => {
  const s = failureStats.value;
  if (!s || s.totalRows === 0) return 0;
  return s.failed / s.totalRows;
});
const failureAlertVisible = computed(
  () =>
    failureStats.value !== undefined &&
    failureStats.value.totalRows > 0 &&
    failureRate.value > 0.1 &&
    !app.model.data.failureAlertDismissed,
);
function dismissFailureAlert() {
  app.model.data.failureAlertDismissed = true;
}
const failureReasonEntries = computed(() => {
  const s = failureStats.value;
  if (!s) return [];
  return Object.entries(s.byFailureReason).sort((a, b) => b[1] - a[1]);
});

// Empty-input alert — surfaced after a run reports zero submitted rows.
const emptyInput = computed(() => failureStats.value?.totalRows === 0);

// "All rows above threshold" soft warning.
const allBelowThreshold = computed(() => {
  const s = failureStats.value;
  return s !== undefined && s.succeeded > 0 && s.confidentCount === 0;
});

// PDB downloads — both per-row (R52) and bulk-zip (R53) consume the same
// pdbsMap output: an array of { key: [clonotypeKey], value: RemoteBlobHandleAndSize }.
const pdbsMap = computed(() => app.model.outputs.pdbsMap);

// Labels are resolved asynchronously through the PFrame driver because the
// clonotype-axis label column is Parquet-stored (the model-side findLabels
// throws on those). We cache the result keyed on the PFrame handle so the
// fetch only runs once per (re)render.
const clonotypeLabelsCache = ref<Map<PFrameHandle, Promise<Record<string, string>>>>(new Map());

async function resolveClonotypeLabels(): Promise<Record<string, string>> {
  const handle = app.model.outputs.clonotypeLabelsPf;
  const axis = app.model.outputs.clonotypeAxisId;
  if (!handle || !axis) return {};
  const cached = clonotypeLabelsCache.value.get(handle);
  if (cached) return cached;

  const promise = (async () => {
    try {
      const labelCols = await getColumnsFull(handle, {
        selectedSources: [],
        strictlyCompatible: false,
        names: ["pl7.app/label"],
      });
      const match = labelCols.find(
        (c) => c.spec.axesSpec.length === 1 && c.spec.axesSpec[0].name === axis.name,
      );
      if (!match) return {};
      const { axesData, data } = await getSingleColumnData(handle, match.columnId);
      const axisKeys = Object.values(axesData)[0];
      if (!axisKeys || axisKeys.length !== data.length) return {};
      const out: Record<string, string> = {};
      for (let i = 0; i < axisKeys.length; i++) {
        const k = axisKeys[i];
        const v = data[i];
        if (k !== null && k !== undefined && v !== null && v !== undefined) {
          out[String(k)] = String(v);
        }
      }
      return out;
    } catch (err) {
      console.warn("PDB export: failed to resolve clonotype labels", err);
      return {};
    }
  })();
  clonotypeLabelsCache.value.set(handle, promise);
  return promise;
}

// Trigger label fetch in the background as soon as the pframe is ready so
// most-likely the labels are warm by the time the user clicks Export.
const resolvedLabels = ref<Record<string, string>>({});
watch(
  () => app.model.outputs.clonotypeLabelsPf,
  async (handle) => {
    if (!handle) {
      resolvedLabels.value = {};
      return;
    }
    resolvedLabels.value = await resolveClonotypeLabels();
  },
  { immediate: true },
);

// Replace characters that are unsafe in cross-platform file names. Built via
// fromCharCode so the C0 control range stays out of the regex literal (which
// trips lint rules forbidding control characters in source).
function buildUnsafeFileNameRe(): RegExp {
  const punct = '\\\\/:*?"<>|';
  let controls = "";
  for (let i = 0; i < 32; i++) controls += String.fromCharCode(i);
  return new RegExp(`[${punct}${controls}]+`, "g");
}
const UNSAFE_FILENAME_RE = buildUnsafeFileNameRe();
function sanitizeFileName(label: string): string {
  return label
    .replace(UNSAFE_FILENAME_RE, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 200);
}

function pdbFileNameFor(clonotypeKey: string): string {
  const label = resolvedLabels.value[clonotypeKey];
  const base = label && label.length > 0 ? sanitizeFileName(label) : clonotypeKey;
  return `${base || clonotypeKey}.pdb`;
}

const pdbExportEntries = computed<FileExportEntry[] | undefined>(() => {
  const entries = pdbsMap.value;
  if (!entries) return undefined;
  // Disambiguate filenames within the archive — labels can collide
  // (e.g. two clonotypes sharing the same CDR3). Reuse the raw key as a
  // suffix in the rare collision case.
  const seen = new Map<string, number>();
  return entries
    .filter((e) => e.value !== undefined)
    .map((e) => {
      const clonotypeKey = String(e.key[0]);
      const baseName = pdbFileNameFor(clonotypeKey);
      const used = seen.get(baseName) ?? 0;
      seen.set(baseName, used + 1);
      const fileName = used === 0 ? baseName : baseName.replace(/\.pdb$/, `_${clonotypeKey}.pdb`);
      return {
        importHandle: `pdb_${clonotypeKey}` as ImportFileHandle,
        blobHandle: e.value!,
        fileName,
      };
    });
});

const exportSuggestedFileName = computed(() => {
  const date = new Date().toISOString().split("T")[0];
  return `${date}_3DStructures.zip`;
});

const exportDisabled = computed(
  () => !pdbExportEntries.value || pdbExportEntries.value.length === 0,
);

const clonotypeAxisId = computed(() => app.model.outputs.clonotypeAxisId);

// 3D viewer — opens a single structure for the row the user clicked.
const viewer = ref<PlStructureViewerProps>();

function openViewerForRow(rowKey?: PTableKey) {
  const key = rowKey?.at(0);
  if (!key) return;
  const handle = pdbsMap.value?.find((entry) => entry.key.at(0) === key)?.value?.handle;
  if (!handle) return;
  viewer.value = { handle, fileName: pdbFileNameFor(String(key)) };
}

function handleViewerVisibility(open: boolean) {
  if (!open) viewer.value = undefined;
}
</script>

<template>
  <PlBlockPage
    v-model:subtitle="app.model.data.customBlockLabel"
    :subtitle-placeholder="defaultBlockLabelFor(app.model.data)"
    title="3D Structure Prediction"
  >
    <template #append>
      <PlBtnExportArchive
        :file-exports="pdbExportEntries"
        :suggested-file-name="exportSuggestedFileName"
        :disabled="exportDisabled"
        :file-picker-types="[{ description: 'ZIP files', accept: { 'application/zip': ['.zip'] } }]"
      >
        Export PDBs
      </PlBtnExportArchive>
      <PlBtnGhost icon="settings" @click.stop="settingsOpen = true">Settings</PlBtnGhost>
    </template>

    <!-- Pre-flight clonotype-count gate. Shown when the prerun has counted
         more clonotypes than the block is willing to run. The Run button is
         also disabled in this state (via the throw in `.args()`). -->
    <PlAlert v-if="clonotypeCountTooHigh" type="error">
      Selected dataset has {{ clonotypeCount?.toLocaleString() }} clonotypes — over the
      {{ MAX_CLONOTYPES.toLocaleString() }} limit. Apply a stricter filter to reduce the input
      before running.
    </PlAlert>

    <!-- scFv suspicion alert (R7) -->
    <PlAlert v-if="scFvAlertVisible" type="warn" closable @close="dismissScFvAlert">
      The selected dataset looks like it may contain scFv (single-chain Fv) constructs: heavy and
      light chain VDJRegion columns co-occur on a bulk clonotype axis. ImmuneBuilder predicts
      separate VH and VL domains; scFv linker regions may produce malformed structures. Verify the
      input is paired VH/VL, not linker-joined.
    </PlAlert>

    <!-- Empty input alert -->
    <PlAlert v-if="emptyInput" type="warn">
      Dataset is empty: no clonotypes to predict. Verify upstream filtering or dataset selection.
    </PlAlert>

    <!-- Failure rate alert (R58) -->
    <PlAlert v-if="failureAlertVisible" type="warn" closable @close="dismissFailureAlert">
      Prediction failed for {{ failureStats?.failed }} / {{ failureStats?.totalRows }} sequences ({{
        Math.round(failureRate * 100)
      }}%):
      <ul style="margin: 0.25rem 0 0 1.25rem">
        <li v-for="[reason, count] in failureReasonEntries" :key="reason">
          {{ count }} × {{ reason }}
        </li>
      </ul>
    </PlAlert>

    <!-- All-rows-above-threshold warning -->
    <PlAlert v-if="allBelowThreshold" type="info">
      No clonotypes pass the confidence threshold of
      {{ failureStats?.thresholdAngstroms }} Å. Lower the threshold or relax the metric to populate
      the <code>confident</code> subset.
    </PlAlert>

    <PlAgDataTableV2
      v-model="app.model.data.tableState"
      :settings="tableSettings"
      :show-cell-button-for-axis-id="clonotypeAxisId"
      :cell-button-invoke-rows-on-double-click="false"
      not-ready-text="Configure the dataset and chains, then run."
      no-rows-text="No structures predicted yet."
      @cell-button-clicked="openViewerForRow"
    />

    <PlSlideModal v-model="settingsOpen" close-on-outside-click shadow>
      <template #title>Settings</template>

      <PlDatasetSelector
        v-model="app.model.data.dataset"
        :options="app.model.outputs.datasetOptions"
        label="VDJ dataset"
        clearable
        required
        @update:model-value="onDatasetChange"
      />

      <PlDropdown
        v-model="app.model.data.heavyChainRef"
        :options="heavyChainOptions"
        :disabled="app.model.data.dataset === undefined"
        label="Heavy chain sequence (full VDJ region)"
        required
      />

      <PlDropdown
        v-model="app.model.data.lightChainRef"
        :options="lightChainOptions"
        :disabled="app.model.data.dataset === undefined"
        label="Light chain sequence (optional)"
        clearable
      >
        <template #tooltip>
          Leave empty for VHH/nanobody data, or for bulk samples where only the heavy chain was
          sequenced.
        </template>
      </PlDropdown>

      <PlDropdown
        v-model="app.model.data.species"
        :options="speciesOptions"
        label="Species"
        required
      >
        <template #tooltip>
          ABodyBuilder2 was trained predominantly on human and mouse antibodies; other species may
          have reduced accuracy. NanoBodyBuilder2 was trained on camelid VHHs — picking
          <i>camelid</i> here indicates a genuine nanobody input.
        </template>
      </PlDropdown>

      <PlAlert
        v-if="
          chainGuidanceVisible &&
          effectiveMode === 'NanoBodyBuilder2' &&
          app.model.data.species === 'camelid'
        "
        type="info"
      >
        Light chain not set — predicting with NanoBodyBuilder2 trained on camelid VHHs.
      </PlAlert>

      <PlAlert
        v-else-if="
          chainGuidanceVisible &&
          effectiveMode === 'NanoBodyBuilder2' &&
          app.model.data.species !== undefined
        "
        type="warn"
      >
        Predicting a conventional <b>{{ app.model.data.species }}</b> heavy chain alone with
        NanoBodyBuilder2. A structure is still produced, but framework geometry, especially the
        VL-facing side of FR2, is biased by the VHH training distribution. Pair the heavy chain with
        a light chain column, or set species to <i>camelid</i> if this is a nanobody dataset.
      </PlAlert>

      <PlAlert
        v-if="chainGuidanceVisible && effectiveMode === 'ABodyBuilder2' && nonStandardAbb2Species"
        type="warn"
      >
        ABodyBuilder2 was trained predominantly on human and mouse antibodies. Predictions for
        <b>{{ app.model.data.species }}</b> may have reduced accuracy.
      </PlAlert>

      <PlBtnGroup
        v-model="app.model.data.confidenceMetric"
        :options="confidenceMetricOptions"
        label="Confidence filter metric"
        :class="$style.equalWidthGroup"
        compact
      >
        <template #tooltip>
          CDR-H3 mean is recommended because framework residues dominate the overall mean and
          inflate it regardless of loop quality.
        </template>
      </PlBtnGroup>

      <PlNumberField
        :model-value="app.model.data.confidenceThresholdAngstroms"
        label="Confidence threshold (Å, lower = better)"
        :min-value="0.5"
        :max-value="6.0"
        :step="0.1"
        @update:model-value="setThreshold"
      >
        <template #tooltip>
          Per-residue ensemble error (Ångstroms). Clonotypes above this threshold are still
          predicted but excluded from the <code>confident</code> subset column. Below 2.5 Å is
          considered benchmark-quality.
        </template>
      </PlNumberField>

      <PlAccordionSection label="Advanced">
        <PlDropdown
          v-model="app.model.data.mode"
          :options="predictionModeOptions"
          label="Prediction mode (override)"
        >
          <template #tooltip>
            Normally auto-selected: paired VH+VL → ABodyBuilder2, VH only → NanoBodyBuilder2.
            Override forces the engine regardless of the light chain selection.
          </template>
        </PlDropdown>

        <PlNumberField
          v-model="app.model.data.batchSize"
          label="Batch size"
          :min-value="1"
          :max-value="1000"
          :step="10"
        >
          <template #tooltip>
            Antibodies predicted per worker invocation. Higher values reduce scheduling overhead;
            lower values give finer progress granularity.
          </template>
        </PlNumberField>

        <PlNumberField
          v-model="app.model.data.torchSeed"
          label="Random seed"
          :min-value="0"
          :step="1"
        >
          <template #tooltip>
            Locks ImmuneBuilder's random initialization. The same seed and same input sequences
            always produce identical PDB files — keep it fixed for reproducible runs, or change it
            to gauge how sensitive a prediction is to the model's stochastic ensemble.
          </template>
        </PlNumberField>
      </PlAccordionSection>
    </PlSlideModal>

    <PlSlideModal
      :model-value="viewer !== undefined"
      width="100%"
      :close-on-outside-click="false"
      @update:model-value="handleViewerVisibility"
    >
      <template #title>3D Structure Viewer</template>
      <PlStructureViewer v-if="viewer" v-bind="viewer" />
    </PlSlideModal>
  </PlBlockPage>
</template>

<style module>
/* Force the two confidence-metric buttons to share width 50/50 — by default
   PlBtnGroup uses flex: 1 with white-space: nowrap, so a long label can
   stretch one option past its half. */
.equalWidthGroup :global(.pl-btn-group__option) {
  flex: 1 1 0;
  min-width: 0;
}
</style>
