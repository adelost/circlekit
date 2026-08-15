export type PreflightBriefingAvailability = "required" | "optional";

export type PreflightBriefingRule<
  MetricRef extends string = string,
  StateRef extends string = string,
  RampRef extends string = string,
> =
  | {
      readonly kind: "circular-delta";
      readonly metricRef: MetricRef;
      readonly minimumMagnitude: number;
      readonly deltaDeg: number;
    }
  | {
      readonly kind: "ramp-crossing";
      readonly metricRef: MetricRef;
      readonly rampRef: RampRef;
    }
  | {
      readonly kind: "state-projection";
      readonly stateRef: StateRef;
      readonly cautionValues: readonly string[];
      readonly abortValues: readonly string[];
    };

export interface PreflightBriefingDefinition<
  MetricRef extends string = string,
  StateRef extends string = string,
  RampRef extends string = string,
  IconRef extends string = string,
  CopyRef extends string = string,
> {
  readonly id: string;
  readonly label: string;
  readonly iconRef: IconRef;
  readonly copyRef: CopyRef;
  /** Data availability is orthogonal to whether the observed value is hazardous. */
  readonly availability: PreflightBriefingAvailability;
  readonly rule: PreflightBriefingRule<MetricRef, StateRef, RampRef>;
}

export interface PreflightBriefingCatalog<
  MetricRef extends string = string,
  StateRef extends string = string,
  RampRef extends string = string,
  IconRef extends string = string,
  CopyRef extends string = string,
> {
  readonly definitions: readonly PreflightBriefingDefinition<MetricRef, StateRef, RampRef, IconRef, CopyRef>[];
}

export function validatePreflightBriefingCatalog(catalog: PreflightBriefingCatalog): void {
  if (catalog.definitions.length === 0) throw new Error("preflight briefing catalog is empty");
  const ids = new Set<string>();
  for (const definition of catalog.definitions) {
    if (!/^[a-z][a-z0-9-]*$/u.test(definition.id)) {
      throw new Error(`preflight briefing id '${definition.id}' is not a wire id`);
    }
    if (ids.has(definition.id)) throw new Error(`duplicate preflight briefing id '${definition.id}'`);
    ids.add(definition.id);
    for (const [field, value] of [
      ["label", definition.label],
      ["iconRef", definition.iconRef],
      ["copyRef", definition.copyRef],
    ] as const) {
      if (value.trim() === "") throw new Error(`preflight briefing '${definition.id}' has empty ${field}`);
    }
    switch (definition.rule.kind) {
      case "circular-delta":
        finite(definition.rule.minimumMagnitude, definition.id, "minimumMagnitude");
        finite(definition.rule.deltaDeg, definition.id, "deltaDeg");
        if (definition.rule.minimumMagnitude < 0) {
          throw new Error(`preflight briefing '${definition.id}' minimumMagnitude must be non-negative`);
        }
        if (definition.rule.deltaDeg <= 0 || definition.rule.deltaDeg > 180) {
          throw new Error(`preflight briefing '${definition.id}' deltaDeg must be in (0, 180]`);
        }
        break;
      case "ramp-crossing":
        nonBlank(definition.rule.metricRef, definition.id, "metricRef");
        nonBlank(definition.rule.rampRef, definition.id, "rampRef");
        break;
      case "state-projection": {
        nonBlank(definition.rule.stateRef, definition.id, "stateRef");
        const caution = new Set(definition.rule.cautionValues);
        const abort = new Set(definition.rule.abortValues);
        if (caution.size !== definition.rule.cautionValues.length || abort.size !== definition.rule.abortValues.length) {
          throw new Error(`preflight briefing '${definition.id}' repeats a projected state value`);
        }
        if ([...caution].some((value) => abort.has(value))) {
          throw new Error(`preflight briefing '${definition.id}' projects one state as both caution and abort`);
        }
        [...caution, ...abort].forEach((value) => nonBlank(value, definition.id, "state value"));
        break;
      }
    }
  }
}

function finite(value: number, id: string, field: string): void {
  if (!Number.isFinite(value)) throw new Error(`preflight briefing '${id}' ${field} must be finite`);
}

function nonBlank(value: string, id: string, field: string): void {
  if (value.trim() === "") throw new Error(`preflight briefing '${id}' has empty ${field}`);
}
