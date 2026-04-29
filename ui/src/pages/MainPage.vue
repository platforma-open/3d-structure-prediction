<script setup lang="ts">
import {
  confidenceMetricOptions,
  predictionModeOptions,
} from "@platforma-open/milaboratories.3d-structure-prediction.model";
import type { ImportFileHandle, PFrameHandle, PTableKey } from "@platforma-sdk/model";
import { getColumnsFull, getRawPlatformaInstance, getSingleColumnData } from "@platforma-sdk/model";
import type { FileExportEntry } from "@platforma-sdk/ui-vue";
import {
  PlAccordionSection,
  PlAgDataTableV2,
  PlAlert,
  PlBlockPage,
  PlBtnExportArchive,
  PlBtnGhost,
  PlBtnGroup,
  PlDropdown,
  PlDropdownRef,
  PlLogView,
  PlMaskIcon24,
  PlNumberField,
  PlSlideModal,
  usePlDataTableSettingsV2,
} from "@platforma-sdk/ui-vue";
import { computed, ref, watch } from "vue";
import { useApp } from "../app";

const app = useApp();

const settingsOpen = ref(
  app.model.data.datasetRef === undefined || app.model.data.heavyChainRef === undefined,
);

function onDatasetChange() {
  app.model.data.heavyChainRef = undefined;
  app.model.data.lightChainRef = undefined;
}

const effectiveMode = computed(() => app.model.outputs.effectiveMode);

// Confidence-threshold helper: format and constrain.
function setThreshold(value: number | undefined) {
  if (value === undefined) return;
  app.model.data.confidenceThresholdAngstroms = Math.min(6.0, Math.max(0.5, value));
}

const tableSettings = usePlDataTableSettingsV2({
  model: () => app.model.outputs.structuresTable,
});

const logOpen = ref(false);

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

// Per-row PDB download: triggered by the "download" cell button on the
// clonotype-key axis column. Looks up the file handle in pdbsMap by key,
// fetches bytes via the blob driver, and writes them to the user-selected
// path (browser fallback uses the standard <a download> trick).
const rowDownloadPending = ref<string | null>(null);
async function downloadPdbForRow(key?: PTableKey) {
  if (!key) return;
  const clonotypeKey = key[0];
  if (clonotypeKey === null || clonotypeKey === undefined) return;
  const keyStr = String(clonotypeKey);
  const entries = pdbsMap.value;
  if (!entries) return;
  const match = entries.find((e) => String(e.key[0]) === keyStr);
  if (!match || !match.value) return;

  rowDownloadPending.value = keyStr;
  try {
    // Make sure labels are resolved before computing the filename — when the
    // user clicks before the eager fetch finishes, fall back to awaiting it.
    if (Object.keys(resolvedLabels.value).length === 0) {
      resolvedLabels.value = await resolveClonotypeLabels();
    }
    const bytes = await getRawPlatformaInstance().blobDriver.getContent(match.value.handle);
    // Copy into a fresh ArrayBuffer — the result of getContent may carry
    // a SharedArrayBuffer-typed view, which strict-mode TS rejects for
    // FileSystemWritableFileStream.write / Blob constructors.
    const buf = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const fileName = pdbFileNameFor(keyStr);
    const showSaveFilePicker = (
      window as unknown as { showSaveFilePicker?: (opts: unknown) => Promise<FileSystemFileHandle> }
    ).showSaveFilePicker;
    if (typeof showSaveFilePicker === "function") {
      const handle = await showSaveFilePicker({
        types: [{ description: "PDB structure", accept: { "chemical/x-pdb": [".pdb"] } }],
        suggestedName: fileName,
      });
      const writable = await handle.createWritable();
      await writable.write(buf);
      await writable.close();
    } else {
      // Fallback for browsers without showSaveFilePicker.
      const blob = new Blob([buf], { type: "chemical/x-pdb" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  } finally {
    rowDownloadPending.value = null;
  }
}
</script>

<template>
  <PlBlockPage
    v-model:subtitle="app.model.data.customBlockLabel"
    :subtitle-placeholder="app.model.data.defaultBlockLabel"
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
      <PlBtnGhost @click.stop="() => (logOpen = true)">
        Logs
        <template #append>
          <PlMaskIcon24 name="file-logs" />
        </template>
      </PlBtnGhost>
      <PlBtnGhost @click.stop="() => (settingsOpen = true)">
        Settings
        <template #append>
          <PlMaskIcon24 name="settings" />
        </template>
      </PlBtnGhost>
    </template>

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
      @cell-button-clicked="downloadPdbForRow"
    />

    <PlSlideModal v-model="settingsOpen" close-on-outside-click shadow>
      <template #title>Settings</template>

      <PlDropdownRef
        v-model="app.model.data.datasetRef"
        :options="app.model.outputs.datasetOptions"
        label="VDJ dataset"
        clearable
        required
        @update:model-value="onDatasetChange"
      />

      <PlDropdown
        v-model="app.model.data.heavyChainRef"
        :options="app.model.outputs.sequenceOptions"
        :disabled="app.model.data.datasetRef === undefined"
        label="Heavy chain sequence (full VDJ region)"
        required
      />

      <PlDropdown
        v-model="app.model.data.lightChainRef"
        :options="app.model.outputs.sequenceOptions"
        :disabled="app.model.data.datasetRef === undefined"
        label="Light chain sequence (leave empty for VHH)"
        clearable
      />

      <PlAlert v-if="effectiveMode === 'NanoBodyBuilder2'" type="info">
        Light chain not set — predicting single-domain (VHH) structures with NanoBodyBuilder2.
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
          :max-value="500"
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

        <PlNumberField
          v-model="app.model.data.cpu"
          label="CPU cores per batch"
          :min-value="1"
          :max-value="32"
          :step="1"
        />

        <PlNumberField
          v-model="app.model.data.mem"
          label="Memory per batch (GiB)"
          :min-value="4"
          :max-value="128"
          :step="4"
        />
      </PlAccordionSection>
    </PlSlideModal>

    <PlSlideModal v-model="logOpen" width="80%">
      <template #title>ImmuneBuilder log</template>
      <PlLogView :log-handle="app.model.outputs.predictionLogHandle" />
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
