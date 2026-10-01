import assert from "node:assert/strict";
import test from "node:test";
import { defineProduct, fetchService, storeService, type FetchServiceSpec } from "../src/index.js";
import { assetCatalog, lifetime, logWriter, product } from "./minimal-product.js";

const logStore = storeService({ id: "log.store", backend: "file", codec: { id: "log-entry", version: 1 },
  identity: "logId", durability: "fsync-atomic-replace", failure: "reject", migration: "versioned",
  effectIds: ["storage.log-write"] });
const weather: FetchServiceSpec = { id: "WEATHER", flow: { mode: "clock", everyMs: 60_000, minSpacingMs: 10_000 },
  freshness: { kind: "age", staleAfterMs: 60_000 },
  failure: { transport: "local", retry: { attemptDelaysMs: [], afterFailureMs: [30_000] }, cache: { kind: "none" } },
  onCrash: "as-failure", effectIds: ["network.weather-read"], ownerNodeRef: "weather.fetch", screenRefs: ["MAIN"] };
const compile = (overrides: object) => defineProduct({ ...product, ...overrides } as typeof product, assetCatalog);

test("owned stores and demanded fetches compile, and the IR stays the product without them", () => {
  const declared = compile({ stores: [logStore], fetches: [fetchService(weather)] });
  assert.deepEqual(declared, defineProduct(product, assetCatalog));
  assert.equal("stores" in declared || "fetches" in declared, false);
});

test("a store effect needs exactly one compiled owner", () => {
  assert.throws(() => compile({ stores: [storeService({ ...logStore, effectIds: ["storage.unowned-write"] })] }),
    /store 'log\.store' effect 'storage\.unowned-write' needs exactly one compiled owner, has 0$/u);
  assert.throws(() => compile({ stores: [logStore],
    nodeTypes: [...product.nodeTypes, logWriter("fixture.log-mirror")],
    nodes: [...product.nodes, { id: "log.mirror", nodeTypeRef: "fixture.log-mirror", config: {},
      bindings: { forecast: "weather.fetch.forecast" }, activation: lifetime }] }),
  /store 'log\.store' effect 'storage\.log-write' needs exactly one compiled owner, has 2 \(fixture\.log-store, fixture\.log-mirror\)$/u);
});

test("a fetch effect needs a compiled owner", () => {
  assert.throws(() => compile({ fetches: [fetchService({ ...weather, effectIds: ["network.unowned-read"] })] }),
    /fetch 'WEATHER' effect 'network\.unowned-read' has no compiled owner/u);
});

test("a fetch owner is a compiled node", () => {
  assert.throws(() => compile({ fetches: [fetchService({ ...weather, ownerNodeRef: "weather.missing" })] }),
    /fetch 'WEATHER' ownerNodeRef 'weather\.missing' is not a compiled node/u);
});

test("a fetch screen is a component-family screen that demands its owner", () => {
  assert.throws(() => compile({ fetches: [fetchService({ ...weather, screenRefs: ["RECORDS"] })] }),
    /fetch 'WEATHER' screen 'RECORDS' is not a component-family screen/u);
  assert.throws(() => compile({ fetches: [fetchService({ ...weather, ownerNodeRef: "log.store" })] }),
    /fetch 'WEATHER' owner 'log\.store' is not demanded on screen 'MAIN'/u);
});
