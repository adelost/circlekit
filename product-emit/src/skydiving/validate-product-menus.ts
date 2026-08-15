import { kotlinIdentifier, kotlinLabel } from "../core/kotlin-syntax.js";
import { MENU_HINT_MAX_CHARS, MENU_LABEL_MAX_CHARS } from "./menu-text-budget.js";
import type { SettingIr } from "./model.js";
import {
  type AnyProductMenu,
  isNativeRowsItem,
  isNativeToggleItem,
  isSettingItem,
  isSettingValueItem,
  wireId,
} from "./product-menu-types.js";

/**
 * What a menu declaration must satisfy before anything is emitted from it.
 *
 * Kept apart from the emitter because these are the INVARIANTS — they answer
 * "is this declaration legal", not "what Kotlin does it become", and the two
 * questions grow at different rates.
 */
export function validate<EffectRef extends string>(
  menus: readonly AnyProductMenu[],
  settings: readonly SettingIr<EffectRef>[],
): void {
  if (menus.length === 0) throw new Error("at least one product menu is required");
  const menuIds = menus.map(({ id }) => id);
  if (new Set(menuIds).size !== menuIds.length) throw new Error("duplicate product-menu id");
  const settingIds = new Set(settings.map(({ id }) => id));
  const emittedWireIds = new Set<string>();
  const menuPortActions = new Set<string>();
  for (const menu of menus) {
    validId(menu.id, "menu");
    const entries = Object.entries(menu.items);
    if (entries.length === 0) throw new Error(`product menu '${menu.id}' is empty`);
    const symbols = entries.map(([id]) => kotlinIdentifier(id));
    if (new Set(symbols).size !== symbols.length) throw new Error(`product menu '${menu.id}' emits duplicate Kotlin symbols`);
    for (const [id, item] of entries) {
      validId(id, `item in '${menu.id}'`);
      if (isSettingItem(item)) {
        if (!settingIds.has(item.settingRef)) {
          throw new Error(`product menu '${menu.id}' item '${id}' references missing setting '${item.settingRef}'`);
        }
        continue;
      }
      if (isNativeRowsItem(item)) {
        validWireId(item.wireId, `wire id for '${menu.id}.${id}'`);
        if (emittedWireIds.has(item.wireId)) {
          throw new Error(`duplicate product-menu wire id '${item.wireId}'`);
        }
        emittedWireIds.add(item.wireId);
        if (item.reason.trim() === "") {
          throw new Error(
            `product menu '${menu.id}' slot '${id}' fills itself natively without saying why`,
          );
        }
        menuPortActions.add(`${item.wireId}\u0000${item.nativeRowsRef}`);
        continue;
      }
      if (isNativeToggleItem(item)) {
        validWireId(item.wireId, `wire id for '${menu.id}.${id}'`);
        if (emittedWireIds.has(item.wireId)) {
          throw new Error(`duplicate product-menu wire id '${item.wireId}'`);
        }
        emittedWireIds.add(item.wireId);
        if (item.label.trim() === "") {
          throw new Error(`product menu '${menu.id}' item '${id}' has an empty label`);
        }
        if (item.hint.trim() === "") {
          throw new Error(`product menu '${menu.id}' toggle '${id}' explains nothing`);
        }
        if (item.reason.trim() === "") {
          throw new Error(
            `product menu '${menu.id}' toggle '${id}' hands its value to native without saying why`,
          );
        }
        menuPortActions.add(`${item.wireId}\u0000${item.nativeToggleRef}`);
        continue;
      }
      if (isSettingValueItem(item)) {
        const target = settings.find(({ id: settingId }) => settingId === item.settingValueRef.setting);
        if (target === undefined) {
          throw new Error(
            `product menu '${menu.id}' item '${id}' references missing setting '${item.settingValueRef.setting}'`,
          );
        }
        // A row that IS a value has to name a value that exists, or the menu
        // would offer a choice the setting cannot be written to.
        const declared = target.kind === "enum-setting"
          ? target.values.map((value) => value.id)
          : ["false", "true"];
        if (!declared.includes(item.settingValueRef.value)) {
          throw new Error(
            `product menu '${menu.id}' item '${id}' selects value '${item.settingValueRef.value}' ` +
              `which '${item.settingValueRef.setting}' does not declare`,
          );
        }
      }
      const wire = wireId(menu, id, item);
      validWireId(wire, `wire id for '${menu.id}.${id}'`);
      if (emittedWireIds.has(wire)) throw new Error(`duplicate product-menu wire id '${wire}'`);
      emittedWireIds.add(wire);
      if ((item.label ?? kotlinLabel(id)).trim() === "") {
        throw new Error(`product menu '${menu.id}' item '${id}' has an empty label`);
      }
      if ("information" in item && item.information !== undefined && item.information.trim() === "") {
        throw new Error(`product menu '${menu.id}' item '${id}' has empty information copy`);
      }
      if (item.menuRef !== undefined) {
        if (!menuIds.includes(item.menuRef)) {
          throw new Error(`product menu '${menu.id}' item '${id}' references missing menu '${item.menuRef}'`);
        }
        if (item.menuRef === menu.id) {
          throw new Error(`product menu '${menu.id}' item '${id}' cannot target its own menu`);
        }
      }
      if (item.action?.kind === "host" && !/^[A-Z][A-Z0-9_]*$/u.test(item.action.ref)) {
        throw new Error(`product menu '${menu.id}' item '${id}' has invalid host action '${item.action.ref}'`);
      }
      if (item.action?.kind === "port") {
        menuPortActions.add(`${wire}\u0000${item.action.ref}`);
        validProductRef(item.action.ref, `native action for '${menu.id}.${id}'`);
      }
      if (item.destructive === true && item.confirmation !== "hold") {
        throw new Error(`product menu '${menu.id}' item '${id}' is destructive without hold confirmation`);
      }
      if ("cadence" in item && item.cadence !== undefined) {
        if (
          item.cadence.timing !== "immediate" ||
          item.cadence.reason !== "read-only-navigation" ||
          (item.routeRef === undefined && item.menuRef === undefined)
        ) {
          throw new Error(
            `product menu '${menu.id}' item '${id}' may use immediate cadence only for read-only navigation`,
          );
        }
      }
      if (menu.requireItemHint === true && (item.hint === undefined || item.hint.trim() === "")) {
        throw new Error(`product menu '${menu.id}' item '${id}' has no required hint copy`);
      }

      // Which menu kind may bind which action. These lived as nine throws in
      // the emitter, which meant a declaration error surfaced only once
      // somebody asked for Kotlin — and only for the first bad item.
      if (item.action !== undefined) {
        switch (item.action.kind) {
          case "alarm":
            if (menu.localTarget !== "alarm-action") {
              throw new Error(`menu '${menu.id}' cannot bind an alarm action`);
            }
            if (item.hint === undefined || item.hint.trim() === "") {
              throw new Error(`alarm menu '${menu.id}' item '${id}' has no hint copy`);
            }
            break;
          case "clock-face-cue":
            if (menu.localTarget !== "clock-face-action") {
              throw new Error(`menu '${menu.id}' cannot bind a clock-face action`);
            }
            if (item.action.valueLabel.trim() === "") {
              throw new Error(`clock-face menu '${menu.id}' item '${id}' has no value label`);
            }
            break;
          case "clock-face-weight":
            if (menu.localTarget !== "clock-face-action") {
              throw new Error(`menu '${menu.id}' cannot bind a clock-face action`);
            }
            break;
          case "host":
            if (menu.localTarget !== "host-action") {
              throw new Error(`menu '${menu.id}' cannot bind a host action`);
            }
            break;
          case "port":
            break;
        }
      } else if (
        !isSettingItem(item) && !isNativeRowsItem(item) && !isNativeToggleItem(item) &&
        !isSettingValueItem(item) &&
        item.routeRef === undefined && item.menuRef === undefined &&
        !("information" in item && item.information !== undefined) &&
        (menu.localTarget === "alarm-action" ||
          menu.localTarget === "clock-face-action" ||
          menu.localTarget === "host-action")
      ) {
        throw new Error(`action menu '${menu.id}' item '${id}' has no typed action`);
      }

      // Copy budgets are an AUTHORING limit: the round face measured them, so
      // a label that overflows is wrong at declaration time, not at class
      // load. Mirrors exactly what the emitted validateMenuItems checked --
      // settings-derived rows were exempt there and stay exempt here.
      if (!isSettingItem(item)) {
        const label = item.label ?? kotlinLabel(id);
        if (label.length > MENU_LABEL_MAX_CHARS) {
          throw new Error(
            `product menu '${menu.id}' item '${id}' label '${label}' is ${label.length} chars, over ${MENU_LABEL_MAX_CHARS}`,
          );
        }
      }
      if (item.hint !== undefined && item.hint.length > MENU_HINT_MAX_CHARS) {
        throw new Error(
          `product menu '${menu.id}' item '${id}' hint is ${item.hint.length} chars, over ${MENU_HINT_MAX_CHARS}`,
        );
      }
    }
  }
  // This vocabulary is emitted from the menu declaration itself. Repeating it
  // in ProductSpec's removed optional `ui` list was the opt-in hole the
  // mandatory component graph is designed to eliminate.
  for (const entry of menuPortActions) {
    const [, ref] = entry.split("\u0000");
    validProductRef(ref!, "menu native action");
  }
}

export function validId(id: string, subject: string): void {
  if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new Error(`${subject} id '${id}' is not a wire id`);
}

export function validWireId(id: string, subject: string): void {
  if (!/^[a-z][a-z0-9_-]*$/u.test(id)) throw new Error(`${subject} '${id}' is not a wire id`);
}

function validProductRef(id: string, subject: string): void {
  if (!/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/u.test(id)) {
    throw new Error(`${subject} '${id}' is not a dotted product ref`);
  }
}
