import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const scratch = mkdtempSync(join(tmpdir(), "product-emit-acme-"));
const packed = execFileSync("npm", ["pack", "--ignore-scripts", "--pack-destination", scratch], {
  cwd: root,
  encoding: "utf8",
}).trim().split("\n").at(-1);
if (packed === undefined) throw new Error("npm pack did not return a tarball");

writeFileSync(join(scratch, "package.json"), JSON.stringify({
  private: true,
  type: "module",
  dependencies: { "@v1d/product-emit": `file:${join(scratch, packed)}` },
}, null, 2));
writeFileSync(join(scratch, "tsconfig.json"), JSON.stringify({
  compilerOptions: {
    target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext",
    strict: true, noEmit: true, skipLibCheck: true,
  },
  include: ["acme.ts"],
}, null, 2));
writeFileSync(join(scratch, "acme.ts"), `
import { kotlinIdentifier } from "@v1d/product-emit/core";
import type { SkydivingNativeSymbols } from "@v1d/product-emit/skydiving";

const symbols = {
  homeActions: { homeActionId: "dev.acme.ui.AcmeAction" },
  interactions: {
    continuousInteractionContract: "dev.acme.native.Continuous", discreteInteractionContract: "dev.acme.native.Discrete",
    host: "dev.acme.native.Host", interactionCatalog: "dev.acme.native.Catalog",
    interactionControlId: "dev.acme.native.ControlId", interactionMount: "dev.acme.native.Mount",
    interactionMountId: "dev.acme.native.MountId", interactionPolicyHandle: "dev.acme.native.Policy",
    interactionSource: "dev.acme.native.Source", settingId: "dev.acme.native.SettingId",
  },
  isoOptions: { menuAccentToken: "dev.acme.native.Accent", menuIconToken: "dev.acme.native.Icon" },
  settings: {
    booleanSettingDescriptor: "dev.acme.native.BooleanSetting", choice: "dev.acme.native.Choice",
    choiceAccessibility: "dev.acme.native.ChoiceA11y", changedEffectRef: "dev.acme.native.EffectRef",
    controlId: "dev.acme.native.ControlId", enumSettingDescriptor: "dev.acme.native.EnumSetting",
    host: "dev.acme.native.Host", intentId: "dev.acme.native.IntentId", selectorId: "dev.acme.native.SelectorId",
    semanticIconId: "dev.acme.native.IconId", settingDescriptor: "dev.acme.native.Setting",
    settingId: "dev.acme.native.SettingId", settingStore: "dev.acme.native.Store",
    source: "dev.acme.native.Source", toggleAccessibility: "dev.acme.native.ToggleA11y",
    valueId: "dev.acme.native.ValueId",
  },
  productIcons: { menuAccentToken: "dev.acme.native.Accent" },
  productMenus: {
    menuAccentToken: "dev.acme.native.Accent", menuActionKey: "dev.acme.native.ActionKey",
    menuIconToken: "dev.acme.native.Icon", settingId: "dev.acme.native.SettingId",
    valueId: "dev.acme.native.ValueId", clockFaceCue: "dev.acme.native.ClockCue",
    alarmStage: "dev.acme.native.AlarmStage",
  },
  settingsComponents: {
    booleanSettingDescriptor: "dev.acme.native.BooleanSetting", settingDescriptor: "dev.acme.native.Setting",
    settingsSection: "dev.acme.native.Section", settingId: "dev.acme.native.SettingId",
    settingRow: "dev.acme.native.settingRow", settingsState: "dev.acme.native.State",
    settingWrite: "dev.acme.native.Write", isoToggleOption: "dev.acme.native.toggleOption",
    isoChoiceOption: "dev.acme.native.choiceOption",
  },
  surfaceComponents: { ringSurface: "dev.acme.native.Surface", spatialMode: "dev.acme.native.SpatialMode" },
} as const satisfies SkydivingNativeSymbols;

const generatedName: string = kotlinIdentifier("acme-main");
const nativeSymbol: string = symbols.homeActions.homeActionId;
if (generatedName.length === 0 || nativeSymbol.length === 0) throw new Error("Acme fixture is incomplete");
`);

execFileSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: scratch, stdio: "inherit" });
execFileSync(resolve(root, "node_modules/typescript/bin/tsc"), ["-p", join(scratch, "tsconfig.json")], {
  cwd: scratch,
  stdio: "inherit",
});
console.log(`product-emit packed Acme consumer: PASS (${packed})`);
