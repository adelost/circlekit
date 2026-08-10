import type { ScreenComponentFamilyRef } from "./component-tree-model.js";
import {
  contractFingerprint,
  field,
  finiteValueRef,
  requireUnique,
  requireWireId,
  validateContract,
  type LegoContract,
  type LegoFiniteValueDeclaration,
} from "./node-model.js";
import type { CompiledProductGraph } from "./port-graph-model.js";

interface NavigationArtifactMountScope {
  readonly artifactRef: string;
  readonly screenRef: string;
  readonly includedMounts: readonly { readonly componentInstanceRef: string }[];
}

export const PAGE_RESTORE_POLICIES = ["root", "process"] as const;
export type PageRestorePolicy = (typeof PAGE_RESTORE_POLICIES)[number];
export const PAGE_BACK_POLICIES = ["previous", "consume", "system"] as const;
export type PageBackPolicy = (typeof PAGE_BACK_POLICIES)[number];

export interface NavigationGuardContract extends LegoContract {
  readonly kind: "state";
  readonly boundary: "service-internal";
  readonly navigation: { readonly kind: "guard" };
}

export interface ProductPageSemantics {
  readonly restore: PageRestorePolicy;
  readonly guard: NavigationGuardContract | null;
  readonly back: PageBackPolicy;
}

interface ProductPageDeclaration<Id extends string = string> extends ProductPageSemantics {
  readonly id: Id;
}

export interface ProductPageIr<Id extends string = string> {
  readonly id: Id;
  readonly restore: PageRestorePolicy;
  readonly guardContractRef: string | null;
  readonly back: PageBackPolicy;
}

export interface NavigationRouteContract<PageId extends string = string> extends LegoContract {
  readonly kind: "event";
  readonly boundary: "ui-event";
  readonly navigation: {
    readonly kind: "route";
    readonly targetPageRef: PageId;
    readonly effect: "push";
  };
}

export interface NavigationEventContract extends LegoContract {
  readonly kind: "event";
  readonly boundary: "ui-event";
  readonly navigation: { readonly kind: "event" };
}

export interface NavigationActivePageContract extends LegoContract {
  readonly kind: "state";
  readonly boundary: "presentation";
  readonly navigation: { readonly kind: "active-page" };
}

export interface ProductNavigationDeclaration<PageId extends string = string> {
  readonly id: string;
  readonly pageValues: LegoFiniteValueDeclaration<string, PageId>;
  readonly pages: readonly ProductPageDeclaration<PageId>[];
  readonly activePageContract: NavigationActivePageContract;
  readonly routeContracts: readonly NavigationRouteContract<PageId>[];
}

export interface CompiledProductMenuAction {
  readonly id: string;
  readonly kind: "route" | "event";
  readonly sourcePortRef: string;
  readonly targetPortRef: string;
  readonly contractRef: string;
  readonly targetPageRef?: string;
  readonly effect?: "push";
}

export interface CompiledProductMenu {
  readonly componentInstanceRef: string;
  readonly pageRefs: readonly string[];
  readonly artifactRefs: readonly string[];
  readonly actions: readonly CompiledProductMenuAction[];
}

export interface ProductNavigationIr {
  readonly id: string;
  readonly pageValuesRef: string;
  readonly pages: readonly ProductPageIr[];
  readonly activePageContract: NavigationActivePageContract;
  readonly activePagePortRef: string | null;
  readonly routeContracts: readonly NavigationRouteContract[];
  readonly menus: readonly CompiledProductMenu[];
}

export function navigationRouteContract<
  const Id extends string,
  const Target extends string,
>(navigationId: Id, targetPageRef: Target): NavigationRouteContract<Target> {
  return routeContract(navigationId, targetPageRef) as NavigationRouteContract<Target>;
}

