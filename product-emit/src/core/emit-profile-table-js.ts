import { PROFILE_TABLE_SPEC_VERSION } from "./profile-table-model.js";
import type {
  ProfileTableDeclaration,
  ProfileTableField,
  ProfileTableSymbolRegistry,
} from "./profile-table-model.js";

export interface ProfileTableJsEmissionOptions {
  readonly registry: ProfileTableSymbolRegistry;
  /** Repo-relative path of the declaration this module is projected from. */
  readonly sourceFile: string;
  readonly sourceSha: string;
}

/**
 * The declared table as a JavaScript module, plus the gates that keep it true.
 *
 * The layout is deliberately the one hand-written tables in this family already
 * use — first field on the brace line, last field closed by its own tail — so a
 * consumer's first emission is byte-identical to the file it replaces. A nicer
 * canonical format would cost a reformat commit whose diff a reviewer cannot
 * verify by eye, and the whole value of a first emission is that it is
 * verifiable.
 *
 * Assumes a validated declaration (R3). Every `!` below is a fact
 * validateProfileTable has already proved.
 */
export function emitProfileTableJs(
  declaration: ProfileTableDeclaration,
  options: ProfileTableJsEmissionOptions,
): string {
  const guards = [...new Set(declaration.fields
    .flatMap((field) => field.value.kind === "guarded-number" ? [field.value.guard] : []))];
  const refs = [...new Set(declaration.presets.flatMap((preset) =>
    declaration.fields.flatMap((field) => {
      const value = declaration.rows[preset]!.values[field.name];
      return field.value.kind === "ref" && typeof value === "string" ? [value] : [];
    })))];

  return `// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM ${options.sourceFile}
// Profile-table spec ${PROFILE_TABLE_SPEC_VERSION}
// Declaration SHA-256: ${options.sourceSha}
${emitImports([...refs, ...guards], options.registry)}
export const ${declaration.symbol} = Object.freeze({
${declaration.presets.map((preset) => emitRow(declaration, preset)).join("\n")}
});

${emitGates(declaration, guards)}`;
}

/** One import per module, symbols sorted, so the header is stable under edits. */
function emitImports(
  symbols: readonly string[],
  registry: ProfileTableSymbolRegistry,
): string {
  const byModule = new Map<string, string[]>();
  for (const symbol of [...new Set(symbols)].sort()) {
    const module = registry.sources[symbol]!;
    byModule.set(module, [...(byModule.get(module) ?? []), symbol]);
  }
  if (byModule.size === 0) return "";
  return `\n${[...byModule.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([module, names]) => `import { ${names.join(", ")} } from ${JSON.stringify(module)};`)
    .join("\n")}\n`;
}

function emitRow(declaration: ProfileTableDeclaration, preset: string): string {
  const row = declaration.rows[preset]!;
  const present = declaration.fields.filter(({ name }) => row.values[name] !== undefined);
  const cells = present.map((field) => ({
    field,
    text: `${field.name}: ${emitValue(field, row.values[field.name]!, preset)}`,
    note: row.notes?.[field.name],
  }));

  // The first cell shares the brace line, which is what makes this layout
  // compact — unless it carries a note, because a comment cannot follow code on
  // the line it explains.
  const first = cells[0]!;
  const inlineFirst = first.note === undefined;
  const head = inlineFirst
    ? `  ${preset}: Object.freeze({ ${first.text}`
    : `  ${preset}: Object.freeze({`;
  const rest = (inlineFirst ? cells.slice(1) : cells)
    .map((cell) => `${cell.note === undefined ? "" : `${emitNote(cell.note)}\n`}    ${cell.text}`);

  if (rest.length === 0) return `${head} }),`;
  return `${[head, ...rest.slice(0, -1)].join(",\n")},\n${rest.at(-1)} }),`;
}

function emitNote(note: string): string {
  return note.split("\n").map((line) => `    // ${line}`.trimEnd()).join("\n");
}

function emitValue(field: ProfileTableField, value: number | string, preset: string): string {
  if (field.value.kind === "ref") {
    return field.value.member === "per-preset" ? `${value}.${preset}` : `${value}`;
  }
  // String() roundtrips every finite number exactly, and the validator has
  // already refused the exponent forms that roundtrip but do not read.
  return String(value);
}

/**
 * The gates, projected from the same declaration as the table above them.
 *
 * A generated file that only holds data is one hand edit away from being wrong
 * in a way nothing notices. These two say what the declaration says: the rows
 * carry exactly these fields, and the guarded ones answer to the consumer's own
 * validator — whose rule stays where it always lived.
 */
function emitGates(declaration: ProfileTableDeclaration, guards: readonly string[]): string {
  const required = declaration.fields.filter(({ required }) => required).map(({ name }) => name);
  const guardChecks = guards.flatMap((guard) => declaration.fields
    .filter((field) => field.value.kind === "guarded-number" && field.value.guard === guard)
    .map((field) => `  ${guard}(row.${field.name}, \`\${preset} ${field.name}\`);`));

  return `for (const [preset, row] of Object.entries(${declaration.symbol})) {
  for (const field of ${JSON.stringify(required)}) {
    if (!(field in row)) throw new Error(\`${declaration.symbol}.\${preset} is missing \${field}\`);
  }
${guardChecks.join("\n")}
}
`;
}
