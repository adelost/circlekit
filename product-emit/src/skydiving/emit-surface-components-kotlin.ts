import { kotlinEnumToken } from "../core/kotlin-syntax.js";
import type { SourcedKotlinEmissionOptions } from "../core/emission-options.js";
import type { SurfaceComponent } from "./surface-component-model.js";
import type { SurfaceComponentsNativeSymbols } from "./native-symbols.js";

export function emitSurfaceComponentsKotlin(
  surfaces: readonly SurfaceComponent[],
  options: SourcedKotlinEmissionOptions & { readonly nativeSymbols: SurfaceComponentsNativeSymbols },
): string {
  const generated = `Generated${options.symbolPrefix}`;
  const screens = surfaces.map(({ screen }) => screen);
  if (new Set(screens).size !== screens.length) throw new Error("duplicate surface screen");
  const entries = surfaces.map(({
    screen,
    dataSurface,
    spatialMode,
    debugOnly,
    componentFamilyPolicy,
    roundBackChrome,
  }) =>
    `        ${generated}SurfaceMetadata(${generated}PageRef.${screen}, RingSurface.${dataSurface}, ${spatialMode === null ? "null" : `SpatialMode.${spatialMode}`}, ${debugOnly}, ${generated}ComponentFamilyPolicy.${kotlinEnumToken(componentFamilyPolicy)}, ${roundBackChrome}),`
  ).join("\n");

  return `// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM ${options.sourceFile}
// Generator SHA-256: ${options.sourceSha}
package ${options.packageName}

import ${options.nativeSymbols.ringSurface}
import ${options.nativeSymbols.spatialMode}

enum class ${generated}ComponentFamilyPolicy { PORTABLE, NATIVE_ONLY }

data class ${generated}SurfaceMetadata(
    val screen: ${generated}PageRef,
    val dataSurface: RingSurface,
    val spatialMode: SpatialMode?,
    val debugOnly: Boolean,
    val componentFamilyPolicy: ${generated}ComponentFamilyPolicy,
    val roundBackChrome: Boolean,
)

object ${generated}SurfaceComponents {
    val surfaces: Set<${generated}SurfaceMetadata> = setOf(
${entries}
    )

    init {
        require(surfaces.map { it.screen }.distinct().size == surfaces.size)
        require(surfaces.all {
            it.debugOnly == (it.componentFamilyPolicy == ${generated}ComponentFamilyPolicy.NATIVE_ONLY)
        })
    }
}
`;
}
