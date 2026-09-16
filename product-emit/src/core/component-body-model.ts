/**
 * A component body as data: what one component draws, from which inputs, under
 * which conditions.
 *
 * This is the smallest form that holds a component a host feeds with real state:
 * one product's first declared body, priced as a pilot. A body is a column of atoms. Its values read typed
 * inputs, fall back across optional ones, choose on flags, and resolve
 * CircleKit's tokens and phone surface design. Lists, state, animation and any
 * layout beyond one column are not part of it: the first body did not need
 * them, so they are not guessed here.
 *
 * Atoms are declared as data too (id and typed parameters). Which native
 * function draws an atom is the emitter target's business, never the body's.
 */

/** The value kinds a body passes around. `native:<ref>` is a type only the target can spell. */
export type BodyBaseType =
  | "text"
  | "flag"
  | "icon"
  | "accent"
  | "choice-state"
  | "color"
  | "dp"
  | "float"
  | "event"
  | "font-weight"
  | "text-align"
  | `native:${string}`;

export interface BodyType {
  readonly base: BodyBaseType;
  readonly optional: boolean;
}

/** CircleKit's graphite ink scale. */
export const BODY_INK_TOKENS = ["ink", "muted", "faint"] as const;
export type BodyInkToken = (typeof BODY_INK_TOKENS)[number];

/** Fields of CircleKit's phone surface design a body may read. */
export const BODY_PHONE_METRICS = {
  actionDiameter: "dp",
  actionIconSize: "dp",
  actionTextGap: "dp",
  actionPaddingVertical: "dp",
  actionLabelSize: "float",
  actionSupportingSize: "float",
} as const satisfies Readonly<Record<string, "dp" | "float">>;
export type BodyPhoneMetric = keyof typeof BODY_PHONE_METRICS;

export type BodyValue =
  | { readonly kind: "read"; readonly name: string }
  | { readonly kind: "literal"; readonly type: "dp" | "float"; readonly value: number }
  | { readonly kind: "ink"; readonly token: BodyInkToken }
  | { readonly kind: "font-weight"; readonly weight: "medium" | "semibold" | "bold" }
  | { readonly kind: "text-align"; readonly align: "center" }
  | { readonly kind: "first-present"; readonly values: readonly BodyValue[] }
  | { readonly kind: "choose"; readonly when: string; readonly then: BodyValue; readonly otherwise: BodyValue }
  | { readonly kind: "accent-color"; readonly accent: BodyValue; readonly activeWhen: string }
  | { readonly kind: "phone-metric"; readonly metric: BodyPhoneMetric; readonly plus: number; readonly otherwise: BodyValue | null };

export type BodyNode =
  | {
    readonly kind: "column";
    readonly spacing: BodyValue;
    /** Only when this flag holds: fill the width and pad vertically. */
    readonly fillWhen: Readonly<{ flag: string; paddingVertical: BodyValue }> | null;
    readonly children: readonly BodyNode[];
  }
  | { readonly kind: "atom"; readonly atom: string; readonly props: Readonly<Record<string, BodyValue>> }
  | { readonly kind: "show-when"; readonly flag: string; readonly children: readonly BodyNode[] }
  | { readonly kind: "with-present"; readonly input: string; readonly children: readonly BodyNode[] };

export interface BodyAtomDeclaration {
  readonly id: string;
  /** Parameter name to type. A non-optional parameter must be given. */
  readonly params: Readonly<Record<string, BodyType>>;
  /** Parameters the atom accepts but a body may leave out. */
  readonly defaulted: readonly string[];
}

export interface ComponentBodyDeclaration {
  readonly id: string;
  readonly inputs: Readonly<Record<string, BodyType>>;
  /** The flag under which the phone surface design is read; null when the body reads none. */
  readonly phoneDesignWhen: string | null;
  readonly root: BodyNode;
}

/** CircleKit's text atom, the one atom every body may use without declaring it. */
export const circleTextAtom: BodyAtomDeclaration = {
  id: "circle-text",
  params: {
    text: required("text"),
    color: required("color"),
    fontSizeSp: required("float"),
    fontWeight: required("font-weight"),
    letterSpacingSp: required("float"),
    lineHeightSp: required("float"),
    textAlign: required("text-align"),
  },
  defaulted: ["fontWeight", "letterSpacingSp", "lineHeightSp", "textAlign"],
};

