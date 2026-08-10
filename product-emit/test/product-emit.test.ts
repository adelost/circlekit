import assert from "node:assert/strict";
import test from "node:test";
import { emitHomeActionsKotlin, emitSettingsKotlin, type SkydivingNativeSymbols } from "../src/skydiving/index.js";

const acmeSymbols = {
  homeActions: { homeActionId: "io.acme.ui.home.HomeActionId" },
  interactions: {
    continuousInteractionContract: "io.acme.appspec.AppSpecContinuousInteractionContract",
    discreteInteractionContract: "io.acme.appspec.AppSpecDiscreteInteractionContract",
    host: "io.acme.appspec.AppSpecHost",
    interactionCatalog: "io.acme.appspec.AppSpecInteractionCatalog",
    interactionControlId: "io.acme.appspec.AppSpecInteractionControlId",
    interactionMount: "io.acme.appspec.AppSpecInteractionMount",
    interactionMountId: "io.acme.appspec.AppSpecInteractionMountId",
    interactionPolicyHandle: "io.acme.appspec.AppSpecInteractionPolicyHandle",
    interactionSource: "io.acme.appspec.AppSpecInteractionSource",
    settingId: "io.acme.appspec.AppSpecSettingId",
  },
  isoOptions: {
    menuAccentToken: "io.acme.presentation.MenuAccentToken",
    menuIconToken: "io.acme.presentation.MenuIconToken",
  },
  settings: {
    booleanSettingDescriptor: "io.acme.appspec.AppSpecBooleanSettingDescriptor",
    choice: "io.acme.appspec.AppSpecChoice",
    choiceAccessibility: "io.acme.appspec.AppSpecChoiceAccessibility",
    changedEffectRef: "io.acme.appspec.AppSpecChangedEffectRef",
    controlId: "io.acme.appspec.AppSpecControlId",
    enumSettingDescriptor: "io.acme.appspec.AppSpecEnumSettingDescriptor",
    host: "io.acme.appspec.AppSpecHost",
    intentId: "io.acme.appspec.AppSpecIntentId",
    selectorId: "io.acme.appspec.AppSpecSelectorId",
    semanticIconId: "io.acme.appspec.AppSpecSemanticIconId",
    settingDescriptor: "io.acme.appspec.AppSpecSettingDescriptor",
    settingId: "io.acme.appspec.AppSpecSettingId",
    settingStore: "io.acme.appspec.AppSpecSettingStore",
    source: "io.acme.appspec.AppSpecSource",
    toggleAccessibility: "io.acme.appspec.AppSpecToggleAccessibility",
    valueId: "io.acme.appspec.AppSpecValueId",
  },
  productIcons: { menuAccentToken: "io.acme.presentation.MenuAccentToken" },
  productMenus: {
    menuAccentToken: "io.acme.presentation.MenuAccentToken",
    menuActionKey: "io.acme.presentation.MenuActionKey",
    menuIconToken: "io.acme.presentation.MenuIconToken",
    settingId: "io.acme.appspec.AppSpecSettingId",
    valueId: "io.acme.appspec.AppSpecValueId",
    clockFaceCue: "io.acme.core.ClockFaceCue",
    alarmStage: "io.acme.core.flight.AlarmStage",
  },
  settingsComponents: {
    booleanSettingDescriptor: "io.acme.appspec.AppSpecBooleanSettingDescriptor",
    settingDescriptor: "io.acme.appspec.AppSpecSettingDescriptor",
    settingsSection: "io.acme.appspec.AppSpecSettingsSection",
    settingId: "io.acme.appspec.AppSpecSettingId",
    settingRow: "io.acme.appspec.appSpecSettingRow",
    settingsState: "io.acme.settings.SettingsState",
    settingWrite: "io.acme.settings.SettingWrite",
    isoToggleOption: "io.acme.settings.isoToggleOption",
    isoChoiceOption: "io.acme.settings.isoChoiceOption",
  },
  surfaceComponents: {
    ringSurface: "io.acme.surface.RingSurface",
    spatialMode: "io.acme.surface.SpatialMode",
  },
} as const satisfies SkydivingNativeSymbols;

test("renamed consumers supply their own package and native symbols", () => {
  const output = emitHomeActionsKotlin([{
    id: "LOGBOOK",
    group: "PRIMARY",
    reason: "main action",
  }], {
    packageName: "io.acme.generated",
    symbolPrefix: "Acme",
    sourceFile: "product/home-actions.ts",
    sourceSha: "fixture",
    watchChromeHoisted: [],
    nativeSymbols: acmeSymbols.homeActions,
  });
  assert.match(output, /package io\.acme\.generated/u);
  assert.match(output, /import io\.acme\.ui\.home\.HomeActionId/u);
  assert.match(output, /GeneratedAcmeHomeActions/u);
});

test("settings aggregate uses the required product-owned descriptor symbol", () => {
  const output = emitSettingsKotlin({
    kind: "settings-ir",
    appSpecVersion: 5,
    settings: [],
    graph: { nodes: [], edges: [] },
  }, {
    packageName: "io.acme.generated",
    symbolPrefix: "Acme",
    sourceSha: "fixture",
    nativeSymbols: acmeSymbols.settings,
  });
  assert.match(output, /import io\.acme\.appspec\.AppSpecSettingDescriptor/u);
});
