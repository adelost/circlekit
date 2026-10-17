import { CIRCLEKIT_TEXT } from "@v1d/circlekit-assets";

/** The same roles as native, translated to the phone's rem scale. */
export function emitCircleTextCss(): string {
  const scale = CIRCLEKIT_TEXT.phoneFloorSp / CIRCLEKIT_TEXT.roles.note.sp;
  const faces = Object.entries(CIRCLEKIT_TEXT.faces).map(([id, face]) => `  --circle-text-${id}-face: "${face}";`).join("\n");
  return faces + "\n" + Object.entries(CIRCLEKIT_TEXT.roles).map(([id, role]) => {
    const unit = "unitSp" in role ? `\n  --circle-text-${id}-unit-size: ${role.unitSp * scale / 16}rem;\n  --circle-text-${id}-unit-weight: ${role.unitWeight};` : "";
    return `  --circle-text-${id}-size: ${role.sp * scale / 16}rem;\n  --circle-text-${id}-weight: ${role.weight};\n  --circle-text-${id}-tracking: ${role.tracking}em;${unit}`;
  }).join("\n");
}
