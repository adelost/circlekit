import type {
  ProfileTableDeclaration,
  ProfileTableField,
  ProfileTableRow,
  ProfileTableSymbolRegistry,
} from "./profile-table-model.js";

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/u;

/**
 * Everything that must be true before a profile table may be emitted, decided
 * here and only here (R2). The emitter downstream assumes all of it and reads
 * rather than re-checks.
 *
 * Throws rather than collecting diagnostics: every failure below is a declaration
 * a human wrote wrong, and there is no partial table worth emitting from one.
 */
export function validateProfileTable(
  declaration: ProfileTableDeclaration,
  registry: ProfileTableSymbolRegistry,
): void {
  requireIdentifier(declaration.symbol, "profile table symbol");
  requireNonEmptyUnique(declaration.presets, "preset");
  for (const preset of declaration.presets) requireIdentifier(preset, "preset");
  requireNonEmptyUnique(declaration.fields.map(({ name }) => name), "field");
  for (const field of declaration.fields) requireIdentifier(field.name, "field");

  // Rows answer the declared presets, both directions: a row nobody declared is
  // as wrong as a preset nobody filled in.
  const declaredPresets = new Set(declaration.presets);
  for (const name of Object.keys(declaration.rows)) {
    if (!declaredPresets.has(name)) {
      throw new Error(`profile table '${declaration.symbol}' has a row '${name}' that is not a declared preset`);
    }
  }

  for (const preset of declaration.presets) {
    const row = declaration.rows[preset];
    if (row === undefined) {
      throw new Error(`profile table '${declaration.symbol}' preset '${preset}' has no row`);
    }
    validateRow(declaration, preset, row, registry);
  }
}

function validateRow(
  declaration: ProfileTableDeclaration,
  preset: string,
  row: ProfileTableRow,
  registry: ProfileTableSymbolRegistry,
): void {
  const where = `profile table '${declaration.symbol}' preset '${preset}'`;
  const declaredFields = new Map(declaration.fields.map((field) => [field.name, field]));
  for (const name of Object.keys(row.values)) {
    if (!declaredFields.has(name)) {
      throw new Error(`${where} sets '${name}', which is not a declared field`);
    }
  }
  for (const name of Object.keys(row.notes ?? {})) {
    if (!declaredFields.has(name)) {
      throw new Error(`${where} notes '${name}', which is not a declared field`);
    }
  }
  for (const field of declaration.fields) {
    const value = row.values[field.name];
    if (value === undefined) {
      if (field.required) throw new Error(`${where} is missing required field '${field.name}'`);
      continue;
    }
    validateCell(where, field, value, preset, registry);
  }
}

function validateCell(
  where: string,
  field: ProfileTableField,
  value: number | string,
  preset: string,
  registry: ProfileTableSymbolRegistry,
): void {
  const at = `${where} field '${field.name}'`;
  switch (field.value.kind) {
    case "number": {
      const number = requireFiniteNumber(at, value);
      const { range } = field.value;
      if (range !== undefined && (number < range.min || number > range.max)) {
        throw new Error(`${at} is ${number}, outside the declared ${range.min}..${range.max}`);
      }
      return;
    }
    case "guarded-number": {
      requireFiniteNumber(at, value);
      // The guard's RULE stays in the consumer's own function. What must be true
      // here is only that the emitted file will be able to import it.
      if (registry.sources[field.value.guard] === undefined) {
        throw new Error(`${at} names guard '${field.value.guard}', which the registry cannot source`);
      }
      return;
    }
    case "ref": {
      if (typeof value !== "string") {
        throw new Error(`${at} must name a symbol, got ${typeof value}`);
      }
      if (!(value in registry.values)) {
        throw new Error(`${at} references '${value}', which the registry cannot resolve`);
      }
      if (registry.sources[value] === undefined) {
        throw new Error(`${at} references '${value}', which the registry cannot source`);
      }
      if (field.value.member === "per-preset") {
        const target = registry.values[value];
        if (target === null || typeof target !== "object" || !(preset in target)) {
          throw new Error(`${at} references '${value}.${preset}', which does not exist`);
        }
      }
      return;
    }
  }
}

/**
 * `Number(String(v)) === v` holds for every finite JS number, so the roundtrip is
 * exact by construction and needs no check. Exponent form is what needs one: it
 * is legal, it roundtrips, and `1e+21` in a table a human reviews is a surprise
 * nobody asked for.
 */
function requireFiniteNumber(at: string, value: number | string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${at} must be a finite number, got ${JSON.stringify(value)}`);
  }
  if (String(value).includes("e")) {
    throw new Error(`${at} is ${String(value)}, which emits in exponent form; write it out`);
  }
  return value;
}

function requireIdentifier(value: string, owner: string): void {
  if (!IDENTIFIER.test(value)) throw new Error(`${owner} '${value}' is not a JavaScript identifier`);
}

function requireNonEmptyUnique(values: readonly string[], owner: string): void {
  if (values.length === 0) throw new Error(`a profile table needs at least one ${owner}`);
  if (new Set(values).size !== values.length) throw new Error(`duplicate ${owner} in profile table`);
}
