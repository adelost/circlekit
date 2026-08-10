import type {
  ComponentType,
  PortableSurfaceClass,
  ProductComponentInstance,
} from "./component-tree-model.js";
import type { PortBindingIr } from "./port-graph-model.js";

export interface ComponentRenderScopeIr {
  readonly artifactRef: string;
  readonly screenRef: string;
  readonly surface: PortableSurfaceClass;
  readonly mountRef: string;
}

export interface ComponentRenderInputIr {
  readonly inputPortRef: string;
  readonly producerPortRef: string;
  readonly contractRef: string;
  readonly required: boolean;
}

export interface ComponentRenderEventIr {
  readonly eventPortRef: string;
  readonly targetPortRef: string;
  readonly contractRef: string;
}

/**
 * The complete immutable boundary for one mounted component instance.
 *
 * This is compiled graph data, not a second renderer catalog. Component types
 * own the named contracts, instances own their bindings, and artifact scopes
 * say exactly where the instance is executable.
 */
export interface ComponentRenderContractIr {
  readonly componentInstanceRef: string;
  readonly componentTypeRef: string;
  readonly scopes: readonly ComponentRenderScopeIr[];
  readonly inputs: readonly ComponentRenderInputIr[];
  readonly events: readonly ComponentRenderEventIr[];
}

export function compileComponentRenderContracts(input: {
  readonly componentTypes: readonly ComponentType[];
  readonly components: readonly ProductComponentInstance[];
  readonly bindings: readonly PortBindingIr[];
  readonly artifactScopes: readonly {
    readonly artifactRef: string;
    readonly screenRef: string;
    readonly surface: PortableSurfaceClass;
    readonly includedMounts: readonly {
      readonly mountRef: string;
      readonly componentInstanceRef: string;
    }[];
  }[];
}): readonly ComponentRenderContractIr[] {
  const typeById = new Map(input.componentTypes.map((type) => [type.id, type]));
  const scopesByInstance = new Map<string, ComponentRenderScopeIr[]>();
  for (const scope of input.artifactScopes) {
    for (const mount of scope.includedMounts) {
      const scopes = scopesByInstance.get(mount.componentInstanceRef) ?? [];
      scopes.push({
        artifactRef: scope.artifactRef,
        screenRef: scope.screenRef,
        surface: scope.surface,
        mountRef: mount.mountRef,
      });
      scopesByInstance.set(mount.componentInstanceRef, scopes);
    }
  }

  return input.components.flatMap((component) => {
    const scopes = scopesByInstance.get(component.id) ?? [];
    if (scopes.length === 0) return [];
    const type = typeById.get(component.componentTypeRef);
    if (type === undefined) {
      throw new Error(`component '${component.id}' uses missing component type '${component.componentTypeRef}'`);
    }
    requireUnique(scopes.map(scopeKey), `render scope for component '${component.id}'`);

    const inputs = type.inputs.flatMap((port): readonly ComponentRenderInputIr[] => {
      const inputPortRef = `${component.id}.${port.id}`;
      const bindings = input.bindings.filter((binding) =>
        binding.kind === "component-input" && binding.to === inputPortRef);
      if (bindings.length === 0) {
        if (port.required) throw new Error(`component render input '${inputPortRef}' has no producer`);
        return [];
      }
      if (bindings.length > 1) throw new Error(`component render input '${inputPortRef}' has multiple producers`);
      return [{
        inputPortRef,
        producerPortRef: bindings[0]!.from,
        contractRef: port.contract.id,
        required: port.required,
      }];
    });

    const events = type.outputs.flatMap((port): readonly ComponentRenderEventIr[] => {
      const eventPortRef = `${component.id}.${port.id}`;
      const bindings = input.bindings.filter((binding) =>
        binding.kind === "component-event" && binding.from === eventPortRef);
      if (bindings.length === 0) {
        if (port.required) throw new Error(`component render event '${eventPortRef}' has no target`);
        return [];
      }
      if (bindings.length > 1) throw new Error(`component render event '${eventPortRef}' has multiple targets`);
      return [{
        eventPortRef,
        targetPortRef: bindings[0]!.to,
        contractRef: port.contract.id,
      }];
    });

    return [{
      componentInstanceRef: component.id,
      componentTypeRef: component.componentTypeRef,
      scopes,
      inputs,
      events,
    }];
  });
}

export function componentRenderScopeKey(scope: ComponentRenderScopeIr): string {
  return scopeKey(scope);
}

function scopeKey(scope: ComponentRenderScopeIr): string {
  return `${scope.artifactRef}/${scope.screenRef}/${scope.surface}/${scope.mountRef}`;
}

function requireUnique(values: readonly string[], owner: string): void {
  if (new Set(values).size !== values.length) throw new Error(`duplicate ${owner}`);
}
