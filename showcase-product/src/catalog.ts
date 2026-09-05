import type { ShowcaseCategory } from "./palette.js";

export const showcaseSections = [
  { id: "foundations", title: "STYLE", menuLabel: "STYLE", iconId: "palette", category: "style" },
  { id: "atoms", title: "ICON ACTIONS", menuLabel: "ICONS", iconId: "grid", category: "actions" },
  { id: "controls", title: "CONTROLS", menuLabel: "CONTROLS", iconId: "touchdown-run", category: "actions" },
  { id: "input", title: "TEXT INPUT", menuLabel: "TEXT", iconId: "pencil", category: "text" },
  { id: "media", title: "AUDIO DEMOS", menuLabel: "AUDIO", iconId: "play", category: "audio" },
  { id: "templates", title: "PAGE LAYOUTS", menuLabel: "LAYOUTS", iconId: "layers", category: "style" },
  { id: "flows", title: "DATA DEMOS", menuLabel: "DATA", iconId: "data", category: "data" },
] as const satisfies readonly { id: string; title: string; menuLabel: string; iconId: string; category: ShowcaseCategory }[];

export type ShowcaseSectionId = (typeof showcaseSections)[number]["id"];

export interface ShowcaseScenarioDeclaration {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

export interface ShowcaseCaseDeclaration {
  readonly id: string;
  readonly openPort: string;
  readonly section: ShowcaseSectionId;
  readonly title: string;
  readonly iconId: string;
  readonly purpose: string;
  readonly scenarios: readonly ShowcaseScenarioDeclaration[];
}

export const showcaseCases = [
  {
    id: "foundation.colors", openPort: "foundationColors", section: "foundations", title: "COLORS", iconId: "palette",
    purpose: "Shared OLED style and accent samples. Preview only.",
    scenarios: [
      { id: "sea-glass", label: "SEA GLASS", description: "Warm-white actions with green semantic accents" },
      { id: "flat-cyan", label: "FLAT CYAN", description: "Shared base with cyan semantic accents" },
      { id: "muted", label: "MUTED", description: "Subdued semantic accent range" },
      { id: "high-contrast", label: "HIGH CONTRAST", description: "Strong separation between semantic accent roles" },
    ],
  },
  {
    id: "foundation.geometry", openPort: "foundationGeometry", section: "foundations", title: "GEOMETRY", iconId: "grid",
    purpose: "Layout metrics. Real viewport changes: DEV / HOST.",
    scenarios: [
      { id: "round-192", label: "WATCH METRICS", description: "Calculated fit for a 192 dp round screen" },
      { id: "phone-compact", label: "PORTRAIT METRICS", description: "Calculated fit for 390 × 844 dp" },
      { id: "phone-wide", label: "WIDE METRICS", description: "Calculated fit for 1280 × 800 dp" },
      { id: "chrome-x", label: "BACK CLEARANCE", description: "Reserve the left edge for Back" },
      { id: "chrome-x-gear", label: "BACK + SETTINGS", description: "Reserve both round edge controls" },
    ],
  },
  {
    id: "atom.icon-action", openPort: "atomIconAction", section: "atoms", title: "ACTIONS", iconId: "watch",
    purpose: "Shared demo toggle, static looks and disabled actions.",
    scenarios: [
      { id: "idle", label: "INACTIVE LOOK", description: "Static appearance; no command runs" },
      { id: "active", label: "ACTIVE LOOK", description: "Static active appearance; no command runs" },
      { id: "immediate", label: "TAP TO TOGGLE", description: "The icons respond immediately" },
      { id: "deliberate", label: "HOLD TO TOGGLE", description: "Progress confirms an intentional press" },
      { id: "disabled", label: "UNAVAILABLE", description: "The icons cannot be activated" },
    ],
  },
  {
    id: "control.action-row", openPort: "controlActionRow", section: "controls", title: "ACTION ROW", iconId: "touchdown-run",
    purpose: "Local action counts. Nothing is sent or deleted.",
    scenarios: [
      { id: "immediate", label: "TAP ACTION", description: "A tap increments the action count" },
      { id: "deliberate", label: "HOLD ACTION", description: "A completed hold increments the count" },
      { id: "confirm", label: "CONFIRM ACTION", description: "A longer hold protects a destructive action" },
      { id: "recoverable", label: "RECOVER ACCESS", description: "A simulated permission can be enabled" },
      { id: "blocked", label: "MISSING TARGET", description: "Show the reason without a false action" },
      { id: "failure", label: "FAILURE + RETRY", description: "A failed action can be retried in place" },
    ],
  },
  {
    id: "control.choice-row", openPort: "controlChoiceRow", section: "controls", title: "CHOICES", iconId: "grid",
    purpose: "Try selection marks and local demo choices.",
    scenarios: [
      { id: "off", label: "START OFF", description: "Switch a two-state setting on" },
      { id: "on", label: "START ON", description: "Switch a two-state setting off" },
      { id: "two", label: "TWO UNITS", description: "Choose metres or feet" },
      { id: "first", label: "FIRST CHOICE", description: "Seven choices, starting at the beginning" },
      { id: "middle", label: "MIDDLE CHOICE", description: "Seven choices, starting in the middle" },
      { id: "last", label: "LAST CHOICE", description: "Seven choices, starting at the end" },
    ],
  },
  {
    id: "control.adjustment", openPort: "controlAdjustment", section: "controls", title: "ADJUST", iconId: "sliders",
    purpose: "Demo range: 0–1000, in steps of 100.",
    scenarios: [
      { id: "minimum", label: "LOWER LIMIT", description: "Start at zero; decrease cannot go further" },
      { id: "middle", label: "MID RANGE", description: "Increase and decrease from 500" },
      { id: "maximum", label: "UPPER LIMIT", description: "Start at 1000; increase cannot go further" },
      { id: "deliberate", label: "HOLD EACH STEP", description: "Each change needs a deliberate press" },
    ],
  },
  {
    id: "control.progress", openPort: "controlProgress", section: "controls", title: "PROGRESS", iconId: "download",
    purpose: "Tap to advance example progress. No download.",
    scenarios: [
      { id: "none", label: "NOT STARTED", description: "No work means no progress indicator" },
      { id: "indeterminate", label: "UNKNOWN TOTAL", description: "Activity without an invented percentage" },
      { id: "empty", label: "ZERO COMPLETE", description: "The amount is known, but nothing is done" },
      { id: "half", label: "HALF COMPLETE", description: "Measured work at 50 percent" },
      { id: "complete", label: "COMPLETE", description: "Measured work at 100 percent" },
      { id: "failed", label: "FAILURE + RETRY", description: "Keep the failure visible until retried" },
    ],
  },
  {
    id: "control.press-ring", openPort: "controlPressRing", section: "controls", title: "PRESS", iconId: "record",
    purpose: "Press, release and cancel. No microphone is used.",
    scenarios: [
      { id: "idle", label: "READY TO HOLD", description: "Hold to start; release to stop the demo" },
      { id: "recording", label: "RECORDING LOOK", description: "Frozen 7.8-second recording example" },
      { id: "disabled", label: "UNAVAILABLE", description: "No recording gesture is accepted" },
      { id: "failed", label: "FAILED + RETRY", description: "Retry the simulated capture failure" },
    ],
  },
  {
    id: "input.text", openPort: "inputText", section: "input", title: "TEXT", iconId: "pencil",
    purpose: "Type up to 24 characters. Local submission only.",
    scenarios: [
      { id: "empty", label: "START WRITING", description: "Empty composer with a useful prompt" },
      { id: "filled", label: "EDIT A MESSAGE", description: "Existing text stays editable" },
      { id: "max", label: "TEXT LIMIT", description: "A filled 24-character field" },
      { id: "disabled", label: "READ ONLY", description: "Content stays visible without input" },
    ],
  },
  {
    id: "media.capture", openPort: "mediaCapture", section: "media", title: "WAVEFORM", iconId: "record",
    purpose: "Frozen waveform samples. No microphone or live audio.",
    scenarios: [
      { id: "silent", label: "NO SAMPLES", description: "Empty waveform without fabricated signal" },
      { id: "active", label: "SAMPLE WAVEFORM", description: "Frozen 7.8-second example levels" },
      { id: "long", label: "LONG RECORDING", description: "Large elapsed time with the same layout" },
    ],
  },
  {
    id: "media.playback", openPort: "mediaPlayback", section: "media", title: "PLAYBACK", iconId: "play",
    purpose: "Try play, pause and stop. Frozen data; no sound.",
    scenarios: [
      { id: "ready", label: "READY TO PLAY", description: "Start the silent player demo" },
      { id: "playing", label: "PLAYING LOOK", description: "Frozen play position; try pause or stop" },
      { id: "paused", label: "PAUSED", description: "Resume from the retained position" },
      { id: "complete", label: "FINISHED", description: "Playback at its end point" },
      { id: "failed", label: "PLAYBACK FAILED", description: "A visible error can be retried" },
    ],
  },
  {
    id: "template.screens", openPort: "templateScreens", section: "templates", title: "SCREENS", iconId: "layers",
    purpose: "Reusable layouts with local example data.",
    scenarios: [
      { id: "hub", label: "DATA OVERVIEW", description: "Open each source and keep its identity" },
      { id: "detail", label: "VALUE + ACTIONS", description: "Try refresh, use and clear on demo data" },
      { id: "launcher", label: "APP MENU", description: "Each icon opens a working example" },
      { id: "rows", label: "SETTINGS LIST", description: "Read, run an action and toggle a choice" },
      { id: "adjustment", label: "ADJUST VALUE", description: "One value with bounded increase/decrease" },
      { id: "color-picker", label: "PALETTE PICKER", description: "Choose a local preview palette" },
      { id: "dial-preview", label: "DIAL PREVIEW", description: "Simulated height; not a sensor reading" },
      { id: "empty", label: "EMPTY PAGE", description: "Intentionally blank; Back must still work" },
      { id: "max-capacity", label: "LONG LIST", description: "18 rows to test scroll and round clipping" },
      { id: "long-content", label: "LONG TEXT", description: "Check wrapping at the round screen edge" },
      { id: "named-selection", label: "CHOOSE DEVICE", description: "Named choices with descriptions and a disabled option" },
    ],
  },
  {
    id: "flow.source", openPort: "flowSource", section: "flows", title: "DATA AGE", iconId: "data",
    purpose: "Example data: value, age, coverage and errors.",
    scenarios: [
      { id: "off", label: "SOURCE OFF", description: "No value; this source is disabled" },
      { id: "loading", label: "FIRST REQUEST", description: "Fetching before any value has arrived" },
      { id: "fresh", label: "CURRENT VALUE", description: "A completed request with recent data" },
      { id: "aging", label: "OLD VALUE", description: "Keep the last value and show its age" },
      { id: "partial", label: "PARTIAL COVERAGE", description: "Only 3 of 5 requested parts are available" },
      { id: "broken", label: "REQUEST FAILED", description: "Timeout with no usable value" },
    ],
  },
  {
    id: "flow.update", openPort: "flowUpdate", section: "flows", title: "UPDATE DEMO", iconId: "download",
    purpose: "No download or install. Real updates: home / APP UPDATE.",
    scenarios: [
      { id: "checking", label: "CHECKING", description: "Waiting for release information" },
      { id: "available", label: "UPDATE FOUND", description: "A newer version can be downloaded" },
      { id: "downloading", label: "DOWNLOADING", description: "Measured bytes; installation unavailable" },
      { id: "ready", label: "READY TO INSTALL", description: "Verified download awaiting your action" },
      { id: "failed", label: "CHECK FAILED", description: "A network error with a retry action" },
    ],
  },
  {
    id: "flow.service", openPort: "flowService", section: "flows", title: "WORK + CACHE", iconId: "wrench",
    purpose: "Simulated work and cache use. No network requests.",
    scenarios: [
      { id: "idle", label: "NO WORK", description: "No request has run yet" },
      { id: "active", label: "WORK IN PROGRESS", description: "One operation and one transfer are active" },
      { id: "success", label: "REQUEST FINISHED", description: "Last operation completed in 420 ms" },
      { id: "failed", label: "REQUEST FAILED", description: "Last operation timed out" },
      { id: "cache", label: "SAVED LOCALLY", description: "128 cached items; no active transfer" },
    ],
  },
] as const satisfies readonly ShowcaseCaseDeclaration[];
