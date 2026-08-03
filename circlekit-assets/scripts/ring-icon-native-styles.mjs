/** Only framework components with real semantic layers carry native colour. */
export const DEFAULT_COMPOSITE_ICON_STYLES = {
  "cloud-sun": { primary: "sun", layers: ["sun", "cloud"] },
  "rain": { primary: "rain", layers: ["cloud", "rain"] },
  "storm": { primary: "danger", layers: ["cloud", "danger"] },
};
