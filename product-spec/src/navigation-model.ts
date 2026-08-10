import type { ScreenComponentFamilyRef } from "./component-tree-model.js";
import {
  contractFingerprint,
  field,
  requireUnique,
  requireWireId,
  validateContract,
  valueRef,
  type LegoContract,
  type ProductNodeType,
} from "./node-model.js";
import type {
  CompiledProductGraph,
} from "./port-graph-model.js";

interface NavigationArtifactMountScope {
  readonly artifactRef: string;
  readonly screenRef: string;
  readonly includedMounts: readonly { readonly componentInstanceRef: string }[];
}

export const PAGE_RESTORE_POLICIES = ["root", "process"] as const;
export type PageRestorePolicy = (typeof PAGE_RESTORE_POLICIES)[number];
export const PAGE_BACK_POLICIES = ["previous", "consume", "system"] as const;
export type PageBackPolicy = (typeof PAGE_BACK_POLICIES)[number];

export interface ProductPageSemantics<GuardRef extends string = string> {
  readonly default: boolean;
  readonly restore: PageRestorePolicy;
  readonly guardPolicyRef: GuardRef | null;
  readonly back: PageBackPolicy;
}

export interface ProductPageIr<Id extends string = string, GuardRef extends string = string>
  extends ProductPageSemantics<GuardRef> {
  readonly id: Id;
}

export interface NavigationRouteContract<PageId extends string = string> extends LegoContract {
  readonly navigation: {
    readonly kind: "route";
    readonly targetPageRef: PageId;
    readonly effect: "push";
  };
}

export interface NavigationActivePageContract extends LegoContract {
  readonly navigation: { readonly kind: "active-page" };
}

export interface PageNavigationDefinition<
  PageId extends string = string,
  GuardRef extends string = string,
> {
  readonly id: string;
  readonly guardPolicyRefs: readonly GuardRef[];
  readonly pages: readonly ProductPageIr<PageId, GuardRef>[];
  readonly activePageContract: NavigationActivePageContract;
  readonly routeContracts: readonly NavigationRouteContract<PageId>[];
}

export type ProductMenuActionDeclaration<PageId extends string = string> =
  | {
    readonly id: string;
    readonly kind: "route";
    readonly sourcePortRef: string;
    readonly targetPageRef: PageId;
  }
  | {
    readonly id: string;
    readonly kind: "event";
    readonly sourcePortRef: string;
  };

export interface ProductMenuDeclaration<PageId extends string = string> {
  readonly id: string;
  readonly componentInstanceRef: string;
  readonly actions: readonly ProductMenuActionDeclaration<PageId>[];
}

export interface ProductNavigationDeclaration<PageId extends string = string, GuardRef extends string = string>
  extends PageNavigationDefinition<PageId, GuardRef> {
  readonly menus: readonly ProductMenuDeclaration<PageId>[];
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
  readonly id: string;
  readonly componentInstanceRef: string;
  readonly pageRefs: readonly string[];
  readonly artifactRefs: readonly string[];
  readonly actions: readonly CompiledProductMenuAction[];
}

export interface ProductNavigationIr {
  readonly id: string;
  readonly guardPolicyRefs: readonly string[];
  readonly pages: readonly ProductPageIr[];
  readonly activePageContract: NavigationActivePageContract;
  readonly routeContracts: readonly NavigationRouteContract[];
  readonly menus: readonly CompiledProductMenu[];
}

export function navigationRouteContract<
  const Id extends string,
  const Target extends string,
>(navigationId: Id, targetPageRef: Target): NavigationRouteContract<Target> {
  return routeContract(navigationId, targetPageRef) as NavigationRouteContract<Target>;
}

export function defineProductNavigation<
  const Families extends readonly ScreenComponentFamilyRef[],
  const NodeTypes extends readonly ProductNodeType[],
  const Menus extends readonly ProductMenuDeclaration<Families[number]["screen"]>[],
