import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { ContractPayloadError, field, listOf, readContractPayload, type LegoContract } from "@v1d/product-spec";
import {
  livePositionContract, livePositionReceiptContract, liveStopReceiptContract, pairingStartReceiptContract,
  pairingStartRequestContract, trackbookWireValues,
} from "../src/wire/index.js";

/** Every JSON body in one fixture folder, by file name. */
function bodies(folder: string): readonly (readonly [string, Record<string, unknown>])[] {
  const directory = new URL(`../../test/fixtures/${folder}/`, import.meta.url);
  return readdirSync(directory).filter((name) => name.endsWith(".json")).sort()
    .map((name) => [name, JSON.parse(readFileSync(new URL(name, directory), "utf8"))] as const);
}

const read = (contract: LegoContract, body: unknown) => readContractPayload(contract, body, trackbookWireValues);

/** A refusal must be a payload fault at this field, never a plain Error a route would answer 500 for. */
function refused(contract: LegoContract, body: unknown, field: string, message: RegExp): void {
  assert.throws(() => read(contract, body), (error) => error instanceof ContractPayloadError && error.field === field
    && message.test(error.message));
}

const corpus = [
  ["pair-start/request", () => pairingStartRequestContract, 5],
  ["pair-start/response", () => pairingStartReceiptContract, 4],
  ["live-position/request", () => livePositionContract, 3],
  ["live-position/response", (name: string) => name.includes("-stop") ? liveStopReceiptContract : livePositionReceiptContract, 5],
] as const;

for (const [folder, contractOf, count] of corpus) {
  test(`every trackbook ${folder} fixture reads as itself: nothing invented, nothing dropped`, () => {
    const found = bodies(`trackbook/${folder}`);
    assert.equal(found.length, count, `${folder} holds ${count} fixtures`);
    for (const [name, body] of found) assert.deepEqual(read(contractOf(name), body), body, name);
  });
}

const [, released] = bodies("trackbook/pair-start/request").find(([name]) => name === "v0.5.1581.json")!;
const [, receipt] = bodies("trackbook/pair-start/response").find(([name]) => name === "trackbook-19a716c.json")!;
const [, point] = bodies("trackbook/live-position/request").find(([name]) => name === "v0.5.1245.json")!;
const [, live] = bodies("trackbook/live-position/response").find(([name]) => name === "trackbook-e8a1a2f.json")!;

// Watches auto-update from a release and trackbook deploys by hand, so a newer watch may send an optional field the
// server does not know yet. Only code generated from these contracts writes the two requests, so an unknown key in
// one is a newer field, never a misspelt one.
const newerPairing: Record<string, unknown> = { ...released, appVersion: "0.5.1600" };
const newerPoint: Record<string, unknown> = { ...point, speedMs: 52.4 };

test("a request with an unknown field parses, and the copy leaves it out", () => {
  assert.deepEqual(read(pairingStartRequestContract, newerPairing), released);
  assert.deepEqual(read(livePositionContract, newerPoint), point);
});

test("an unknown field hides no fault in a declared one: each is refused by its field", () => {
  refused(livePositionContract, { ...newerPoint, latitude: "56.18" }, "latitude", /field 'latitude' must be number/u);
  refused(pairingStartRequestContract, { ...newerPairing, label: 42 }, "label", /field 'label' must be string/u);
  const { phase: _phase, ...withoutPhase } = newerPoint;
  refused(livePositionContract, withoutPhase, "phase", /is missing field 'phase'/u);
  refused(livePositionContract, { ...newerPoint, latitude: 90.5 }, "latitude", /'latitude'=90\.5 violates -90\.\.90/u);
  refused(pairingStartRequestContract, { ...newerPairing, platform: "pebble" }, "platform",
    /must belong to finite 'trackbook\.device-platform'/u);
});

test("a response with an unknown field parses, and the copy leaves it out", () => {
  assert.deepEqual(read(pairingStartReceiptContract, { ...receipt, addedLater: 1 }), receipt);
  const grown = { ...live, eta: 5, position: { ...(live.position as object), heading: 90 },
    grant: { ...(live.grant as object), expiresAt: "2027-01-01T00:00:00.000Z" } };
  assert.deepEqual(read(livePositionReceiptContract, grown), live);
});

