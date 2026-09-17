import { requireWireId } from "./node-model.js";

/**
 * Lanes: where a product's streams and services run, declared instead of hand-made.
 *
 * A product that keeps a sensor off the UI thread wrote the same idea three ways (a HandlerThread, another
 * HandlerThread, a single-thread executor), and nothing stopped the next stream from being registered on the UI
 * thread by omission, the freeze class a watch showed in freefall. Here a lane is intent, not mechanism: who owns it,
 * how long it lives, that its work runs one at a time, and why. Each platform emitter decides how to build it and says
 * how fully it could: full, degraded (an allowed sharing of a physical resource, its meaning kept) or unsupported (a
 * must-hold requirement the platform cannot meet), never a breach called degraded.
 *
 * Laws the shape owns, which no product can switch off:
 * - a stream never rides the UI lane;
 * - a dedicated lane belongs to one owner: its riders all name that owner (a sensor intake and its processing may share
 *   it), unrelated work may not, and it has at least one rider;
 * - only a dedicated lane may live and die with its owner instance; a shared lane lives for the process;
 * - every declared stream rides a lane;
 * - a ride names a declared lane, or the UI lane.
 * Riders are named `stream.<id>` or `service.<id>`, so the first law can see which is which.
 */

/** The platform's UI lane (Android's main looper). Declared lanes may not take its name. */
export const UI_LANE = "ui";

export const LANE_ISOLATIONS = ["dedicated", "shared"] as const;
/** `dedicated`: one owner's work only. `shared`: unrelated riders take turns on it. */
export type LaneIsolation = (typeof LANE_ISOLATIONS)[number];

export const LANE_ORDERINGS = ["serial"] as const;
/** `serial`: one piece of work at a time, in arrival order. */
export type LaneOrdering = (typeof LANE_ORDERINGS)[number];

export const LANE_LIFETIMES = ["process", "owner"] as const;
/**
 * `process`: built on first use and kept until the process ends.
 * `owner`: built with its owner instance and closed with it; an owner that restarts builds a new lane.
 */
export type LaneLifetime = (typeof LANE_LIFETIMES)[number];

/** How fully a platform could build a lane, as its emitter reports it. */
export const LANE_FULFILMENTS = ["full", "degraded", "unsupported"] as const;
export type LaneFulfilment = (typeof LANE_FULFILMENTS)[number];

interface LaneBase {
  readonly ordering: LaneOrdering;
  readonly lifetime: LaneLifetime;
  /** Why this work has its own lane: what goes wrong if it waits. */
  readonly reason: string;
}

export interface DedicatedLane extends LaneBase {
  readonly isolation: "dedicated";
  /** The one owner whose riders may share this lane, e.g. `pressure-hub`. */
  readonly owner: string;
}

export interface SharedLane extends LaneBase {
  readonly isolation: "shared";
  readonly lifetime: "process";
}

export type LaneDeclaration = DedicatedLane | SharedLane;

export type LaneRider = `stream.${string}` | `service.${string}`;

/** A ride onto a dedicated lane names the owner the rider works for; a ride onto a shared lane or the UI names only the lane. */
export type LaneRide<LaneName extends string = string> = LaneName | typeof UI_LANE | { readonly lane: LaneName; readonly owner: string };

export interface LanesDeclaration<Lanes extends Readonly<Record<string, LaneDeclaration>>> {
  readonly id: string;
  readonly lanes: Lanes;
  /** Every stream the product declares, by rider name; each must ride a lane. */
  readonly streams: readonly `stream.${string}`[];
  /** Each rider to the lane it runs on. */
  readonly rides: Readonly<Record<LaneRider, LaneRide<keyof Lanes & string>>>;
}

export type Lanes<Declared extends Readonly<Record<string, LaneDeclaration>> = Readonly<Record<string, LaneDeclaration>>> =
  LanesDeclaration<Declared>;

/** One ride as an edge, for the product JSON and graph. */
export interface LaneRideEdge {
  readonly from: LaneRider;
  readonly to: string;
  readonly owner?: string;
}

/** Lanes as the product IR carries them: the lanes as declared and every ride as an edge from rider to lane. */
export interface LanesIr {
  readonly id: string;
  readonly lanes: Readonly<Record<string, LaneDeclaration>>;
  readonly rides: readonly LaneRideEdge[];
}

/** Checks every law, then returns the declaration unchanged. All problems are named in one error. */
export function defineLanes<const Declared extends Readonly<Record<string, LaneDeclaration>>>(
  declaration: LanesDeclaration<Declared>,
): Lanes<Declared> {
  const problems = lanesProblems(declaration as unknown as Lanes);
  if (problems.length > 0) throw new Error(`lanes '${declaration.id}' are refused:\n- ${problems.join("\n- ")}`);
  return declaration;
}

