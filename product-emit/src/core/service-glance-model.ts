/**
 * Services a product shows as small glyphs: an icon, a number, and a ring that counts down to the next update
 * (CircleKit's `CircleServiceStrip`). A product that declares none gets nothing and pays nothing.
 *
 * WHAT IS DECLARED: which services exist, what they are called, their icon, and how they deliver, which alone decides
 * what the number means. WHAT IS NOT: anything live. Whether a service runs, when it last delivered and how fast it
 * measures are its native owner's to report; the renderer draws what the owner says.
 */

/** What a glyph's number means: time between deliveries, deliveries per second, or how old the kept data is. */
export const SERVICE_GLANCE_UNITS = ["INTERVAL", "HERTZ", "AGE"] as const;
export type ServiceGlanceUnit = (typeof SERVICE_GLANCE_UNITS)[number];

interface ServiceGlanceBase<IconRef extends string> {
  /** UPPER_SNAKE and unique: the identity a product maps to the one native owner that reports the service. */
  readonly id: string;
  /** Spoken name, UPPER CASE. */
  readonly label: string;
  /** Distinct across the catalogue, so a glyph names one service. */
  readonly icon: IconRef;
}

/** Asked on a clock: the number is its interval, and the ring counts down to the next ask. */
export interface ClockServiceGlance<IconRef extends string = string> extends ServiceGlanceBase<IconRef> {
  readonly delivery: "CLOCK";
  readonly intervalMs: number;
}

/** Delivers on its own clock (a sensor): the number is what arrives, and the ring counts the measured interval. */
export interface StreamServiceGlance<IconRef extends string = string> extends ServiceGlanceBase<IconRef> {
  readonly delivery: "STREAM";
  readonly unit: "INTERVAL" | "HERTZ";
}

/** Kept on a lease and refetched on demand, never on a clock: the number is its age, the ring counts the lease. */
export interface LeaseServiceGlance<IconRef extends string = string> extends ServiceGlanceBase<IconRef> {
  readonly delivery: "LEASE";
  readonly leaseMs: number;
}

export type ServiceGlanceDeclaration<IconRef extends string = string> =
  | ClockServiceGlance<IconRef>
  | StreamServiceGlance<IconRef>
  | LeaseServiceGlance<IconRef>;

export function serviceGlanceUnit(glance: ServiceGlanceDeclaration): ServiceGlanceUnit {
  switch (glance.delivery) {
    case "CLOCK": return "INTERVAL";
    case "STREAM": return glance.unit;
    case "LEASE": return "AGE";
  }
}

/** The interval its ring counts against when the declaration knows it; a stream's is measured on the device. */
export function serviceGlanceDeclaredIntervalMs(glance: ServiceGlanceDeclaration): number | undefined {
  switch (glance.delivery) {
    case "CLOCK": return glance.intervalMs;
    case "STREAM": return undefined;
    case "LEASE": return glance.leaseMs;
  }
}

export interface ServiceGlanceRules<IconRef extends string = string> {
  /** Every icon the product can draw; a glyph naming another fails here, not on a watch. */
  readonly icons: ReadonlySet<IconRef>;
  readonly labelMaxChars: number;
}

const UPPER_SNAKE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/u;

/** Every reason the catalogue is not drawable, empty when it is. */
export function serviceGlanceProblems<IconRef extends string>(
  glances: readonly ServiceGlanceDeclaration<IconRef>[],
  rules: ServiceGlanceRules<IconRef>,
): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const icons = new Map<string, string>();
  glances.forEach((glance, index) => {
    const where = `service glance ${index} '${glance.id}'`;
    if (!UPPER_SNAKE.test(glance.id)) problems.push(`${where} is not an UPPER_SNAKE id`);
    if (ids.has(glance.id)) problems.push(`${where} is declared twice`);
    ids.add(glance.id);
    if (glance.label.trim() === "" || glance.label !== glance.label.toUpperCase()) problems.push(`${where} needs an UPPER CASE label`);
    if (glance.label.length > rules.labelMaxChars) {
      problems.push(`${where} label '${glance.label}' is ${glance.label.length} chars, cap is ${rules.labelMaxChars}`);
    }
    if (!rules.icons.has(glance.icon)) problems.push(`${where} shows icon ${glance.icon}, which the product cannot draw`);
    const other = icons.get(glance.icon);
    if (other !== undefined) problems.push(`${where} shows icon ${glance.icon}, which already names ${other}`);
    icons.set(glance.icon, where);
    switch (glance.delivery) {
      case "CLOCK":
        if (!isPositiveWholeMs(glance.intervalMs)) problems.push(`${where} needs a positive whole-millisecond interval`);
        break;
      case "LEASE":
        if (!isPositiveWholeMs(glance.leaseMs)) problems.push(`${where} needs a positive whole-millisecond lease`);
        break;
      case "STREAM":
        if (glance.unit !== "INTERVAL" && glance.unit !== "HERTZ") problems.push(`${where} is a stream, so its number is an INTERVAL or HERTZ`);
        break;
      default:
        problems.push(`${where} delivers by '${(glance as { delivery: string }).delivery}', not CLOCK, STREAM or LEASE`);
    }
  });
  return problems;
}

/** Fail before emission with every problem at once. */
export function validateServiceGlances<IconRef extends string>(
  glances: readonly ServiceGlanceDeclaration<IconRef>[],
  rules: ServiceGlanceRules<IconRef>,
): void {
  const problems = serviceGlanceProblems(glances, rules);
  if (problems.length > 0) throw new Error(`service glances are not drawable:\n${problems.join("\n")}`);
}

function isPositiveWholeMs(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}
