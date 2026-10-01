/**
 * Kit-internal: what a field value is (a finite member, a nested record, a list) and every finite declaration a
 * contract names through its fields, lists and nested records. One walk, so every completeness check reads alike.
 * Not re-exported from index.ts.
 */
import type { LegoContract, LegoField, LegoFiniteValueRef } from './node-model.js';
import type { LegoContractRef, LegoListRef } from './contract-law-model.js';

type FieldValue = LegoField['value'];

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export const isFiniteRef = (value: FieldValue): value is LegoFiniteValueRef =>
  typeof value !== 'string' && 'finite' in value && value.finite === true;
export const isContractRef = (value: FieldValue): value is LegoContractRef =>
  typeof value !== 'string' && 'contract' in value && isRecord(value.contract);
export const isListRef = (value: FieldValue): value is LegoListRef => typeof value !== 'string' && 'list' in value;

/** The record a field nests, directly or as the element of its list. */
export const nestedOf = (value: FieldValue): LegoContract | undefined => isContractRef(value) ? value.contract
  : isListRef(value) && isContractRef(value.list) ? value.list.contract : undefined;

/** Every finite declaration a contract names, with the dotted path of the field that names it (`latest.scope`). */
export function finiteRefsOf(contract: LegoContract, prefix = '', seen = new Set<LegoContract>()):
  readonly { readonly path: string; readonly ref: string }[] {
  if (seen.has(contract)) return [];
  seen.add(contract);
  return contract.fields.flatMap(({ name, value }) => {
    const path = prefix === '' ? name : `${prefix}.${name}`, element = isListRef(value) ? value.list : value;
    if (isFiniteRef(element)) return [{ path, ref: element.ref }];
    const nested = nestedOf(value);
    return nested === undefined ? [] : finiteRefsOf(nested, path, seen);
  });
}
