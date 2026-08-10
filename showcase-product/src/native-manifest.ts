import {
  NATIVE_BINDING_MANIFEST_SCHEMA_VERSION,
  type NativeBindingManifest,
  type OutputArtifact,
  type ProductIr,
} from "@v1d/product-spec";

export interface ShowcaseNativeNodeAdapter {
  readonly nodeId: string;
  readonly nativePortId: string;
}

/**
 * Navigation registrations shared by one deterministic native source and its
 * exported manifest. Callers must emit these records into executable host code;
 * a manifest-only use would not constitute a native binding.
 */
export function compileShowcaseNativeNavigation(
  product: ProductIr,
  profiles: readonly string[],
): NativeBindingManifest["navigation"] {
  const profileSet = new Set(profiles);
  return {
    artifacts: product.navigation.artifacts.filter(({ artifactRef }) => profileSet.has(artifactRef)),
    activePageBindings: [{
      publisherPortRef: product.navigation.activePagePortRef,
      pageHostPortRef: product.navigation.pageHostPortRef,
    }],
    actionGroups: product.navigation.actionGroups.flatMap((group) => group.artifactRefs
      .filter((artifactRef) => profileSet.has(artifactRef))
      .map((artifactRef) => ({
        artifactRef,
        componentInstanceRef: group.componentInstanceRef,
        actions: group.actions.map(({ sourcePortRef, targetPortRef, effect }) => ({
          sourcePortRef,
          targetPortRef,
          effect,
        })),
      }))),
  };
}

export function compileShowcaseNativeFiniteValues(
  product: ProductIr,
): NonNullable<NativeBindingManifest["finiteValues"]> {
  return product.finiteValues.map(({ id, values }) => ({ id, values }));
}

/**
 * Compile the node registrations emitted into one native host.
 *
 * The adapter names are host-owned. ProductSpec contributes only the exact node
 * and port vocabulary; shared conformance independently checks the emitted
 * manifest, so this compiler cannot turn a missing native adapter into coverage.
 */
export function compileShowcaseNativeNodes(
  product: ProductIr,
  profiles: readonly string[],
  adapters: readonly ShowcaseNativeNodeAdapter[],
): NativeBindingManifest["nodes"] {
  const adapterByNode = new Map(adapters.map((adapter) => [adapter.nodeId, adapter.nativePortId]));
  if (adapterByNode.size !== adapters.length) throw new Error("duplicate Showcase native node adapter");
  for (const nodeId of adapterByNode.keys()) {
    if (!product.nodes.some(({ id }) => id === nodeId)) {
      throw new Error(`native adapter names unknown Showcase node '${nodeId}'`);
    }
  }
  return product.nodes.map(({ id }) => {
    const nativePortId = adapterByNode.get(id);
    if (nativePortId === undefined) throw new Error(`Showcase node '${id}' has no native adapter`);
    const ports = product.portRegistry.nodePorts.filter(({ ownerId }) => ownerId === id);
    return {
      nodeId: id,
      nativePortId,
      profiles,
      inputPorts: ports.filter(({ direction }) => direction === "input").map(({ portId }) => portId),
      outputPorts: ports.filter(({ direction }) => direction === "output").map(({ portId }) => portId),
    };
  });
}

export function nativeManifestArtifact(
  id: string,
  path: string,
  manifest: Omit<NativeBindingManifest, "stage" | "schemaVersion">,
): OutputArtifact {
  const value: NativeBindingManifest = {
    stage: "native-export",
    schemaVersion: NATIVE_BINDING_MANIFEST_SCHEMA_VERSION,
    ...manifest,
  };
  return {
    id,
    path,
    mediaType: "application/json",
    content: `${JSON.stringify(value, null, 2)}\n`,
  };
}
