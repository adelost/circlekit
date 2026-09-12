import { kotlinEnumToken, kotlinIdentifier } from "../core/kotlin-syntax.js";
import {
  type AnyProductMenu,
  type AnyProductMenuItem,
  isNativeRowsItem,
  isNativeToggleItem,
  isSettingItem,
  isSettingValueItem,
} from "./product-menu-types.js";

/**
 * What one menu can actually hold, read off its declaration.
 *
 * A host matches a menu's rows with `when`. If the static type of `item.target`
 * is the product-wide sealed set, the host must write an `else` for the
 * subtypes its menu never declares, and that `else` is where an undeclared or
 * mistyped row compiles and crashes at open. These sets are what the emitter
 * closes per menu, so the host's `when` is exhaustive without an `else` and a
 * row of a new kind fails at compile time instead.
 */

/** The simple names of the `MenuTarget` subtypes the menu's rows resolve to. */
export function menuTargetKinds(menu: AnyProductMenu): string[] {
  const kinds = Object.values(menu.items).flatMap((item) => {
    const kind = targetKind(menu, item);
    return kind === undefined ? [] : [kind];
  });
  return [...new Set(kinds)];
}

export interface MenuPortSets {
  readonly nativeRows: readonly string[];
  readonly nativeToggle: readonly string[];
  readonly action: readonly string[];
}

/** The ports each kind of slot or action in the menu is bound to, by kind. */
export function menuPorts(menu: AnyProductMenu): MenuPortSets {
  const items = Object.values(menu.items);
  return {
    nativeRows: distinct(items.flatMap((item) => (isNativeRowsItem(item) ? [item.nativeRowsRef] : []))),
    nativeToggle: distinct(items.flatMap((item) => (isNativeToggleItem(item) ? [item.nativeToggleRef] : []))),
    action: distinct(items.flatMap((item) => (portActionRef(item) === undefined ? [] : [portActionRef(item)!]))),
  };
}

export function hostActionRefs(menu: AnyProductMenu): string[] {
  return distinct(Object.values(menu.items).flatMap((item) =>
    !isSettingItem(item) && !isSettingValueItem(item) && !isNativeRowsItem(item) && !isNativeToggleItem(item)
      && item.action?.kind === "host"
      ? [item.action.ref]
      : []
  ));
}

/** `Generated<Prefix><Menu>MenuTarget`: the sealed set a host matches one menu against. */
export function menuTargetTypeName(menu: AnyProductMenu, generated: string): string {
  return `${generated}${kotlinIdentifier(menu.id)}MenuTarget`;
}

export function menuPortEnumName(menu: AnyProductMenu, kind: keyof MenuPortSets, generated: string): string {
  const suffix = { nativeRows: "NativeRowsPort", nativeToggle: "NativeTogglePort", action: "ActionPort" }[kind];
  return `${generated}${kotlinIdentifier(menu.id)}${suffix}`;
}

export function portActionTargetName(menu: AnyProductMenu): string {
  return `${kotlinIdentifier(menu.id)}PortAction`;
}

export function hostActionTargetName(menu: AnyProductMenu): string {
  return `${kotlinIdentifier(menu.id)}Action`;
}

/** Emits `enum class <Name>(override val port: <Port>) : <MenuPort> { A(<Port>.A), … }`. */
export function emitMenuPortEnum(name: string, refs: readonly string[], generated: string): string {
  const entries = refs.map((ref) => `    ${kotlinEnumToken(ref)}(${generated}ProductInputPort.${kotlinEnumToken(ref)}),`);
  return `enum class ${name}(override val port: ${generated}ProductInputPort) : ${generated}MenuPort {
${entries.join("\n")}
}`;
}

function targetKind(menu: AnyProductMenu, item: AnyProductMenuItem): string | undefined {
  if (isSettingItem(item)) return "Setting";
  if (isNativeRowsItem(item) || isNativeToggleItem(item)) return undefined;
  if (isSettingValueItem(item)) return "SettingValue";
  if ("routeRef" in item && item.routeRef !== undefined) return "Destination";
  if (item.menuRef !== undefined) return "Destination";
  if ("information" in item && item.information !== undefined) return "Information";
  if (item.action !== undefined) {
    switch (item.action.kind) {
      case "alarm": return "AlarmAction";
      case "clock-face-cue": return "ClockFaceCueAction";
      case "clock-face-weight": return "ClockFaceWeightAction";
      case "host": return hostActionTargetName(menu);
      case "port": return portActionTargetName(menu);
    }
  }
  return menu.localTarget === "settings-section" ? "SettingsSection" : "MapControl";
}

function portActionRef(item: AnyProductMenuItem): string | undefined {
  return "action" in item && item.action?.kind === "port" ? item.action.ref : undefined;
}

function distinct(values: readonly string[]): string[] {
  return [...new Set(values)];
}