export function required(base: BodyBaseType): BodyType {
  return { base, optional: false };
}

export function optional(base: BodyBaseType): BodyType {
  return { base, optional: true };
}

export const body = {
  read: (name: string): BodyValue => ({ kind: "read", name }),
  dp: (value: number): BodyValue => ({ kind: "literal", type: "dp", value }),
  float: (value: number): BodyValue => ({ kind: "literal", type: "float", value }),
  ink: (token: BodyInkToken): BodyValue => ({ kind: "ink", token }),
  weight: (weight: "medium" | "semibold" | "bold"): BodyValue => ({ kind: "font-weight", weight }),
  center: (): BodyValue => ({ kind: "text-align", align: "center" }),
  firstPresent: (...values: BodyValue[]): BodyValue => ({ kind: "first-present", values }),
  choose: (when: string, then: BodyValue, otherwise: BodyValue): BodyValue => ({ kind: "choose", when, then, otherwise }),
  accentColor: (accent: BodyValue, activeWhen: string): BodyValue => ({ kind: "accent-color", accent, activeWhen }),
  phone: (metric: BodyPhoneMetric, options: { readonly plus?: number; readonly otherwise?: BodyValue } = {}): BodyValue =>
    ({ kind: "phone-metric", metric, plus: options.plus ?? 0, otherwise: options.otherwise ?? null }),
  column: (
    spacing: BodyValue,
    children: readonly BodyNode[],
    fillWhen: Readonly<{ flag: string; paddingVertical: BodyValue }> | null = null,
  ): BodyNode => ({ kind: "column", spacing, fillWhen, children }),
  atom: (atom: string, props: Readonly<Record<string, BodyValue>>): BodyNode => ({ kind: "atom", atom, props }),
  showWhen: (flag: string, children: readonly BodyNode[]): BodyNode => ({ kind: "show-when", flag, children }),
  withPresent: (input: string, children: readonly BodyNode[]): BodyNode => ({ kind: "with-present", input, children }),
} as const;

/** What a value resolves to while its body is checked. */
interface Scope {
  readonly types: ReadonlyMap<string, BodyType>;
  readonly phoneFlag: string | null;
  /** True inside a branch where the phone design flag holds. */
  readonly phoneKnown: boolean;
}

/**
 * Fail before emission: every name is declared, every atom parameter is given
 * a value of its type, and the phone design is only read where it exists.
 */
export function validateComponentBody(
  declaration: ComponentBodyDeclaration,
  atoms: readonly BodyAtomDeclaration[],
): void {
  const where = `component body '${declaration.id}'`;
  const atomById = new Map([circleTextAtom, ...atoms].map((atom) => [atom.id, atom] as const));
  if (atomById.size !== atoms.length + 1) throw new Error(`${where} declares an atom id twice`);
  const types = new Map(Object.entries(declaration.inputs));
  if (declaration.phoneDesignWhen !== null) requireFlag(types, declaration.phoneDesignWhen, where);
  checkNode(declaration.root, { types, phoneFlag: declaration.phoneDesignWhen, phoneKnown: false }, atomById, where);
}

