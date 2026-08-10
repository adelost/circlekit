import { kotlinIdentifier, kotlinStringLiteral } from "../core/kotlin-syntax.js";
import type { SourcedKotlinEmissionOptions } from "../core/emission-options.js";
import type { SettingMount, SettingMountIr } from "./setting-mount-model.js";
import type { SettingsComponentsNativeSymbols } from "./native-symbols.js";

/**
 * The hand-written native types the generated rows speak to.
 *
 * Fully qualified, because the emitter both imports and names them. A bare
 * class name would leave the package hardcoded here, so the emitter would
 * write `import <this app's package>.<another product's class>` — output that
 * compiles for exactly one product while looking generic.
 */
export interface SettingsComponentsEmissionOptions extends SourcedKotlinEmissionOptions {
  readonly nativeSymbols: SettingsComponentsNativeSymbols;
}

/**
 * Generic over the section vocabulary, not over one product's copy of it. The
 * emitter reads a section only to order and name it, so the narrow union stays
 * at the call site where it is declared.
 */
export function emitSettingsComponentsKotlin<SectionRef extends string>(
  components: readonly SettingMountIr<SettingMount<SectionRef>>[],
  sectionOrder: readonly SectionRef[],
  options: SettingsComponentsEmissionOptions,
): string {
  const { nativeSymbols } = options;
  const generated = `Generated${options.symbolPrefix}`;
  const settingsState = simpleName(nativeSymbols.settingsState);
  const settingWrite = simpleName(nativeSymbols.settingWrite);
  const sectionComponents = [...components]
    .filter((component) => component.mount.kind === "settings-section")
    .sort((left, right) => {
      const leftMount = left.mount.kind === "settings-section" ? left.mount : null;
      const rightMount = right.mount.kind === "settings-section" ? right.mount : null;
      if (leftMount === null || rightMount === null) return 0;
      const section = sectionOrder.indexOf(leftMount.section) - sectionOrder.indexOf(rightMount.section);
      return section === 0 ? leftMount.order - rightMount.order : section;
    });
  const mounts = sectionComponents.map(({ settingId, mount }) => {
    if (mount.kind !== "settings-section") throw new Error("filtered setting mount changed kind");
    return `        ${generated}SettingMount(${kotlinStringLiteral(settingId)}, AppSpecSettingsSection.${mount.section}),`;
  }).join("\n");
  const rows = sectionOrder.map((section) => {
    const calls = sectionComponents
      .filter(({ mount }) => mount.kind === "settings-section" && mount.section === section)
      .map(({ settingId }) => `            appSpecSettingRow(${generated}Settings.${kotlinIdentifier(settingId)}, state, dispatch),`)
      .join("\n");
    return `        AppSpecSettingsSection.${section} -> listOf(\n${calls}\n        )`;
  }).join("\n");
  const mapObjectLayerComponents = components
    .filter((component) => component.mount.kind === "map-object-layer");
  const mapOverlayComponents = components
    .filter((component) => component.mount.kind === "map-overlay");
  const logEntryComponents = components
    .filter((component) => component.mount.kind === "log-entry-element");
  const productMenuRowComponents = components
    .filter((component) => component.mount.kind === "product-menu-row");
  // A menu row may compose any setting that is mounted somewhere: a shared
  // settings section, or the one surface that owns it.
  const settingCases = [...sectionComponents, ...mapObjectLayerComponents, ...mapOverlayComponents,
    ...logEntryComponents, ...productMenuRowComponents]
    .map(({ settingId }) =>
      `        ${kotlinStringLiteral(settingId)} -> appSpecSettingRow(${generated}Settings.${kotlinIdentifier(settingId)}, state, dispatch)`
    ).join("\n");
  const mapObjectLayers = mapObjectLayerComponents
    .map(({ settingId }) => `        ${generated}Settings.${kotlinIdentifier(settingId)},`)
    .join("\n");
  const mapOverlays = mapOverlayComponents
    .map(({ settingId }) => `        ${generated}Settings.${kotlinIdentifier(settingId)},`)
    .join("\n");
  const logEntryElements = logEntryComponents
    .map(({ settingId }) => `        ${generated}Settings.${kotlinIdentifier(settingId)},`)
    .join("\n");
  const isoSceneOptionIds = components
    .filter((component) => component.mount.kind === "iso-scene-option")
    .map(({ settingId }) => `        ${generated}Settings.${kotlinIdentifier(settingId)}.id,`)
    .join("\n");
  // The projection follows the setting's KIND, not the mount's name. Emitting
  // the boolean helper for every iso-scene-option meant the mount kind accepted
  // an enum that native could not build — a declaration nothing could answer,
  // which is the exact failure #890 closed for destination rows.
  const isoSceneOptions = components
    .filter((component) => component.mount.kind === "iso-scene-option")
    .map(({ settingId, kind }) => {
      const helper = simpleName(
        kind === "enum-setting" ? nativeSymbols.isoChoiceOption : nativeSymbols.isoToggleOption,
      );
      return `        ${helper}(${generated}Settings.${kotlinIdentifier(settingId)}, state, dispatch, menuOccludesScene),`;
    })
    .join("\n");

  return `// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM ${options.sourceFile}
// Generator SHA-256: ${options.sourceSha}
package ${options.packageName}

import ${nativeSymbols.booleanSettingDescriptor}
import ${nativeSymbols.settingDescriptor}
import ${nativeSymbols.settingsSection}
import ${nativeSymbols.settingId}
import ${nativeSymbols.settingWrite}
import ${nativeSymbols.settingsState}
import ${nativeSymbols.isoChoiceOption}
import ${nativeSymbols.isoToggleOption}
import ${nativeSymbols.settingRow}
import com.adelost.ringkit.ui.EdgeMenuOption
import com.adelost.ringkit.ui.RowSpec

data class ${generated}SettingMount(val declarationId: String, val section: AppSpecSettingsSection)

object ${generated}SettingsComponents {
    val mounts: List<${generated}SettingMount> = listOf(
${mounts}
    )

    fun settingsRows(
        section: AppSpecSettingsSection,
        state: ${settingsState},
        dispatch: (${settingWrite}) -> Unit,
    ): List<RowSpec> = when (section) {
${rows}
    }

    fun settingRow(
        settingId: AppSpecSettingId,
        state: ${settingsState},
        dispatch: (${settingWrite}) -> Unit,
    ): RowSpec = when (settingId.value) {
${settingCases}
        else -> error("Setting '\${settingId.value}' is not mounted anywhere a menu can compose")
    }

    /**
     * The map object layers, in the order the map menu reads them. Their wire
     * names are the keys they are stored under, so the native store derives
     * both the list and the keys from here instead of repeating either.
     */
    val mapObjectLayers: List<AppSpecBooleanSettingDescriptor> = listOf(
${mapObjectLayers}
    )

    /**
     * The map overlays, in menu order. Whether the map product can draw one is
     * a native question and is not answered here.
     */
    val mapOverlays: List<AppSpecSettingDescriptor> = listOf(
${mapOverlays}
    )

    /**
     * The logbook row elements, in menu order. Each is stored as membership in
     * one collection, not as a key of its own.
     */
    val logEntryElements: List<AppSpecBooleanSettingDescriptor> = listOf(
${logEntryElements}
    )

    /**
     * The settings shown only on the ISO surface. Named so a sweep can tell an
     * orphan from a setting that is simply read where it takes effect.
     */
    val isoSceneOptionSettingIds: List<AppSpecSettingId> = listOf(
${isoSceneOptionIds}
    )

    fun isoSceneOptions(
        state: ${settingsState},
        dispatch: (${settingWrite}) -> Unit,
        /** See RingMenuOverlay.ISO_MENU_OCCLUDES_SCENE: the ONE presentation fact. */
        menuOccludesScene: Boolean,
    ): List<EdgeMenuOption> = listOf(
${isoSceneOptions}
    )
}
`;
}

/** Kotlin's own rule: an import binds the last segment. */
function simpleName(qualified: string): string {
  const name = qualified.slice(qualified.lastIndexOf(".") + 1);
  if (name.length === 0) throw new Error(`native symbol '${qualified}' names no class`);
  return name;
}