export function navigationActivePageContract(id: string): NavigationActivePageContract {
  const contract = {
    id: `${id}.active-page`, kind: "state", boundary: "presentation",
    fields: [field("page", finiteValueRef(`${id}.page`))],
    navigation: { kind: "active-page" },
  } as const;
  validateContract(contract);
  return contract;
}

export function navigationGuardContract(id: string): NavigationGuardContract {
  const contract = {
    id, kind: "state", boundary: "service-internal",
    fields: [field("allowed", "boolean")],
    navigation: { kind: "guard" },
  } as const;
  validateContract(contract);
  return contract;
}

export function navigationEventContract<
  const Contract extends LegoContract & { readonly kind: "event"; readonly boundary: "ui-event" },
>(contract: Contract): Contract & NavigationEventContract {
  const tagged = { ...contract, navigation: { kind: "event" } as const };
  validateContract(tagged);
  return tagged;
}

export function defineProductNavigation<
  const Families extends readonly ScreenComponentFamilyRef[],
>(
  componentFamilies: Families,
  declaration: {
    readonly id: string;
    readonly pageSemantics: {
      readonly [Page in Families[number]["screen"]]: ProductPageSemantics
    };
  },
): ProductNavigationDeclaration<Families[number]["screen"]> {
  type PageId = Families[number]["screen"];
  const pageIds = componentFamilies.map(({ screen }) => screen) as readonly PageId[];
  const semantics = declaration.pageSemantics as Readonly<Record<string, ProductPageSemantics>>;
  const semanticIds = Object.keys(semantics);
  requireUnique(pageIds, `page in navigation '${declaration.id}'`);
  if (pageIds.length !== semanticIds.length || pageIds.some((id) => !(id in semantics))) {
    throw new Error(`navigation '${declaration.id}' page semantics must exactly cover component-family screens`);
  }
  const definition: ProductNavigationDeclaration<PageId> = {
    id: declaration.id,
    pageValues: pageValueDeclaration(declaration.id, pageIds),
    pages: pageIds.map((id) => ({ id, ...semantics[id]! })),
    activePageContract: navigationActivePageContract(declaration.id),
    routeContracts: pageIds.map((id) => routeContract(declaration.id, id)) as
      readonly NavigationRouteContract<PageId>[],
  };
  validateDefinition(definition);
  return definition;
}

