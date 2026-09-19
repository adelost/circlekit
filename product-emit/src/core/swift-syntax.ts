/**
 * The ONE Swift surface syntax: identifiers, enum cases and string literals for
 * every Swift emitter. The Kotlin side learned this the hard way (four local
 * copies, three of them wrong about one escape), so Swift starts with one.
 *
 * Swift's own escapes are the Kotlin set plus `\0`, and its interpolation is
 * `\(`, which the backslash escape already covers. A declared name that is a
 * Swift keyword is written in backticks rather than renamed, so the emitted
 * symbol still reads as the declaration wrote it.
 */

/** `power.pressure` / `power-pressure` → `PowerPressure`. */
export function swiftIdentifier(id: string): string {
  const result = id
    .split(/[^A-Za-z0-9]+/u)
    .filter((word) => word.length > 0)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join("");
  if (!/^[A-Za-z][A-Za-z0-9]*$/u.test(result)) {
    throw new Error(`cannot emit Swift identifier for '${id}'`);
  }
  return result;
}

/** `batch-ms` / `batchMs` → `batchMs` (a property or parameter name), in backticks when it is a keyword. */
export function swiftPropertyName(name: string): string {
  const identifier = swiftIdentifier(name);
  return swiftMember(identifier[0]!.toLowerCase() + identifier.slice(1));
}

/**
 * The case a declared value is written as. A value that is already a plain Swift
 * name keeps its spelling; anything else becomes one, and the raw value carries
 * the declared text either way, so nothing is lost on the wire.
 */
export function swiftEnumCase(value: string): string {
  const plain = /^[A-Za-z_][A-Za-z0-9_]*$/u.test(value)
    ? value
    : value.split(/[^A-Za-z0-9]+/u).filter((word) => word.length > 0)
      .map((word, index) => (index === 0 ? word : word[0]?.toUpperCase() + word.slice(1))).join("");
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(plain)) throw new Error(`cannot emit a Swift case for '${value}'`);
  return swiftMember(plain);
}

/** A Swift keyword used as a member is legal in backticks; anything else is written as it stands. */
export function swiftMember(name: string): string {
  return SWIFT_KEYWORDS.has(name) ? `\`${name}\`` : name;
}

const SWIFT_KEYWORDS = new Set([
  "associatedtype", "class", "deinit", "enum", "extension", "fileprivate", "func", "import", "init", "inout",
  "internal", "let", "open", "operator", "private", "precedencegroup", "protocol", "public", "rethrows", "static",
  "struct", "subscript", "typealias", "var", "break", "case", "catch", "continue", "default", "defer", "do", "else",
  "fallthrough", "for", "guard", "if", "in", "repeat", "return", "throw", "switch", "where", "while", "as", "Any",
  "false", "is", "nil", "self", "Self", "super", "throws", "true", "try",
]);

const SWIFT_STRING_ESCAPES: Readonly<Record<string, string>> = {
  "\\": "\\\\",
  "\"": "\\\"",
  "\n": "\\n",
  "\r": "\\r",
  "\t": "\\t",
  "\0": "\\0",
};

/**
 * A Swift double-quoted string literal, strictly safe: backslash (which also
 * disarms `\(` interpolation), quote, the shorthand whitespace escapes, and
 * every other control character as `\u{XX}`.
 */
export function swiftStringLiteral(value: string): string {
  let out = "";
  for (const char of value) {
    const shorthand = SWIFT_STRING_ESCAPES[char];
    if (shorthand !== undefined) {
      out += shorthand;
      continue;
    }
    const code = char.codePointAt(0)!;
    out += code < 0x20 || code === 0x7f ? `\\u{${code.toString(16)}}` : char;
  }
  return `"${out}"`;
}

/** `["a", "b"]`, the literal a `[String]` constant is written as. */
export function swiftStringArray(values: readonly string[]): string {
  return `[${values.map(swiftStringLiteral).join(", ")}]`;
}

/** The two header lines every generated Swift file carries, so a reader knows what to edit instead. */
export function swiftGeneratedHeader(sourceFile: string): readonly string[] {
  return ["// GENERATED FILE. DO NOT EDIT.", `// GENERATED FROM ${sourceFile}`];
}
