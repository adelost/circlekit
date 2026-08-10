import type { ProductNavigationIr } from "@v1d/product-spec";
import { kotlinEnumToken, kotlinStringLiteral } from "./kotlin-syntax.js";
import type { KotlinEmissionOptions } from "./emission-options.js";

/** Emits the closed native navigation vocabulary from ProductSpec schema navigation. */
export function emitNavigationKotlin(
  navigation: ProductNavigationIr,
  options: KotlinEmissionOptions,
): string {
  const generated = `Generated${options.symbolPrefix}`;
  const pages = navigation.pages.map(({ id }) =>
    `    ${kotlinEnumToken(id)}(${kotlinStringLiteral(id)}),`
  ).join("\n");
  const semantics = navigation.pages.map(({ id, back, guardContractRef }) =>
    `        ${generated}PageRef.${kotlinEnumToken(id)} to ${generated}PageSemantics(` +
      `${generated}PageBack.${kotlinEnumToken(back)}, ` +
      `${guardContractRef === null ? "null" : kotlinStringLiteral(guardContractRef)}),`
  ).join("\n");
  const artifacts = navigation.artifacts.map(({ artifactRef, entryPageRef, pages: artifactPages }) => {
    const artifactEntries = artifactPages.map(({ pageRef, restore }) =>
      `            ${generated}PageRef.${kotlinEnumToken(pageRef)} to ` +
        `${generated}PageRestore.${kotlinEnumToken(restore)},`
    ).join("\n");
    return `        ${kotlinStringLiteral(artifactRef)} to ${generated}NavigationArtifact(
            entry = ${generated}PageRef.${kotlinEnumToken(entryPageRef)},
            pages = mapOf(
${artifactEntries}
            ),
        ),`;
  }).join("\n");
  const groups = navigation.actionGroups.map((group) => {
    const actions = group.actions.map((action) =>
      `                ${generated}NavigationAction(` +
        `${kotlinStringLiteral(action.id)}, ${generated}NavigationActionKind.${kotlinEnumToken(action.kind)}, ` +
        `${kotlinStringLiteral(action.sourcePortRef)}, ${kotlinStringLiteral(action.targetPortRef)}, ` +
        `${kotlinStringLiteral(action.contractRef)}),`
    ).join("\n");
    return `        ${generated}NavigationActionGroup(
            componentInstanceRef = ${kotlinStringLiteral(group.componentInstanceRef)},
            pageRefs = setOf(${group.pageRefs.map((id) => `${generated}PageRef.${kotlinEnumToken(id)}`).join(", ")}),
            artifactRefs = setOf(${group.artifactRefs.map(kotlinStringLiteral).join(", ")}),
            actions = listOf(
${actions}
            ),
        ),`;
  }).join("\n");

  return `// GENERATED FILE. DO NOT EDIT.
// Generator SHA-256: ${options.sourceSha}
package ${options.packageName}

enum class ${generated}PageRef(val wireId: String) {
${pages}
}

enum class ${generated}PageRestore { ROOT, PROCESS }
enum class ${generated}PageBack { PREVIOUS, CONSUME, SYSTEM }
enum class ${generated}NavigationActionKind { ROUTE, EVENT }

data class ${generated}RouteIntent(val target: ${generated}PageRef)
data class ${generated}PageSemantics(
    val back: ${generated}PageBack,
    val guardContractRef: String?,
)
data class ${generated}NavigationArtifact(
    val entry: ${generated}PageRef,
    val pages: Map<${generated}PageRef, ${generated}PageRestore>,
)
data class ${generated}NavigationAction(
    val id: String,
    val kind: ${generated}NavigationActionKind,
    val sourcePortRef: String,
    val targetPortRef: String,
    val contractRef: String,
)
data class ${generated}NavigationActionGroup(
    val componentInstanceRef: String,
    val pageRefs: Set<${generated}PageRef>,
    val artifactRefs: Set<String>,
    val actions: List<${generated}NavigationAction>,
)

object ${generated}Navigation {
    const val id: String = ${kotlinStringLiteral(navigation.id)}
    const val activePagePortRef: String = ${kotlinStringLiteral(navigation.activePagePortRef)}
    const val pageHostPortRef: String = ${kotlinStringLiteral(navigation.pageHostPortRef)}
    val pageSemantics: Map<${generated}PageRef, ${generated}PageSemantics> = mapOf(
${semantics}
    )
    val artifacts: Map<String, ${generated}NavigationArtifact> = mapOf(
${artifacts}
    )
    val actionGroups: List<${generated}NavigationActionGroup> = listOf(
${groups}
    )
}
`;
}
