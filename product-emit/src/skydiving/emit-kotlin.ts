import { indent, kotlinEnumToken, kotlinIdentifier, kotlinStringLiteral } from "../core/kotlin-syntax.js";
import type { KotlinEmissionOptions } from "../core/emission-options.js";
import type { BooleanSettingIr, EnumSettingIr, NormalizedSettingsIr, SettingIr } from "./model.js";
import type { SettingsDescriptorNativeSymbols } from "./native-symbols.js";

export type { KotlinEmissionOptions };

export interface SettingsKotlinEmissionOptions extends KotlinEmissionOptions {
  readonly nativeSymbols: SettingsDescriptorNativeSymbols;
}

export interface KotlinSettingGroup {
  readonly id: string;
  readonly settingIds: readonly string[];
}

export interface KotlinSettingsFiles {
  readonly aggregate: string;
  readonly groups: readonly { readonly id: string; readonly content: string }[];
}

/** Emits portable metadata only. Native Kotlin owns types, state and effects. */
export function emitSettingsKotlin<EffectRef extends string>(
  ir: NormalizedSettingsIr<EffectRef>,
  options: SettingsKotlinEmissionOptions,
): string {
  return emitDescriptorFile(ir.settings, aggregateName(options), ir.appSpecVersion, options);
}

/** Splits a product catalogue at its already-declared section seams while
 * preserving one small aggregate API for native consumers. */
export function emitSettingsKotlinFiles<EffectRef extends string>(
  ir: NormalizedSettingsIr<EffectRef>,
  options: SettingsKotlinEmissionOptions,
  groups: readonly KotlinSettingGroup[],
): KotlinSettingsFiles {
  // The groups are a partition of the catalogue, checked by
  // validateSettingGroups before any emitter runs (R2/R3).
  const ownerBySettingId = new Map(groups.flatMap((group) =>
    group.settingIds.map((settingId) => [settingId, group.id] as const)));

  const outputs = groups.map((group) => {
    const settings = ir.settings.filter(({ id }) => ownerBySettingId.get(id) === group.id);
    return {
      id: group.id,
      content: emitDescriptorFile(
        settings,
        groupName(options, group.id),
        ir.appSpecVersion,
        options,
      ),
    };
  });
  const aliases = ir.settings.map((setting) => {
    const groupId = ownerBySettingId.get(setting.id)!;
    return `    val ${kotlinIdentifier(setting.id)} = ${groupName(options, groupId)}.${kotlinIdentifier(setting.id)}`;
  }).join("\n");
  const all = ir.settings.map((setting) => kotlinIdentifier(setting.id)).join(", ");
  const aggregate = `// GENERATED FILE — DO NOT EDIT
// AppSpec ${ir.appSpecVersion} · portable settings aggregate
// Generator source ${options.sourceSha}
package ${options.packageName}

import ${options.nativeSymbols.settingDescriptor}

object ${aggregateName(options)} {
${aliases}

    val all: List<AppSpecSettingDescriptor> = listOf(${all})
}
`;
  return { aggregate, groups: outputs };
}

/** The one object a native consumer imports for the whole catalogue. */
function aggregateName(options: KotlinEmissionOptions): string {
  return `Generated${options.symbolPrefix}Settings`;
}

/** One split file's object, named after the group seam it was cut at. */
function groupName(options: KotlinEmissionOptions, groupId: string): string {
  return `Generated${options.symbolPrefix}${kotlinIdentifier(groupId)}Settings`;
}

function emitDescriptorFile<EffectRef extends string>(
  settings: readonly SettingIr<EffectRef>[],
  objectName: string,
  appSpecVersion: number,
  options: SettingsKotlinEmissionOptions,
): string {
  const descriptors = settings.map(emitDescriptor).join("\n\n");
  const all = settings.map((setting) => kotlinIdentifier(setting.id)).join(", ");
  return `// GENERATED FILE — DO NOT EDIT
// AppSpec ${appSpecVersion} · portable settings IR
// Generator source ${options.sourceSha}
package ${options.packageName}

import ${options.nativeSymbols.booleanSettingDescriptor}
import ${options.nativeSymbols.choice}
import ${options.nativeSymbols.choiceAccessibility}
import ${options.nativeSymbols.changedEffectRef}
import ${options.nativeSymbols.controlId}
import ${options.nativeSymbols.enumSettingDescriptor}
import ${options.nativeSymbols.host}
import ${options.nativeSymbols.intentId}
import ${options.nativeSymbols.selectorId}
import ${options.nativeSymbols.semanticIconId}
import ${options.nativeSymbols.settingDescriptor}
import ${options.nativeSymbols.settingId}
import ${options.nativeSymbols.settingStore}
import ${options.nativeSymbols.source}
import ${options.nativeSymbols.toggleAccessibility}
import ${options.nativeSymbols.valueId}

object ${objectName} {
${indent(descriptors, 4)}

    val all: List<AppSpecSettingDescriptor> = listOf(${all})
}
`;
}

