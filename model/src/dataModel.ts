import { createPlDataTableStateV2, DataModelBuilder } from "@platforma-sdk/model";
import type { BlockData, BlockData_Ver_v1 } from "./types";

const initialGraphState = (title: string, fillColor: string) =>
  ({
    title,
    template: "bins",
    currentTab: null,
    layersSettings: { bins: { fillColor } },
    axesSettings: {
      axisY: { axisLabelsAngle: 0 as const, scale: "linear" },
      other: { binsCount: 30 },
    },
  }) satisfies import("@milaboratories/graph-maker").GraphMakerState;

export const blockDataModel = new DataModelBuilder()
  .from<BlockData_Ver_v1>("v1")
  // v1 predates `species`. Existing projects keep the historical "human"
  // assumption so their Run stays unlocked; only fresh blocks start unset.
  .migrate<BlockData>("v2", (prev) => ({ ...prev, species: "human" as const }))
  .init(() => ({
    customBlockLabel: "",

    mode: "ABodyBuilder2" as const,
    confidenceMetric: "cdrh3Mean" as const,
    confidenceThresholdAngstroms: 2.5,
    batchSize: 50,
    torchSeed: 42,

    tableState: createPlDataTableStateV2(),
    graphStateMeanV2: initialGraphState("Mean error distribution", "#7da3d1"),
    graphStateCdrh3V2: initialGraphState("CDR-H3 error distribution", "#e5a06f"),
    scFvAlertDismissed: false,
    failureAlertDismissed: false,
  }));
