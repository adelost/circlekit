import type { PortableSurfaceClass } from "./component-tree-model.js";

export interface NativeComponentIdentityManifest {
  readonly instanceRef: string;
  readonly typeRef: string;
}

export interface NativeComponentMountManifest {
  readonly profileRef: string;
  readonly pageRef: string;
  readonly surface: PortableSurfaceClass;
  readonly mountRef: string;
}

export interface NativeImmutableInputManifest {
  readonly consumerPortRef: string;
  readonly producerPortRef: string;
  readonly contractRef: string;
  readonly required: boolean;
}

export interface NativeTypedEventBindingManifest {
  readonly sourcePortRef: string;
  readonly targetPortRef: string;
  readonly contractRef: string;
}

export type NativeEventEmitterManifest =
  | { readonly kind: "empty" }
  | {
    readonly kind: "typed";
    readonly bindings: readonly NativeTypedEventBindingManifest[];
  };

/** Serializable evidence derived from actual host registrations. */
export interface NativeComponentRendererManifestEntry {
  readonly component: NativeComponentIdentityManifest;
  readonly mounts: readonly NativeComponentMountManifest[];
  readonly immutableInputs: readonly NativeImmutableInputManifest[];
  readonly eventEmitter: NativeEventEmitterManifest;
}

export type NativeRendererInputFrame = Readonly<Record<string, unknown>>;

export interface NativeComponentMountRegistration extends NativeComponentMountManifest {
  readonly mount: (
    inputs: NativeRendererInputFrame,
    emitter: NativeEventEmitterRegistration,
  ) => unknown;
}

export interface NativeImmutableInputRegistration extends NativeImmutableInputManifest {
  readonly read: () => unknown;
}

export interface NativeTypedEventBindingRegistration extends NativeTypedEventBindingManifest {
  readonly emit: (payload: unknown) => void;
}

export interface NativeEmptyEventEmitterRegistration {
  readonly kind: "empty";
  /** The `never` input makes an attempted event a compile error for a read-only component. */
  readonly emit: (event: never) => never;
}

export interface NativeTypedEventEmitterRegistration {
  readonly kind: "typed";
  readonly bindings: readonly NativeTypedEventBindingRegistration[];
}

export type NativeEventEmitterRegistration =
  | NativeEmptyEventEmitterRegistration
  | NativeTypedEventEmitterRegistration;

/**
 * Actual compile-bound host registration. Callback endpoints are deliberately
 * absent from Product IR and from the JSON manifest shape.
 */
export interface NativeComponentRendererRegistration {
  readonly component: NativeComponentIdentityManifest;
  readonly mounts: readonly NativeComponentMountRegistration[];
  readonly immutableInputs: readonly NativeImmutableInputRegistration[];
  readonly eventEmitter: NativeEventEmitterRegistration;
}

export function defineNativeEmptyEventEmitter(): NativeEmptyEventEmitterRegistration {
  return Object.freeze({
    kind: "empty" as const,
    emit: (_event: never): never => {
      throw new Error("read-only component cannot emit an event");
    },
  });
}

export function defineNativeTypedEventEmitter(
  bindings: readonly NativeTypedEventBindingRegistration[],
): NativeTypedEventEmitterRegistration {
  if (bindings.length === 0) {
    throw new Error("typed native event emitter has no binding; use defineNativeEmptyEventEmitter");
  }
  requireUnique(bindings.map(({ sourcePortRef }) => sourcePortRef), "native event source port");
  for (const binding of bindings) {
    requireNonblank(binding.sourcePortRef, "native event source port");
    requireNonblank(binding.targetPortRef, `native event '${binding.sourcePortRef}' target port`);
    requireNonblank(binding.contractRef, `native event '${binding.sourcePortRef}' contract`);
    requireFunction(binding.emit, `native event '${binding.sourcePortRef}' emitter`);
  }
  return Object.freeze({ kind: "typed" as const, bindings: Object.freeze([...bindings]) });
}

