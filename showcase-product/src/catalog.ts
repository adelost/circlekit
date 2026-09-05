export const showcaseSections = [
  { id: "foundations", title: "FOUNDATIONS", menuLabel: "TOKENS", iconId: "palette" },
  { id: "atoms", title: "ATOMS", menuLabel: "ATOMS", iconId: "grid" },
  { id: "controls", title: "CONTROLS", menuLabel: "CONTROLS", iconId: "touchdown-run" },
  { id: "input", title: "INPUT", menuLabel: "INPUT", iconId: "pencil" },
  { id: "media", title: "MEDIA", menuLabel: "MEDIA", iconId: "play" },
  { id: "templates", title: "TEMPLATES", menuLabel: "TEMPLATES", iconId: "layers" },
  { id: "flows", title: "FLOWS", menuLabel: "FLOWS", iconId: "wifi" },
] as const;

export type ShowcaseSectionId = (typeof showcaseSections)[number]["id"];

export interface ShowcaseScenarioDeclaration {
  readonly id: string;
  readonly label: string;
}

export interface ShowcaseCaseDeclaration {
  readonly id: string;
  readonly openPort: string;
  readonly section: ShowcaseSectionId;
  readonly title: string;
  readonly iconId: string;
  readonly scenarios: readonly ShowcaseScenarioDeclaration[];
}

