import type { ComponentCopyDeclaration } from "./component-copy-model.js";
import { validateComponentCopy } from "./component-copy-model.js";
import type { SourcedKotlinEmissionOptions } from "./emission-options.js";
import { kotlinIdentifier, kotlinStringLiteral } from "./kotlin-syntax.js";

/** Emit one typed Kotlin value per component. No string-key lookup survives. */
export function emitComponentCopyKotlin(
  declarations: readonly ComponentCopyDeclaration[],
  componentRefs: ReadonlySet<string>,
  options: SourcedKotlinEmissionOptions,
): string {
  validateComponentCopy(declarations, componentRefs);
  const generated = `Generated${options.symbolPrefix}ComponentCopy`;
  const types = declarations.map(({ componentRef, fields }) => {
    const type = `${kotlinIdentifier(componentRef)}Copy`;
    const properties = Object.keys(fields)
      .map((field) => `        val ${field}: String,`)
      .join("\n");
    return `    data class ${type}(\n${properties}\n    )`;
  }).join("\n\n");
  const values = declarations.map(({ componentRef, fields }) => {
    const symbol = lowerCamel(kotlinIdentifier(componentRef));
    const type = `${kotlinIdentifier(componentRef)}Copy`;
    const properties = Object.entries(fields)
      .map(([field, value]) => `        ${field} = ${kotlinStringLiteral(value)},`)
      .join("\n");
    return `    val ${symbol}: ${type} = ${type}(\n${properties}\n    )`;
  }).join("\n\n");

  return `// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM ${options.sourceFile}
// Generator SHA-256: ${options.sourceSha}
package ${options.packageName}

internal object ${generated} {
${types}

${values}
}
`;
}

function lowerCamel(value: string): string {
  return value[0]!.toLowerCase() + value.slice(1);
}