export function compileProductNavigation(input: {
  readonly declaration: ProductNavigationDeclaration;
  readonly artifacts: readonly {
    readonly id: string;
    readonly entryScreen: string;
    readonly screenRefs: readonly string[];
  }[];
  readonly componentFamilies: readonly ScreenComponentFamilyRef[];
  readonly artifactScopes: readonly NavigationArtifactMountScope[];
  readonly graph: CompiledProductGraph;
}): ProductNavigationIr {
  const { declaration, artifacts, componentFamilies, artifactScopes, graph } = input;
  validateDefinition(declaration);
  const pageById = new Map(declaration.pages.map((page) => [page.id, page]));
  const familyIds = componentFamilies.map(({ screen }) => screen);
  for (const page of declaration.pages) {
    if (!familyIds.includes(page.id)) throw new Error(`orphan page '${page.id}' has no component family`);
  }
  for (const screen of familyIds) {
    if (!pageById.has(screen)) throw new Error(`component family uses undeclared page '${screen}'`);
  }

  const selectedPages = new Set(artifacts.flatMap(({ screenRefs }) => screenRefs));
  for (const page of declaration.pages) {
    if (!selectedPages.has(page.id)) throw new Error(`orphan page '${page.id}' is selected by no artifact`);
  }
  const entryPages = new Set(artifacts.map(({ entryScreen }) => entryScreen));
  for (const artifact of artifacts) {
    const entry = pageById.get(artifact.entryScreen);
    if (entry === undefined) {
      throw new Error(`artifact '${artifact.id}' entry '${artifact.entryScreen}' is an undeclared page`);
    }
    if (entry.restore !== "root") {
      throw new Error(`artifact '${artifact.id}' entry '${artifact.entryScreen}' must use root restore`);
    }
    for (const pageRef of artifact.screenRefs) {
      if (!pageById.has(pageRef)) throw new Error(`artifact '${artifact.id}' selects undeclared page '${pageRef}'`);
      const scopes = artifactScopes.filter(({ artifactRef, screenRef }) =>
        artifactRef === artifact.id && screenRef === pageRef);
      if (scopes.length === 0 || scopes.every(({ includedMounts }) => includedMounts.length === 0)) {
        throw new Error(`artifact '${artifact.id}' page '${pageRef}' has no included mount`);
      }
    }
  }
  for (const page of declaration.pages) {
    if (page.restore === "root" && !entryPages.has(page.id)) {
      throw new Error(`root-restored page '${page.id}' is not an artifact entry`);
    }
  }

  const routeByPage = new Map(declaration.routeContracts.map((contract) =>
    [contract.navigation.targetPageRef, contract]));
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const nodeTypeById = new Map(graph.nodeTypes.map((node) => [node.id, node]));
  const contractById = new Map(graph.portRegistry.contracts.map((contract) => [contract.id, contract]));
  const actionOutputs = graph.portRegistry.componentPorts.filter((port) =>
    port.direction === "output" && isNavigationActionContract(contractById.get(port.contractRef)));
  const guardContracts = uniqueGuardContracts(declaration.pages);
  const requiresNavigationService = actionOutputs.some((port) =>
    isRouteContract(contractById.get(port.contractRef))) || guardContracts.length > 0;
  const activeOutputs = graph.portRegistry.nodePorts.filter((port) =>
    port.direction === "output" && port.contractRef === declaration.activePageContract.id
      && nodeTypeById.get(nodeById.get(port.ownerId)?.nodeTypeRef ?? "")?.kind === "service");
  if (activeOutputs.length > 1 || (requiresNavigationService && activeOutputs.length !== 1)) {
    throw new Error(`navigation must publish exactly one active page output (found ${activeOutputs.length})`);
  }
  const compiledActiveContract = contractById.get(declaration.activePageContract.id);
  if (activeOutputs.length === 1 && !sameNavigationContract(compiledActiveContract, declaration.activePageContract)) {
    throw new Error(`navigation active page output contract drift`);
  }
  const activeOwner = activeOutputs[0]?.ownerId;
  validateGuardInputs(guardContracts, activeOwner, graph, nodeById, nodeTypeById);

  const componentById = new Map(graph.components.map((component) => [component.id, component]));
  const bindings = new Map(graph.portRegistry.bindings.map((binding) => [binding.from, binding]));
  const menuOwners = [...new Set(actionOutputs.map(({ ownerId }) => ownerId))].sort();
  const compiledMenus = menuOwners.map((ownerId): CompiledProductMenu => {
    if (!componentById.has(ownerId)) throw new Error(`navigation action uses unknown component '${ownerId}'`);
    const scopes = artifactScopes.filter(({ includedMounts }) =>
      includedMounts.some(({ componentInstanceRef }) => componentInstanceRef === ownerId));
    const artifactRefs = [...new Set(scopes.map(({ artifactRef }) => artifactRef))].sort();
    const pageRefs = [...new Set(scopes.map(({ screenRef }) => screenRef))].sort();
    const outputs = actionOutputs.filter((port) => port.ownerId === ownerId);
    const actions = outputs.map((source): CompiledProductMenuAction => {
      const contract = contractById.get(source.contractRef)!;
      const binding = bindings.get(source.ref);
      if (binding === undefined || binding.kind !== "component-event") {
        throw new Error(`mounted action output '${source.ref}' has no typed service binding`);
      }
      if (isRouteContract(contract)) {
        const targetPageRef = contract.navigation.targetPageRef;
        const expected = routeByPage.get(targetPageRef);
        if (expected === undefined) throw new Error(`navigation targets unknown page '${targetPageRef}'`);
        if (!sameNavigationContract(contract, expected)) {
          throw new Error(
            `navigation action '${source.ref}' target drift: '${targetPageRef}' requires contract '${expected.id}', got '${contract.id}'`,
          );
        }
        const target = graph.portRegistry.nodePorts.find(({ ref }) => ref === binding.to);
        if (activeOwner === undefined || target?.ownerId !== activeOwner) {
          throw new Error(`navigation route action '${source.ref}' does not target the navigation service`);
        }
        for (const artifactRef of artifactRefs) {
          const artifact = artifacts.find(({ id }) => id === artifactRef)!;
          if (!artifact.screenRefs.includes(targetPageRef)) {
            throw new Error(`navigation action '${source.ref}' targets page '${targetPageRef}' outside artifact '${artifactRef}'`);
          }
        }
        return {
          id: source.portId, kind: "route", sourcePortRef: source.ref,
          targetPortRef: binding.to, contractRef: source.contractRef,
          targetPageRef, effect: "push",
        };
      }
      return {
        id: source.portId, kind: "event", sourcePortRef: source.ref,
        targetPortRef: binding.to, contractRef: source.contractRef,
      };
    });
    return { componentInstanceRef: ownerId, pageRefs, artifactRefs, actions };
  });

  return {
    id: declaration.id,
    pageValuesRef: declaration.pageValues.id,
    pages: declaration.pages.map((page) => ({
      id: page.id, restore: page.restore, guardContractRef: page.guard?.id ?? null, back: page.back,
    })),
    activePageContract: declaration.activePageContract,
    activePagePortRef: activeOutputs[0]?.ref ?? null,
    routeContracts: declaration.routeContracts,
    menus: compiledMenus,
  };
}

