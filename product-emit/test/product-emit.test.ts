import assert from "node:assert/strict";
import test from "node:test";
import {
  emitHomeActionsKotlin,
  emitIsoOptionsKotlin,
  emitProductMenusKotlin,
  emitSettingsKotlin,
  emitStatusIndicatorsKotlin,
  type ProductMenuDeclaration,
  type IsoOptionDeclaration,
  type SkydivingNativeSymbols,
  type StatusIndicatorDeclaration,
  validate as validateProductMenus,
  validateIsoOptions,
} from "../src/skydiving/index.js";

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
  statusIndicators: { statusIndicatorId: "io.acme.ui.status.StatusIndicatorId" },
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

const statusOptions = {
  packageName: "io.acme.generated",
  symbolPrefix: "Acme",
  sourceFile: "product/status-indicators.ts",
  sourceSha: "fixture",
  nativeSymbols: acmeSymbols.statusIndicators,
} as const;

test("status indicators emit a catalogue the host iterates, with seats derived", () => {
  const output = emitStatusIndicatorsKotlin([
    { id: "RECORDING", seat: "FLIGHT_STATE", priority: 30, disclosure: "GLANCE_ONLY", reason: "the act of the jump day" },
    { id: "BATTERY", seat: "DEVICE", priority: 20, disclosure: "ON_REVEAL", reason: "endurance is not flight" },
  ], statusOptions);
  assert.match(output, /import io\.acme\.ui\.status\.StatusIndicatorId/u);
  assert.match(output, /enum class GeneratedAcmeStatusSeat \{ FLIGHT_STATE, DEVICE \}/u);
  // Both disclosure levels cross over even though one product uses one of
  // them, so a native branch breaks when the grammar grows, not when a
  // product starts using what it already declared.
  assert.match(output, /enum class GeneratedAcmeStatusDisclosure \{ GLANCE_ONLY, ON_REVEAL \}/u);
  assert.match(output, /GeneratedAcmeStatusIndicator\(StatusIndicatorId\.RECORDING, GeneratedAcmeStatusSeat\.FLIGHT_STATE, 30, GeneratedAcmeStatusDisclosure\.GLANCE_ONLY\)/u);
  // The reason is the declaration's, not native's.
  assert.doesNotMatch(output, /the act of the jump day/u);
});

test("two indicators cannot hold one seat at one priority", () => {
  const contested: readonly StatusIndicatorDeclaration[] = [
    { id: "AUTOLOCK", seat: "TRANSIENT_CUE", priority: 10, disclosure: "GLANCE_ONLY", reason: "relock countdown" },
    { id: "INSTRUMENT_REASON", seat: "TRANSIENT_CUE", priority: 10, disclosure: "GLANCE_ONLY", reason: "why an instrument is quiet" },
  ];
  assert.throws(
    () => emitStatusIndicatorsKotlin(contested, statusOptions),
    /both claim priority 10 in seat TRANSIENT_CUE/u,
  );
});

test("one priority may repeat across different seats", () => {
  const output = emitStatusIndicatorsKotlin([
    { id: "RECORDING", seat: "FLIGHT_STATE", priority: 10, disclosure: "GLANCE_ONLY", reason: "recording" },
    { id: "BATTERY", seat: "DEVICE", priority: 10, disclosure: "GLANCE_ONLY", reason: "battery" },
  ], statusOptions);
  assert.match(output, /AcmeStatusIndicators/u);
});

