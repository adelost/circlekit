import { type LegoContract, registerContract, requireWireId, validateContract } from './node-model.js';
import { declarationSite, declaredSite, rememberCallsite } from './source-site.js';

export const EFFECT_OUTCOMES = Object.freeze(['CONFIRMED', 'FAILED', 'UNKNOWN'] as const);
export type EffectOutcome = (typeof EFFECT_OUTCOMES)[number];

/** Product definition only. Requests, attempts, receipts and secret bytes are runtime data. */
export interface EffectSpec {
  readonly id: string;
  readonly input: LegoContract;
  readonly receipt: LegoContract;
}

export type EffectDefinition<Spec extends EffectSpec = EffectSpec> = Spec & {
  readonly pattern: 'effect';
  readonly identityField: 'operationId';
  readonly digestField: 'inputSha256';
  readonly retry: Readonly<{ identity: 'same'; unknown: 'retain' }>;
  readonly outcomes: typeof EFFECT_OUTCOMES;
};

/** A retry can name the same operation only when its frozen input still matches. */
export function defineEffect<const Spec extends EffectSpec>(spec: Spec): EffectDefinition<Spec> {
  const name = typeof spec?.id === 'string' && spec.id ? spec.id : '<missing-id>';
  const fail = (field: string): never => {
    throw new Error(`defineEffect '${name}' needs ${field} [${declarationSite(defineEffect)}]`);
  };
  try { requireWireId(name, 'effect id'); } catch { fail('id'); }
  requireEnvelope(spec.input, 'input', 'event', fail);
  requireEnvelope(spec.receipt, 'receipt', 'receipt', fail);
  const effect = Object.freeze({ ...spec, pattern: 'effect' as const,
    identityField: 'operationId' as const, digestField: 'inputSha256' as const,
    retry: Object.freeze({ identity: 'same' as const, unknown: 'retain' as const }),
    outcomes: EFFECT_OUTCOMES });
  return rememberCallsite(effect, defineEffect);
}

/** A product has one declaration per outside-world effect. */
export function effectCatalog<const Effects extends readonly EffectDefinition[]>(effects: Effects): Readonly<Effects> {
  const seen = new Set<string>();
  const contracts = new Map<string, LegoContract>();
  for (const effect of effects) {
    if (seen.has(effect.id)) throw new Error(`effect '${effect.id}' is declared twice [${declaredSite(effect) ?? 'source unknown'}]`);
    seen.add(effect.id);
    try { registerContract(contracts, effect.input); registerContract(contracts, effect.receipt); }
    catch (error) { throw new Error(`${String(error)} [${declaredSite(effect) ?? 'source unknown'}]`); }
  }
  return Object.freeze([...effects]) as unknown as Readonly<Effects>;
}

function requireEnvelope(
  contract: LegoContract | undefined,
  role: 'input' | 'receipt',
  kind: 'event' | 'receipt',
  fail: (field: string) => never,
): void {
  if (!contract || !Array.isArray(contract.fields) || contract.boundary !== 'service-internal' ||
      (kind === 'event' ? contract.kind !== 'event' : !['event', 'snapshot'].includes(contract.kind))) fail(`${role}.contract`);
  try { validateContract(contract); }
  catch { fail(`${role}.contract`); }
  for (const fieldName of ['operationId', 'inputSha256']) {
    const field = contract.fields.find(item => item.name === fieldName);
    if (!field || field.value !== 'string' || field.nullable) fail(`${role}.${fieldName}`);
  }
}