test("a missing non-optional field is refused in both directions", () => {
  const { platform: _platform, ...withoutPlatform } = released;
  refused(pairingStartRequestContract, withoutPlatform, "platform", /is missing field 'platform'/u);
  const { code: _code, ...withoutCode } = receipt;
  refused(pairingStartReceiptContract, withoutCode, "code", /is missing field 'code'/u);
  const { phase: _phase, ...withoutPhase } = point;
  refused(livePositionContract, withoutPhase, "phase", /is missing field 'phase'/u);
  const { sequence: _sequence, ...positionWithoutSequence } = live.position as Record<string, unknown>;
  refused(livePositionReceiptContract, { ...live, position: positionWithoutSequence }, "position.sequence",
    /contract 'trackbook\.live-position-echo' is missing field 'sequence'/u);
});

test("an undeclared finite member is refused", () => {
  refused(pairingStartRequestContract, { ...released, platform: "pebble" }, "platform", /must belong to finite 'trackbook\.device-platform'/u);
  refused(pairingStartRequestContract, { ...released, scopes: ["jumps:admin"] }, "scopes[0]", /must belong to finite 'trackbook\.device-scope'/u);
  refused(livePositionReceiptContract, { ...live, sharing: "OFF" }, "sharing", /must belong to finite 'trackbook\.live-sharing-on'/u);
  refused(livePositionReceiptContract, { ...live, grant: { ...(live.grant as object), scope: "jumps:read" } }, "grant.scope",
    /must belong to finite 'trackbook\.live-grant-scope'/u);
});

test("a duplicate scope is refused", () => {
  refused(pairingStartRequestContract, { ...released, scopes: ["jumps:write", "jumps:write"] }, "scopes", /repeats 'jumps:write'/u);
  refused(pairingStartReceiptContract, { ...receipt, requestedScopes: ["jumps:read", "jumps:read"] }, "requestedScopes",
    /repeats 'jumps:read'/u);
});

test("an optional pairing key may be absent but is never null, as today's server refuses null", () => {
  refused(pairingStartRequestContract, { ...released, scopes: null }, "scopes", /must be a list/u);
  refused(pairingStartRequestContract, { ...released, operationId: null }, "operationId", /must be string/u);
});

test("live field laws: range, whole sequence and the one schema version", () => {
  refused(livePositionContract, { ...point, latitude: 90.5 }, "latitude", /'latitude'=90\.5 violates -90\.\.90/u);
  refused(livePositionContract, { ...point, sequence: 1.5 }, "sequence", /must be integer/u);
  refused(livePositionReceiptContract, { ...live, schemaVersion: 2 }, "schemaVersion", /violates 1\.\.1/u);
});

// pl4n-shaped: TaskInput in pl4n's src/lib/server/store.ts. An absent key leaves the task's field as it is and null
// clears it, so a read must keep the two apart. The bodies sit beside the trackbook fixtures.
const taskPatch = {
  id: "tasks.patch", kind: "event", boundary: "wire",
  fields: [
    field("title", "string", { optional: true }), field("note", "string", { optional: true }),
    field("day", "string", { optional: true, nullable: true }), field("until", "string", { optional: true, nullable: true }),
    field("time", "string", { optional: true, nullable: true }), field("assigneeId", "string", { optional: true, nullable: true }),
    field("helpers", listOf("string"), { optional: true }), field("done", "boolean", { optional: true }),
  ],
} as const;

test("a pl4n-shaped PATCH keeps absent keys absent and nulls null", () => {
  const patches = new Map(bodies("pl4n-task-patch"));
  assert.deepEqual([...patches.keys()], ["clear.json", "leave-the-rest.json", "nothing.json", "set.json"]);
  for (const [name, body] of patches) assert.deepEqual(readContractPayload(taskPatch, body), body, name);
  const clear = readContractPayload(taskPatch, patches.get("clear.json"));
  assert.equal(clear.day, null);
  assert.equal("title" in clear, false);
  const leave = readContractPayload(taskPatch, patches.get("leave-the-rest.json"));
  assert.equal("day" in leave, false);
  assert.throws(() => readContractPayload(taskPatch, { title: null }), ContractPayloadError);
});