function validateDefinition(definition: ProductNavigationDeclaration): void {
  requireWireId(definition.id, "navigation");
  if (definition.pages.length === 0) throw new Error(`navigation '${definition.id}' has no pages`);
  requireUnique(definition.pages.map(({ id }) => id), `page in navigation '${definition.id}'`);
  definition.pages.forEach((page) => {
    requirePageId(page.id);
    if (!PAGE_RESTORE_POLICIES.includes(page.restore)) throw new Error(`page '${page.id}' has invalid restore policy`);
    if (!PAGE_BACK_POLICIES.includes(page.back)) throw new Error(`page '${page.id}' has invalid back policy`);
    if (page.guard !== null && !isGuardContract(page.guard)) {
      throw new Error(`page '${page.id}' has invalid guard contract`);
    }
  });
  const expectedValues = pageValueDeclaration(definition.id, definition.pages.map(({ id }) => id));
  if (definition.pageValues.id !== expectedValues.id
    || definition.pageValues.values.join("\n") !== expectedValues.values.join("\n")) {
    throw new Error(`navigation '${definition.id}' page finite values drift`);
  }
  const expectedActive = navigationActivePageContract(definition.id);
  if (!sameNavigationContract(definition.activePageContract, expectedActive)) {
    throw new Error(`navigation '${definition.id}' active page contract drift`);
  }
  const expectedRoutes = definition.pages.map((page) => routeContract(definition.id, page.id));
  if (definition.routeContracts.length !== expectedRoutes.length || expectedRoutes.some((expected, index) =>
    !sameNavigationContract(definition.routeContracts[index], expected))) {
    throw new Error(`navigation '${definition.id}' route contract drift`);
  }
}

