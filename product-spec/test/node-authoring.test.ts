import assert from "node:assert/strict";
import test from "node:test";
import { authorNode, componentOutput, componentOutputs, defineComponentType, field, nodeOutput, port, service } from "../src/index.js";

const pressure = { id: "fixture.pressure", kind: "observation", boundary: "service-internal", fields: [field("hpa", "number")] } as const;
const position = { id: "fixture.position", kind: "observation", boundary: "service-internal", fields: [field("lat", "number")] } as const;
const runtime = {
  stateOwner: "none", lifetime: "operation", durability: "transient", clockDomain: "none",
  contextInputs: [], effects: ["fixture.run"],
} as const;
const sourceType = service({ id: "fixture.source", inputs: [], outputs: [
  port("pressure", pressure), port("position", position),
], runtime });
const sinkType = service({ id: "fixture.sink", inputs: [port("pressure", pressure)], outputs: [], runtime });
const source = authorNode("fixture.source", {
  type: sourceType, from: {}, config: {}, runs: { kind: "lifetime", lifecycleSources: [] },
});
const sink = authorNode("fixture.sink", {
  type: sinkType, from: { pressure: source.out.pressure }, config: {},
  runs: { kind: "lifetime", lifecycleSources: [] },
});

function wrongContractIsRejected() {
  authorNode("fixture.wrong", {
    type: sinkType,
    // @ts-expect-error The position output cannot satisfy the pressure input.
    from: { pressure: source.out.position },
    config: {}, runs: { kind: "lifetime", lifecycleSources: [] },
  });
  authorNode("fixture.misspelled", {
    type: sinkType,
    // @ts-expect-error A typo is an undeclared port, not an implicit extra input.
    from: { presure: source.out.pressure },
    config: {}, runs: { kind: "lifetime", lifecycleSources: [] },
  });
}
void wrongContractIsRejected;

test("one authored block emits the existing node instance shape", () => {
  assert.deepEqual(sink.node, {
    id: "fixture.sink", nodeTypeRef: sinkType.id,
    bindings: { pressure: "fixture.source.pressure" }, config: {},
    activation: { kind: "lifetime", lifecycleSources: [] },
  });
  assert.deepEqual(source.out.pressure, {
    ref: "fixture.source.pressure", contract: pressure.id, purpose: "data",
  });
  assert.deepEqual(nodeOutput(source, "position"), source.out.position);
});

test("component events expose the same typed output as individual selection", () => {
  const action = { id: "fixture.action", kind: "event", boundary: "ui-event", fields: [] } as const;
  const component = defineComponentType({ id: "fixture.component", inputs: {}, outputs: { fire: action } });
  const producer = { id: "fixture.component", type: component } as const;
  assert.deepEqual(componentOutputs(producer).fire, componentOutput(producer, "fire"));
});
