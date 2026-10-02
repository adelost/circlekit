import {
  compileProductGraph,
  field,
  finiteValueRef,
  port,
  type ComponentType,
  type LegoContract,
  type ProductComponentInstance,
  type ProductIr,
  type ProductNodeInstance,
  type ProductNodeType,
} from "@v1d/product-spec";
import type { ActionKotlinType, ActionModelOptions } from "../src/core/index.js";

/**
 * A compiled acme product with every kind of action: component `acme.panel` emits `reset` (no fields), `rename`
 * (`name: string`) and `pick` (a finite field, so it needs a `types` entry). Service `acme.counter` takes `reset` and
 * `rename`; the sink `acme.surface` takes `pick`, and the relay `acme.state.forwardedPick` into `statePick`.
 */
const event = (id: string, boundary: LegoContract["boundary"], fields: LegoContract["fields"] = []): LegoContract =>
  ({ id, kind: "event", boundary, fields });

export const acmeReset = event("acme.reset", "ui-event");
export const acmeRename = event("acme.rename", "ui-event", [field("name", "string")]);
export const acmePick = event("acme.pick", "ui-event", [field("choice", finiteValueRef("acme.choice"))]);
export const acmeForwardedPick = event("acme.forwarded-pick", "service-internal", [field("choice", finiteValueRef("acme.choice"))]);

export interface AcmeParts {
  readonly nodeTypes: readonly ProductNodeType[];
  readonly nodes: readonly ProductNodeInstance[];
  readonly componentTypes: readonly ComponentType[];
  readonly components: readonly ProductComponentInstance[];
}

/** An effectful service type, named like its one instance. */
function serviceType(id: string, inputs: ProductNodeType["inputs"], outputs: ProductNodeType["outputs"] = []): ProductNodeType {
  return { id, kind: "service", inputs, outputs, runtime: { stateOwner: "none", lifetime: "process", durability: "transient",
    clockDomain: "none", contextInputs: [], effects: [`${id}-write`] } };
}

function serviceNode(id: string, bindings: Readonly<Record<string, string>>): ProductNodeInstance {
  return { id, nodeTypeRef: id, config: {}, bindings, activation: { kind: "lifetime", lifecycleSources: [] } };
}

export const acmeParts: AcmeParts = {
  nodeTypes: [
    serviceType("acme.counter", [port("reset", acmeReset), port("rename", acmeRename)]),
    serviceType("acme.surface", [port("pick", acmePick), port("statePick", acmeForwardedPick)]),
    serviceType("acme.state", [], [port("forwardedPick", acmeForwardedPick)]),
  ],
  nodes: [
    serviceNode("acme.counter", { reset: "acme.panel.reset", rename: "acme.panel.rename" }),
    serviceNode("acme.surface", { pick: "acme.panel.pick", statePick: "acme.state.forwardedPick" }),
    serviceNode("acme.state", {}),
  ],
  componentTypes: [{ id: "acme.panel", requiredCapabilities: [], inputs: [], outputs: [
    { id: "reset", contract: acmeReset, required: true },
    { id: "rename", contract: acmeRename, required: true },
    { id: "pick", contract: acmePick, required: true },
  ] }],
  components: [{ id: "acme.panel", componentTypeRef: "acme.panel", bindings: { inputs: {},
    events: { reset: "acme.counter.reset", rename: "acme.counter.rename", pick: "acme.surface.pick" } } }],
};

/**
 * The parts plus component `componentId`, whose outputs each feed the same-index input of a new service `nodeId`:
 * `[output, input, contract]`. A variant reads as the one thing it adds.
 */
export function withFeed(
  parts: AcmeParts,
  componentId: string,
  nodeId: string,
  feeds: readonly (readonly [output: string, input: string, contract: LegoContract])[],
): AcmeParts {
  return {
    nodeTypes: [...parts.nodeTypes, serviceType(nodeId, feeds.map(([, input, contract]) => port(input, contract)))],
    nodes: [...parts.nodes, serviceNode(nodeId, Object.fromEntries(feeds.map(([output, input]) => [input, `${componentId}.${output}`])))],
    componentTypes: [...parts.componentTypes, { id: componentId, requiredCapabilities: [], inputs: [],
      outputs: feeds.map(([output, , contract]) => ({ id: output, contract, required: true })) }],
    components: [...parts.components, { id: componentId, componentTypeRef: componentId, bindings: { inputs: {},
      events: Object.fromEntries(feeds.map(([output, input]) => [output, `${nodeId}.${input}`])) } }],
  };
}

export const noParts: AcmeParts = { nodeTypes: [], nodes: [], componentTypes: [], components: [] };

/** Compiles the parts with product-spec's own graph compiler, every component mounted on one phone screen. */
export function compileAcme(parts: AcmeParts = acmeParts): Pick<ProductIr, "portRegistry"> {
  return compileProductGraph({ ...parts, configs: [], mountedScopes: parts.components.map(({ id }) => ({
    artifactRef: "phone", screenRef: "acme.home", surface: "main", mountRef: `acme.home.${id}`, componentInstanceRef: id })) });
}

export const acmePickType: ActionKotlinType = { value: "AcmePick", result: "Boolean" };

export const acmeActionOptions = {
  symbolPrefix: "Acme",
  sinks: ["acme.surface"],
  forwardedInputs: ["acme.surface.statePick"],
  types: { "acme.panel.pick": acmePickType, "acme.surface.pick": acmePickType, "acme.surface.statePick": acmePickType },
} as const satisfies ActionModelOptions;
