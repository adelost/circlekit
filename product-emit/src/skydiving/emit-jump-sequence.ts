import { kotlinStringLiteral } from "../core/kotlin-syntax.js";
import type { JumpSequenceRuleEmission } from "./jump-tag-model.js";

/** WHAT: Builds typed native stages from validated bounded sequence data.
 * WHY: Prevents empty matches, invalid durations and non-finite thresholds from reaching product code. */
export function emitJumpSequence(rule: JumpSequenceRuleEmission, g: string): string {
  requireThat(Number.isInteger(rule.version) && rule.version > 0, "version");
  requireThat(Number.isInteger(rule.requiredTracks) && rule.requiredTracks >= 1 && rule.requiredTracks <= 2, "track count");
  requireThat(Number.isSafeInteger(rule.maxGapMs) && rule.maxGapMs > 0, "sample gap");
  requireThat(Number.isSafeInteger(rule.maxTransitionMs) && rule.maxTransitionMs >= 0, "transition gap");
  requireThat(rule.paths.length >= 1 && rule.paths.length <= 8, "path count");
  const paths = rule.paths.map(path => {
    requireThat(path.length >= 1 && path.length <= 8, "stage count");
    requireThat(new Set(path.map(s => s.id)).size === path.length, "duplicate stage");
    return `listOf(${path.map(stage => {
      requireThat(stage.id.length > 0, "stage identity");
      requireThat(Number.isSafeInteger(stage.minDurationMs) && stage.minDurationMs > 0, "stage duration");
      requireThat(stage.conditions.length >= 1 && stage.conditions.length <= 24, "conditions");
      requireThat(new Set(stage.conditions.map(c => c.metric)).size === stage.conditions.length, "duplicate condition");
      const conditions = stage.conditions.map(condition => {
        requireThat(/^[A-Z][A-Z0-9_]*$/u.test(condition.metric), "metric identity");
        requireThat(condition.min !== undefined || condition.max !== undefined, "unbounded condition");
        requireThat(condition.min === undefined || Number.isFinite(condition.min), "minimum");
        requireThat(condition.max === undefined || Number.isFinite(condition.max), "maximum");
        requireThat(condition.min === undefined || condition.max === undefined || condition.min <= condition.max, "reversed range");
        return `${g}SequenceCondition(${g}JumpTagEvidenceMetric.${condition.metric}, ${float(condition.min)}, ${float(condition.max)})`;
      });
      return `${g}SequenceStage(${kotlinStringLiteral(stage.id)}, ${stage.minDurationMs}L, listOf(${conditions.join(", ")}))`;
    }).join(", ")})`;
  });
  return `${g}JumpTagRule.Sequence(${rule.version}, ${rule.requiredTracks}, ${rule.maxGapMs}L, ${rule.maxTransitionMs}L, listOf(${paths.join(", ")}))`;
}

function float(value: number | undefined): string {
  return value === undefined ? "null" : `${Number.isInteger(value) ? value.toFixed(1) : value}f`;
}

function requireThat(condition: boolean, detail: string): asserts condition {
  if (!condition) throw new Error(`Invalid sequence: ${detail}`);
}
