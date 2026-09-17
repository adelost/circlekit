/**
 * A declaration's laws run once, when it is defined. So every define* freezes what it returns, and everything that
 * reaches, in place: a later write, by the caller to the object it passed in or by anyone to the result, throws
 * (ES modules run in strict mode) and changes nothing. In place, not copied, because identity carries meaning here:
 * a library proves where a contract or node type came from by being the very object a product imports, so a copy would
 * turn every exact import into a collision. Functions are code, not declared data, and are left as they are.
 */
export function frozen<T>(value: T): T {
  freezeOnce(value, new Set());
  return value;
}

function freezeOnce(value: unknown, seen: Set<object>): void {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return;
  for (const item of Object.values(value)) freezeOnce(item, seen);
  Object.freeze(value);
}
