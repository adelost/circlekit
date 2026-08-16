/**
 * The product menu grammar, with no product in it.
 *
 * Every menu shape lives here; a product binds the two refs that are its own —
 * which icons exist and which routes exist — in a thin alias file. Foundation
 * importing a product's icon token was the inversion this file ends: the
 * grammar cannot be reused, or even read, without dragging one product's
 * vocabulary along with it.
 *
 * IconRef and RouteRef are the LAST type parameters on purpose. Every existing
 * call site writes its parameters positionally, so appending them keeps those
 * sites meaning exactly what they meant before.
 */
export type ProductMenuAccent = "POSITIVE" | "CAUTION" | "DANGER" | "NEUTRAL";
export type ProductMenuLocalTarget =
  | "settings-section"
  | "map-control"
  | "alarm-action"
  | "clock-face-action"
  | "host-action";
export type ProductAlarmStage = "BREAK_OFF" | "PULL" | "HARD_DECK" | "DOWNWIND" | "BASE" | "FINAL";
export type ProductClockFaceCue = "NORTH" | "WIND" | "HOME";
export type ProductMenuAction<
  ActionPortRef extends string = never,
  NativeActionRef extends string = string,
> =
  | { readonly kind: "alarm"; readonly stage: ProductAlarmStage; readonly stepM: 50 | 100 }
  | { readonly kind: "clock-face-cue"; readonly cue: ProductClockFaceCue; readonly valueLabel: string }
  | { readonly kind: "clock-face-weight" }
  | { readonly kind: "host"; readonly ref: NativeActionRef }
  | { readonly kind: "port"; readonly ref: ActionPortRef };

export type ProductMenuConfirmation = "hold";
export type ProductMenuImmediateReason = "read-only-navigation";
export interface ProductMenuImmediateCadence {
  readonly timing: "immediate";
  readonly reason: ProductMenuImmediateReason;
}

interface ProductMenuItemBase<IconRef extends string = string> {
  readonly wireId?: string;
  readonly icon: IconRef;
  readonly label?: string;
  readonly hint?: string;
  readonly accent?: ProductMenuAccent;
  readonly confirmation?: ProductMenuConfirmation;
  readonly destructive?: true;
}

export interface ProductMenuSettingItemDeclaration<SettingRef extends string = string> {
  readonly settingRef: SettingRef;
  readonly wireId?: never;
  readonly icon?: never;
  readonly label?: never;
  readonly hint?: never;
  readonly accent?: never;
  readonly confirmation?: never;
  readonly destructive?: never;
  readonly routeRef?: never;
  readonly menuRef?: never;
  readonly settingValueRef?: never;
  readonly nativeRowsRef?: never; readonly nativeToggleRef?: never;
  readonly action?: never;
  readonly cadence?: never;
}

/**
 * One row that IS one value of a setting, for a menu that offers its choices
 * as a list instead of as one row to cycle. The setting supplies the state and
 * the write; the item still supplies its own word, icon and reason, because a
 * value shown as a row is read on its own and has to say more than its label.
 */
/**
 * A slot in a menu that native fills with rows of its own.
 *
 * The product owns WHERE it sits and WHY it cannot be declared; native owns how
 * many rows appear and what they say. Used where the rows are a function of live
 * state or of a build capability — enumerating them would copy a state machine
 * into the grammar, which the grammar must not hold.
 */
export interface ProductMenuNativeRowsItemDeclaration<PortRef extends string = string> {
  readonly wireId: string;
  readonly nativeRowsRef: PortRef;
  /** Why these rows cannot be declared. A slot without one is just a gap. */
  readonly reason: string;
  readonly settingRef?: never;
  readonly settingValueRef?: never;
  readonly icon?: never;
  readonly label?: never;
  readonly hint?: never;
  readonly accent?: never;
  readonly confirmation?: never;
  readonly destructive?: never;
  readonly routeRef?: never;
  readonly menuRef?: never;
  readonly action?: never;
  readonly cadence?: never;
}

/**
 * A row the product declares in full whose VALUE belongs to native.
 *
 * The difference from a setting is ownership, not shape. A setting owns its
 * value; this names a row over state some component already owns and would
 * keep owning whether or not we drew a row. Copying such a value into a store
 * of ours would create a second truth plus a migration to keep the two equal.
 *
 * So the product owns everything the user reads and native owns the value and
 * the write, behind one named port.
 */
