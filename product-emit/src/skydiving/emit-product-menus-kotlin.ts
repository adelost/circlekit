import { kotlinEnumToken, kotlinIdentifier, kotlinLabel, kotlinStringLiteral } from "../core/kotlin-syntax.js";
import type { SourcedKotlinEmissionOptions } from "../core/emission-options.js";
import { MENU_HINT_MAX_CHARS, MENU_LABEL_MAX_CHARS } from "./menu-text-budget.js";
import type { SettingIr } from "./model.js";
import type { ProductMenusNativeSymbols } from "./native-symbols.js";

import {
  type AnyProductMenu,
  type AnyProductMenuItem,
  type AnyProductMenuVisualItem,
  isNativeRowsItem,
  isNativeToggleItem,
  isSettingItem,
  isSettingValueItem,
  wireId,
} from "./product-menu-types.js";

export function emitProductMenusKotlin<EffectRef extends string>(
  menus: readonly AnyProductMenu[],
  settings: readonly SettingIr<EffectRef>[],
  options: SourcedKotlinEmissionOptions & { readonly nativeSymbols: ProductMenusNativeSymbols },
): { readonly contracts: string; readonly menus: string } {
  const generated = `Generated${options.symbolPrefix}`;
  const settingById = new Map(settings.map((setting) => [setting.id, setting]));
  const hostActionMenus = menus.filter((menu) => hostActionRefs(menu).length > 0);
  const inputPorts = menuNativeRefs(menus);
  const contracts = `// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM ${options.sourceFile}
// Product declaration SHA-256: ${options.sourceSha}
package ${options.packageName}

import ${options.nativeSymbols.menuAccentToken}
import ${options.nativeSymbols.menuActionKey}
import ${options.nativeSymbols.menuIconToken}
import com.adelost.designkit.ui.CircleActionTiming
import ${options.nativeSymbols.settingId}
import ${options.nativeSymbols.valueId}
import ${options.nativeSymbols.clockFaceCue}
import ${options.nativeSymbols.alarmStage}

${hostActionMenus.map((menu) => emitHostActionEnum(menu, generated)).join("\n")}
enum class ${generated}ProductInputPort(val wireId: String) {
${inputPorts.map((ref) => `    ${kotlinEnumToken(ref)}(${kotlinStringLiteral(ref)}),`).join("\n")}
}

enum class ${generated}MenuRef(val wireId: String) {
${menus.map((menu) => `    ${kotlinEnumToken(menu.id)}(${kotlinStringLiteral(menu.id)}),`).join("\n")}
}

sealed interface ${generated}DiscreteActionDestination {
    data class Surface(val intent: ${generated}RouteIntent) : ${generated}DiscreteActionDestination
    data class Menu(val ref: ${generated}MenuRef) : ${generated}DiscreteActionDestination
}

sealed interface ${generated}MenuTarget {
    data class SettingsSection(val key: MenuActionKey) : ${generated}MenuTarget
    data class MapControl(val key: MenuActionKey) : ${generated}MenuTarget
    data class AlarmAction(
        val key: MenuActionKey,
        val stage: AlarmStage,
        val stepM: Int,
    ) : ${generated}MenuTarget
    data class ClockFaceCueAction(
        val key: MenuActionKey,
        val cue: ClockFaceCue,
        val valueLabel: String,
    ) : ${generated}MenuTarget
    data class ClockFaceWeightAction(val key: MenuActionKey) : ${generated}MenuTarget
    data class PortAction(
        val key: MenuActionKey,
        val port: ${generated}ProductInputPort,
    ) : ${generated}MenuTarget
    data class Information(val text: String) : ${generated}MenuTarget
    data class Setting(val settingId: AppSpecSettingId) : ${generated}MenuTarget
    /** This row IS one value of the setting; the menu is the choice list. */
    data class SettingValue(
        val key: MenuActionKey,
        val settingId: AppSpecSettingId,
        val valueId: AppSpecValueId,
    ) : ${generated}MenuTarget
${hostActionMenus.map((menu) => emitHostActionTarget(menu, generated)).join("\n")}
    data class Destination(
        val destination: ${generated}DiscreteActionDestination,
    ) : ${generated}MenuTarget {
        constructor(screen: ${generated}PageRef) : this(
            ${generated}DiscreteActionDestination.Surface(${generated}RouteIntent(screen)),
        )
    }
}

/**
 * One position in a menu's declared order: either a row the product owns, or a
 * slot native fills. The reason travels with the slot, so a screen cannot quietly
 * grow native rows nobody named.
 */
sealed interface ${generated}MenuElement {
    data class Row(val item: ${generated}MenuItem) : ${generated}MenuElement
    data class NativeRows(
        val key: MenuActionKey,
        val port: ${generated}ProductInputPort,
        val reason: String,
    ) : ${generated}MenuElement

    /** A row the product owns whose VALUE and write belong to [port]. */
    data class NativeToggle(
        val key: MenuActionKey,
        val port: ${generated}ProductInputPort,
        val label: String,
        val icon: MenuIconToken,
        val hint: String,
        val reason: String,
    ) : ${generated}MenuElement
}

/** One product menu as data: what it is called and what it offers. */
data class ${generated}ProductMenu(
    val id: String,
    val label: String,
    val items: List<${generated}MenuItem>,
    val elements: List<${generated}MenuElement>,
)

/** Why a generated menu row may bypass the safe deliberate default. */
enum class ${generated}MenuImmediateReason { READ_ONLY_NAVIGATION }

data class ${generated}MenuItem(
    val key: MenuActionKey,
    val label: String,
    val hint: String?,
    val icon: MenuIconToken,
    val accent: MenuAccentToken = icon.defaultAccent,
    val timing: CircleActionTiming = CircleActionTiming.DELIBERATE,
    val immediateReason: ${generated}MenuImmediateReason? = null,
    val destructive: Boolean = false,
    val target: ${generated}MenuTarget,
) {
    init {
        require(!destructive || timing == CircleActionTiming.DELIBERATE) {
            "destructive generated menu actions must use deliberate timing"
        }
        require((timing == CircleActionTiming.IMMEDIATE) == (immediateReason != null)) {
            "immediate generated menu actions must carry a closed reason"
        }
        require(immediateReason == null || target is ${generated}MenuTarget.Destination) {
            "immediate generated menu actions are read-only navigation only"
        }
    }
}

internal fun localItem(
    id: String,
    label: String,
    icon: MenuIconToken,
    accent: MenuAccentToken = icon.defaultAccent,
    destructive: Boolean = false,
    target: (MenuActionKey) -> ${generated}MenuTarget,
    hint: String? = null,
): ${generated}MenuItem {
    val key = MenuActionKey(id)
    return ${generated}MenuItem(key, label, hint, icon, accent, destructive = destructive, target = target(key))
}

internal fun settingsItem(
    id: String,
    label: String,
    icon: MenuIconToken,
    accent: MenuAccentToken = icon.defaultAccent,
    destructive: Boolean = false,
) = localItem(id, label, icon, accent, destructive, ${generated}MenuTarget::SettingsSection)

internal fun mapItem(
    id: String,
    label: String,
    icon: MenuIconToken,
    accent: MenuAccentToken = icon.defaultAccent,
    destructive: Boolean = false,
) = localItem(id, label, icon, accent, destructive, ${generated}MenuTarget::MapControl)

internal fun actionItem(
    id: String,
    label: String,
    hint: String?,
    icon: MenuIconToken,
    accent: MenuAccentToken = icon.defaultAccent,
    destructive: Boolean = false,
    target: (MenuActionKey) -> ${generated}MenuTarget,
) = localItem(id, label, icon, accent, destructive, target, hint)

internal fun informationItem(
    id: String,
    label: String,
    hint: String?,
    text: String,
    icon: MenuIconToken,
    accent: MenuAccentToken = icon.defaultAccent,
) = localItem(
    id,
    label,
    icon,
    accent,
    target = { ${generated}MenuTarget.Information(text) },
    hint = hint,
)

internal fun surfaceDestinationItem(
    id: String,
    label: String,
    hint: String?,
    icon: MenuIconToken,
    screen: ${generated}PageRef,
    accent: MenuAccentToken = icon.defaultAccent,
    immediateReason: ${generated}MenuImmediateReason? = null,
    destructive: Boolean = false,
) = ${generated}MenuItem(
    MenuActionKey(id), label, hint, icon, accent,
    timing = if (immediateReason == null) CircleActionTiming.DELIBERATE else CircleActionTiming.IMMEDIATE,
    immediateReason = immediateReason,
    destructive = destructive,
    target = ${generated}MenuTarget.Destination(screen),
)

internal fun menuDestinationItem(
    id: String,
    label: String,
    hint: String?,
    icon: MenuIconToken,
    menu: ${generated}MenuRef,
    accent: MenuAccentToken = icon.defaultAccent,
    immediateReason: ${generated}MenuImmediateReason? = null,
    destructive: Boolean = false,
) = ${generated}MenuItem(
    MenuActionKey(id), label, hint, icon, accent,
    timing = if (immediateReason == null) CircleActionTiming.DELIBERATE else CircleActionTiming.IMMEDIATE,
    immediateReason = immediateReason,
    destructive = destructive,
    target = ${generated}MenuTarget.Destination(${generated}DiscreteActionDestination.Menu(menu)),
)

/**
 * The copy budget every generated menu label and hint was measured against,
 * stated so it can be checked rather than re-enforced. The declaration is
 * validated at authoring time, so a row that overflows never reaches a build.
 * What this object guards is the other direction: that the numbers the
 * generator measured by are still the numbers the round face renders by.
 * MenuTextBudgetTest binds it to MenuDesign, and either side moving goes red.
 */
object ${generated}MenuTextBudget {
    const val labelMaxChars: Int = ${MENU_LABEL_MAX_CHARS}
    const val hintMaxChars: Int = ${MENU_HINT_MAX_CHARS}
}
`;

  const declarations = `// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM ${options.sourceFile}
// Product declaration SHA-256: ${options.sourceSha}
package ${options.packageName}

import ${options.nativeSymbols.menuAccentToken}
import ${options.nativeSymbols.menuActionKey}
import ${options.nativeSymbols.menuIconToken}
import com.adelost.designkit.ui.CircleActionTiming
import ${options.nativeSymbols.settingId}
import ${options.nativeSymbols.valueId}
import ${options.nativeSymbols.clockFaceCue}
import ${options.nativeSymbols.alarmStage}

${menus.map((menu) => emitMenu(menu, settingById, generated)).join("\n\n")}

/**
 * Every product menu, from the same declaration the objects above are emitted
 * from. A test that sweeps this cannot miss the next menu, which is the whole
 * reason it exists rather than a hand-kept list somewhere.
 */
object ${generated}ProductMenus {
    val all: List<${generated}ProductMenu> = listOf(
${menus.map((menu) =>
  `        ${generated}ProductMenu(${kotlinStringLiteral(menu.id)}, ${generated}${kotlinIdentifier(menu.id)}Menu.label, ${generated}${kotlinIdentifier(menu.id)}Menu.items, ${generated}${kotlinIdentifier(menu.id)}Menu.elements),`
).join("\n")}
    )

    fun menu(id: String): ${generated}ProductMenu = all.single { it.id == id }
}
`;
  return { contracts, menus: declarations };
}

