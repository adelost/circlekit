import { kotlinStringLiteral } from "../core/kotlin-syntax.js";
import type { SourcedKotlinEmissionOptions } from "../core/emission-options.js";
import type {
  JumpTagCatalogEmission,
  JumpTagDefinitionEmission,
  JumpTagRuleEmission,
} from "./jump-tag-model.js";

/** Emits one product-prefixed Kotlin catalog from declared skydiving tag data. */
export function emitJumpTagsKotlin(
  input: JumpTagCatalogEmission,
  options: SourcedKotlinEmissionOptions,
): string {
  const g = `Generated${options.symbolPrefix}`;
  const categories = input.axes.map(({ id }) => id);
  const shapes = unique(input.tags.map(({ shape }) => shape));
  const edits = unique(input.tags.map(({ edit }) => edit));
  const icons = unique(input.tags.map(({ icon }) => icon));
  const tones = unique(input.tags.map(({ tone }) => tone));
  const definitions = input.tags.map((item) => emitDefinition(item, g)).join(`,
`);
  const axes = input.axes.map(({ id, label }) => `        ${g}JumpTagAxis(${q(id)}, ${q(label)})`).join(`,
`);
  const quickAdd = input.tags.filter(({ quickAdd }) => quickAdd === true).map(({ id }) => q(id)).join(", ");
  const aiEditable = input.tags.filter(({ edit }) => edit === "USER_EDITABLE").map(({ id }) => q(id)).join(", ");
  const eventIds = input.tags.filter(({ shape }) => shape === "EVENT").map(({ id }) => q(id)).join(", ");
  return `// Generated from ${options.sourceFile} · ${options.sourceSha}
package ${options.packageName}

enum class ${g}JumpTagCategory { ${categories.join(", ")} }
enum class ${g}JumpTagShape { ${shapes.join(", ")} }
enum class ${g}JumpTagEdit { ${edits.join(", ")} }
enum class ${g}JumpTagIcon { ${icons.join(", ")} }
enum class ${g}JumpTagTone { ${tones.join(", ")} }
enum class ${g}JumpTagEvidenceMetric { ${input.evidenceMetrics.join(", ")} }

data class ${g}JumpTagAxis(val id: String, val label: String)
sealed interface ${g}JumpTagRule {
    data class SinkBand(val metric: ${g}JumpTagEvidenceMetric, val min: Float, val max: Float, val minCoverage: Float) : ${g}JumpTagRule
    data class SinkUncertain(val metric: ${g}JumpTagEvidenceMetric, val ranges: List<ClosedFloatingPointRange<Float>>, val minCoverage: Float) : ${g}JumpTagRule
    data class BodyDrive(val metric: ${g}JumpTagEvidenceMetric, val min: Float) : ${g}JumpTagRule
    data class HopNPop(val minFallbackPeakM: Float, val maxExitM: Float, val maxFreefallS: Long) : ${g}JumpTagRule
    data class AtLeast(val metric: ${g}JumpTagEvidenceMetric, val value: Float) : ${g}JumpTagRule
    data class FiniteAny(val metric: ${g}JumpTagEvidenceMetric, val values: Set<String>) : ${g}JumpTagRule
    data class Range(val metric: ${g}JumpTagEvidenceMetric, val min: Float?, val max: Float?) : ${g}JumpTagRule
    data class PersonalExtreme(val metric: ${g}JumpTagEvidenceMetric, val direction: String, val minSamples: Int) : ${g}JumpTagRule
    data class Rotation(val metric: ${g}JumpTagEvidenceMetric, val moment: String, val axis: String?, val minTurns: Float, val maxSecondsPerTurn: Float) : ${g}JumpTagRule
    data class LandingBands(val metric: ${g}JumpTagEvidenceMetric, val values: Set<String>) : ${g}JumpTagRule
}

data class ${g}JumpTagDefinition(
    val id: String,
    val label: String,
    val category: ${g}JumpTagCategory,
    val shape: ${g}JumpTagShape,
    val edit: ${g}JumpTagEdit,
    val icon: ${g}JumpTagIcon,
    val tone: ${g}JumpTagTone,
    val exclusiveGroup: String?,
    val autoChoosesOne: String?,
    val quickAdd: Boolean,
    val suggest: ${g}JumpTagRule?,
    val unlessAnyDecided: Set<String>,
)

enum class ${g}JumpAiOperation { ${input.ai.operations.join(", ")} }
enum class ${g}JumpAiRejectionLiveness { EDIT_SNAPSHOT }
enum class ${g}JumpNoteMode { REPLACE, APPEND }
data class ${g}JumpAiTagRef(val id: String, val atMs: Long?)
data class ${g}JumpRosterPerson(val personId: String?, val displayNameSnapshot: String)
data class ${g}JumpRosterPatch(val groupSize: Int?, val people: List<${g}JumpRosterPerson>)
data class ${g}JumpNotePatch(val mode: ${g}JumpNoteMode, val text: String)
data class ${g}JumpAiPatch(
    val addTags: List<${g}JumpAiTagRef> = emptyList(),
    val removeUserTagIds: Set<String> = emptySet(),
    val rejectTags: List<${g}JumpAiTagRef> = emptyList(),
    val roster: ${g}JumpRosterPatch? = null,
    val note: ${g}JumpNotePatch? = null,
)
data class ${g}JumpAiEditSnapshot(
    val detectedSuggestions: Set<${g}JumpAiTagRef>,
    val jumpStartMs: Long,
    val jumpEndMs: Long,
    val allowedEventTimesMs: Set<Long>,
)
data class ${g}JumpAiValidation(val errors: List<String>) {
    val valid: Boolean get() = errors.isEmpty()
}

object ${g}JumpTags {
    const val MAX_GROUP_SIZE: Int = ${input.roster.maxGroupSize}
    const val MAX_NAME_CHARS: Int = ${input.roster.maxNameChars}
    const val MAX_AI_INSTRUCTION_CHARS: Int = ${input.ai.maxInstructionChars}
    const val MAX_NOTE_CHARS: Int = ${input.ai.maxNoteChars}
    val AI_REJECTION_LIVENESS = ${g}JumpAiRejectionLiveness.${input.ai.rejectionLiveness}
    val AXES: List<${g}JumpTagAxis> = listOf(
${axes}
    )
    val ALL: List<${g}JumpTagDefinition> = listOf(
${definitions}
    )
    val BY_ID: Map<String, ${g}JumpTagDefinition> = ALL.associateBy { it.id }
    val QUICK_ADD_CANDIDATE_IDS: List<String> = listOf(${quickAdd})
    val AI_EDITABLE_IDS: Set<String> = setOf(${aiEditable})
    val EVENT_IDS: Set<String> = setOf(${eventIds})
    val AI_OPERATIONS: Set<${g}JumpAiOperation> = setOf(${input.ai.operations.map((item) => `${g}JumpAiOperation.${item}`).join(", ")})

    /** Candidate ids are offers only: this API has no state-writing return type. */
    fun quickAddCandidateIds(): List<String> = QUICK_ADD_CANDIDATE_IDS

    /** Validates one atomic patch against the immutable edit snapshot. */
    fun validateAiPatch(patch: ${g}JumpAiPatch, snapshot: ${g}JumpAiEditSnapshot): ${g}JumpAiValidation {
        val errors = mutableListOf<String>()
        val addedIds = patch.addTags.map { it.id }
        if (patch.addTags.size != patch.addTags.toSet().size) errors += "A tag occurrence may be added only once per patch"
        patch.addTags.forEach { ref ->
            val definition = BY_ID[ref.id]
            if (definition == null) errors += "Unknown tag: \${ref.id}"
            else if (definition.edit != ${g}JumpTagEdit.USER_EDITABLE) errors += "Tag is derived: \${ref.id}"
            else if (definition.shape == ${g}JumpTagShape.EVENT && ref.atMs == null) errors += "Event tag requires time: \${ref.id}"
            else if (definition.shape == ${g}JumpTagShape.WHOLE_JUMP && ref.atMs != null) errors += "Whole-jump tag cannot carry time: \${ref.id}"
            else if (ref.atMs != null && ref.atMs !in snapshot.jumpStartMs..snapshot.jumpEndMs) errors += "Event time is outside this jump: \${ref.id}"
            else if (ref.atMs != null && ref.atMs !in snapshot.allowedEventTimesMs) errors += "Event time is not on the derived jump timeline: \${ref.id}"
        }
        patch.removeUserTagIds.forEach { id ->
            if (id !in AI_EDITABLE_IDS) errors += "Tag cannot be removed by AI edit: \${id}"
        }
        if (patch.rejectTags.size != patch.rejectTags.toSet().size) errors += "A tag occurrence may be rejected only once per patch"
        patch.rejectTags.forEach { ref ->
            val definition = BY_ID[ref.id]
            if (definition == null) errors += "Unknown tag: \${ref.id}"
            else if (ref.id !in AI_EDITABLE_IDS) errors += "Tag cannot be rejected by AI edit: \${ref.id}"
            else if (definition.shape == ${g}JumpTagShape.EVENT && ref.atMs == null) errors += "Event rejection requires time: \${ref.id}"
            else if (definition.shape == ${g}JumpTagShape.WHOLE_JUMP && ref.atMs != null) errors += "Whole-jump rejection cannot carry time: \${ref.id}"
            // Liveness belongs to the captured snapshot; never recompute after another operation changes it.
            else if (ref !in snapshot.detectedSuggestions) errors += "Tag occurrence was not detected in this edit snapshot: \${ref.id}"
        }
        val contradictory = addedIds.toSet() intersect (patch.removeUserTagIds + patch.rejectTags.map { it.id })
        if (contradictory.isNotEmpty()) errors += "Contradictory tag operations: \${contradictory.sorted().joinToString()}"
        patch.roster?.let { roster ->
            if (roster.groupSize == null && roster.people.isNotEmpty()) errors += "People require a group size"
            if (roster.groupSize != null && roster.groupSize !in ${input.roster.minGroupSize}..MAX_GROUP_SIZE) errors += "Group size is outside the declared range"
            if (roster.groupSize == 1 && roster.people.isNotEmpty()) errors += "A solo jump cannot list other people"
            if (roster.groupSize != null && roster.people.size > roster.groupSize - 1) errors += "More names than other people in the group"
            if (roster.people.any { it.displayNameSnapshot.isBlank() || it.displayNameSnapshot.length > MAX_NAME_CHARS }) errors += "A roster name is empty or too long"
            if (roster.people.any { it.personId != null }) errors += "AI cannot invent local person ids"
            val knownIds = roster.people.mapNotNull { it.personId }
            if (knownIds.size != knownIds.toSet().size) errors += "The same known person appears twice"
        }
        if (patch.note?.text?.length?.let { it > MAX_NOTE_CHARS } == true) errors += "Note is too long"
        return ${g}JumpAiValidation(errors)
    }
}
`;
}

