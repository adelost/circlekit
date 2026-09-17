/**
 * Rows that share fields. A family states its shared fields once; each row adds only its own, and a row that
 * restates a field its family fixes is refused, in the editor (the key is `never`) and at build (named here).
 * The row that comes out is the plain record the product already declares, so nothing downstream changes.
 */
/** The row's own keys never include the family's (a caller's `never` marker for them is dropped, not intersected into never). */
export type FamilyRow<Shared extends object, Row extends object> = Shared & Omit<Row, keyof Shared>;

export type FamilyMember<Shared extends object> = <const Row extends object & { readonly [Key in keyof Shared]?: never }>(
  row: Row,
) => FamilyRow<Shared, Row>;

export function family<const Shared extends object>(shared: Shared): FamilyMember<Shared> {
  return (row) => {
    const restated = Object.keys(row).filter((key) => Object.hasOwn(shared, key));
    if (restated.length > 0) {
      throw new Error(`family row ${rowName(row)} restates ${restated.map((key) => `'${key}'`).join(", ")}, which its family fixes as ${restated
        .map((key) => JSON.stringify((shared as Record<string, unknown>)[key]))
        .join(", ")}`);
    }
    return { ...shared, ...row } as FamilyRow<Shared, typeof row>;
  };
}

function rowName(row: object): string {
  const id = (row as { readonly id?: unknown }).id;
  return typeof id === "string" ? `'${id}'` : "without an id";
}
