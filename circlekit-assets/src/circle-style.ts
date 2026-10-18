/**
 * CircleKit-owned cross-product chrome. Product palettes cannot override it.
 *
 * Style C (Mattias 2026-10-17: "genomför detta.. förös göra det generiskt också så det är lätt att ändra.. och finns
 * i dsl språket"): the neutrals are Cutkit's (tools/studio_static/kit/tokens.css), so a product built on the kit looks
 * like Cutkit wherever it runs. The plan: skydive-altimeter docs/plans/2026-10-17-skyvw-style-c.md.
 */
export const CIRCLEKIT_STYLE = {
  /** The screen: OLED black. */
  surface: "#000000",
  /** A sheet behind a group of things: a menu's page, a panel. */
  sheet: "#121316",
  /** A card on a sheet. */
  card: "#1c1d20",
  /** A fine edge or divider. */
  line: "#2a2b2e",
  /** A control that is off: a switch's track, a ring at rest. Grey means off and nothing else. */
  off: "#373c44",
  /** Grid lines, axes and whatever must be seen without being read. */
  faint: "#5f656f",
  /** Dimmed text: a value, a unit, a note. */
  actionMuted: "#8b939e",
  /** Text, and the one action colour: what you press to finish, a hold, a progress. */
  action: "#f2f4f7",
} as const;

/** Fixed type roles. The phone scale is derived from the note floor, never a second palette. */
export const CIRCLEKIT_TEXT = {
  phoneFloorSp: 12,
  faces: { words: "Onest", numerals: "Barlow Semi Condensed" },
  roles: {
    title: { sp: 11, weight: 700, tracking: 0.27 },
    name: { sp: 9.5, weight: 700, tracking: 0.02 },
    label: { sp: 7.5, weight: 700, tracking: 0.13 },
    value: { sp: 9, weight: 400, tracking: 0 },
    number: { sp: 12, weight: 700, tracking: 0, unitSp: 7.5, unitWeight: 600 },
    note: { sp: 6.5, weight: 600, tracking: 0 },
  },
} as const;

/** Fixed line roles in dp on the 192 dp face. Canonical viewports scale the whole drawing together. */
export const CIRCLEKIT_LINE = {
  hairline: 0.75,
  edge: 1.5,
  stroke: 2,
  bar: 4,
} as const;

const deliberateMs = 500;
const hintMaxChars = 90;
const hintReadCharsPerSecond = 30;

/** One press ladder for native and web. A host chooses a rung, never a second duration. */
export const CIRCLEKIT_PRESS = {
  immediateMs: 0,
  wornTouchCostMs: 200,
  holdDeliberateMs: deliberateMs,
  rowInfoHoldMs: deliberateMs,
  backHoldMs: deliberateMs,
  holdDestructiveMs: 900,
  holdConfirmMs: 1000,
  actionConfirmationMs: 240,
  actionExplainMs: 1600,
  brushMinMs: 40,
  releaseMs: 90,
  hintMaxChars,
  hintReadCharsPerSecond,
  hintReadingMs: hintMaxChars / hintReadCharsPerSecond * 1000,
} as const;

/** The one centre receipt and the control's own trace, in canonical dp. */
export const CIRCLEKIT_CUE = {
  discDp: 114,
  ringDp: 104,
  iconDp: 24,
  labelMaxDp: 76,
  contentGapDp: 3,
  roundAspect: 1.2,
  washAlpha: 0.30,
  progressDiameterShare: 0.06,
} as const;

/**
 * How a colour's quieter tones follow from it. A colour is written once, as the tone you read (strong); its ground
 * sits behind an icon at a fixed lightness with a capped chroma, and its dimmed tone lies part of the way from the
 * ground back toward the strong one. Measured on Cutkit's tokens.css, whose kinds it reproduces: #83b0e4 gives the
 * ground #21354d and the dimmed #436082 against Cutkit's #24334c and #455f81.
 */
export const CIRCLEKIT_TONE = {
  /** OKLab lightness of a ground. */
  groundLightness: 0.325,
  /** A ground's chroma: at most this... */
  groundChromaMax: 0.05,
  /** ...and at most this share of the strong colour's chroma. */
  groundChromaShare: 0.55,
  /** The dimmed tone, this far from the ground toward the strong one. */
  dimAt: 0.376,
  /** An icon disc's fine edge, this far from its ground toward the strong colour (Cutkit --kind-edge, mixed in OKLab). */
  edgeAt: 0.42,
} as const;

/**
 * The tones of a thing that is about no kind: a pointer, the weather (whose colour sits on its value), an icon a
 * product has not given a colour. Text-white to read, the dimmed text behind, Cutkit's greys for its disc.
 */
export const CIRCLEKIT_NEUTRAL_TONES = {
  strong: CIRCLEKIT_STYLE.action,
  dim: CIRCLEKIT_STYLE.actionMuted,
  ground: "#232429",
  edge: CIRCLEKIT_STYLE.off,
} as const;

/**
 * The kit's icon vocabulary in colour, by meaning (`CircleAccent` in Kotlin). A product supplies its own
 * (`CircleAccentPaletteProvider`) from its palette; these are the house defaults, the colours of style C. Each is a
 * strong tone, or the neutral tones for what is about no kind.
 */
export const CIRCLEKIT_ACCENTS = {
  neutral: CIRCLEKIT_NEUTRAL_TONES,
  /** The air and what moves through it: a jump, the aircraft, time in the air. */
  sky: "#83b0e4",
  /** Light: the screen, the sun. */
  sun: "#eec649",
  /** Weather wears its colour on its value, so the cloud itself is neutral. */
  cloud: CIRCLEKIT_NEUTRAL_TONES,
  /** The drops of rain: the calm sky's dimmed blue. */
  rain: "#6c91bb",
  cold: "#d7e7ee",
  /** Home, done, add, lock: the safety scale's green. */
  positive: "#1bc279",
  /** Wants a second look: the safety scale's yellow. */
  caution: "#eec649",
  /** Record, stop, delete: the safety scale's red. */
  danger: "#eb483c",
  /** A record, always with its star. */
  achievement: "#d9b45c",
  /** The controls: settings, sliders, units. */
  violet: "#cba8ef",
  /** Where you are: the map, GPS, places. */
  place: "#5be2cd",
  /** Sound, alarms, vibration. */
  sound: "#e498c1",
} as const;

/** The on/off switch, dp (style C, sheet 7): big enough to read on a 192 dp face; on is a track in the row's colour. */
export const CIRCLEKIT_SWITCH = {
  width: 22,
  height: 12,
  /** The knob's inset from the track's edge. */
  knobInset: 2,
} as const;
