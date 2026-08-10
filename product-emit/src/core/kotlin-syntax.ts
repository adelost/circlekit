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

export function indent(value: string, spaces: number): string {
  const prefix = " ".repeat(spaces);
  return value
    .split("\n")
    .map((line) => (line.length === 0 ? line : prefix + line))
    .join("\n");
}
