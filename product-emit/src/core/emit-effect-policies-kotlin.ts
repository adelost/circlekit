import { EFFECT_OUTCOMES, effectCatalog, type EffectDefinition } from '@v1d/product-spec';
import type { SourcedKotlinEmissionOptions } from './emission-options.js';
import { kotlinEnumToken, kotlinStringLiteral } from './kotlin-syntax.js';

/** Emit type-safe policy refs only; existing product owners perform HTTP and durable retry. */
export function emitEffectPoliciesKotlin(
  effects: readonly EffectDefinition[], options: SourcedKotlinEmissionOptions,
): string {
  const catalog = effectCatalog(effects);
  const generated = `Generated${options.symbolPrefix}`;
  const refs = catalog.map(effect => kotlinEnumToken(effect.id));
  if (new Set(refs).size !== refs.length) throw new Error('effect ids collide as Kotlin enum tokens');
  const rows = catalog.map((effect, index) =>
    `        ${generated}EffectRef.${refs[index]} to ${generated}EffectPolicy(` +
    [effect.id, effect.input.id, effect.receipt.id, effect.identityField, effect.digestField]
      .map(kotlinStringLiteral).join(', ') +
    `, ${generated}EffectRetryIdentity.${kotlinEnumToken(effect.retry.identity)}, ` +
    `${generated}EffectUnknown.${kotlinEnumToken(effect.retry.unknown)}),`).join('\n');
  return `// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM ${options.sourceFile}
// Generator SHA-256: ${options.sourceSha}
package ${options.packageName}

enum class ${generated}EffectRef { ${refs.join(', ')} }
enum class ${generated}EffectOutcome { ${EFFECT_OUTCOMES.join(', ')} }
enum class ${generated}EffectRetryIdentity { SAME }
enum class ${generated}EffectUnknown { RETAIN }

data class ${generated}EffectPolicy(
    val id: String,
    val inputContractId: String,
    val receiptContractId: String,
    val identityField: String,
    val digestField: String,
    val retryIdentity: ${generated}EffectRetryIdentity,
    val unknown: ${generated}EffectUnknown,
)

object ${generated}Effects {
    val policies: Map<${generated}EffectRef, ${generated}EffectPolicy> = mapOf(
${rows}
    )
    fun policy(ref: ${generated}EffectRef): ${generated}EffectPolicy = policies.getValue(ref)
}
`;
}
