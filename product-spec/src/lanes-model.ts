import { requireWireId } from "./node-model.js";

/**
 * Lanes: where a product's streams and services run, declared instead of hand-made.
 *
 * A product that keeps a sensor off the UI thread wrote the same idea three ways (a HandlerThread, another
 * HandlerThread, a single-thread executor), and nothing stopped the next stream from being registered on the UI
 * thread by omission, the freeze class a watch showed in freefall. Here a lane is intent, not mechanism: whether it
 * serves one rider or several, and that its work runs one at a time. Each platform emitter decides how to build it
 * and reports how fully it could.
 *
 * Laws the shape owns, which no product can switch off:
 * - a stream never rides the UI lane;
 * - a dedicated lane has exactly one rider;
 * - every declared stream rides a lane;
 * - a ride names a declared lane, or the UI lane.
 * Riders are named `stream.<id>` or `service.<id>`, so the first law can see which is which.
 */

/** The platform's UI lane (Android's main looper). Declared lanes may not take its name. */
export const UI_LANE = "ui";

export const LANE_ISOLATIONS = ["dedicated", "shared"] as const;
/** `dedicated`: one rider owns the lane. `shared`: several riders take turns on it. */
export type LaneIsolation = (typeof LANE_ISOLATIONS)[number];

export const LANE_ORDERINGS = ["serial"] as const;
/** `serial`: one piece of work at a time, in arrival order. */
export type LaneOrdering = (typeof LANE_ORDERINGS)[number];

export interface LaneDeclaration {
  readonly isolation: LaneIsolation;
  readonly ordering: LaneOrdering;
  /** Why this work has its own lane: what goes wrong if it waits. */
  readonly reason: string;
}

export type LaneRider = `stream.${string}` | `service.${string}`;

export interface LanesDeclaration<Lanes extends Readonly<Record<string, LaneDeclaration>>> {
  readonly id: string;
  readonly lanes: Lanes;
  /** Every stream the product declares, by rider name; each must ride a lane. */
  readonly streams: readonly `stream.${string}`[];
  /** Each rider to the lane it runs on. */
  readonly rides: Readonly<Record<LaneRider, (keyof Lanes & string) | typeof UI_LANE>>;
}

export type Lanes<Declared extends Readonly<Record<string, LaneDeclaration>> = Readonly<Record<string, LaneDeclaration>>> =
  LanesDeclaration<Declared>;

/** Checks every law, then returns the declaration unchanged. All problems are named in one error. */
export function defineLanes<const Declared extends Readonly<Record<string, LaneDeclaration>>>(
  declaration: LanesDeclaration<Declared>,
): Lanes<Declared> {
  const problems = lanesProblems(declaration as unknown as Lanes);
  if (problems.length > 0) throw new Error(`lanes '${declaration.id}' are refused:\n- ${problems.join("\n- ")}`);
  return declaration;
}

/** The riders of one lane, in declaration order. */
export function laneRiders<Declared extends Readonly<Record<string, LaneDeclaration>>>(
  lanes: Lanes<Declared>,
  lane: string,
): readonly LaneRider[] {
  return (Object.entries(lanes.rides) as [LaneRider, string][]).filter(([, rides]) => rides === lane).map(([rider]) => rider);
}

function lanesProblems(lanes: Lanes): string[] {
  const problems: string[] = [];
  try {
    requireWireId(lanes.id, "lanes");
  } catch (error) {
    problems.push((error as Error).message);
  }
  if (Object.keys(lanes.lanes).length === 0) problems.push("lanes need at least one lane");
  for (const [name, lane] of Object.entries(lanes.lanes)) {
    if (name === UI_LANE) problems.push(`lane '${UI_LANE}' is the platform's UI lane and cannot be declared`);
    if (!/^[a-z][a-zA-Z0-9]*$/u.test(name)) problems.push(`lane '${name}' is not a plain lowerCamel name`);
    if (!(LANE_ISOLATIONS as readonly string[]).includes(lane.isolation)) {
      problems.push(`lane '${name}' isolation '${lane.isolation}' is not one of ${LANE_ISOLATIONS.join(", ")}`);
    }
    if (!(LANE_ORDERINGS as readonly string[]).includes(lane.ordering)) {
      problems.push(`lane '${name}' ordering '${lane.ordering}' is not one of ${LANE_ORDERINGS.join(", ")}`);
    }
    if (lane.reason.trim() === "") problems.push(`lane '${name}' exists without saying why`);
  }
  for (const [rider, lane] of Object.entries(lanes.rides) as [string, string][]) {
    if (!/^(stream|service)\.[a-z][a-z0-9.-]*$/u.test(rider)) problems.push(`rider '${rider}' is not named stream.<id> or service.<id>`);
    if (lane !== UI_LANE && lanes.lanes[lane] === undefined) problems.push(`${rider} rides '${lane}', which is not a declared lane`);
    if (lane === UI_LANE && rider.startsWith("stream.")) problems.push(`${rider} rides the UI lane; a stream never does`);
  }
  for (const [name, lane] of Object.entries(lanes.lanes)) {
    const riders = laneRiders(lanes, name);
    if (lane.isolation === "dedicated" && riders.length !== 1) {
      problems.push(`dedicated lane '${name}' has ${riders.length} riders${riders.length > 0 ? ` (${riders.join(", ")})` : ""}; it takes exactly one`);
    }
  }
  for (const stream of lanes.streams) {
    if (!(stream in lanes.rides)) problems.push(`${stream} is declared but rides no lane`);
  }
  return problems;
}
