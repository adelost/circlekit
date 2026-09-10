// Reusable silhouettes, not classification rules. Products own labels and evidence.
// Keep separate people and equipment legible in the Ring 24-unit viewport.
const fill = (pathData: string, fillRule: "nonzero" | "evenodd" = "nonzero") =>
  ({ kind: "fill", pathData, fillRule } as const);
const stroke = (pathData: string, strokeWidth = 1.8) =>
  ({ kind: "stroke", pathData, strokeWidth } as const);
const head = (x: number, y: number, r = 1.4) =>
  fill(`M${x - r} ${y}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`);
const wing = fill("M2 7V4.5Q12 -0.5 22 4.5V7Q12 4 2 7Z");
const suspension = stroke("M4 8L9 13M20 8L13 13", 1.4);

/** WHAT: Builds shared activity pictograms from equipment and human silhouettes.
 * WHY: Distinct subjects need recognizable shapes without product-local artwork or duplicated paths. */
export const ACTIVITY_ICON_ASSETS = [
  { id: "tag", viewport: { width: 24, height: 24 }, paths: [
    fill("M3 3H11L21 13Q22 14 21 15L15 21Q14 22 13 21L3 11ZM6.2 5a1.7 1.7 0 1 0 0 3.4a1.7 1.7 0 1 0 0 -3.4Z", "evenodd"),
  ] },
  { id: "ram-air", viewport: { width: 24, height: 24 }, paths: [
    wing, suspension, head(11, 13.1),
    stroke("M11 15.5V18.5M11 17L7.5 15M11 17L14.5 15M11 18.5L8.5 22M11 18.5L14 22"),
  ] },
  { id: "canopy-carry", viewport: { width: 24, height: 24 }, paths: [
    wing, suspension, head(10, 12), head(16, 16),
    stroke("M10 14.4V17M10 17L7 20M10 17L12.4 20"),
    stroke("M16 18.4V20M16 20L14.5 22.5M16 20L19 22M14.7 18L12.7 14.5L10.8 14.5", 1.7),
  ] },
  { id: "tandem", viewport: { width: 24, height: 24 }, paths: [
    wing, suspension, head(9, 12), head(14, 13.4),
    stroke("M9 14.5V18L13 20L15.8 19M14 15.8V19L18 21L21 19.5", 2),
    stroke("M10.5 16.8L14 17.8M14 16.5L17 14.8", 1.6),
  ] },
  { id: "wingsuit", viewport: { width: 24, height: 24 }, paths: [
    head(12, 3.4, 1.8),
    fill("M10 6H14L21 9L20 12L15 15L16.3 21H13.3L12 18.7L10.7 21H7.7L9 15L4 12L3 9Z"),
  ] },
  { id: "tracking", viewport: { width: 24, height: 24 }, paths: [
    head(19, 16, 1.8),
    stroke("M16.2 14.6L11 10.8L5 3.5M11 10.8L3 7M14.4 13.4L8 15M14.4 13.4L15 7", 2.6),
  ] },
  { id: "canopy-swoop", viewport: { width: 24, height: 24 }, paths: [
    fill("M5 8L6 4Q14 0 22 3L21 7Q13 4 5 8Z"),
    stroke("M7 9L14 13M19 8L15 13", 1.4), head(14.7, 13.4),
    stroke("M14.7 15.6L12.5 18.2L8 19M12.5 18.2L17.5 19"),
    stroke("M2 14Q2 21 8 22H21", 1.6),
  ] },
  { id: "formation", viewport: { width: 24, height: 24 }, paths: [
    head(12, 8, 1.3), head(16, 12, 1.3), head(12, 16, 1.3), head(8, 12, 1.3),
    stroke("M12 5.5V2M10.5 4.5L6 6M13.5 4.5L18 6M18.5 12H22M19.5 10.5L18 6M19.5 13.5L18 18M12 18.5V22M13.5 19.5L18 18M10.5 19.5L6 18M5.5 12H2M4.5 13.5L6 18M4.5 10.5L6 6", 2),
  ] },
  { id: "camera", viewport: { width: 24, height: 24 }, paths: [
    fill("M3 6H7L9 3H15L17 6H21Q23 6 23 8V19Q23 21 21 21H3Q1 21 1 19V8Q1 6 3 6ZM12 8a5 5 0 1 0 0 10a5 5 0 1 0 0 -10Z", "evenodd"),
    head(12, 13, 3.1),
  ] },
  { id: "balloon", viewport: { width: 24, height: 24 }, paths: [
    fill("M12 1C3 1 2 9 7 14L9 16H15L17 14C22 9 21 1 12 1ZM11.2 3H12.8V14H11.2Z", "evenodd"),
    stroke("M9 16L10 19M15 16L14 19", 1.5), fill("M9 19H15L14.5 23H9.5Z"),
  ] },
  { id: "helicopter", viewport: { width: 24, height: 24 }, paths: [
    stroke("M5 3H21M13 3V6M2 5V11", 1.8),
    fill("M3 8L10 9V7H16Q20 7 22 11V15H10L8 12L3 11ZM15 8.5V11.5H20L18 8.5Z", "evenodd"),
    stroke("M11 16V19M19 16V19M7 20H22", 1.8),
  ] },
] as const;
