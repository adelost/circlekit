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

export type ShowcaseNativeNavigationRegistration = NonNullable<NativeBindingManifest["navigation"]>;

export interface ShowcaseNativeArtifactRegistration {
  readonly artifactRef: string;
  readonly entryPageRef: string;
  readonly pageRefs: readonly string[];
}

export interface ShowcaseNativeDispatchRegistration {
  readonly artifactRefs: readonly string[];
  readonly componentInstanceRef: string;
  readonly sourcePortRef: string;
  readonly targetPortRef: string;
}

/** The registration executed by NavigationStack hosts. */
export function fullUiNavigationRegistration(
  artifacts: readonly ShowcaseNativeArtifactRegistration[],
  dispatches: readonly ShowcaseNativeDispatchRegistration[],
): ShowcaseNativeNavigationRegistration {
  return {
    artifacts: artifacts.map((artifact) => ({
      artifactRef: artifact.artifactRef,
      entryPageRef: artifact.entryPageRef,
      pages: artifact.pageRefs.map((pageRef) => ({
        pageRef,
        restore: pageRef === artifact.entryPageRef ? "root" : "process",
        back: pageRef === artifact.entryPageRef ? "system" : "previous",
        guardContractRef: null,
      })),
    })),
    activePageBindings: [{
      publisherPortRef: "navigation.activePage",
      pageHostPortRef: "page.host.activePage",
    }],
    actionGroups: [
      ...dispatches.flatMap((dispatch) => dispatch.artifactRefs.map((artifactRef) => ({
        artifactRef,
        componentInstanceRef: dispatch.componentInstanceRef,
        actions: [{
          sourcePortRef: dispatch.sourcePortRef,
          targetPortRef: dispatch.targetPortRef,
          effect: "dispatch" as const,
        }],
      }))),
      ...artifacts.map((artifact) => ({
        artifactRef: artifact.artifactRef,
        componentInstanceRef: "page.menu",
        actions: [{
          sourcePortRef: "page.menu.route",
          targetPortRef: "navigation.route",
          effect: "push" as const,
        }],
      })),
    ],
  };
}

/** The registration executed by the one-page Garmin host. */
export function singlePageNavigationRegistration(
  artifact: ShowcaseNativeArtifactRegistration,
  dispatch: ShowcaseNativeDispatchRegistration,
): ShowcaseNativeNavigationRegistration {
  if (artifact.pageRefs.length !== 1 || artifact.pageRefs[0] !== artifact.entryPageRef) {
    throw new Error("single-page native host must register exactly its entry page");
  }
  return {
    artifacts: [{
      artifactRef: artifact.artifactRef,
      entryPageRef: artifact.entryPageRef,
      pages: [{
        pageRef: artifact.entryPageRef,
        restore: "root",
        back: "system",
        guardContractRef: null,
      }],
    }],
    activePageBindings: [{
      publisherPortRef: "navigation.activePage",
      pageHostPortRef: "page.host.activePage",
    }],
    actionGroups: [{
      artifactRef: artifact.artifactRef,
      componentInstanceRef: dispatch.componentInstanceRef,
      actions: [{
        sourcePortRef: dispatch.sourcePortRef,
        targetPortRef: dispatch.targetPortRef,
        effect: "dispatch",
      }],
    }],
  };
}

/**
 * Serialize native navigation registrations without consulting ProductSpec.
 * The caller builds these records from the executable host implementation;
 * shared conformance is the independent comparison with product.navigation.
 */
export function nativeNavigationManifest(
  registration: ShowcaseNativeNavigationRegistration,
): NativeBindingManifest["navigation"] {
  return {
    artifacts: registration.artifacts.map((artifact) => ({
      ...artifact,
      pages: artifact.pages.map((page) => ({ ...page })),
    })),
    activePageBindings: registration.activePageBindings.map((binding) => ({ ...binding })),
    actionGroups: registration.actionGroups.map((group) => ({
      ...group,
      actions: group.actions.map((action) => ({ ...action })),
    })),
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
