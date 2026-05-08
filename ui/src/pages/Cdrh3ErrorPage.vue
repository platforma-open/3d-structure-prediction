<script setup lang="ts">
import type { PredefinedGraphOption } from "@milaboratories/graph-maker";
import { GraphMaker } from "@milaboratories/graph-maker";
import { PlBlockPage } from "@platforma-sdk/ui-vue";
import { computed } from "vue";
import { useApp } from "../app";

const app = useApp();

const cdrh3Defaults = computed((): PredefinedGraphOption<"histogram">[] | undefined => {
  const spec = app.model.outputs.cdrh3ErrorSpec?.spec;
  if (!spec) return undefined;
  return [{ inputName: "value", selectedSource: spec }];
});
</script>

<template>
  <PlBlockPage>
    <GraphMaker
      v-model="app.model.data.graphStateCdrh3V2"
      chart-type="histogram"
      :data-state-key="app.model.outputs.cdrh3ErrorPf"
      :p-frame="app.model.outputs.cdrh3ErrorPf"
      :default-options="cdrh3Defaults"
      :status-text="{ noPframe: { title: 'Run the workflow to see the distribution' } }"
    />
  </PlBlockPage>
</template>