function emitDescriptor<EffectRef extends string>(setting: SettingIr<EffectRef>): string {
  return setting.kind === "enum-setting" ? emitEnumDescriptor(setting) : emitBooleanDescriptor(setting);
}

function emitEnumDescriptor<EffectRef extends string>(setting: EnumSettingIr<EffectRef>): string {
  const choices = setting.values.map((choice) =>
    `AppSpecChoice(AppSpecValueId(${kotlinStringLiteral(choice.id)}), ${kotlinStringLiteral(choice.label)})`
  ).join(",\n");
  return `// GENERATED FROM ${setting.source.file}#${setting.source.declarationId}
val ${kotlinIdentifier(setting.id)} = AppSpecEnumSettingDescriptor(
    id = AppSpecSettingId(${kotlinStringLiteral(setting.id)}),
    wireName = ${kotlinStringLiteral(setting.wireName)},
    store = AppSpecSettingStore.${kotlinEnumToken(setting.persistence.storeRef)},
    changedEffectRef = ${emitChangedEffectRef(setting)},
    defaultValueId = AppSpecValueId(${kotlinStringLiteral(setting.defaultValueId)}),
    choices = listOf(
${indent(choices, 8)},
    ),
    selectorId = AppSpecSelectorId(${kotlinStringLiteral(setting.selector.id)}),
    intentId = AppSpecIntentId(${kotlinStringLiteral(setting.intent.id)}),
    controlId = AppSpecControlId(${kotlinStringLiteral(setting.control.id)}),
    title = ${kotlinStringLiteral(setting.control.title.text)},
    hint = ${kotlinStringLiteral(setting.control.hint.text)},
    iconId = AppSpecSemanticIconId(${kotlinStringLiteral(setting.control.iconId)}),
    requiredHosts = ${emitHosts(setting)},
    accessibility = AppSpecChoiceAccessibility(AppSpecChoiceAccessibility.Role.ADJUSTABLE,
        ${kotlinStringLiteral(setting.control.accessibility.label)}, AppSpecChoiceAccessibility.Value.SELECTED_LABEL,
        AppSpecChoiceAccessibility.Action.SELECT_CHOICE, false),
    source = ${emitSource(setting)},
)`;
}

function emitBooleanDescriptor<EffectRef extends string>(setting: BooleanSettingIr<EffectRef>): string {
  return `// GENERATED FROM ${setting.source.file}#${setting.source.declarationId}
val ${kotlinIdentifier(setting.id)} = AppSpecBooleanSettingDescriptor(
    id = AppSpecSettingId(${kotlinStringLiteral(setting.id)}),
    wireName = ${kotlinStringLiteral(setting.wireName)},
    store = AppSpecSettingStore.${kotlinEnumToken(setting.persistence.storeRef)},
    changedEffectRef = ${emitChangedEffectRef(setting)},
    defaultValue = ${setting.defaultValue},
    falseLabel = ${kotlinStringLiteral(setting.labels.false)},
    trueLabel = ${kotlinStringLiteral(setting.labels.true)},
    selectorId = AppSpecSelectorId(${kotlinStringLiteral(setting.selector.id)}),
    intentId = AppSpecIntentId(${kotlinStringLiteral(setting.intent.id)}),
    controlId = AppSpecControlId(${kotlinStringLiteral(setting.control.id)}),
    title = ${kotlinStringLiteral(setting.control.title.text)},
    hint = ${kotlinStringLiteral(setting.control.hint.text)},
    iconId = AppSpecSemanticIconId(${kotlinStringLiteral(setting.control.iconId)}),
    requiredHosts = ${emitHosts(setting)},
    accessibility = AppSpecToggleAccessibility(AppSpecToggleAccessibility.Role.SWITCH,
        ${kotlinStringLiteral(setting.control.accessibility.label)}, AppSpecToggleAccessibility.Value.CHECKED_LABEL,
        AppSpecToggleAccessibility.Action.TOGGLE, false),
    source = ${emitSource(setting)},
)`;
}


function emitChangedEffectRef<EffectRef extends string>(setting: SettingIr<EffectRef>): string {
  return setting.changedEffectRef === undefined
    ? "null"
    : `AppSpecChangedEffectRef(${kotlinStringLiteral(setting.changedEffectRef)})`;
}

function emitHosts<EffectRef extends string>(setting: SettingIr<EffectRef>): string {
  return `setOf(${setting.requiredHosts.map((host) => `AppSpecHost.${kotlinEnumToken(host)}`).join(", ")})`;
}

function emitSource<EffectRef extends string>(setting: SettingIr<EffectRef>): string {
  return `AppSpecSource(${kotlinStringLiteral(setting.source.file)}, ${kotlinStringLiteral(setting.source.declarationId)})`;
}
