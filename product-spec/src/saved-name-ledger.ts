import type { StoredType } from "./stored-value-model.js";

/**
 * The law of a product's saved-name ledger: the committed file that lists every name a device may hold, and the type it
 * holds under each. Generate only ever appends to it, so a name leaves the product only by being retired, and a type
 * once pinned never changes. Pure functions: the product keeps its ledger file, its format and its walk over revisions.
 */

/** Names a device may hold. An active name stays until it is retired; a retired name never returns. */
export interface SavedNameSection {
  readonly active: readonly string[];
  readonly retired: readonly string[];
}

export interface DeclaredSavedType {
  readonly name: string;
  readonly type: StoredType;
}

/**
 * The section with every declared name it does not list yet appended, in declaration order. Listed names keep their
 * place and are never removed here: a listed name nobody declares any more is a rename or a removal, which the product's
 * history check refuses until the name is retired.
 */
export function appendSavedNames(section: SavedNameSection, declared: readonly string[], noun: string): SavedNameSection {
  const problems = [
    ...[...new Set(declared.filter((name, index) => declared.indexOf(name) !== index))]
      .map((name) => `${noun} '${name}' is declared twice`),
    ...[...new Set(declared.filter((name) => section.retired.includes(name)))]
      .map((name) => `${noun} '${name}' is retired and cannot be declared again: old saved data would take on the new meaning`),
  ];
  refuse(problems);
  const listed = new Set(section.active);
  return { ...section, active: [...section.active, ...new Set(declared.filter((name) => !listed.has(name)))] };
}

/** Every pinned type, then each newly declared name with its type, in declaration order. */
export function pinStoredTypes(pinned: Readonly<Record<string, StoredType>>, declared: readonly DeclaredSavedType[]):
  Record<string, StoredType> {
  const types = new Map(Object.entries(pinned));
  const problems: string[] = [];
  for (const { name, type } of declared) {
    const saved = types.get(name);
    if (saved === undefined) types.set(name, type);
    else if (saved !== type) {
      problems.push(`'${name}' was saved as ${saved}; declaring it as ${type} makes every device that holds it fail its read, `
        + `and the store resets to defaults. Retire '${name}' and declare a new name`);
    }
  }
  refuse(problems);
  return Object.fromEntries(types);
}

/** A type pinned in an earlier revision of the ledger is still pinned, as the same type, in the current one. */
export function assertStoredTypesKept(previous: Readonly<Record<string, StoredType>>,
  current: Readonly<Record<string, StoredType>>, revision: string): void {
  refuse(Object.entries(previous).flatMap(([name, type]) => {
    const now = Object.hasOwn(current, name) ? current[name] : undefined;
    return now === type ? []
      : [`'${name}' was pinned as ${type} in ${revision} and is ${now ?? "gone"} now: a pinned saved type never changes or leaves`];
  }));
}

/**
 * The names a product still holds in hand-written native code may only shrink across revisions: a value that leaves
 * moves into a generated record, and a new value is never held by hand.
 */
export function assertHeldOnlyShrinks(previous: readonly string[], current: readonly string[], revision: string): void {
  const before = new Set(previous);
  refuse(current.filter((name) => !before.has(name)).map((name) =>
    `'${name}' is held natively now but was not in ${revision}: a new saved value is held by its generated record`));
}

function refuse(problems: readonly string[]): void {
  if (problems.length > 0) throw new Error(problems.join("\n"));
}
