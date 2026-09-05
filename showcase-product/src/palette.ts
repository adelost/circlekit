/** Category wayfinding, not service health. Surface/text stay CircleKit-owned. */
export const showcasePalette = {
  variants: [{
    id: "oled-categories",
    identity: {},
    categories: [
      { id: "style", hex: "#63c899", meaning: "Visual style and layout examples" },
      { id: "actions", hex: "#e7bc64", meaning: "Interactive controls and icon actions" },
      { id: "text", hex: "#7ea9ee", meaning: "Text entry and editing" },
      { id: "audio", hex: "#b09adb", meaning: "Audio capture and playback" },
      { id: "data", hex: "#57bed5", meaning: "Data, freshness and background work examples" },
    ],
    status: {},
    ramps: [],
  }],
} as const;

export type ShowcaseCategory = (typeof showcasePalette.variants)[number]["categories"][number]["id"];