test("an iso choice emits total state faces and derives reset from the setting default", () => {
  const options: readonly IsoOptionDeclaration<"MAP" | "LAYERS" | "EYE_OFF">[] = [{
    settingRef: "map.detail",
    tier: "SETTINGS",
    kind: "CHOICE_OF_N",
    dismissal: "STAYS_ON_SURFACE",
    statePresentation: { kind: "FINITE", states: {
      NONE: { icon: "EYE_OFF", tint: "NEUTRAL", explanation: "Fetches no imagery.", resettable: true },
      LOW: { icon: "MAP", tint: "ICON", explanation: "Fetches base imagery.", resettable: true },
      HIGH: { icon: "LAYERS", tint: "ICON", explanation: "Fetches detailed imagery.", resettable: false },
    } },
  }];
  const settings = [{
    id: "map.detail",
    kind: "enum-setting" as const,
    values: [
      { id: "NONE", label: "NONE" },
      { id: "LOW", label: "LOW" },
      { id: "HIGH", label: "HIGH" },
    ],
    defaultValueId: "HIGH",
    control: {
      id: "map-detail",
      title: { text: "MAP DETAIL" },
      hint: { text: "How much imagery to fetch." },
      iconId: "LAYERS",
    },
  }];

  validateIsoOptions(options, settings);
  const output = emitIsoOptionsKotlin(options, settings, [
    { state: "FLOWING", glyph: null, accent: "NEUTRAL", meaning: "Flowing." },
    { state: "LOADING", glyph: "MAP", accent: "NEUTRAL", meaning: "Loading." },
    { state: "OFF", glyph: "EYE_OFF", accent: "NEUTRAL", meaning: "Off." },
    { state: "MISSING", glyph: "LAYERS", accent: "CAUTION", meaning: "Missing." },
  ], {
    packageName: "io.acme.generated",
    symbolPrefix: "Acme",
    sourceFile: "product/iso.ts",
    sourceSha: "fixture",
    nativeSymbols: acmeSymbols.isoOptions,
  });
  assert.match(output, /"NONE" to GeneratedAcmeIsoOptionStateFace\(MenuIconToken\.EYE_OFF, MenuAccentToken\.NEUTRAL, "Fetches no imagery\.", true\)/u);
  assert.match(output, /"HIGH" to GeneratedAcmeIsoOptionStateFace\(MenuIconToken\.LAYERS, null, "Fetches detailed imagery\.", false\)/u);

  const wrongDefault = structuredClone(options) as IsoOptionDeclaration[];
  (wrongDefault[0]!.statePresentation as { kind: "FINITE"; states: Record<string, { resettable: boolean }> })
    .states.HIGH!.resettable = true;
  assert.throws(
    () => validateIsoOptions(wrongDefault, settings),
    /answer 'HIGH' declares resettable=true.*default is 'HIGH'/u,
  );
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

const productMenuFixture = (item: ProductMenuDeclaration["items"][string]): ProductMenuDeclaration => ({
  id: "root",
  localTarget: "settings-section",
  items: { fixture: item },
});

test("product menu actions default to deliberate timing", () => {
  const menu = productMenuFixture({ icon: "SETTINGS", label: "FIXTURE" });
  validateProductMenus([menu], []);
  const output = emitProductMenusKotlin([menu], [], {
    packageName: "io.acme.generated",
    symbolPrefix: "Acme",
    sourceFile: "product/menus.ts",
    sourceSha: "fixture",
    nativeSymbols: acmeSymbols.productMenus,
  });
  assert.match(
    output.contracts,
    /val timing: CircleActionTiming = CircleActionTiming\.DELIBERATE/u,
  );
});

test("product menu rejects immediate cadence on a mutating action", () => {
  const menu = productMenuFixture({
    icon: "SETTINGS",
    label: "FIXTURE",
    cadence: { timing: "immediate", reason: "read-only-navigation" },
  } as ProductMenuDeclaration["items"][string]);
  assert.throws(
    () => validateProductMenus([menu], []),
    /immediate cadence.*read-only navigation/u,
  );
});

test("read-only navigation can declare immediate cadence with its closed reason", () => {
  const menu = productMenuFixture({
    icon: "SETTINGS",
    label: "OPEN",
    routeRef: "HOME",
    cadence: { timing: "immediate", reason: "read-only-navigation" },
  });
  validateProductMenus([menu], []);
  const output = emitProductMenusKotlin([menu], [], {
    packageName: "io.acme.generated",
    symbolPrefix: "Acme",
    sourceFile: "product/menus.ts",
    sourceSha: "fixture",
    nativeSymbols: acmeSymbols.productMenus,
  });
  assert.match(output.menus, /immediateReason = GeneratedAcmeMenuImmediateReason\.READ_ONLY_NAVIGATION/u);
});
