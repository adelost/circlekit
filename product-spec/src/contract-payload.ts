import type { LegoContract, LegoField, LegoFiniteValueDeclaration } from './node-model.js';

type FinitePayload<Id, Values extends readonly LegoFiniteValueDeclaration[]> =
  Extract<Values[number], { readonly id: Id }> extends infer Declaration
    ? [Declaration] extends [never] ? unknown
      : Declaration extends LegoFiniteValueDeclaration ? Declaration['values'][number] : unknown
    : unknown;

type FieldValue<Value, Values extends readonly LegoFiniteValueDeclaration[]> =
  Value extends 'number' | 'integer' ? number : Value extends 'boolean' ? boolean : Value extends 'string' ? string
    : Value extends { readonly finiteSet: true; readonly ref: infer Id } ? readonly FinitePayload<Id, Values>[]
      : Value extends { readonly contract: infer Nested extends LegoContract } ? ContractPayload<Nested, Values>
        : Value extends { readonly finite: true; readonly ref: infer Id } ? FinitePayload<Id, Values> : unknown;

type FieldPayload<Field extends LegoField, Values extends readonly LegoFiniteValueDeclaration[]> =
  FieldValue<Field['value'], Values> | (true extends Field['nullable'] ? null : never);

/** An optional key may be absent; a field that does not say so is always present. */
type MaybeAbsent<Field> = 'optional' extends keyof Field
  ? Field['optional' & keyof Field] extends false | undefined ? false : true
  : false;

type Fields<Contract extends LegoContract> = Contract['fields'][number];

/** Only authored names and checked values narrow. Opaque references and widened declarations stay unknown. */
export type ContractPayload<Contract extends LegoContract,
  Values extends readonly LegoFiniteValueDeclaration[] = readonly []> =
  string extends Fields<Contract>['name'] ? unknown
    : Contract['fields'] extends readonly [] ? unknown
      : Flat<{ readonly [Field in Fields<Contract> as MaybeAbsent<Field> extends true ? never : Field['name']]:
          FieldPayload<Field, Values> }
        & { readonly [Field in Fields<Contract> as MaybeAbsent<Field> extends true ? Field['name'] : never]?:
          FieldPayload<Field, Values> }>;

type Flat<Payload> = { [Key in keyof Payload]: Payload[Key] };
