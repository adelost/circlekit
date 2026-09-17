import assert from "node:assert/strict";
import test from "node:test";
import {
  componentPort,
  defineComponentType,
  defineStatePresentation,
  field,
  finiteValues,
  statePresentationField,
} from "../src/index.js";

/**
 * Row 143, sugar 2 of the DX review (docs/plans/2026-09-17-dsl-dx-review.md in Skyvw): ports as an object.
 * A presentation given directly means its contract, and the component-tree capability is written only by a
 * type that needs something else. The array form stays valid and declares the same type.
 */

const statusContract = {
  id: "fixture.status",
  kind: "state",
  boundary: "presentation",
  fields: [field("active", "boolean")],
} as const;
const actionContract = { id: "fixture.action", kind: "event", boundary: "ui-event", fields: [] } as const;
const phasePresentation = defineStatePresentation(finiteValues("fixture.phase", ["idle", "active"]), {
  id: "fixture.phase-signal",
  fields: [statePresentationField("label", "string")],
  cases: { idle: { label: "IDLE" }, active: { label: "ACTIVE" } },
});

const asArray = defineComponentType({
  id: "fixture.control",
  requiredCapabilities: ["ui.component-tree"],
  inputs: [componentPort("state", statusContract), componentPort("phase", phasePresentation.contract)],
  outputs: [componentPort("activate", actionContract)],
});
const asObject = defineComponentType({
  id: "fixture.control",
  inputs: { state: statusContract, phase: phasePresentation },
  outputs: { activate: actionContract },
});

// Bindings are typed from these unions, so the object form must keep each port's name and contract id.
type InputOf<Type extends { readonly inputs: readonly unknown[] }> = Type["inputs"][number];
export const inputIds: InputOf<typeof asObject>["id"][] = ["state", "phase"];
// @ts-expect-error a port the type does not declare is not one of its inputs
export const undeclaredInput: InputOf<typeof asObject>["id"] = "missing";
export const contractIds: InputOf<typeof asObject>["contract"]["id"][] = ["fixture.status", phasePresentation.contract.id];
// @ts-expect-error a contract no input carries is not one of its contract ids
export const undeclaredContract: InputOf<typeof asObject>["contract"]["id"] = "fixture.action";

test("an object of ports declares the same component type as the array form", () => {
  assert.deepEqual(asObject, asArray);
  assert.equal(asObject.inputs[1]!.contract, phasePresentation.contract);
});

test("a type that needs another capability writes it; one written as the default reads the same", () => {
  const menu = defineComponentType({ id: "fixture.menu", requiredCapabilities: ["ui.navigation"], inputs: {}, outputs: { route: actionContract } });
  assert.deepEqual(menu.requiredCapabilities, ["ui.navigation"]);
  assert.deepEqual(menu.inputs, []);
  assert.deepEqual(asObject.requiredCapabilities, asArray.requiredCapabilities);
});

test("the port laws run on the object form and name the port", () => {
  assert.throws(
    () => defineComponentType({ id: "fixture.bad", inputs: { press: actionContract }, outputs: {} }),
    /component type 'fixture\.bad' input 'press' must use a presentation contract/u,
  );
  assert.throws(
    () => defineComponentType({ id: "fixture.bad", inputs: {}, outputs: { state: statusContract } }),
    /component type 'fixture\.bad' output 'state' must use a ui-event contract/u,
  );
  assert.throws(
    () => defineComponentType({ id: "fixture.bad", inputs: { "not-an-identifier": statusContract }, outputs: {} }),
    /input in component type 'fixture\.bad' has invalid identifier 'not-an-identifier'/u,
  );
});
