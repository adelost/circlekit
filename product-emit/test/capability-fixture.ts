import type { CapabilityTable, CapabilitySource, DomainGraphSource } from "../src/core/index.js";
import { capabilityRows, effectRows, feedbackCapabilities } from "../src/core/index.js";

/**
 * A five-domain product small enough to read in one look: a sensor feeds a
 * flight engine that feeds a dial; a weather fetcher is read by the engine
 * without a port; a complication only the watch instantiates.
 */
export type FixtureProduct = Omit<CapabilitySource, "nodeTypes"> & DomainGraphSource;

const runtime = (contextInputs: readonly string[], effects: readonly string[]) => ({
  stateOwner: "none" as const,
  lifetime: "process" as const,
  durability: "transient" as const,
  clockDomain: "none" as const,
  contextInputs,
  effects,
});

const nodePort = (ownerId: string, portId: string, contractRef: string) =>
  ({ ref: `${ownerId}.${portId}`, ownerId, contractRef });

export const fixtureProduct: FixtureProduct = {
  artifacts: [{ id: "phone" }, { id: "wear" }],
  nodeTypes: [
    { id: "sensor.pressure", kind: "service", runtime: runtime(["device.pressure-sensor"], ["sensor.pressure-subscription"]) },
    { id: "flight.engine", kind: "derive", runtime: runtime(["weather.snapshot"], []) },
    { id: "weather.fetcher", kind: "service", runtime: runtime(["network.connectivity"], ["weather.fetch"]) },
    { id: "watchface.complication", kind: "service", runtime: runtime(["host.complication-request"], ["host.complication-data"]) },
    { id: "dial.present", kind: "present", runtime: runtime([], []) },
  ],
  nodes: [
    { id: "sensor.pressure", nodeTypeRef: "sensor.pressure" },
    { id: "flight.engine", nodeTypeRef: "flight.engine" },
    { id: "weather.fetcher", nodeTypeRef: "weather.fetcher" },
    { id: "watchface.complication", nodeTypeRef: "watchface.complication" },
    { id: "dial.present", nodeTypeRef: "dial.present" },
  ],
  components: [{ id: "dial.face" }],
  portRegistry: {
    nodePorts: [
      nodePort("sensor.pressure", "observation", "pressure.observation"),
      nodePort("flight.engine", "pressure", "pressure.observation"),
      nodePort("flight.engine", "altitude", "flight.altitude"),
      nodePort("dial.present", "altitude", "flight.altitude"),
      nodePort("dial.present", "model", "dial.model"),
    ],
    componentPorts: [nodePort("dial.face", "model", "dial.model")],
    bindings: [
      { from: "sensor.pressure.observation", to: "flight.engine.pressure" },
      { from: "flight.engine.altitude", to: "dial.present.altitude" },
      { from: "dial.present.model", to: "dial.face.model" },
    ],
    demandEdges: [
      { kind: "component-mount", artifactRef: "phone", nodeInstanceRef: "dial.present" },
      { kind: "component-mount", artifactRef: "wear", nodeInstanceRef: "dial.present" },
      { kind: "lifecycle", nodeInstanceRef: "sensor.pressure" },
    ],
  },
};

export const fixtureTable: CapabilityTable = {
  sourceFile: "fixture/capabilities.ts",
  capabilities: [
    ...capabilityRows("SENSOR", ["device.pressure-sensor"]),
    ...capabilityRows("NETWORK", ["network.connectivity"]),
    { id: "host.complication-request", kind: "PLATFORM", providedBy: ["wear"] },
    ...feedbackCapabilities("weather", ["weather.snapshot"]),
  ],
  effects: effectRows("IO", ["sensor.pressure-subscription", "weather.fetch", "host.complication-data"]),
  hostOverrides: { "watchface.complication": ["wear"] },
};
