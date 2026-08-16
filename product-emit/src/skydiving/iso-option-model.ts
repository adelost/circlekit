/**
 * THE option law for every spatial surface, as grammar.
 *
 * The tiers, the kinds and the two option shapes are product-independent; the
 * icon vocabulary is not, so it is a parameter. `ISO_VIEW_SHEET_MAX` lives here
 * with the tier it caps, and the product imports it back: a cap that belongs to
 * a tier cannot be owned by the file that happens to fill it.
 *
 * The full reasoning for the law, and for what is deliberately NOT declarable
 * (the ANSWERS), stays with the product declaration that applies it.
 */
/** Where an option may be asked, ordered by how often its answer changes. */
export type IsoOptionTierRef =
  /** Touched mid-jump: back, camera mode, recentre, peer view. The rail. */
  | "RAIL"
  /** Changes what you SEE. Capped so the sheet is one screen without scroll. */
  | "VIEW_SHEET"
  /** Set once, then forgotten. Ordered after the first-glance controls. */
  | "SETTINGS"
  /**
   * Kept, but nobody could say which jumper asks this question or when
   * (Mattias 2026-07-27: "som du inte kan kategorisera så lägg dem under en
   * junk-meny"). A holding pen, not a graveyard: still reachable, so dropping
   * it stays a decision made by looking at it.
   */
  | "JUNK";

/** How many answers the question has — a property of the question. */
export type IsoOptionKindRef = "ACTION" | "TOGGLE" | "CHOICE_OF_N";

/** A semantic pigment, or the product icon catalogue's own pigment. */
export type IsoOptionTintRef =
  | "ICON"
  | "POSITIVE"
  | "CAUTION"
  | "DANGER"
  | "NEUTRAL"
  | "COMPOSITE";

/** Everything a host needs to present one answer without renderer guesses. */
export interface IsoOptionStateFace<IconRef extends string = string> {
  readonly icon: IconRef;
  readonly tint: IsoOptionTintRef;
  readonly explanation: string;
  /** Whether this answer may offer RESET TO DEFAULT in its info card. */
  readonly resettable: boolean;
}

/** Finite choices name every answer; runtime choices carry one total face. */
export type IsoOptionStatePresentation<IconRef extends string = string> =
  | {
      readonly kind: "FINITE";
      readonly states: Readonly<Record<string, IsoOptionStateFace<IconRef>>>;
    }
  | {
      readonly kind: "DYNAMIC";
      readonly face: IsoOptionStateFace<IconRef>;
    };

/**
 * Whether answering this question takes you off the surface that asked it.
 *
 * A property of the QUESTION, for the same reason `kind` is. It used to be a
 * `closeOnTap` boolean passed by every caller, with a different DEFAULT per
 * builder — false for an action, true for a toggle or a choice — so whether a
 * menu closed depended on the widget a row was drawn as rather than on what the
 * row did. That already produced a divergence: `cutaway-finder` closed the menu
 * and `details` did not, though both leave the replay surface.
 *
 * The surface still gets one say, and only one: a menu that COVERS the scene
 * has to close to show what it just changed. That belongs to the host, not
 * here.
 */
export type IsoOptionDismissalRef = "STAYS_ON_SURFACE" | "LEAVES_SURFACE";

interface IsoOptionPlacement {
  readonly tier: IsoOptionTierRef;
  /** Omitted means ACTION: the option does its one thing and is done. */
  readonly kind?: IsoOptionKindRef;
  /**
   * Required, with no default on purpose: a silent default is how the two
   * navigation options ended up disagreeing. A new option must say whether
   * answering it leaves.
   */
  readonly dismissal: IsoOptionDismissalRef;
}

/** An option the spatial surfaces own outright. */
export interface DeclaredIsoOption<IconRef extends string = string> extends IsoOptionPlacement {
  readonly key: string;
  readonly label: string;
  readonly icon: IconRef;
  /**
   * One sentence, shown in the centre cue while the row is held: what this does
   * and what its states mean. A row can then be explored by pressing it and
   * released before it fires (Mattias 2026-07-27: "problemet med att man
   * klickar på en knapp är att man kanske inte vet riktigt vad den gör").
   */
  readonly hint: string;
  /** Complete answer faces; totality is checked again against each live host. */
  readonly statePresentation?: IsoOptionStatePresentation<IconRef>;
  readonly settingRef?: never;
}

/**
 * An option that IS a setting, shown on a spatial surface.
 *
 * Its name, icon and sentence are the setting's own. Repeating them here would
 * create a second copy that drifts the first time the setting is reworded —
 * exactly the drift this file exists to end. Only the placement is ours.
 */
export interface SettingIsoOption<IconRef extends string = string> extends IsoOptionPlacement {
  readonly settingRef: string;
  readonly key?: never;
  readonly label?: never;
  readonly icon?: never;
  readonly hint?: never;
  readonly statePresentation?: IsoOptionStatePresentation<IconRef>;
}

export type IsoOptionDeclaration<IconRef extends string = string> =
  | DeclaredIsoOption<IconRef>
  | SettingIsoOption<IconRef>;

/**
 * Six rings fit one 192 dp face without scrolling. The cap is the whole point
 * of the tier, so it is asserted rather than trusted.
 */
export const ISO_VIEW_SHEET_MAX = 6;

/**
 * What a spatial surface's ONE data-status slot can be saying.
 *
 * The icon reports the GAP between what the settings promised and what the
 * scene got — never "here is a layer". Silence is therefore the healthy state:
 * chronic chrome on a watch face is noise, and an icon that is always lit
 * stops being read long before the day it means something.
 *
 * Declared here rather than branched in a renderer so the four states and
 * their glyphs cannot diverge between the surfaces that mount the slot.
 */
export type IsoDataStatusRef = "FLOWING" | "LOADING" | "OFF" | "MISSING";

/** One state's whole presentation. A null glyph draws nothing at all. */
export interface IsoDataStatusDeclaration<IconRef extends string = string> {
  readonly state: IsoDataStatusRef;
  readonly glyph: IconRef | null;
  readonly accent: string;
  /** Read aloud, and shown in the centre cue while the slot is held. */
  readonly meaning: string;
}

/**
 * Worst-first. One slot cannot show two answers, so a surface with a broken
 * promise and a switched-off layer reports the broken promise: the state that
 * needs a person is always the one that gets the pixel.
 */
export const ISO_DATA_STATUS_SEVERITY: readonly IsoDataStatusRef[] = [
  "MISSING",
  "LOADING",
  "OFF",
  "FLOWING",
];
