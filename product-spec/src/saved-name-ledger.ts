import type { StoredType } from "./stored-value-model.js";

/**
 * The law of a product's saved-name ledger: the committed file that lists every name a device may hold, the type it holds
 * under each and the store that holds it. Generate only ever appends to it, so a name leaves the product only by being
 * retired, and a type or store once pinned never changes. Pure functions: the product keeps its ledger file, its format
 * and its walk over revisions.
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

export interface DeclaredSavedStore {
  readonly name: string;
  readonly store: string;
}

/** Every pinned type, then each newly declared name with its type, in declaration order. */
export function pinStoredTypes(pinned: Readonly<Record<string, StoredType>>, declared: readonly DeclaredSavedType[]):
  Record<string, StoredType> {
  return pinFacts(pinned, declared.map(({ name, type }) => [name, type]), (name, saved, type) =>
    `'${name}' was saved as ${saved}; declaring it as ${type} makes every device that holds it fail its read, `
      + `and the store resets to defaults. Retire '${name}' and declare a new name`);
}

/** A type pinned in an earlier revision of the ledger is still pinned, as the same type, in the current one. */
export function assertStoredTypesKept(previous: Readonly<Record<string, StoredType>>,
  current: Readonly<Record<string, StoredType>>, revision: string): void {
  keepFacts(previous, current, (name, type, now) =>
    `'${name}' was pinned as ${type} in ${revision} and is ${now ?? "gone"} now: a pinned saved type never changes or leaves`);
}

/**
 * Every pinned store, then each newly declared name with the store that holds it, in declaration order. A ledger that
 * pins no store yet (`undefined`) gains the whole map, so its existing bytes stay as they are.
 */
export function pinSavedStores(pinned: Readonly<Record<string, string>> | undefined, declared: readonly DeclaredSavedStore[]):
  Record<string, string> {
  return pinFacts(pinned ?? {}, declared.map(({ name, store }) => [name, store]), (name, saved, store) =>
    `'${name}' was saved in '${saved}'; declaring it in '${store}' makes every device lose its saved value. `
      + `Retire '${name}' and declare a new name`);
}

/** A store pinned in an earlier revision is still pinned, as the same store, in the current one; `undefined` pins none. */
export function assertSavedStoresKept(previous: Readonly<Record<string, string>> | undefined,
  current: Readonly<Record<string, string>> | undefined, revision: string): void {
  keepFacts(previous ?? {}, current ?? {}, (name, store, now) => `'${name}' was pinned to '${store}' in ${revision} and is `
    + `${now === undefined ? "gone" : `in '${now}'`} now: a pinned store never changes or leaves`);
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

/** Pins each declared name's fact after the pinned ones; a pinned name declared with another fact is refused. */
function pinFacts<Fact extends string>(pinned: Readonly<Record<string, Fact>>, declared: readonly (readonly [string, Fact])[],
  changed: (name: string, saved: Fact, declared: Fact) => string): Record<string, Fact> {
  const facts = new Map(Object.entries(pinned));
  const problems: string[] = [];
  for (const [name, fact] of declared) {
    const saved = facts.get(name);
    if (saved === undefined) facts.set(name, fact);
    else if (saved !== fact) problems.push(changed(name, saved, fact));
  }
  refuse(problems);
  return Object.fromEntries(facts);
}

/** Every fact pinned in [previous] is still pinned, unchanged, in [current]. */
function keepFacts<Fact extends string>(previous: Readonly<Record<string, Fact>>, current: Readonly<Record<string, Fact>>,
  lost: (name: string, pinned: Fact, now: Fact | undefined) => string): void {
  refuse(Object.entries(previous).flatMap(([name, fact]) => {
    const now = Object.hasOwn(current, name) ? current[name] : undefined;
    return now === fact ? [] : [lost(name, fact, now)];
  }));
}

function refuse(problems: readonly string[]): void {
  if (problems.length > 0) throw new Error(problems.join("\n"));
}
