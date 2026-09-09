// One shell and a bounded set of fill levels, sharing the Ring 24-unit viewport.
// Geometry only: products own measured percent, unknown/charging and warning colour.
const shell = "M9 1H15V4H17A2 2 0 0 1 19 6V21A2 2 0 0 1 17 23H7A2 2 0 0 1 5 21V6A2 2 0 0 1 7 4H9ZM7.5 6.5V20.5H16.5V6.5Z";

const battery = <const Id extends string>(id: Id, quarters: 0 | 1 | 2 | 3 | 4) => ({
  id,
  viewport: { width: 24, height: 24 },
  paths: [
    { kind: "fill", pathData: shell, fillRule: "evenodd" },
    ...(quarters === 0 ? [] : [{
      kind: "fill" as const,
      pathData: `M9 ${19 - quarters * 2.75}H15V19H9Z`,
      fillRule: "nonzero" as const,
    }]),
  ],
} as const);

export const BATTERY_ICON_ASSETS = [
  battery("battery-empty", 0),
  battery("battery-quarter", 1),
  battery("battery-half", 2),
  battery("battery-three-quarters", 3),
  battery("battery-full", 4),
] as const;
