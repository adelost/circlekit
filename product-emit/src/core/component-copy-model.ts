/**
 * Static component-owned strings and stable UI identities.
 *
 * The declaration is grouped by component instead of being a global string
 * catalogue. A renderer can therefore only consume copy belonging to the
 * component type it implements, while dynamic locale/unit formatting remains
 * native presentation logic.
 */
export interface ComponentCopyDeclaration<
  ComponentRef extends string = string,
  Fields extends Readonly<Record<string, string>> = Readonly<Record<string, string>>,
> {
  readonly componentRef: ComponentRef;
  readonly fields: Fields;
}

export function defineComponentCopy<
  const ComponentRef extends string,
  const Fields extends Readonly<Record<string, string>>,
>(declaration: ComponentCopyDeclaration<ComponentRef, Fields>): ComponentCopyDeclaration<ComponentRef, Fields> {
  return declaration;
}

/** Fail before emission: every copy owner is real, unique and Kotlin-typable. */
export function validateComponentCopy(
  declarations: readonly ComponentCopyDeclaration[],
  componentRefs: ReadonlySet<string>,
): void {
  const owners = new Set<string>();
  for (const declaration of declarations) {
    if (!componentRefs.has(declaration.componentRef)) {
      throw new Error(`component copy names unknown component '${declaration.componentRef}'`);
    }
    if (owners.has(declaration.componentRef)) {
      throw new Error(`duplicate component copy for '${declaration.componentRef}'`);
    }
    owners.add(declaration.componentRef);
    const entries = Object.entries(declaration.fields);
    if (entries.length === 0) {
      throw new Error(`component copy for '${declaration.componentRef}' has no fields`);
    }
    for (const [field, value] of entries) {
      if (!/^[a-z][A-Za-z0-9]*$/u.test(field)) {
        throw new Error(`component copy field '${declaration.componentRef}.${field}' is not lower camel case`);
      }
      if (value.trim().length === 0) {
        throw new Error(`component copy field '${declaration.componentRef}.${field}' is blank`);
      }
    }
  }
}