/** Closed payload vocabulary for the mounted settings component. */
function menuNativeRefs(menus: readonly AnyProductMenu[]): string[] {
  return [...new Set(menus.flatMap((menu) => Object.values(menu.items).flatMap((item) => {
    if (isNativeRowsItem(item)) return [item.nativeRowsRef];
    if (isNativeToggleItem(item)) return [item.nativeToggleRef];
    if ("action" in item && item.action?.kind === "port") return [item.action.ref];
    return [];
  })))];
}


function emitMenu<EffectRef extends string>(
  menu: AnyProductMenu,
  settingById: ReadonlyMap<string, SettingIr<EffectRef>>,
  generated: string,
): string {
  const entries = Object.entries(menu.items);
  const objectName = `${generated}${kotlinIdentifier(menu.id)}Menu`;
  const values = entries.map(([id, item]) => emitItem(menu, id, item, settingById, generated)).join("\n");
  // `items` stays the rows the product declares; `elements` is the declared
  // ORDER, slots included, so a screen can render top to bottom from one source.
  const generatedItems = entries
    .filter(([, item]) => !isNativeRowsItem(item) && !isNativeToggleItem(item))
    .map(([id]) => kotlinIdentifier(id)).join(", ");
  const generatedElements = entries
    .map(([id, item]) => isNativeRowsItem(item) || isNativeToggleItem(item)
      ? kotlinIdentifier(id)
      : `${generated}MenuElement.Row(${kotlinIdentifier(id)})`)
    .join(", ");
  return `object ${objectName} {
    const val label: String = ${kotlinStringLiteral(menu.label ?? kotlinLabel(menu.id))}
${values}
    val items: List<${generated}MenuItem> = listOf(${generatedItems})
    val elements: List<${generated}MenuElement> = listOf(${generatedElements})
    fun item(key: MenuActionKey): ${generated}MenuItem = items.single { it.key == key }
}`;
}

