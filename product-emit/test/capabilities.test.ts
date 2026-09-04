import assert from "node:assert/strict";
import test from "node:test";
import { nodeHosts, validateCapabilities } from "../src/core/index.js";
import { fixtureProduct, fixtureTable } from "./capability-fixture.js";

const rules = (diagnostics: readonly { readonly rule: string }[]) => diagnostics.map(({ rule }) => rule);

test("every context input and effect in the product is a declared row, and every row is used", () => {
  assert.deepEqual(validateCapabilities(fixtureProduct, fixtureTable), []);
});

test("a string a node type spells that the table does not know is a diagnostic, not a capability", () => {
  const [first, ...rest] = fixtureProduct.nodeTypes;
  const mutated = {
    ...fixtureProduct,
    nodeTypes: [{
      ...first!,
      runtime: { ...first!.runtime, contextInputs: [...first!.runtime.contextInputs, "device.teleporter"] },
    }, ...rest],
  };
  assert.ok(rules(validateCapabilities(mutated, fixtureTable)).includes("capability.undeclared"));
});

test("a row nothing asks for is dead data and fails, pointing at the table file", () => {
  const diagnostics = validateCapabilities(fixtureProduct, {
    ...fixtureTable,
    capabilities: [...fixtureTable.capabilities, { id: "device.teleporter", kind: "SENSOR" }],
  });
  assert.deepEqual(diagnostics.map(({ rule, declarationId, sourceFile }) => [rule, declarationId, sourceFile]), [
    ["capability.unused", "device.teleporter", "fixture/capabilities.ts"],
  ]);
});

test("a node hosted on the phone cannot ask for a watch-only capability", () => {
  const withoutOverride = validateCapabilities(fixtureProduct, { ...fixtureTable, hostOverrides: {} });
  assert.deepEqual(withoutOverride.map(({ rule, declarationId, message }) => [rule, declarationId, message]), [
    ["capability.not-provided", "watchface.complication", "needs 'host.complication-request', which artifact 'phone' does not provide"],
  ]);
});

test("hosts are derived from where components are mounted, lifecycle nodes run everywhere", () => {
  const hosts = nodeHosts(fixtureProduct, ["phone", "wear"], fixtureTable.hostOverrides ?? {});
  assert.deepEqual([...hosts.get("dial.present")!].sort(), ["phone", "wear"]);
  assert.deepEqual([...hosts.get("sensor.pressure")!].sort(), ["phone", "wear"]);
  assert.deepEqual([...hosts.get("watchface.complication")!], ["wear"]);
});

test("a STATE_FEEDBACK row must name a domain that exists", () => {
  const diagnostics = validateCapabilities(fixtureProduct, {
    ...fixtureTable,
    capabilities: fixtureTable.capabilities.map((row) =>
      row.id === "weather.snapshot" ? { ...row, domain: "nowhere" } : row),
  });
  assert.ok(rules(diagnostics).includes("capability.feedback-domain"));
});

test("a host override for a node that does not exist is a diagnostic", () => {
  const diagnostics = validateCapabilities(fixtureProduct, {
    ...fixtureTable,
    hostOverrides: { ...fixtureTable.hostOverrides, "ghost.node": ["wear"] },
  });
  assert.ok(rules(diagnostics).includes("capability.override-orphan"));
});