function emitDefinition(item: JumpTagDefinitionEmission, g: string): string {
  return `        ${g}JumpTagDefinition(${[
    q(item.id), q(item.label), `${g}JumpTagCategory.${item.category}`,
    `${g}JumpTagShape.${item.shape}`, `${g}JumpTagEdit.${item.edit}`,
    `${g}JumpTagIcon.${item.icon}`, `${g}JumpTagTone.${item.tone}`,
    nullableQ(item.exclusiveGroup), nullableQ(item.autoChoosesOne), String(item.quickAdd === true),
    emitRule(item.suggest, g), setOf(item.unlessAnyDecided ?? []),
  ].join(", ")})`;
}

function emitRule(rule: JumpTagRuleEmission | undefined, g: string): string {
  if (rule === undefined) return "null";
  switch (rule.kind) {
    case "sink-band": return `${g}JumpTagRule.SinkBand(${g}JumpTagEvidenceMetric.${rule.metric}, ${f(rule.min)}, ${f(rule.max)}, ${f(rule.minCoverage)})`;
    case "sink-uncertain": return `${g}JumpTagRule.SinkUncertain(${g}JumpTagEvidenceMetric.${rule.metric}, listOf(${rule.ranges.map(([min, max]) => `${f(min)}..${f(max)}`).join(", ")}), ${f(rule.minCoverage)})`;
    case "body-drive": return `${g}JumpTagRule.BodyDrive(${g}JumpTagEvidenceMetric.${rule.metric}, ${f(rule.min)})`;
    case "hop-n-pop": return `${g}JumpTagRule.HopNPop(${f(rule.minFallbackPeakM)}, ${f(rule.maxExitM)}, ${rule.maxFreefallS}L)`;
    case "at-least": return `${g}JumpTagRule.AtLeast(${g}JumpTagEvidenceMetric.${rule.metric}, ${f(rule.value)})`;
    case "finite-any": return `${g}JumpTagRule.FiniteAny(${g}JumpTagEvidenceMetric.${rule.metric}, ${setOf(rule.values)})`;
    case "range": return `${g}JumpTagRule.Range(${g}JumpTagEvidenceMetric.${rule.metric}, ${nullableF(rule.min)}, ${nullableF(rule.max)})`;
    case "personal-extreme": return `${g}JumpTagRule.PersonalExtreme(${g}JumpTagEvidenceMetric.${rule.metric}, ${q(rule.direction)}, ${rule.minSamples})`;
    case "rotation": return `${g}JumpTagRule.Rotation(${g}JumpTagEvidenceMetric.${rule.metric}, ${q(rule.moment)}, ${nullableQ(rule.axis ?? undefined)}, ${f(rule.minTurns)}, ${f(rule.maxSecondsPerTurn)})`;
    case "landing-bands": return `${g}JumpTagRule.LandingBands(${g}JumpTagEvidenceMetric.${rule.metric}, ${setOf(rule.values)})`;
  }
}

function unique<T>(values: readonly T[]): readonly T[] { return [...new Set(values)]; }
function q(value: string): string { return kotlinStringLiteral(value); }
function nullableQ(value: string | undefined): string { return value === undefined ? "null" : q(value); }
function f(value: number): string { return `${Number.isInteger(value) ? value.toFixed(1) : value}f`; }
function nullableF(value: number | undefined): string { return value === undefined ? "null" : f(value); }
function setOf(values: readonly string[]): string { return values.length === 0 ? "emptySet()" : `setOf(${values.map(q).join(", ")})`; }
