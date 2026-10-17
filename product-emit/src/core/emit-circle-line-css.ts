import { CIRCLEKIT_LINE } from "@v1d/circlekit-assets";

/** CSS pixels are the web host's dp; the viewport scales its drawing as one face. */
export function emitCircleLineCss(): string {
  return Object.entries(CIRCLEKIT_LINE)
    .map(([role, dp]) => `  --circle-line-${role}: ${dp}px;`)
    .join("\n");
}
