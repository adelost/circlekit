import type { ProductEmitterPlugin, ProductIr } from "@v1d/product-spec";
import { kotlinEnumToken, kotlinIdentifier, kotlinStringLiteral } from "./kotlin-syntax.js";
import type { SourcedKotlinEmissionOptions } from "./emission-options.js";

export interface ActionsKotlinEmissionOptions extends SourcedKotlinEmissionOptions {
  readonly nativePortPackageName: string;
  readonly nativeCatalogPackageName: string;
  readonly outputDirectory: string;
}

export interface ActionEndpointDeclaration {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly contractRef: string;
}

/** Emits the typed native endpoints and navigation registrations for direct ProductSpec actions. */
export function emitActionsKotlin(
  actions: readonly ActionEndpointDeclaration[],
  options: ActionsKotlinEmissionOptions,
): string {
  if (actions.length === 0) throw new Error("action Kotlin emission has no actions");
  const prefix = kotlinIdentifier(options.symbolPrefix);
  const generated = `Generated${prefix}`;
  const catalog = `${generated}NativeLegoCatalog`;
  const actionNames = new Map<string, string>();
  const sourceTokens = new Map<string, string>();
  const targetTokens = new Map<string, string>();
  for (const action of actions) {
    const name = kotlinIdentifier(action.id);
    const previous = actionNames.get(name);
    if (previous !== undefined) {
      throw new Error(`actions '${previous}' and '${action.id}' both emit Kotlin endpoint '${name}'`);
    }
    actionNames.set(name, action.id);
    sourceTokens.set(action.id, uniquePortToken(action.from, action.id, sourceTokens));
    targetTokens.set(action.id, uniquePortToken(action.to, action.id, targetTokens));
  }
  const packageImports = [
    options.nativePortPackageName === options.packageName ? "" : `import ${options.nativePortPackageName}.ProductComponentEvent\nimport ${options.nativePortPackageName}.ProductInputPort`,
    options.nativeCatalogPackageName === options.packageName ? "" : `import ${options.nativeCatalogPackageName}.${catalog}`,
  ].filter(Boolean).join("\n");
  const endpoints = actions.map((action) => {
    const name = kotlinIdentifier(action.id);
    return `internal object ${name}Event : ProductComponentEvent<Unit, Unit>(
    ${catalog}.PortIds.${sourceTokens.get(action.id)},
)

internal object ${name}InputPort : ProductInputPort<Unit, Unit>(
    ${catalog}.PortIds.${targetTokens.get(action.id)},
)`;
  }).join("\n\n");
  const registrations = actions.map((action) => `        ${generated}NavigationAction(
            id = ${kotlinStringLiteral(action.id)},
            kind = ${generated}NavigationActionKind.EVENT,
            sourcePortRef = ${kotlinStringLiteral(action.from)},
            targetPortRef = ${kotlinStringLiteral(action.to)},
            contractRef = ${kotlinStringLiteral(action.contractRef)},
        ),`).join("\n");

  return `// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM ${options.sourceFile}
// Product declaration SHA-256: ${options.sourceSha}
package ${options.packageName}
${packageImports.length === 0 ? "" : `\n${packageImports}\n`}
${endpoints}

internal object ${generated}Actions {
    val navigationRegistrations: List<${generated}NavigationAction> = listOf(
${registrations}
    )
}
`;
}

/** ProductEmitterPlugin adapter: a product without declared actions adds no file. */
export function actionKotlinEmitter(options: ActionsKotlinEmissionOptions): ProductEmitterPlugin {
  validateOutputDirectory(options.outputDirectory);
  const path = `${options.outputDirectory.replace(/\/$/u, "")}/Generated${kotlinIdentifier(options.symbolPrefix)}Actions.kt`;
  return {
    id: "actions-kotlin",
    emit(product: ProductIr) {
      if (product.actions === undefined || product.actions.length === 0) return [];
      return [{
        id: `actions-kotlin:${product.id}`,
        path,
        mediaType: "text/x-kotlin",
        content: emitActionsKotlin(product.actions, options),
      }];
    },
  };
}

function uniquePortToken(ref: string, actionId: string, prior: ReadonlyMap<string, string>): string {
  const token = kotlinEnumToken(ref);
  const existing = [...prior.entries()].find(([otherRef, otherToken]) => otherToken === token && otherRef !== actionId);
  if (existing !== undefined) {
    throw new Error(`action '${actionId}' port '${ref}' and action '${existing[0]}' share Kotlin port ID '${token}'`);
  }
  return token;
}

function validateOutputDirectory(value: string): void {
  if (!value || value.startsWith("/") || value.split(/[\\/]/u).includes("..")) {
    throw new Error(`actions Kotlin output directory must be a safe relative path, got '${value}'`);
  }
}