>(
  componentFamilies: Families,
  nodeTypes: NodeTypes,
  declaration: {
    readonly id: string;
    readonly pageSemantics: {
      readonly [Page in Families[number]["screen"]]: ProductPageSemantics<NavigationGuardRefOf<NodeTypes>>
    };
    readonly menus: Menus;
  },
): ProductNavigationDeclaration<Families[number]["screen"], NavigationGuardRefOf<NodeTypes>> & {
  readonly menus: Menus;
} {
  const pageIds = componentFamilies.map(({ screen }) => screen);
  type PageId = Families[number]["screen"];
  type GuardRef = NavigationGuardRefOf<NodeTypes>;
  const semantics = declaration.pageSemantics as Readonly<Record<string, ProductPageSemantics<GuardRef>>>;
  const semanticIds = Object.keys(semantics);
  requireUnique(pageIds, `page in navigation '${declaration.id}'`);
  if (pageIds.length !== semanticIds.length || pageIds.some((id) => !(id in declaration.pageSemantics))) {
    throw new Error(`navigation '${declaration.id}' page semantics must exactly cover component-family screens`);
  }
  const guardPolicyRefs = nodeTypes.flatMap((node) =>
    node.navigationGuardPolicyRef === undefined ? [] : [node.navigationGuardPolicyRef],
  ) as unknown as readonly GuardRef[];
  const pages = pageIds.map((id) => ({ id, ...semantics[id]! })) as
    readonly ProductPageIr<PageId, GuardRef>[];
  const definition: ProductNavigationDeclaration<PageId, GuardRef> & { readonly menus: Menus } = {
    id: declaration.id,
    guardPolicyRefs,
    pages,
    activePageContract: navigationActivePageContract(declaration.id),
    routeContracts: pageIds.map((id) => routeContract(declaration.id, id)) as
      readonly NavigationRouteContract<PageId>[],
    menus: declaration.menus,
  };
  validateDefinition(definition);
  return definition;
}