function checkNode(node: BodyNode, scope: Scope, atoms: ReadonlyMap<string, BodyAtomDeclaration>, where: string): void {
  switch (node.kind) {
    case "column": {
      requireType(typeOf(node.spacing, scope, where), "dp", `${where} column spacing`);
      if (node.fillWhen !== null) {
        requireFlag(scope.types, node.fillWhen.flag, where);
        requireType(typeOf(node.fillWhen.paddingVertical, branch(scope, node.fillWhen.flag), where), "dp",
          `${where} column padding`);
      }
      node.children.forEach((child) => checkNode(child, scope, atoms, where));
      return;
    }
    case "atom": {
      const atom = atoms.get(node.atom);
      if (atom === undefined) throw new Error(`${where} uses undeclared atom '${node.atom}'`);
      for (const [param, value] of Object.entries(node.props)) {
        const expected = atom.params[param];
        if (expected === undefined) throw new Error(`${where} passes unknown parameter '${param}' to '${atom.id}'`);
        const actual = typeOf(value, scope, where);
        if (actual.base !== expected.base || (actual.optional && !expected.optional)) {
          throw new Error(`${where} passes ${describe(actual)} to '${atom.id}.${param}', which takes ${describe(expected)}`);
        }
      }
      const missing = Object.keys(atom.params).filter((param) =>
        !(param in node.props) && !atom.defaulted.includes(param));
      if (missing.length > 0) throw new Error(`${where} leaves '${atom.id}' without '${missing.join("', '")}'`);
      return;
    }
    case "show-when":
      requireFlag(scope.types, node.flag, where);
      node.children.forEach((child) => checkNode(child, branch(scope, node.flag), atoms, where));
      return;
    case "with-present": {
      const type = scope.types.get(node.input);
      if (type === undefined || !type.optional) throw new Error(`${where} unwraps '${node.input}', which is not an optional input`);
      const types = new Map(scope.types).set(node.input, required(type.base));
      node.children.forEach((child) => checkNode(child, { ...scope, types }, atoms, where));
      return;
    }
  }
}

function typeOf(value: BodyValue, scope: Scope, where: string): BodyType {
  switch (value.kind) {
    case "read": {
      const type = scope.types.get(value.name);
      if (type === undefined) throw new Error(`${where} reads undeclared input '${value.name}'`);
      return type;
    }
    case "literal":
      if (!Number.isFinite(value.value)) throw new Error(`${where} has a non-finite ${value.type}`);
      return required(value.type);
    case "ink":
      return required("color");
    case "font-weight":
      return required("font-weight");
    case "text-align":
      return required("text-align");
    case "first-present": {
      const types = value.values.map((item) => typeOf(item, scope, where));
      const last = types.at(-1);
      if (last === undefined || last.optional || types.slice(0, -1).some((type) => !type.optional)) {
        throw new Error(`${where} first-present needs optional values ending in a present one`);
      }
      if (types.some((type) => type.base !== last.base)) throw new Error(`${where} first-present mixes types`);
      return last;
    }
    case "choose": {
      requireFlag(scope.types, value.when, where);
      const then = typeOf(value.then, branch(scope, value.when), where);
      const otherwise = typeOf(value.otherwise, scope, where);
      if (then.base !== otherwise.base) throw new Error(`${where} choose on '${value.when}' mixes types`);
      return { base: then.base, optional: then.optional || otherwise.optional };
    }
    case "accent-color":
      requireType(typeOf(value.accent, scope, where), "accent", `${where} accent colour`);
      requireFlag(scope.types, value.activeWhen, where);
      return required("color");
    case "phone-metric":
      if (scope.phoneFlag === null) throw new Error(`${where} reads the phone design without declaring when it exists`);
      if (!scope.phoneKnown && value.otherwise === null) {
        throw new Error(`${where} reads phone '${value.metric}' outside '${scope.phoneFlag}' with no otherwise`);
      }
      if (value.otherwise !== null) {
        requireType(typeOf(value.otherwise, scope, where), BODY_PHONE_METRICS[value.metric], `${where} phone '${value.metric}' otherwise`);
      }
      if (value.plus !== 0 && (BODY_PHONE_METRICS[value.metric] !== "float" || value.otherwise !== null)) {
        throw new Error(`${where} adds to phone '${value.metric}', which only a float read inside '${scope.phoneFlag}' allows`);
      }
      return required(BODY_PHONE_METRICS[value.metric]);
  }
}

function branch(scope: Scope, flag: string): Scope {
  return flag === scope.phoneFlag ? { ...scope, phoneKnown: true } : scope;
}

function requireFlag(types: ReadonlyMap<string, BodyType>, name: string, where: string): void {
  const type = types.get(name);
  if (type?.base !== "flag" || type.optional) throw new Error(`${where} needs flag input '${name}'`);
}

function requireType(actual: BodyType, base: BodyBaseType, what: string): void {
  if (actual.base !== base || actual.optional) throw new Error(`${what} must be ${base}, not ${describe(actual)}`);
}

function describe(type: BodyType): string {
  return `${type.optional ? "optional " : ""}${type.base}`;
}
