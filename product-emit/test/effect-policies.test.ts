import assert from 'node:assert/strict';
import test from 'node:test';
import { defineEffect, effectCatalog, field, type LegoContract } from '@v1d/product-spec';
import { emitEffectPoliciesKotlin } from '../src/core/index.js';

const contract = (id: string): LegoContract => ({ id, kind: 'event', boundary: 'service-internal',
  fields: [field('operationId', 'string'), field('inputSha256', 'string')] });
const effects = effectCatalog([
  defineEffect({ id: 'network.jump-upload', input: contract('jump.input'), receipt: contract('jump.receipt') }),
  defineEffect({ id: 'network.pairing-revoke', input: contract('revoke.input'), receipt: contract('revoke.receipt') }),
]);

test('effect policies emit Kotlin refs and three outcomes without an executor', () => {
  const kotlin = emitEffectPoliciesKotlin(effects, { packageName: 'com.acme.generated',
    symbolPrefix: 'Acme', sourceFile: 'product/effects.ts', sourceSha: 'fixture' });
  assert.match(kotlin, /enum class GeneratedAcmeEffectRef \{ NETWORK_JUMP_UPLOAD, NETWORK_PAIRING_REVOKE \}/u);
  assert.match(kotlin, /enum class GeneratedAcmeEffectOutcome \{ CONFIRMED, FAILED, UNKNOWN \}/u);
  assert.match(kotlin, /NETWORK_JUMP_UPLOAD to GeneratedAcmeEffectPolicy\("network.jump-upload", "jump.input", "jump.receipt", "operationId", "inputSha256"/u);
  assert.match(kotlin, /EffectRetryIdentity.SAME, GeneratedAcmeEffectUnknown.RETAIN/u);
  assert.doesNotMatch(kotlin, /HttpURLConnection|CoroutineScope|retry\(/u);
});