type NavigationGuardRefOf<NodeTypes extends readonly ProductNodeType[]> =
  NodeTypes[number] extends infer Node
    ? Node extends { readonly navigationGuardPolicyRef: infer Ref extends string } ? Ref : never
    : never;

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
  const graphGuardPolicyRefs = graph.nodeTypes.flatMap((node) =>
    node.navigationGuardPolicyRef === undefined ? [] : [node.navigationGuardPolicyRef]);
  requireUnique(graphGuardPolicyRefs, "navigation guard policy in node catalog");
  if ([...graphGuardPolicyRefs].sort().join("\n") !== [...declaration.guardPolicyRefs].sort().join("\n")) {
    throw new Error(`navigation guard policies differ from the selected node catalog`);
  }
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
  for (const artifact of artifacts) {
    if (!pageById.has(artifact.entryScreen)) {
      throw new Error(`artifact '${artifact.id}' entry '${artifact.entryScreen}' is an undeclared page`);
    }
    for (const pageRef of artifact.screenRefs) {
      if (!pageById.has(pageRef)) throw new Error(`artifact '${artifact.id}' selects undeclared page '${pageRef}'`);
      const scopes = artifactScopes.filter(({ artifactRef, screenRef }) =>
        artifactRef === artifact.id && screenRef === pageRef);
      if (scopes.length === 0 || scopes.every(({ includedMounts }) => includedMounts.length === 0)) {
        throw new Error(`artifact '${artifact.id}' page '${pageRef}' has no included mount`);
      }
    }
    const defaults = artifact.screenRefs.filter((pageRef) => pageById.get(pageRef)?.default === true);
    if (defaults.length !== 1) {
      throw new Error(`artifact '${artifact.id}' must select exactly one default page (found ${defaults.length})`);
    }
    if (defaults[0] !== artifact.entryScreen) {
      throw new Error(`artifact '${artifact.id}' entry '${artifact.entryScreen}' is not its default page '${defaults[0]}'`);
    }
  }

  const routeByPage = new Map(declaration.routeContracts.map((contract) =>
    [contract.navigation.targetPageRef, contract]));
  const routeContractIds = new Set(declaration.routeContracts.map(({ id }) => id));
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const nodeTypeById = new Map(graph.nodeTypes.map((node) => [node.id, node]));
  const activeOutputs = graph.portRegistry.nodePorts.filter((port) =>
    port.direction === "output" && port.contractRef === declaration.activePageContract.id
      && nodeTypeById.get(nodeById.get(port.ownerId)?.nodeTypeRef ?? "")?.kind === "service");
  const hasRouteAction = declaration.menus.some(({ actions }) =>
    actions.some(({ kind }) => kind === "route"));
  if (hasRouteAction && activeOutputs.length !== 1) {
    throw new Error(`navigation must publish exactly one active page output (found ${activeOutputs.length})`);
  }
  const activeOwner = activeOutputs[0]?.ownerId;
  if (activeOwner !== undefined && nodeTypeById.get(nodeById.get(activeOwner)?.nodeTypeRef ?? "")?.kind !== "service") {
    throw new Error(`navigation active page output must belong to a service`);
  }

  requireUnique(declaration.menus.map(({ id }) => id), "product menu");
  requireUnique(declaration.menus.map(({ componentInstanceRef }) => componentInstanceRef), "product menu component");
  const componentPorts = new Map(graph.portRegistry.componentPorts.map((port) => [port.ref, port]));
  const bindings = new Map(graph.portRegistry.bindings.map((binding) => [binding.from, binding]));
  const declaredRouteSources = new Set<string>();
  const compiledMenus = declaration.menus.map((menu): CompiledProductMenu => {
    requireWireId(menu.id, "product menu");
    if (!graph.components.some(({ id }) => id === menu.componentInstanceRef)) {
      throw new Error(`product menu '${menu.id}' uses unknown component '${menu.componentInstanceRef}'`);
    }
    if (menu.actions.length === 0) throw new Error(`product menu '${menu.id}' has no actions`);
    requireUnique(menu.actions.map(({ id }) => id), `action in product menu '${menu.id}'`);
    requireUnique(menu.actions.map(({ sourcePortRef }) => sourcePortRef), `source port in product menu '${menu.id}'`);
    const ownedOutputs = graph.portRegistry.componentPorts.filter(({ ownerId, direction }) =>
      ownerId === menu.componentInstanceRef && direction === "output").map(({ ref }) => ref).sort();
    const actionOutputs = menu.actions.map(({ sourcePortRef }) => sourcePortRef).sort();
    if (ownedOutputs.join("\n") !== actionOutputs.join("\n")) {
      throw new Error(`product menu '${menu.id}' actions do not exactly cover component outputs`);
    }
    const scopes = artifactScopes.filter(({ includedMounts }) =>
      includedMounts.some(({ componentInstanceRef }) => componentInstanceRef === menu.componentInstanceRef));
    const artifactRefs = [...new Set(scopes.map(({ artifactRef }) => artifactRef))].sort();
    const pageRefs = [...new Set(scopes.map(({ screenRef }) => screenRef))].sort();
    const actions = menu.actions.map((action): CompiledProductMenuAction => {
      const source = componentPorts.get(action.sourcePortRef);
      if (source === undefined || source.ownerId !== menu.componentInstanceRef || source.direction !== "output") {
        throw new Error(`product menu '${menu.id}' action '${action.id}' uses unknown output '${action.sourcePortRef}'`);
      }
      const binding = bindings.get(action.sourcePortRef);
      if (binding === undefined || binding.kind !== "component-event") {
        throw new Error(`product menu '${menu.id}' action '${action.id}' has no service binding`);
      }
      if (action.kind === "route") {
        const expected = routeByPage.get(action.targetPageRef);
        if (expected === undefined) throw new Error(`navigation targets unknown page '${action.targetPageRef}'`);
        if (source.contractRef !== expected.id) {
          throw new Error(
            `product menu '${menu.id}' action '${action.id}' target drift: '${action.targetPageRef}' requires contract '${expected.id}', got '${source.contractRef}'`,
          );
        }
        const target = graph.portRegistry.nodePorts.find(({ ref }) => ref === binding.to);
        if (activeOwner === undefined || target?.ownerId !== activeOwner) {
          throw new Error(`product menu '${menu.id}' route action '${action.id}' does not target the navigation service`);
        }
        for (const artifactRef of artifactRefs) {
          const artifact = artifacts.find(({ id }) => id === artifactRef)!;
          if (!artifact.screenRefs.includes(action.targetPageRef)) {
            throw new Error(
              `product menu '${menu.id}' targets page '${action.targetPageRef}' outside artifact '${artifactRef}'`,
            );
          }
        }
        declaredRouteSources.add(action.sourcePortRef);
        return {
          id: action.id, kind: action.kind, sourcePortRef: action.sourcePortRef,
          targetPortRef: binding.to, contractRef: source.contractRef,
          targetPageRef: action.targetPageRef, effect: "push",
        };
      }
      if (routeContractIds.has(source.contractRef)) {
        throw new Error(`product menu '${menu.id}' action '${action.id}' declares a route contract as an event`);
      }
      return {
        id: action.id, kind: action.kind, sourcePortRef: action.sourcePortRef,
        targetPortRef: binding.to, contractRef: source.contractRef,
      };
    });
    return { id: menu.id, componentInstanceRef: menu.componentInstanceRef, pageRefs, artifactRefs, actions };
  });

  const graphRouteSources = graph.portRegistry.componentPorts.filter(({ direction, contractRef }) =>
    direction === "output" && routeContractIds.has(contractRef)).map(({ ref }) => ref);
  const orphanRoute = graphRouteSources.find((ref) => !declaredRouteSources.has(ref));
  if (orphanRoute !== undefined) throw new Error(`orphan navigation route action '${orphanRoute}'`);
  return {
    id: declaration.id,
    guardPolicyRefs: declaration.guardPolicyRefs,
    pages: declaration.pages,
    activePageContract: declaration.activePageContract,
    routeContracts: declaration.routeContracts,
    menus: compiledMenus,
  };
}

