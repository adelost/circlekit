import { kotlinEnumToken, kotlinIdentifier, kotlinStringLiteral } from "./kotlin-syntax.js";
import type { ScreenComponentFamilyRef } from "@v1d/product-spec";

export interface ComponentFamilyRegistryKotlinTarget {
  readonly packageName: string;
  readonly productId: string;
  readonly sourceFile: string;
}

export function emitComponentFamilyRegistryKotlin(
  entries: readonly ScreenComponentFamilyRef[],
  target: ComponentFamilyRegistryKotlinTarget,
  sourceSha: string,
): string {
  const productPrefix = `Generated${kotlinIdentifier(target.productId)}`;
  const routeType = `${productPrefix}PageRef`;
  const familyType = `${productPrefix}ComponentFamilyRef`;
  const componentType = `${productPrefix}ComponentId`;
  const surfaceType = `${productPrefix}SurfaceClass`;
  const bindingType = `${productPrefix}ComponentFamilyBinding`;
  const objectType = `${productPrefix}ComponentFamilies`;
  const componentIds = unique(entries.flatMap(({ family }) =>
    family.trees.flatMap(({ mounts }) => mounts.map(({ instance }) => instance))
  ));
  const familyEntries = entries.map(({ family }) => `${kotlinEnumToken(family.id)}(${kotlinStringLiteral(family.id)})`).join(", ");
  const componentEntries = componentIds.map((id) => `${kotlinEnumToken(id)}(${kotlinStringLiteral(id)})`).join(", ");
  const bindings = entries.map(({ screen, family }) => {
    const components = unique(family.trees.flatMap(({ mounts }) => mounts.map(({ instance }) => instance)));
    return `        ${bindingType}(
            route = ${routeType}.${kotlinEnumToken(screen)},
            family = ${familyType}.${kotlinEnumToken(family.id)},
            components = setOf(${components.map((id) => `${componentType}.${kotlinEnumToken(id)}`).join(", ")}),
        ),`;
  }).join("\n");
  const resolvers = entries.map(({ screen, family }) => {
    const surfaces = family.trees.map(({ surface, mounts }) => {
      const components = unique(mounts.map(({ instance }) => instance));
      return `                ${surfaceType}.${surfaceConstant(surface)} -> setOf(${components
        .map((id) => `${componentType}.${kotlinEnumToken(id)}`)
        .join(", ")})`;
    }).join("\n");
    return `            ${routeType}.${kotlinEnumToken(screen)} -> when (surfaceClass) {\n${surfaces}\n            }`;
  }).join("\n");

  return `// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM ${target.sourceFile}
// Source SHA-256: ${sourceSha}
package ${target.packageName}

enum class ${familyType}(val wireId: String) { ${familyEntries} }
enum class ${componentType}(val wireId: String) { ${componentEntries} }
enum class ${surfaceType} { ROUND, PHONE_COMPACT, PHONE_WIDE }

data class ${bindingType}(
    val route: ${routeType},
    val family: ${familyType},
    val components: Set<${componentType}>,
)

object ${objectType} {
    val bindings: Set<${bindingType}> = setOf(
${bindings}
    )

    /** Exact mounted instances for the active product route and host surface. */
    fun resolve(
        route: ${routeType},
        surfaceClass: ${surfaceType},
    ): Set<${componentType}> = when (route) {
${resolvers}
    }

    init {
        require(bindings.map { it.route }.distinct().size == bindings.size)
        require(bindings.map { it.family }.distinct().size == bindings.size)
        val mountedIdentities = bindings.flatMap { binding ->
            binding.components.map { component -> Triple(binding.route, binding.family, component) }
        }
        require(mountedIdentities.distinct().size == mountedIdentities.size)
    }
}
`;
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function surfaceConstant(surface: string): string {
  switch (surface) {
    case "round": return "ROUND";
    case "compact": return "PHONE_COMPACT";
    case "wide": return "PHONE_WIDE";
    default: throw new Error(`unknown portable surface '${surface}'`);
  }
}