function validateGuardInputs(
  guards: readonly NavigationGuardContract[],
  activeOwner: string | undefined,
  graph: CompiledProductGraph,
  nodeById: ReadonlyMap<string, { readonly nodeTypeRef: string }>,
  nodeTypeById: ReadonlyMap<string, { readonly kind: string }>,
): void {
  for (const guard of guards) {
    if (activeOwner === undefined) throw new Error(`navigation guard '${guard.id}' has no navigation service`);
    const inputs = graph.portRegistry.nodePorts.filter((port) =>
      port.ownerId === activeOwner && port.direction === "input" && port.contractRef === guard.id);
    if (inputs.length !== 1) {
      throw new Error(`navigation guard '${guard.id}' must bind exactly one navigation service input`);
    }
    const binding = graph.portRegistry.bindings.find(({ to }) => to === inputs[0]!.ref);
    const source = graph.portRegistry.nodePorts.find(({ ref }) => ref === binding?.from);
    const sourceKind = nodeTypeById.get(nodeById.get(source?.ownerId ?? "")?.nodeTypeRef ?? "")?.kind;
    if (source === undefined || source.direction !== "output" || sourceKind !== "service") {
      throw new Error(`navigation guard '${guard.id}' must be sourced by a typed service output`);
    }
    const sourceContract = graph.portRegistry.contracts.find(({ id }) => id === source.contractRef);
    if (!sameNavigationContract(sourceContract, guard)) {
      throw new Error(`navigation guard '${guard.id}' contract drift`);
    }
  }
}

function uniqueGuardContracts(pages: readonly ProductPageDeclaration[]): NavigationGuardContract[] {
  const guards = new Map<string, NavigationGuardContract>();
  for (const page of pages) {
    if (page.guard === null) continue;
    const existing = guards.get(page.guard.id);
    if (existing !== undefined && !sameNavigationContract(existing, page.guard)) {
      throw new Error(`navigation guard '${page.guard.id}' contract drift`);
    }
    guards.set(page.guard.id, page.guard);
  }
  return [...guards.values()];
}

function routeContract(id: string, targetPageRef: string): NavigationRouteContract {
  const encoded = [...targetPageRef].map((character) => `u${character.codePointAt(0)!.toString(16)}`).join(".");
  const contract = {
    id: `${id}.route.${encoded}`, kind: "event", boundary: "ui-event",
    fields: [field("page", finiteValueRef(`${id}.page`))],
    navigation: { kind: "route", targetPageRef, effect: "push" },
  } as const;
  validateContract(contract);
  return contract;
}

function sameNavigationContract(actual: LegoContract | undefined, expected: LegoContract): boolean {
  return actual !== undefined && actual.id === expected.id && contractFingerprint(actual) === contractFingerprint(expected)
    && JSON.stringify("navigation" in actual ? actual.navigation : null)
      === JSON.stringify("navigation" in expected ? expected.navigation : null);
}

function isNavigationActionContract(contract: LegoContract | undefined): contract is NavigationRouteContract | NavigationEventContract {
  return isRouteContract(contract) || (contract !== undefined && "navigation" in contract
    && (contract.navigation as { readonly kind?: string }).kind === "event"
    && contract.kind === "event" && contract.boundary === "ui-event");
}

function isRouteContract(contract: LegoContract | undefined): contract is NavigationRouteContract {
  return contract !== undefined && "navigation" in contract
    && (contract.navigation as { readonly kind?: string }).kind === "route"
    && contract.kind === "event" && contract.boundary === "ui-event";
}

function isGuardContract(contract: LegoContract): contract is NavigationGuardContract {
  return "navigation" in contract && (contract.navigation as { readonly kind?: string }).kind === "guard"
    && contract.kind === "state" && contract.boundary === "service-internal";
}

function requirePageId(id: string): void {
  if (!/^[A-Za-z][A-Za-z0-9._-]*$/u.test(id)) throw new Error(`page has invalid id '${id}'`);
}

function pageValueDeclaration<const PageId extends string>(
  navigationId: string,
  pageIds: readonly PageId[],
): LegoFiniteValueDeclaration<string, PageId> {
  const id = `${navigationId}.page`;
  requireWireId(id, "navigation page finite values");
  requireUnique(pageIds, `page in navigation '${navigationId}'`);
  pageIds.forEach(requirePageId);
  return { id, values: pageIds };
}
