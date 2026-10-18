import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { CIRCLEKIT_PRESS } from '../dist/src/circle-style.js';

test('every portable press rung reaches the generated native ladder unchanged', () => {
  const native = readFileSync(new URL('../../designkit/src/main/java/com/adelost/designkit/ui/CirclePress.kt', import.meta.url), 'utf8');
  for (const [name, value] of Object.entries(CIRCLEKIT_PRESS)) {
    assert.ok(Number.isInteger(value) && value >= 0, `${name} is a non-negative integer`);
    const declaration = `const val ${name}: ${name.endsWith('Ms') ? 'Long' : 'Int'} = ${value}${name.endsWith('Ms') ? 'L' : ''}`;
    assert.ok(native.includes(declaration), `${name}: regenerate native press values from circle-style.ts`);
  }
});

test('the settings and hint aliases retain their declared source rung', () => {
  assert.equal(CIRCLEKIT_PRESS.rowInfoHoldMs, CIRCLEKIT_PRESS.holdDeliberateMs);
  assert.equal(CIRCLEKIT_PRESS.backHoldMs, CIRCLEKIT_PRESS.holdDeliberateMs);
  assert.equal(CIRCLEKIT_PRESS.hintReadingMs,
    CIRCLEKIT_PRESS.hintMaxChars / CIRCLEKIT_PRESS.hintReadCharsPerSecond * 1000);
});
