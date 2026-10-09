import assert from "node:assert/strict";
import test from "node:test";
import type { PortableRampBand } from "@v1d/product-spec";
import { bandStops } from "../src/core/emit-theme.js";

// Skyvw's caution step: 8 to 11 m/s, palest at 8 by default.
const caution: PortableRampBand = {
  id: "caution", upTo: 11, ruleEdge: true, hueDeg: 88, lightness: 0.88, lightnessTravel: 0.2, chromaMax: 0.175, label: "CAUTION",
};

test("a band without ramp options keeps the stops it always had", () => {
  assert.deepEqual(bandStops(caution, {}), bandStops(caution));
  assert.equal(bandStops(caution).length, 5);
});

test("travelFrom 0.5 keeps only the strong half: the band opens at its old middle stop and ends where it ended", () => {
  const all = bandStops(caution), strong = bandStops(caution, { travelFrom: 0.5 });
  assert.equal(strong.length, 5);
  assert.equal(strong[0], all[2]);
  assert.equal(strong[4], all[4]);
  assert.notEqual(strong[0], all[0]);
});

test("a ramp whose strong edge is low runs every band strong end first", () => {
  const up = bandStops(caution, { travelFrom: 0.5 }), down = bandStops(caution, { travelFrom: 0.5, strongEdge: "low" });
  assert.deepEqual(down, [...up].reverse());
});

test("a solid band ignores both options", () => {
  const solid = { ...caution, solid: true };
  assert.deepEqual(bandStops(solid, { travelFrom: 0.5, strongEdge: "low" }), bandStops(solid));
});
