/**
 * The ONE Kotlin surface syntax: identifiers, enum tokens, labels and string
 * literals for every emitter AND every validator that reasons about emitted
 * symbols. Replaces four divergent local copies (two forgot `$`, one forgot
 * newline, one borrowed JSON.stringify's semantics) so the prediction can
 * never drift from the emission.
 */

/** `dial-direction` / `dial.direction` → `DialDirection`. */
export function kotlinIdentifier(id: string): string {
  const result = id
    .split(/[^A-Za-z0-9]+/u)
    .filter((word) => word.length > 0)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join("");
  if (!/^[A-Za-z][A-Za-z0-9]*$/u.test(result)) {
    throw new Error(`cannot emit Kotlin identifier for '${id}'`);
  }
  return result;
}

/** `pressureHpa` / `pressure-hpa` → `pressureHpa` (a property or parameter name). */
export function kotlinPropertyName(name: string): string {
  const identifier = kotlinIdentifier(name);
  return identifier[0]!.toLowerCase() + identifier.slice(1);
}

/** `dial-direction` → `DIAL_DIRECTION` (enum entry token). */
export function kotlinEnumToken(id: string): string {
  return id.replace(/[^A-Za-z0-9]+/gu, "_").toUpperCase();
}

/** `dial-direction` → `DIAL DIRECTION` (human label derived from an id). */
export function kotlinLabel(id: string): string {
  return id.replaceAll("-", " ").toUpperCase();
}

/**
 * A Kotlin double-quoted string literal, strictly safe: backslash, quote and
 * `$` (template interpolation), the shorthand whitespace escapes, and every
 * other control character as `XXXX` — so nothing a declaration can hold
 * (including what JSON.stringify used to catch) ever lands raw in source.
 */
const KOTLIN_STRING_ESCAPES: Readonly<Record<string, string>> = {
  "\\": "\\\\",
  "\"": "\\\"",
  "$": "\\$",
  "\n": "\\n",
  "\r": "\\r",
  "\t": "\\t",
};

export function kotlinStringLiteral(value: string): string {
  let out = "";
  for (const char of value) {
    const shorthand = KOTLIN_STRING_ESCAPES[char];
    if (shorthand !== undefined) {
      out += shorthand;
      continue;
    }
    const code = char.codePointAt(0)!;
    out += code < 0x20 || code === 0x7f
      ? `\\u${code.toString(16).padStart(4, "0")}`
      : char;
  }
  return `"${out}"`;
}

/** `0.5` -> `0.5f`, `1` -> `1.0f`, `1e-7` -> `1e-7f`: a Kotlin Float literal for a finite number. */
export function kotlinFloatLiteral(value: number): string {
  if (!Number.isFinite(value)) throw new Error(`cannot emit Kotlin Float literal for ${value}`);
  const text = String(value);
  return /[.e]/u.test(text) ? `${text}f` : `${text}.0f`;
}

/** `dev.acme.ui.IconStyle` -> `IconStyle`: how a file that imports a symbol names it. */
export function kotlinSimpleName(qualified: string): string {
  return qualified.slice(qualified.lastIndexOf(".") + 1);
}

/** `250` -> `250L`: a Kotlin Long literal for a whole number JavaScript holds exactly. */
export function kotlinLongLiteral(value: number): string {
  if (!Number.isSafeInteger(value)) throw new Error(`cannot emit Kotlin Long literal for ${value}`);
  return `${value}L`;
}

export function indent(value: string, spaces: number): string {
  const prefix = " ".repeat(spaces);
  return value
    .split("\n")
    .map((line) => (line.length === 0 ? line : prefix + line))
    .join("\n");
}

/** Kotlin's hard keywords: a declaration named by one does not compile unquoted. */
export const KOTLIN_HARD_KEYWORDS: ReadonlySet<string> = new Set(["as", "break", "class", "continue", "do", "else",
  "false", "for", "fun", "if", "in", "interface", "is", "null", "object", "package", "return", "super", "this", "throw",
  "true", "try", "typealias", "typeof", "val", "var", "when", "while"]);

/** `in` -> `` `in` ``: a property or parameter name as source, quoted when it is a hard keyword. */
export function kotlinQuotedName(name: string): string {
  return KOTLIN_HARD_KEYWORDS.has(name) ? `\`${name}\`` : name;
}

/**
 * Members every Kotlin object has. A declared method of that name with no arguments hides one of `Any`
 * (`toString`, `hashCode`) or accidentally overrides one of `java.lang.Object` (`notify`, `notifyAll`, `wait`),
 * and kotlinc refuses both. `equals`, `getClass`, `clone` and `finalize` compile, so they are not listed.
 */
const OBJECT_MEMBER_NAMES: ReadonlySet<string> = new Set(["hashCode", "notify", "notifyAll", "toString", "wait"]);

/** Why kotlinc refuses [name] as a declared method name, or undefined when it accepts it. */
export function kotlinMethodNameProblem(name: string): string | undefined {
  if (KOTLIN_HARD_KEYWORDS.has(name)) return "a Kotlin keyword";
  if (OBJECT_MEMBER_NAMES.has(name)) return "a member of every Kotlin object";
  if (/^_+$/u.test(name)) return "reserved in Kotlin";
  return undefined;
}