export function defineNativeComponentRendererRegistration(
  registration: NativeComponentRendererRegistration,
): NativeComponentRendererRegistration {
  if (registration === null || typeof registration !== "object") {
    throw new Error("native component renderer registration must be an object");
  }
  if (registration.component === null || typeof registration.component !== "object") {
    throw new Error("native component renderer registration has no component identity");
  }
  requireNonblank(registration.component.instanceRef, "native component instance ref");
  requireNonblank(registration.component.typeRef, "native component type ref");
  if (!Array.isArray(registration.mounts) || registration.mounts.length === 0) {
    throw new Error(`native component '${registration.component.instanceRef}' has no mount endpoint`);
  }
  requireUnique(registration.mounts.map(mountKey),
    `native mount endpoint for '${registration.component.instanceRef}'`);
  for (const mount of registration.mounts) {
    requireNonblank(mount.profileRef, "native mount profile ref");
    requireNonblank(mount.pageRef, "native mount page ref");
    requireNonblank(mount.mountRef, "native mount ref");
    requireFunction(mount.mount,
      `native mount '${mountKey(mount)}' for '${registration.component.instanceRef}'`);
  }
  if (!Array.isArray(registration.immutableInputs)) {
    throw new Error(`native component '${registration.component.instanceRef}' has no immutable input registry`);
  }
  requireUnique(registration.immutableInputs.map(({ consumerPortRef }) => consumerPortRef),
    `native immutable input for '${registration.component.instanceRef}'`);
  for (const input of registration.immutableInputs) {
    requireNonblank(input.consumerPortRef, "native immutable input consumer port");
    requireNonblank(input.producerPortRef, `native immutable input '${input.consumerPortRef}' producer port`);
    requireNonblank(input.contractRef, `native immutable input '${input.consumerPortRef}' contract`);
    requireFunction(input.read, `native immutable input '${input.consumerPortRef}' reader`);
  }
  if (registration.eventEmitter?.kind === "empty") {
    requireFunction(registration.eventEmitter.emit,
      `native empty event emitter for '${registration.component.instanceRef}'`);
  } else if (registration.eventEmitter?.kind === "typed") {
    defineNativeTypedEventEmitter(registration.eventEmitter.bindings);
  } else {
    throw new Error(`native component '${registration.component.instanceRef}' has no typed event emitter`);
  }
  return registration;
}

export function nativeComponentRendererManifest(
  registrations: readonly NativeComponentRendererRegistration[],
): readonly NativeComponentRendererManifestEntry[] {
  const checked = registrations.map(defineNativeComponentRendererRegistration);
  requireUnique(checked.map(({ component }) => component.instanceRef), "native component renderer instance");
  return checked.map((registration) => {
    return {
      component: { ...registration.component },
      mounts: registration.mounts.map(({ profileRef, pageRef, surface, mountRef }) => ({
        profileRef, pageRef, surface, mountRef,
      })),
      immutableInputs: registration.immutableInputs.map(({
        consumerPortRef, producerPortRef, contractRef, required,
      }) => ({ consumerPortRef, producerPortRef, contractRef, required })),
      eventEmitter: registration.eventEmitter.kind === "empty"
        ? { kind: "empty" }
        : {
          kind: "typed",
          bindings: registration.eventEmitter.bindings.map(({
            sourcePortRef, targetPortRef, contractRef,
          }) => ({ sourcePortRef, targetPortRef, contractRef })),
        },
    };
  });
}

function mountKey(mount: NativeComponentMountManifest): string {
  return `${mount.profileRef}/${mount.pageRef}/${mount.surface}/${mount.mountRef}`;
}

function requireNonblank(value: unknown, owner: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${owner} must be nonblank`);
}

function requireFunction(value: unknown, owner: string): asserts value is (...args: never[]) => unknown {
  if (typeof value !== "function") throw new Error(`${owner} must be compile-bound`);
}

function requireUnique(values: readonly string[], owner: string): void {
  if (new Set(values).size !== values.length) throw new Error(`duplicate ${owner}`);
}
