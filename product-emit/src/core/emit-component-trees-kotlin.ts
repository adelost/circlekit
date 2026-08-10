import { kotlinEnumToken, kotlinIdentifier, kotlinStringLiteral } from "./kotlin-syntax.js";
import type { SurfaceFamily } from "@v1d/product-spec";

export interface ComponentTreeKotlinTarget {
  readonly packageName: string;
  readonly productId: string;
  readonly sourceFile: string;
  readonly typePrefix: string;
}

export function emitComponentTreesKotlin(
  family: SurfaceFamily,
  target: ComponentTreeKotlinTarget,
  sourceSha: string,
): string {
  const componentIds = unique(family.trees.flatMap(({ mounts }) => mounts.map(({ instance }) => instance)));
  const productComponentType = `Generated${kotlinIdentifier(target.productId)}ComponentId`;
  const regions = unique(family.trees.flatMap(({ mounts }) => mounts.map(({ region }) => region)));
  const declaredSurfaceClasses = family.trees.map(({ surface }) => `CircleSurfaceClass.${surfaceConstant(surface)}`);
  const componentType = `${target.typePrefix}Component`;
  const regionType = `${target.typePrefix}Region`;
  const mountType = `${target.typePrefix}Mount`;
  const treeType = `${target.typePrefix}Tree`;
  const objectType = `${target.typePrefix}Components`;
  const tree = (surface: string) => {
    const item = family.trees.find((candidate) => candidate.surface === surface);
    if (item === undefined) throw new Error(`missing ${surface} tree`);
    const mounts = item.mounts.map((mount) => `            ${mountType}(
                id = ${kotlinStringLiteral(mount.id)},
                component = ${componentType}.${kotlinEnumToken(mount.instance)},
                region = ${regionType}.${kotlinEnumToken(mount.region)},
                order = ${mount.order},
                priority = ${mount.priority},
                capacity = ${mount.capacity === null ? "null" : mount.capacity},
                required = ${mount.requirement.kind === "required"},
            ),`).join("\n");
    return `${treeType}(listOf(\n${mounts}\n        ))`;
  };

  return `// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM ${target.sourceFile}
// Source SHA-256: ${sourceSha}
package ${target.packageName}

import com.adelost.designkit.ui.CircleSurfaceClass

enum class ${componentType}(val id: ${productComponentType}) {
    ${componentIds.map((id) => `${kotlinEnumToken(id)}(${productComponentType}.${kotlinEnumToken(id)})`).join(", ")}
}
enum class ${regionType} { ${regions.map(kotlinEnumToken).join(", ")} }

data class ${mountType}(
    val id: String,
    val component: ${componentType},
    val region: ${regionType},
    val order: Int,
    val priority: Int,
    val capacity: Int?,
    val required: Boolean,
)

data class ${treeType}(val mounts: List<${mountType}>) {
    val orderedMounts: List<${mountType}> = mounts.sortedWith(
        compareBy(${mountType}::order).thenBy(${mountType}::priority),
    )

    init {
        require(mounts.map { it.id }.distinct().size == mounts.size)
        require(mounts.map { it.region to it.order }.distinct().size == mounts.size)
        require(mounts == orderedMounts)
    }
}

object ${objectType} {
    val declaredSurfaceClasses: Set<CircleSurfaceClass> = setOf(
        ${declaredSurfaceClasses.join(",\n        ")},
    )

    fun resolve(surfaceClass: CircleSurfaceClass): ${treeType} = when (surfaceClass) {
        CircleSurfaceClass.ROUND -> ${tree("round")}
        CircleSurfaceClass.PHONE_COMPACT -> ${tree("compact")}
        CircleSurfaceClass.PHONE_WIDE -> ${tree("wide")}
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