function validateDefinition(definition: PageNavigationDefinition): void {
  requireWireId(definition.id, "navigation");
  if (definition.pages.length === 0) throw new Error(`navigation '${definition.id}' has no pages`);
  requireUnique(definition.pages.map(({ id }) => id), `page in navigation '${definition.id}'`);
  requireUnique(definition.guardPolicyRefs, `guard policy in navigation '${definition.id}'`);
  definition.guardPolicyRefs.forEach((id) => requireWireId(id, `guard policy in navigation '${definition.id}'`));
  const usedGuards = new Set<string>();
  for (const page of definition.pages) {
    requirePageId(page.id);
    if (typeof page.default !== "boolean") throw new Error(`page '${page.id}' has invalid default`);
    if (!PAGE_RESTORE_POLICIES.includes(page.restore)) throw new Error(`page '${page.id}' has invalid restore policy`);
    if (!PAGE_BACK_POLICIES.includes(page.back)) throw new Error(`page '${page.id}' has invalid back policy`);
    if (page.guardPolicyRef !== null) {
      if (!definition.guardPolicyRefs.includes(page.guardPolicyRef)) {
        throw new Error(`page '${page.id}' uses unknown guard policy '${page.guardPolicyRef}'`);
      }
      usedGuards.add(page.guardPolicyRef);
    }
  }
  const orphanGuard = definition.guardPolicyRefs.find((id) => !usedGuards.has(id));
  if (orphanGuard !== undefined) throw new Error(`orphan guard policy '${orphanGuard}'`);
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

export function navigationActivePageContract(id: string): NavigationActivePageContract {
  const contract = {
    id: `${id}.active-page`, kind: "state", boundary: "presentation",
    fields: [field("page", valueRef(`${id}.page`))],
    navigation: { kind: "active-page" },
  } as const;
  validateContract(contract);
  return contract;
}

function routeContract(id: string, targetPageRef: string): NavigationRouteContract {
  const encoded = [...targetPageRef].map((character) => `u${character.codePointAt(0)!.toString(16)}`).join(".");
  const contract = {
    id: `${id}.route.${encoded}`, kind: "event", boundary: "ui-event",
    fields: [field("page", valueRef(`${id}.page`))],
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

function requirePageId(id: string): void {
  if (!/^[A-Za-z][A-Za-z0-9._-]*$/u.test(id)) throw new Error(`page has invalid id '${id}'`);
}