export const showcaseCases = [
  {
    id: "foundation.colors", openPort: "foundationColors", section: "foundations", title: "COLORS", iconId: "palette",
    scenarios: [
      { id: "sea-glass", label: "SEA GLASS" },
      { id: "flat-cyan", label: "FLAT CYAN" },
      { id: "muted", label: "MUTED" },
      { id: "high-contrast", label: "HIGH CONTRAST" },
    ],
  },
  {
    id: "foundation.geometry", openPort: "foundationGeometry", section: "foundations", title: "GEOMETRY", iconId: "grid",
    scenarios: [
      { id: "round-192", label: "ROUND 192" },
      { id: "phone-compact", label: "PHONE COMPACT" },
      { id: "phone-wide", label: "PHONE WIDE" },
      { id: "chrome-x", label: "X @ 9" },
      { id: "chrome-x-gear", label: "X + GEAR" },
    ],
  },
  {
    id: "atom.icon-action", openPort: "atomIconAction", section: "atoms", title: "ACTIONS", iconId: "watch",
    scenarios: [
      { id: "idle", label: "IDLE" },
      { id: "active", label: "ACTIVE" },
      { id: "immediate", label: "IMMEDIATE" },
      { id: "deliberate", label: "DELIBERATE" },
      { id: "disabled", label: "DISABLED" },
    ],
  },
  {
    id: "control.action-row", openPort: "controlActionRow", section: "controls", title: "ACTION ROW", iconId: "touchdown-run",
    scenarios: [
      { id: "immediate", label: "IMMEDIATE" },
      { id: "deliberate", label: "DELIBERATE" },
      { id: "confirm", label: "CONFIRM" },
      { id: "recoverable", label: "RECOVERABLE" },
      { id: "blocked", label: "BLOCKED" },
      { id: "failure", label: "FAILURE + RETRY" },
    ],
  },
  {
    id: "control.choice-row", openPort: "controlChoiceRow", section: "controls", title: "CHOICES", iconId: "grid",
    scenarios: [
      { id: "off", label: "TOGGLE OFF" },
      { id: "on", label: "TOGGLE ON" },
      { id: "two", label: "TWO OPTIONS" },
      { id: "first", label: "SEVEN · FIRST" },
      { id: "middle", label: "SEVEN · MIDDLE" },
      { id: "last", label: "SEVEN · LAST" },
    ],
  },
  {
    id: "control.adjustment", openPort: "controlAdjustment", section: "controls", title: "ADJUST", iconId: "sliders",
    scenarios: [
      { id: "minimum", label: "MINIMUM" },
      { id: "middle", label: "MIDDLE" },
      { id: "maximum", label: "MAXIMUM" },
      { id: "deliberate", label: "DELIBERATE STEPS" },
    ],
  },
  {
    id: "control.progress", openPort: "controlProgress", section: "controls", title: "PROGRESS", iconId: "download",
    scenarios: [
      { id: "none", label: "NONE" },
      { id: "indeterminate", label: "INDETERMINATE" },
      { id: "empty", label: "0 PERCENT" },
      { id: "half", label: "50 PERCENT" },
      { id: "complete", label: "100 PERCENT" },
      { id: "failed", label: "FAILURE + RETRY" },
    ],
  },
  {
    id: "control.press-ring", openPort: "controlPressRing", section: "controls", title: "PRESS", iconId: "record",
    scenarios: [
      { id: "idle", label: "IDLE" },
      { id: "recording", label: "RECORDING" },
      { id: "disabled", label: "DISABLED" },
      { id: "failed", label: "FAILED + RETRY" },
    ],
  },
  {
    id: "input.text", openPort: "inputText", section: "input", title: "TEXT", iconId: "pencil",
    scenarios: [
      { id: "empty", label: "EMPTY" },
      { id: "filled", label: "FILLED" },
      { id: "max", label: "MAX LENGTH" },
      { id: "disabled", label: "DISABLED" },
    ],
  },
  {
    id: "media.capture", openPort: "mediaCapture", section: "media", title: "WAVEFORM", iconId: "record",
    scenarios: [
      { id: "silent", label: "NO SAMPLES" },
      { id: "active", label: "ACTIVE" },
      { id: "long", label: "LONG DURATION" },
    ],
  },
  {
    id: "media.playback", openPort: "mediaPlayback", section: "media", title: "PLAYBACK", iconId: "play",
    scenarios: [
      { id: "ready", label: "READY" },
      { id: "playing", label: "PLAYING" },
      { id: "paused", label: "PAUSED" },
      { id: "complete", label: "COMPLETE" },
      { id: "failed", label: "FAILED" },
    ],
  },
  {
    id: "template.screens", openPort: "templateScreens", section: "templates", title: "SCREENS", iconId: "layers",
    scenarios: [
      { id: "hub", label: "HUB" },
      { id: "detail", label: "DETAIL" },
      { id: "launcher", label: "LAUNCHER" },
      { id: "rows", label: "ROWS" },
      { id: "adjustment", label: "ADJUSTMENT" },
      { id: "color-picker", label: "COLOR PICKER" },
      { id: "dial-preview", label: "DIAL PREVIEW" },
      { id: "empty", label: "EMPTY CONTENT" },
      { id: "max-capacity", label: "MAX CAPACITY" },
      { id: "long-content", label: "LONG CONTENT" },
      { id: "named-selection", label: "NAMED SELECTION" },
    ],
  },
  {
    id: "flow.source", openPort: "flowSource", section: "flows", title: "SOURCE", iconId: "wifi",
    scenarios: [
      { id: "off", label: "OFF" },
      { id: "loading", label: "LOADING" },
      { id: "fresh", label: "FRESH" },
      { id: "aging", label: "AGING" },
      { id: "partial", label: "PARTIAL" },
      { id: "broken", label: "BROKEN" },
    ],
  },
  {
    id: "flow.update", openPort: "flowUpdate", section: "flows", title: "UPDATE", iconId: "download",
    scenarios: [
      { id: "checking", label: "CHECKING" },
      { id: "available", label: "AVAILABLE" },
      { id: "downloading", label: "DOWNLOADING" },
      { id: "ready", label: "READY" },
      { id: "failed", label: "FAILED" },
    ],
  },
  {
    id: "flow.service", openPort: "flowService", section: "flows", title: "SERVICE", iconId: "wrench",
    scenarios: [
      { id: "idle", label: "IDLE" },
      { id: "active", label: "ACTIVE" },
      { id: "success", label: "SUCCESS" },
      { id: "failed", label: "FAILED" },
      { id: "cache", label: "CACHE" },
    ],
  },
] as const satisfies readonly ShowcaseCaseDeclaration[];
