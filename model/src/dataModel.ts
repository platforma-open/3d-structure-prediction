import { createPlDataTableStateV2, DataModelBuilder } from "@platforma-sdk/model";
import type { BlockData } from "./types";

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

export const blockDataModel = new DataModelBuilder().from<BlockData>("v1").init(() => ({
  defaultBlockLabel: "",
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
