<script setup lang="ts">
import type { PredefinedGraphOption } from "@milaboratories/graph-maker";
import { GraphMaker } from "@milaboratories/graph-maker";
import { PlBlockPage } from "@platforma-sdk/ui-vue";
import { computed } from "vue";
import { useApp } from "../app";

const app = useApp();

const meanDefaults = computed((): PredefinedGraphOption<"histogram">[] | undefined => {
  const spec = app.model.outputs.meanErrorSpec?.spec;
  if (!spec) return undefined;
  return [{ inputName: "value", selectedSource: spec }];
});
</script>

<template>
  <PlBlockPage>
    <template #title>Mean error distribution</template>
    <GraphMaker
      v-model="app.model.data.graphStateMeanV2"
      chart-type="histogram"
      :data-state-key="app.model.outputs.meanErrorPf"
      :p-frame="app.model.outputs.meanErrorPf"
      :default-options="meanDefaults"
      :status-text="{ noPframe: { title: 'Run the workflow to see the distribution' } }"
    />
  </PlBlockPage>
</template>