function emitItem<EffectRef extends string>(
  menu: AnyProductMenu,
  id: string,
  item: AnyProductMenuItem,
  settingById: ReadonlyMap<string, SettingIr<EffectRef>>,
  generated: string,
): string {
  if (isSettingItem(item)) {
    const setting = settingById.get(item.settingRef);
    if (setting === undefined) throw new Error(`validator gap: menu item '${id}' passed validation with no compiled setting '${item.settingRef}'`);
    const icon = kotlinEnumToken(setting.control.iconId);
    if (icon.length === 0) throw new Error(`validator gap: setting '${setting.id}' passed validation with no menu icon binding`);
    return `    val ${kotlinIdentifier(id)} = actionItem(${kotlinStringLiteral(setting.control.id)}, ${kotlinStringLiteral(setting.control.title.text)}, ${kotlinStringLiteral(setting.control.hint.text)}, MenuIconToken.${icon}) { ${generated}MenuTarget.Setting(AppSpecSettingId(${kotlinStringLiteral(setting.id)})) }`;
  }
  if (isNativeRowsItem(item)) {
    return `    val ${kotlinIdentifier(id)} = ${generated}MenuElement.NativeRows(MenuActionKey(${kotlinStringLiteral(item.wireId)}), ${generated}ProductInputPort.${kotlinEnumToken(item.nativeRowsRef)}, ${kotlinStringLiteral(item.reason)})`;
  }
  if (isNativeToggleItem(item)) {
    return `    val ${kotlinIdentifier(id)} = ${generated}MenuElement.NativeToggle(MenuActionKey(${kotlinStringLiteral(item.wireId)}), ${generated}ProductInputPort.${kotlinEnumToken(item.nativeToggleRef)}, ${kotlinStringLiteral(item.label)}, MenuIconToken.${item.icon}, ${kotlinStringLiteral(item.hint)}, ${kotlinStringLiteral(item.reason)})`;
  }
  if (isSettingValueItem(item)) {
    const icon = item.icon;
    const label = kotlinStringLiteral(item.label ?? kotlinLabel(id));
    const key = kotlinStringLiteral(wireId(menu, id, item));
    return `    val ${kotlinIdentifier(id)} = actionItem(${key}, ${label}, ${nullableQuoted(item.hint)}, MenuIconToken.${icon}) { key -> ${generated}MenuTarget.SettingValue(key, AppSpecSettingId(${kotlinStringLiteral(item.settingValueRef.setting)}), AppSpecValueId(${kotlinStringLiteral(item.settingValueRef.value)})) }`;
  }
  const key = kotlinStringLiteral(wireId(menu, id, item));
  const accent = item.accent ? `, accent = MenuAccentToken.${item.accent}` : "";
  const interaction = interactionArguments(item, generated);
  const label = kotlinStringLiteral(item.label ?? kotlinLabel(id));
  let constructor: string;
  if ("routeRef" in item && item.routeRef !== undefined) {
    constructor = `surfaceDestinationItem(${key}, ${label}, ${nullableQuoted(item.hint)}, MenuIconToken.${item.icon}, ${generated}PageRef.${item.routeRef}${accent}${interaction})`;
  } else if (item.menuRef !== undefined) {
    constructor = `menuDestinationItem(${key}, ${label}, ${nullableQuoted(item.hint)}, MenuIconToken.${item.icon}, ${generated}MenuRef.${kotlinEnumToken(item.menuRef)}${accent}${interaction})`;
  } else if ("information" in item && item.information !== undefined) {
    constructor = `informationItem(${key}, ${label}, ${nullableQuoted(item.hint)}, ${kotlinStringLiteral(item.information)}, MenuIconToken.${item.icon}${accent})`;
  } else if (item.action !== undefined) {
    switch (item.action.kind) {
      case "alarm":
        constructor = `actionItem(${key}, ${label}, ${kotlinStringLiteral(validatedHint(menu, id, item.hint))}, MenuIconToken.${item.icon}${accent}${interaction}) { key -> ${generated}MenuTarget.AlarmAction(key, AlarmStage.${item.action.stage}, ${item.action.stepM}) }`;
        break;
      case "clock-face-cue":
        constructor = `actionItem(${key}, ${label}, ${nullableQuoted(item.hint)}, MenuIconToken.${item.icon}${accent}${interaction}) { key -> ${generated}MenuTarget.ClockFaceCueAction(key, ClockFaceCue.${item.action.cue}, ${kotlinStringLiteral(item.action.valueLabel)}) }`;
        break;
      case "clock-face-weight":
        constructor = `actionItem(${key}, ${label}, ${nullableQuoted(item.hint)}, MenuIconToken.${item.icon}${accent}${interaction}) { key -> ${generated}MenuTarget.ClockFaceWeightAction(key) }`;
        break;
      case "host":
        constructor = `actionItem(${key}, ${label}, ${nullableQuoted(item.hint)}, MenuIconToken.${item.icon}${accent}${interaction}) { key -> ${generated}MenuTarget.${kotlinIdentifier(menu.id)}Action(key, ${generated}${kotlinIdentifier(menu.id)}Action.${item.action.ref}) }`;
        break;
      case "port":
        constructor = `actionItem(${key}, ${label}, ${nullableQuoted(item.hint)}, MenuIconToken.${item.icon}${accent}${interaction}) { key -> ${generated}MenuTarget.PortAction(key, ${generated}ProductInputPort.${kotlinEnumToken(item.action.ref)}) }`;
        break;
    }
  } else {
    if (menu.localTarget === "alarm-action" || menu.localTarget === "clock-face-action" || menu.localTarget === "host-action") {
      throw new Error(`validator gap: action menu '${menu.id}' item '${id}' passed validation with no typed action`);
    }
    const helper = menu.localTarget === "settings-section" ? "settingsItem" : "mapItem";
    constructor = `${helper}(${key}, ${label}, MenuIconToken.${item.icon}${accent}${interaction})`;
  }
  return `    val ${kotlinIdentifier(id)} = ${constructor}`;
}


