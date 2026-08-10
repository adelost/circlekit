/**
 * Where a product mounts a setting, as grammar.
 *
 * The KINDS are product-independent: a setting either sits in a shared settings
 * section, or on the one surface it affects, or as a row (or a whole choice
 * list) of a named menu. What varies per product is only the vocabulary each
 * kind names, so the sections and the menus are parameters.
 *
 * Not every setting belongs in Settings: an ISO scene option and a map object
 * layer are read and changed on the surface they affect, and moving them into a
 * shared section would put them a menu away from the thing they change.
 */
export type SettingMount<
  SectionRef extends string = string,
  MenuRef extends string = string,
  ValueMenuRef extends string = string,
> = {
  readonly kind: "settings-section";
  readonly section: SectionRef;
  readonly order: number;
} | {
  readonly kind: "iso-scene-option";
} | {
  readonly kind: "map-object-layer";
} | {
  readonly kind: "map-overlay";
} | {
  readonly kind: "log-entry-element";
} | {
  /**
   * A row of one named product menu. A menu that holds a few stored values
   * among rows that command, measure or navigate owns those settings itself,
   * rather than borrowing them from a settings section.
   */
  readonly kind: "product-menu-row";
  readonly menu: MenuRef;
} | {
  /**
   * The whole menu is this setting's choices, one row per value. Chosen over a
   * single row to cycle when each option is deliberate enough to be read on its
   * own line and confirmed with a hold.
   */
  readonly kind: "product-menu-value-rows";
  readonly menu: ValueMenuRef;
};

/**
 * One setting and where the product mounts it.
 *
 * The mount union is the parameter, because a product may bind kinds this
 * grammar does not know about; the emitter only ever needs the pair.
 */
export interface SettingMountIr<Mount = SettingMount> {
  readonly settingId: string;
  readonly mount: Mount;
  /**
   * How many answers the setting has, carried with the mount because the
   * emitter picks a native projection from it.
   *
   * It used to be dropped here, so every mount kind had to assume one shape.
   * `iso-scene-option` therefore emitted the boolean projection for an enum
   * too: a mount the grammar accepted and native could not build.
   */
  readonly kind: "boolean-setting" | "enum-setting";
}