export interface ProductMenuNativeToggleItemDeclaration<
  PortRef extends string = string,
  IconRef extends string = string,
> {
  readonly wireId: string;
  readonly label: string;
  readonly icon: IconRef;
  /** What the toggle does, in the product's words. */
  readonly hint: string;
  readonly nativeToggleRef: PortRef;
  /** Why the value cannot be a declared setting. A port without one is a
   *  setting somebody could not be bothered to declare. */
  readonly reason: string;
  readonly settingRef?: never;
  readonly settingValueRef?: never;
  readonly nativeRowsRef?: never;
  readonly accent?: never;
  readonly confirmation?: never;
  readonly destructive?: never;
  readonly routeRef?: never;
  readonly menuRef?: never;
  readonly action?: never;
  readonly cadence?: never;
}

export interface ProductMenuSettingValueRef<SettingRef extends string = string> {
  readonly setting: SettingRef;
  readonly value: string;
}

export type ProductMenuVisualItemDeclaration<
  MenuRef extends string = string,
  ActionPortRef extends string = never,
  NativeActionRef extends string = string,
  SettingRef extends string = string,
  IconRef extends string = string,
  RouteRef extends string = string,
> = ProductMenuItemBase<IconRef> & (
  | { readonly routeRef?: never; readonly menuRef?: never; readonly settingRef?: never; readonly settingValueRef?: never; readonly nativeRowsRef?: never; readonly nativeToggleRef?: never; readonly action?: never; readonly cadence?: never }
  | { readonly routeRef: RouteRef; readonly menuRef?: never; readonly settingRef?: never; readonly settingValueRef?: never; readonly nativeRowsRef?: never; readonly nativeToggleRef?: never; readonly action?: never; readonly cadence?: ProductMenuImmediateCadence }
  | { readonly routeRef?: never; readonly menuRef: MenuRef; readonly settingRef?: never; readonly settingValueRef?: never; readonly nativeRowsRef?: never; readonly nativeToggleRef?: never; readonly action?: never; readonly cadence?: ProductMenuImmediateCadence }
  | { readonly routeRef?: never; readonly menuRef?: never; readonly settingRef?: never; readonly settingValueRef?: never; readonly nativeRowsRef?: never; readonly nativeToggleRef?: never; readonly information: string; readonly action?: never; readonly confirmation?: never; readonly destructive?: never; readonly cadence?: never }
  | { readonly routeRef?: never; readonly menuRef?: never; readonly settingRef?: never; readonly settingValueRef: ProductMenuSettingValueRef<SettingRef>; readonly nativeRowsRef?: never; readonly nativeToggleRef?: never; readonly action?: never; readonly cadence?: never }
  | { readonly routeRef?: never; readonly menuRef?: never; readonly settingRef?: never; readonly settingValueRef?: never; readonly nativeRowsRef?: never; readonly nativeToggleRef?: never; readonly action: ProductMenuAction<ActionPortRef, NativeActionRef>; readonly cadence?: never }
);

export type ProductMenuItemDeclaration<
  SettingRef extends string = string,
  MenuRef extends string = string,
  ActionPortRef extends string = never,
  NativeActionRef extends string = string,
  IconRef extends string = string,
  RouteRef extends string = string,
> = ProductMenuSettingItemDeclaration<SettingRef>
  | ProductMenuNativeRowsItemDeclaration<ActionPortRef>
  | ProductMenuNativeToggleItemDeclaration<ActionPortRef, IconRef>
  | ProductMenuVisualItemDeclaration<MenuRef, ActionPortRef, NativeActionRef, SettingRef, IconRef, RouteRef>;

export interface ProductMenuDeclaration<
  SettingRef extends string = string,
  MenuRef extends string = string,
  ActionPortRef extends string = never,
  NativeActionRef extends string = string,
  IconRef extends string = string,
  RouteRef extends string = string,
> {
  readonly id: string;
  readonly label?: string;
  readonly localTarget: ProductMenuLocalTarget;
  readonly requireItemHint?: true;
  readonly items: Readonly<Record<string, ProductMenuItemDeclaration<SettingRef, MenuRef, ActionPortRef, NativeActionRef, IconRef, RouteRef>>>;
}
