import type { LegoClockDomain, LegoPrimitive, LegoValueRef } from './node-model.js';
import { rememberCallsite } from './source-site.js';

/** WHAT: Defines field constraints. WHY: Keeps validation facts beside their authored field. */
export interface LegoFieldOptions {
  readonly unit?: string;
  readonly nullable?: boolean;
  /** The key may be absent, and a read keeps it absent: absent and null are two facts (leave as is, clear). */
  readonly optional?: boolean;
  readonly clockDomain?: LegoClockDomain;
  readonly min?: number;
  readonly max?: number;
  readonly gteField?: string;
}

/** WHAT: Carries portable field data. WHY: Keeps native projections independent of TypeScript inference. */
export interface LegoField {
  readonly name: string;
  readonly value: LegoPrimitive | LegoValueRef;
  readonly unit?: string;
  readonly nullable: boolean;
  readonly optional?: boolean;
  readonly clockDomain: LegoClockDomain;
  readonly min?: number;
  readonly max?: number;
  readonly gteField?: string;
}

type Defaulted<Options, Key extends PropertyKey, Default> = Key extends keyof Options
  ? Exclude<Options[Key], undefined> | (undefined extends Options[Key] ? Default : never)
  : Default;

/** A field carries `optional` only when it may be absent; a dynamic flag keeps both possibilities. */
type OptionalOf<Options> = 'optional' extends keyof Options
  ? Options extends { readonly optional: true } ? { readonly optional: true }
    : Options['optional' & keyof Options] extends false | undefined ? {} : { readonly optional?: boolean }
  : {};

/** Literal authoring survives into payload types; optional dynamic flags keep both possibilities. */
export type DeclaredField<Name extends string, Value extends LegoPrimitive | LegoValueRef,
  Options extends LegoFieldOptions> = Omit<LegoField, 'name' | 'value' | 'nullable' | 'clockDomain' | 'optional'> & {
    readonly name: Name;
    readonly value: Value;
    readonly nullable: Defaulted<Options, 'nullable', false>;
    readonly clockDomain: Defaulted<Options, 'clockDomain', 'none'>;
  } & OptionalOf<Options>;

/** WHAT: Returns authored field types. WHY: Avoids a second handwritten payload schema. */
export function field<const Name extends string, const Value extends LegoPrimitive | LegoValueRef,
  const Options extends LegoFieldOptions = {}>(
  name: Name, value: Value, options?: Options,
): DeclaredField<Name, Value, Options>;
/** WHAT: Builds the existing field record. WHY: Keeps inference changes out of emitted runtime data. */
export function field(name: string, value: LegoPrimitive | LegoValueRef, options: LegoFieldOptions = {}): LegoField {
  return rememberCallsite({
    name, value,
    nullable: options.nullable ?? false,
    clockDomain: options.clockDomain ?? 'none',
    ...(options.unit === undefined ? {} : { unit: options.unit }),
    ...(options.optional === true ? { optional: true } : {}),
    ...(options.min === undefined ? {} : { min: options.min }),
    ...(options.max === undefined ? {} : { max: options.max }),
    ...(options.gteField === undefined ? {} : { gteField: options.gteField }),
  }, field);
}