function hostActionRefs(menu: AnyProductMenu): string[] {
  return [...new Set(Object.values(menu.items).flatMap((item) =>
    !isSettingItem(item) && !isSettingValueItem(item) && !isNativeRowsItem(item) && !isNativeToggleItem(item)
      && item.action?.kind === "host"
      ? [item.action.ref]
      : []
  ))];
}

function emitHostActionEnum(menu: AnyProductMenu, generated: string): string {
  return `enum class ${generated}${kotlinIdentifier(menu.id)}Action { ${hostActionRefs(menu).join(", ")} }`;
}

function emitHostActionTarget(menu: AnyProductMenu, generated: string): string {
  const name = kotlinIdentifier(menu.id);
  return `    data class ${name}Action(
        val key: MenuActionKey,
        val action: ${generated}${name}Action,
    ) : ${generated}MenuTarget`;
}




function interactionArguments(item: AnyProductMenuVisualItem, generated: string): string {
  const immediateReason = "cadence" in item && item.cadence !== undefined
    ? `, immediateReason = ${generated}MenuImmediateReason.READ_ONLY_NAVIGATION`
    : "";
  return item.destructive === true ? `${immediateReason}, destructive = true` : immediateReason;
}

function nullableQuoted(value: string | undefined): string {
  return value === undefined ? "null" : kotlinStringLiteral(value);
}

/** The validator guarantees alarm copy exists; this only narrows the type and
 *  names the layer that failed if it ever does not. */
function validatedHint(menu: AnyProductMenu, id: string, hint: string | undefined): string {
  if (hint === undefined || hint.trim() === "") {
    throw new Error(`validator gap: alarm menu '${menu.id}' item '${id}' passed validation with no hint copy`);
  }
  return hint;
}
