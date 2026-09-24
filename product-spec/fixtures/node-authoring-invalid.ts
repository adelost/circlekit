import { authorNode, field, nodeOutput, port, service } from "../src/index.js";

const pressure = { id: "fixture.pressure", kind: "observation", boundary: "service-internal", fields: [field("hpa", "number")] } as const;
const position = { id: "fixture.position", kind: "observation", boundary: "service-internal", fields: [field("lat", "number")] } as const;
const runtime = { stateOwner: "none", lifetime: "operation", durability: "transient", clockDomain: "none", contextInputs: [], effects: ["fixture.run"] } as const;
const sourceType = service({ id: "fixture.source", inputs: [], outputs: [port("pressure", pressure), port("position", position)], runtime });
const sinkType = service({ id: "fixture.sink", inputs: [port("pressure", pressure)], outputs: [], runtime });
const source = { id: "fixture.source", type: sourceType } as const;

authorNode("fixture.wrong-contract", {
  type: sinkType,
  from: { pressure: nodeOutput(source, "position") },
  config: {}, runs: { kind: "lifetime", lifecycleSources: [] },
});
authorNode("fixture.misspelled-port", {
  type: sinkType,
  from: { presure: nodeOutput(source, "pressure") },
  config: {}, runs: { kind: "lifetime", lifecycleSources: [] },
});
