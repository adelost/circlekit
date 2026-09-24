import type { NodeInputRef, NodeOutputRef } from "./node-authoring.js";
import type { ComponentType, ProductComponentInstance } from "./component-tree-model.js";
import { requireUnique, requireWireId, type ProductNodeType } from "./node-model.js";
import type { ProductNodeInstance } from "./node-instance-model.js";

/** One declared UI event path. Its edge and endpoint bindings are compiled by defineProduct. */
export interface ProductAction<Id extends string = string> {
  readonly id: Id;
  readonly from: NodeOutputRef<string, string, "data">;
  readonly to: NodeInputRef<string, string, "data">;
}

export interface CompiledProductActionDeclaration<Id extends string = string> {
  readonly id: Id;
  readonly from: string;
  readonly to: string;
  readonly contractRef: string;
}

/** Declare a Unit UI event from one component output directly to one service input. */
export function action<const Id extends string>(id: Id, ports: {
  readonly from: NodeOutputRef<string, string, "data">;
  readonly to: NodeInputRef<string, string, "data">;
}): ProductAction<Id> {
  requireWireId(id, "action");
  if (ports.from.contract !== ports.to.contract) {
    throw new Error(`action '${id}' ports use different contracts: '${ports.from.contract}' and '${ports.to.contract}'`);
  }
  return { id, from: ports.from, to: ports.to };
}

export function compileProductActions(
  actions: readonly ProductAction[],
  input: {
    readonly components: readonly ProductComponentInstance[];
    readonly componentTypes: readonly ComponentType[];
    readonly nodes: readonly ProductNodeInstance[];
    readonly nodeTypes: readonly ProductNodeType[];
  },
): {
  readonly actions: readonly CompiledProductActionDeclaration[];
  readonly components: readonly ProductComponentInstance[];
  readonly nodes: readonly ProductNodeInstance[];
} {
  const actionIds = new Set<string>();
  for (const { id } of actions) {
    if (actionIds.has(id)) throw new Error(`duplicate action id '${id}'`);
    actionIds.add(id);
  }
  if (actions.length === 0) return { actions: [], components: input.components, nodes: input.nodes };

  const componentTypeById = new Map(input.componentTypes.map((type) => [type.id, type]));
  const nodeTypeById = new Map(input.nodeTypes.map((type) => [type.id, type]));
  const nodeBindings = new Map(input.nodes.map((node) => [node.id, { ...node.bindings }]));
  const componentEventBindings = new Map(input.components.map((component) => [component.id, { ...component.bindings.events }]));
  const compiled: CompiledProductActionDeclaration[] = [];
  const sourceRefs = new Set<string>();
  const targetRefs = new Set<string>();

  for (const declared of actions) {
    requireWireId(declared.id, "action");
    const source = resolveOwnerPort(declared.from.ref, input.components, declared.id, "component");
    const target = resolveOwnerPort(declared.to.ref, input.nodes, declared.id, "node");
    if (source === null) throw new Error(`action '${declared.id}' references unknown component '${ownerRef(declared.from.ref)}'`);
    if (target === null) throw new Error(`action '${declared.id}' references unknown node '${ownerRef(declared.to.ref)}'`);
    const sourceType = componentTypeById.get(source.owner.componentTypeRef);
    const targetType = nodeTypeById.get(target.owner.nodeTypeRef);
    const sourcePort = sourceType?.outputs.find(({ id }) => id === source.portId);
    const targetPort = targetType?.inputs.find(({ id }) => id === target.portId);
    if (sourcePort === undefined) {
      throw new Error(`action '${declared.id}' references unknown component output '${declared.from.ref}'`);
    }
    if (targetPort === undefined) {
      throw new Error(`action '${declared.id}' references unknown node input '${declared.to.ref}'`);
    }
    if (targetType?.kind !== "service") {
      throw new Error(`action '${declared.id}' target '${declared.to.ref}' must be a service input`);
    }
    for (const [side, contract] of [["component output", sourcePort.contract], ["node input", targetPort.contract]] as const) {
      if (contract.kind !== "event" || contract.boundary !== "ui-event" || contract.fields.length !== 0) {
        throw new Error(`action '${declared.id}' ${side} '${side === "component output" ? declared.from.ref : declared.to.ref}' must use a Unit ui-event contract`);
      }
    }
    if (sourcePort.contract.id !== targetPort.contract.id) {
      throw new Error(`action '${declared.id}' ports use different contracts: '${sourcePort.contract.id}' and '${targetPort.contract.id}'`);
    }
    if (sourceRefs.has(declared.from.ref)) throw new Error(`action '${declared.id}' reuses component event '${declared.from.ref}'`);
    if (targetRefs.has(declared.to.ref)) throw new Error(`action '${declared.id}' reuses node input '${declared.to.ref}'`);
    sourceRefs.add(declared.from.ref);
    targetRefs.add(declared.to.ref);

    const targetBindings = nodeBindings.get(target.owner.id)!;
    const existingSource = targetBindings[target.portId];
    if (existingSource !== undefined && existingSource !== declared.from.ref) {
      throw new Error(`action '${declared.id}' target '${declared.to.ref}' is already bound from '${existingSource}'`);
    }
    targetBindings[target.portId] = declared.from.ref;

    const sourceBindings = componentEventBindings.get(source.owner.id)!;
    const existingTarget = sourceBindings[source.portId];
    if (existingTarget !== undefined && existingTarget !== declared.to.ref) {
      throw new Error(`action '${declared.id}' source '${declared.from.ref}' is already bound to '${existingTarget}'`);
    }
    sourceBindings[source.portId] = declared.to.ref;
    compiled.push({
      id: declared.id,
      from: declared.from.ref,
      to: declared.to.ref,
      contractRef: sourcePort.contract.id,
    });
  }

  return {
    actions: compiled,
    nodes: input.nodes.map((node) => ({ ...node, bindings: nodeBindings.get(node.id)! })),
    components: input.components.map((component) => ({
      ...component,
      bindings: { ...component.bindings, events: componentEventBindings.get(component.id)! },
    })),
  };
}

function resolveOwnerPort<Owner extends { readonly id: string }>(
  ref: string,
  owners: readonly Owner[],
  actionId: string,
  ownerKind: "component" | "node",
): { readonly owner: Owner; readonly portId: string } | null {
  const owner = [...owners].sort((left, right) => right.id.length - left.id.length)
    .find((candidate) => ref.startsWith(`${candidate.id}.`));
  if (owner === undefined) return null;
  const portId = ref.slice(owner.id.length + 1);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(portId)) {
    throw new Error(`action '${actionId}' has invalid ${ownerKind} port reference '${ref}'`);
  }
  return { owner, portId };
}

function ownerRef(ref: string): string {
  return ref.slice(0, ref.lastIndexOf("."));
}