/** Every ride as an edge from rider to lane, in declaration order. */
export function laneRideEdges<Declared extends Readonly<Record<string, LaneDeclaration>>>(lanes: Lanes<Declared>): readonly LaneRideEdge[] {
  return (Object.entries(lanes.rides) as [LaneRider, LaneRide][]).map(([from, ride]) =>
    typeof ride === "string" ? { from, to: ride } : { from, to: ride.lane, owner: ride.owner });
}

/** The riders of one lane, in declaration order. */
export function laneRiders<Declared extends Readonly<Record<string, LaneDeclaration>>>(
  lanes: Lanes<Declared>,
  lane: string,
): readonly LaneRider[] {
  return laneRideEdges(lanes).filter(({ to }) => to === lane).map(({ from }) => from);
}

/** The product IR's lanes, or nothing when a product declares none, so its IR stays what it was. */
export function lanesIr<Declared extends Readonly<Record<string, LaneDeclaration>>>(
  lanes: Lanes<Declared> | undefined,
): { readonly lanes?: LanesIr } {
  if (lanes === undefined) return {};
  defineLanes(lanes);
  return { lanes: { id: lanes.id, lanes: lanes.lanes, rides: laneRideEdges(lanes) } };
}

function lanesProblems(lanes: Lanes): string[] {
  const problems: string[] = [];
  try {
    requireWireId(lanes.id, "lanes");
  } catch (error) {
    problems.push((error as Error).message);
  }
  if (Object.keys(lanes.lanes).length === 0) problems.push("lanes need at least one lane");
  for (const [name, lane] of Object.entries(lanes.lanes)) problems.push(...laneProblems(name, lane));
  const edges = laneRideEdges(lanes);
  for (const { from, to, owner } of edges) {
    if (!/^(stream|service)\.[a-z][a-z0-9.-]*$/u.test(from)) problems.push(`rider '${from}' is not named stream.<id> or service.<id>`);
    if (to === UI_LANE) {
      if (from.startsWith("stream.")) problems.push(`${from} rides the UI lane; a stream never does`);
      continue;
    }
    const lane = lanes.lanes[to];
    if (lane === undefined) {
      problems.push(`${from} rides '${to}', which is not a declared lane`);
    } else if (lane.isolation === "dedicated" && owner !== lane.owner) {
      problems.push(owner === undefined
        ? `${from} rides dedicated lane '${to}' without naming its owner '${lane.owner}'`
        : `${from} works for '${owner}' and may not ride '${to}', which belongs to '${lane.owner}'`);
    } else if (lane.isolation === "shared" && owner !== undefined) {
      problems.push(`${from} names owner '${owner}' on shared lane '${to}', which has no owner`);
    }
  }
  for (const [name, lane] of Object.entries(lanes.lanes)) {
    if (lane.isolation === "dedicated" && !edges.some(({ to }) => to === name)) problems.push(`dedicated lane '${name}' has no rider`);
  }
  for (const stream of lanes.streams) {
    if (!(stream in lanes.rides)) problems.push(`${stream} is declared but rides no lane`);
  }
  return problems;
}

function laneProblems(name: string, lane: LaneDeclaration): string[] {
  const problems: string[] = [];
  if (name === UI_LANE) problems.push(`lane '${UI_LANE}' is the platform's UI lane and cannot be declared`);
  if (!/^[a-z][a-zA-Z0-9]*$/u.test(name)) problems.push(`lane '${name}' is not a plain lowerCamel name`);
  if (!(LANE_ISOLATIONS as readonly string[]).includes(lane.isolation)) {
    problems.push(`lane '${name}' isolation '${lane.isolation}' is not one of ${LANE_ISOLATIONS.join(", ")}`);
  }
  if (!(LANE_ORDERINGS as readonly string[]).includes(lane.ordering)) {
    problems.push(`lane '${name}' ordering '${lane.ordering}' is not one of ${LANE_ORDERINGS.join(", ")}`);
  }
  if (!(LANE_LIFETIMES as readonly string[]).includes(lane.lifetime)) {
    problems.push(`lane '${name}' lifetime '${lane.lifetime}' is not one of ${LANE_LIFETIMES.join(", ")}`);
  }
  if (lane.isolation === "dedicated" && !/^[a-z][a-z0-9-]*$/u.test(lane.owner ?? "")) {
    problems.push(`dedicated lane '${name}' names no owner`);
  }
  if (lane.isolation === "shared" && (lane.lifetime as LaneLifetime) === "owner") {
    problems.push(`shared lane '${name}' has no owner instance to live and die with; its lifetime is the process`);
  }
  if (lane.reason.trim() === "") problems.push(`lane '${name}' exists without saying why`);
  return problems;
}
