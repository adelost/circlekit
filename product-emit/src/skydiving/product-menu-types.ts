import type {
  ProductMenuDeclaration,
  ProductMenuItemDeclaration,
  ProductMenuVisualItemDeclaration,
} from "./product-menu-model.js";

export type AnyProductMenu = ProductMenuDeclaration<string, string, string>;
export type AnyProductMenuItem = ProductMenuItemDeclaration<string, string, string>;
export type AnyProductMenuVisualItem = ProductMenuVisualItemDeclaration<string, string>;

/** Shared shape questions: which kind of item is this, and what is it keyed by. */
export function isNativeRowsItem(
  item: AnyProductMenuItem,
): item is Extract<AnyProductMenuItem, { readonly nativeRowsRef: string }> {
  return "nativeRowsRef" in item && item.nativeRowsRef !== undefined;
}

export function isNativeToggleItem(
  item: AnyProductMenuItem,
): item is Extract<AnyProductMenuItem, { readonly nativeToggleRef: string }> {
  return "nativeToggleRef" in item && item.nativeToggleRef !== undefined;
}

export function isSettingValueItem(
  item: AnyProductMenuItem,
): item is Extract<AnyProductMenuItem, { readonly settingValueRef: { setting: string; value: string } }> {
  return "settingValueRef" in item && item.settingValueRef !== undefined;
}

export function isSettingItem(
  item: AnyProductMenuItem,
): item is Extract<AnyProductMenuItem, { readonly settingRef: string }> {
  return "settingRef" in item && item.settingRef !== undefined;
}

export function wireId(menu: AnyProductMenu, itemId: string, item: AnyProductMenuVisualItem): string {
  return item.wireId ?? (menu.id === "root" ? itemId : `${menu.id}-${itemId}`);
}
