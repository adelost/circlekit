import type { LegoContract, LegoField, LegoFiniteValueDeclaration } from './node-model.js';

type FinitePayload<Id, Values extends readonly LegoFiniteValueDeclaration[]> =
  Extract<Values[number], { readonly id: Id }> extends infer Declaration
    ? [Declaration] extends [never] ? unknown
      : Declaration extends LegoFiniteValueDeclaration ? Declaration['values'][number] : unknown
    : unknown;

type FieldValue<Value, Values extends readonly LegoFiniteValueDeclaration[]> =
  Value extends 'number' | 'integer' ? number : Value extends 'boolean' ? boolean
    : Value extends 'string' ? string
      : Value extends { readonly finiteSet: true; readonly ref: infer Id } ? readonly FinitePayload<Id, Values>[]
        : Value extends { readonly finite: true; readonly ref: infer Id } ? FinitePayload<Id, Values> : unknown;

type FieldPayload<Field extends LegoField, Values extends readonly LegoFiniteValueDeclaration[]> =
  FieldValue<Field['value'], Values> | (true extends Field['nullable'] ? null : never);

/** Only authored names and checked values narrow. Opaque references and widened declarations stay unknown. */
export type ContractPayload<Contract extends LegoContract,
  Values extends readonly LegoFiniteValueDeclaration[] = readonly []> =
  string extends Contract['fields'][number]['name'] ? unknown
    : Contract['fields'] extends readonly [] ? unknown
      : { readonly [Field in Contract['fields'][number] as Field['name']]: FieldPayload<Field, Values> };
