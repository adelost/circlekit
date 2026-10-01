import assert from "node:assert/strict";
import test from "node:test";
import {
  bindPortImplementations, bool, choice, decide, defineDecisionTable, defineLanes, defineProduct, fetchService, field,
  finiteValueRef, finiteValues, integer, laneRiders, listOf, on, portContracts, readContractPayload, record,
} from "../src/index.js";
import { assetCatalog, product as minimalProduct } from "./minimal-product.js";

// Every ```ts block of product-spec/GUIDE.md, verbatim, inside the real declaration it belongs to, so the
// compiler and the shape's laws read each example. scripts/check-guide-paths.sh refuses a block missing here.

const litGroundFace = "LIT";
const stayOnHolds = true;
const live = { hz: 25 };
const idle = { hz: 1 };
const isAirborne = (phase: string): boolean => phase === "FREEFALL";

const powerTable = (airPressure: { readonly hz: number }) => defineDecisionTable({
  id: "guide.power",
  axes: { phase: ["GROUND", "LANDED", "FREEFALL"], display: ["INTERACTIVE", "DARK"], arrived: ["JUST_NOW", "SETTLED"] },
  columns: { brightness: choice(["DIM", "LIT"]), screenHold: bool, pressure: record({ hz: integer }) },
  cells: [
    on("ground.lit.arrival",
       { phase: ["GROUND", "LANDED"], display: "INTERACTIVE", arrived: "JUST_NOW" },
       { brightness: litGroundFace, screenHold: stayOnHolds, pressure: live }),
    on("ground.lit.settled", { phase: ["GROUND", "LANDED"], display: "INTERACTIVE", arrived: "SETTLED" },
      { brightness: litGroundFace, screenHold: false, pressure: idle }),
    on("ground.dark", { phase: ["GROUND", "LANDED"], display: "DARK" }, { brightness: "DIM", screenHold: false, pressure: idle }),
    on("air", { phase: "FREEFALL" }, { brightness: litGroundFace, screenHold: stayOnHolds, pressure: airPressure }),
  ],
  derived: { arrived: { inside: "JUST_NOW", outside: "SETTLED", windowMs: 30_000,
                        startsOn: ["face-lit", "touch"], restartsOn: ["touch"], endsOn: ["face-dark"],
                        source: "docs/architecture/barometer-rate.md" } },
  invariants: [{ refuse: "air must read pressure live", when: (d) => isAirborne(d.at.phase) && d.values.pressure.hz < 20 }],
});

test("the cell, derived-axis and invariant examples build one decision table", () => {
  const power = powerTable(live);
  assert.equal(decide(power, { phase: "LANDED", display: "INTERACTIVE", arrived: "JUST_NOW" }).cell, "ground.lit.arrival");
  assert.deepEqual(power.derived.arrived?.startsOn.length, 2);
});

test("the invariant example refuses an airborne decision below 20 Hz", () => {
  assert.throws(() => powerTable(idle), /air must read pressure live/u);
});

test("the lane example is a lane declaration", () => {
  const lanes = defineLanes({ id: "guide.lanes",
    lanes: { pressure: { isolation: "dedicated", owner: "pressure-hub", lifetime: "process", ordering: "serial", reason: "a late sample is a late altitude" } },
    streams: ["stream.pressure"],
    rides: { "stream.pressure": { lane: "pressure", owner: "pressure-hub" } } });
  assert.deepEqual(laneRiders(lanes, "pressure"), ["stream.pressure"]);
});

test("the fetch example is a fetch policy", () => {
  const weather = fetchService({ id: "WEATHER", flow: { mode: "clock", everyMs: 1_800_000, minSpacingMs: 10_000 },
    freshness: { kind: "age", staleAfterMs: 1_800_000 },
    failure: { transport: "network", timeout: { connectMs: 10_000, readMs: 30_000 },
      retry: { attemptDelaysMs: [1_000, 4_000], afterFailureMs: [30_000, 120_000, 600_000] },
      offline: "serve-stale", cache: { kind: "value", maxAgeMs: 1_800_000,
        homeRadiusM: 50, onFailure: "keep-last-good" } },
    onCrash: "as-failure", effectIds: ["weather.briefing-fetch"] });
  assert.equal(weather.cadenceMs, 1_800_000);
});

test("the wire example reads a released request whose optional key is absent, and keeps it absent", () => {
  const platforms = finiteValues("device.platform", ["wear-os", "apple-watch", "garmin"]);
  const scopes = finiteValues("device.scope", ["jumps:read", "jumps:write"]);
  const body: unknown = { platform: "wear-os" };
  const start = { id: "pairing.start", kind: "event", boundary: "wire", fields: [
    field("platform", finiteValueRef("device.platform")),
    field("scopes", listOf(finiteValueRef("device.scope"), { distinct: true }), { optional: true })] } as const;
  const request = readContractPayload(start, body, [platforms, scopes]);
  assert.deepEqual(request, { platform: "wear-os" });
});

test("the observed-port example binds a compiled product's contracts", () => {
  const product = defineProduct(minimalProduct, assetCatalog);
  const implementations = { "weather.fetch.forecast": () => ({ windMs: 4 }) };
  const contracts = portContracts(product.portRegistry, product.finiteValues);
  const ports = bindPortImplementations(implementations, contracts);
  assert.equal(ports, implementations);
  assert.equal(contracts.contracts.get("weather.fetch.forecast")?.id, "fixture.forecast");
});
