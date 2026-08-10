import { service, field, port, valueRef } from "@v1d/product-spec";

const uiAction = (id: string, value: string) => ({
  id, kind: "event", boundary: "ui-event",
  fields: [field("event", valueRef(value))],
} as const);

export const atmosSceneSettingsActionContract = uiAction(
  "settings.atmos-scene-action", "settings.atmos-scene-event",
);
export const atmosControlsSettingsActionContract = uiAction(
  "settings.atmos-controls-action", "settings.atmos-controls-event",
);
export const cloudSceneSettingsActionContract = uiAction(
  "settings.cloud-scene-action", "settings.cloud-scene-event",
);
export const cloudControlsSettingsActionContract = uiAction(
  "settings.cloud-controls-action", "settings.cloud-controls-event",
);
export const liveSceneSettingsActionContract = uiAction(
  "settings.live-scene-action", "settings.live-scene-event",
);
export const productSettingWriteContract = uiAction(
  "settings.product-write", "settings.product-write-event",
);

export const continuousTrackStateContract = {
  id: "settings.continuous-track-state",
  kind: "state",
  boundary: "service-internal",
  fields: [field("enabled", "boolean")],
} as const;

/** The persisted product choice, published so every runtime follows one wire value. */
export const mapBaseStateContract = {
  id: "settings.map-base-state",
  kind: "state",
  boundary: "service-internal",
  fields: [field("value", valueRef("map.base"))],
} as const;

export const powerSettingsPresentationContract = {
  id: "settings.power-presentation",
  kind: "snapshot",
  boundary: "presentation",
  fields: [field("value", valueRef("settings.power-state"))],
} as const;

export const devSettingsPresentationContract = {
  id: "settings.dev-presentation",
  kind: "snapshot",
  boundary: "presentation",
  fields: [field("value", valueRef("settings.dev-state"))],
} as const;

export const diagnosticsSettingsPresentationContract = {
  id: "settings.diagnostics-presentation",
  kind: "snapshot",
  boundary: "presentation",
  fields: [field("value", valueRef("settings.diagnostics-state"))],
} as const;

export const settingsWriteContract = {
  id: "settings.write",
  kind: "event",
  boundary: "ui-event",
  fields: [field("write", valueRef("settings.write"))],
} as const;

export const settingsCommandOwner = service({
  id: "settings.command-owner",
  inputs: [port("write", settingsWriteContract)],
  outputs: [],
  runtime: {
    stateOwner: "none", lifetime: "call", durability: "transient", clockDomain: "none",
    contextInputs: ["settings.runtime", "settings.dev", "settings.diagnostics"],
    effects: ["storage.settings-write"],
  },
});

/**
 * Typed power/flight settings owner over the existing SettingsIr stores;
 * alarm-ladder coercion and pull/spot normalisation live here.
 */
export const settingsRuntimeOwner = service({
  id: "settings.runtime-owner",
  inputs: [port("productWrite", productSettingWriteContract)],
  outputs: [
    port("continuousTrack", continuousTrackStateContract),
    port("mapBase", mapBaseStateContract),
    port("presentation", powerSettingsPresentationContract),
  ],
  runtime: {
    stateOwner: "instance", lifetime: "process", durability: "durable", clockDomain: "none",
    contextInputs: ["settings.user-intent", "storage.power-settings", "storage.flight-settings"],
    effects: [
      "storage.power-settings-write",
      "storage.flight-settings-write",
      "diagnostics.incident-recovered",
    ],
  },
});

/** Debug settings owner; fixture actions and QA bridges stay native. */
export const devSettingsOwner = service({
  id: "settings.dev-owner",
  inputs: [
    port("atmosSceneAction", atmosSceneSettingsActionContract),
    port("atmosControlsAction", atmosControlsSettingsActionContract),
    port("cloudSceneAction", cloudSceneSettingsActionContract),
    port("cloudControlsAction", cloudControlsSettingsActionContract),
    port("liveSceneAction", liveSceneSettingsActionContract),
  ],
  outputs: [port("presentation", devSettingsPresentationContract)],
  runtime: {
    stateOwner: "instance", lifetime: "process", durability: "durable", clockDomain: "none",
    contextInputs: ["settings.user-intent", "storage.dev-settings"],
    effects: ["storage.dev-settings-write"],
  },
});

/** Diagnostics settings owner; GPS filter application and raw-log lifecycle react as effects. */
export const diagnosticsSettingsOwner = service({
  id: "settings.diagnostics-owner",
  inputs: [],
  outputs: [port("presentation", diagnosticsSettingsPresentationContract)],
  runtime: {
    stateOwner: "instance", lifetime: "process", durability: "durable", clockDomain: "none",
    contextInputs: ["settings.user-intent", "storage.diagnostics-settings"],
    effects: [
      "storage.diagnostics-settings-write",
      "gps.filter-mode-apply",
      "diagnostics.raw-log-discard",
    ],
  },
});
