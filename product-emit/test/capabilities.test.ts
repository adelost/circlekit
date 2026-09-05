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

test("host declarations cannot hide a missing capability on a mounted or lifecycle host", () => {
  const table = {
    ...fixtureTable,
    capabilities: fixtureTable.capabilities.map((row) =>
      row.id === "device.pressure-sensor" ? { ...row, providedBy: ["wear"] } : row),
  };
  for (const kind of ["component-mount", "lifecycle"] as const) {
    const product = {
      ...fixtureProduct,
      portRegistry: {
        ...fixtureProduct.portRegistry,
        demandEdges: [{ kind, artifactRef: "phone", nodeInstanceRef: "sensor.pressure" }],
      },
    };
    for (const override of [[], ["wear"]]) {
      const overrides = { ...table.hostOverrides, "sensor.pressure": override };
      const diagnostics = rules(validateCapabilities(product, { ...table, hostOverrides: overrides }));
      assert.ok(diagnostics.includes("capability.override-derived"), `${kind}: override rejected`);
      assert.ok(diagnostics.includes("capability.not-provided"), `${kind}: phone requirement preserved`);
      assert.ok(nodeHosts(product, ["phone", "wear"], overrides).get("sensor.pressure")?.has("phone"));
    }
  }
});

test("OS host overrides are nonempty and every host reference names a product artifact", () => {
  for (const [hosts, rule] of [
    [[], "capability.override-empty"],
    [["weaar"], "capability.override-artifact"],
  ] as const) {
    const diagnostics = validateCapabilities(fixtureProduct, {
      ...fixtureTable,
      hostOverrides: { "watchface.complication": hosts },
    });
    assert.ok(rules(diagnostics).includes(rule));
  }
  const diagnostics = validateCapabilities(fixtureProduct, {
    ...fixtureTable,
    capabilities: fixtureTable.capabilities.map((row) =>
      row.id === "host.complication-request" ? { ...row, providedBy: ["wear", "weaar"] } : row),
  });
  assert.ok(rules(diagnostics).includes("capability.provider-artifact"));
});
