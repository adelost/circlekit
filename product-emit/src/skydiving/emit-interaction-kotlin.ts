import { indent, kotlinEnumToken, kotlinIdentifier, kotlinStringLiteral } from "../core/kotlin-syntax.js";
import type {
  NormalizedContinuousInteractionIr,
  NormalizedDiscreteInteractionIr,
  NormalizedInteractionCatalogIr,
  NormalizedInteractionIr,
} from "./interaction-model.js";
import type { InteractionNativeSymbols } from "./native-symbols.js";

export interface InteractionKotlinEmissionOptions {
  readonly packageName: string;
  readonly objectName: string;
  readonly sourceSha: string;
  readonly nativeSymbols: InteractionNativeSymbols;
}

/** Typed constructors only: no runtime JSON, reflection, callbacks or free milliseconds. */
export function emitInteractionKotlin(ir: NormalizedInteractionCatalogIr, options: InteractionKotlinEmissionOptions): string {
  return `// GENERATED FILE — DO NOT EDIT
// AppSpec ${ir.appSpecVersion} · TypeScript-owned interactions · generator source ${options.sourceSha}
package ${options.packageName}

import com.adelost.designkit.ui.CircleActionTiming
import ${options.nativeSymbols.continuousInteractionContract}
import ${options.nativeSymbols.discreteInteractionContract}
import ${options.nativeSymbols.host}
import ${options.nativeSymbols.interactionCatalog}
import ${options.nativeSymbols.interactionControlId}
import ${options.nativeSymbols.interactionMount}
import ${options.nativeSymbols.interactionMountId}
import ${options.nativeSymbols.interactionPolicyHandle}
import ${options.nativeSymbols.interactionSource}
import ${options.nativeSymbols.settingId}

object ${options.objectName} {
${indent(ir.interactions.map((interaction) => `${source(interaction)}\nval ${kotlinName(interaction.controlId)} = ${emitInteraction(interaction)}`).join("\n\n"), 4)}

    val catalog = AppSpecInteractionCatalog(
        interactions = listOf(
${indent(ir.interactions.map((interaction) => kotlinName(interaction.controlId)).join(",\n"), 12)},
        ),
    )
}
`;
}

function emitInteraction(interaction: NormalizedInteractionIr): string {
  return interaction.kind === "discrete-action" ? emitDiscrete(interaction) : emitContinuous(interaction);
}

function emitDiscrete(interaction: NormalizedDiscreteInteractionIr): string {
  const settingLine = interaction.setting === undefined
    ? ""
    : `    settingId = AppSpecSettingId(${kotlinStringLiteral(interaction.setting.id)}),\n`;
  return `AppSpecDiscreteInteractionContract(
    controlId = AppSpecInteractionControlId(${kotlinStringLiteral(interaction.controlId)}),
    timing = CircleActionTiming.${kotlinEnumToken(interaction.timing)},
${settingLine}    mounts = ${mounts(interaction)},
    requiredHosts = ${hosts(interaction.requiredHosts)},
    source = ${sourceValue(interaction)},
)`;
}

function emitContinuous(interaction: NormalizedContinuousInteractionIr): string {
  return `AppSpecContinuousInteractionContract(
    controlId = AppSpecInteractionControlId(${kotlinStringLiteral(interaction.controlId)}),
    gesturePolicy = AppSpecInteractionPolicyHandle(${kotlinStringLiteral(interaction.gesturePolicy)}),
    endPolicy = AppSpecInteractionPolicyHandle(${kotlinStringLiteral(interaction.endPolicy)}),
    settlePolicy = AppSpecInteractionPolicyHandle(${kotlinStringLiteral(interaction.settlePolicy)}),
    accessibilityPolicy = AppSpecInteractionPolicyHandle(${kotlinStringLiteral(interaction.accessibilityPolicy)}),
    mounts = ${mounts(interaction)},
    requiredHosts = ${hosts(interaction.requiredHosts)},
    source = ${sourceValue(interaction)},
)`;
}

/**
 * `action.live-iso-reset-view` -> `LiveIsoResetView`.
 *
 * The leading `action`/`surface` word is the declaration's namespace, not part
 * of the name; dropping it is the only thing this adds to the shared rule.
 */
function kotlinName(controlId: string): string {
  const parts = controlId.split(/[^a-zA-Z0-9]+/u).filter(Boolean);
  if (parts[0] === "action" || parts[0] === "surface") parts.shift();
  return kotlinIdentifier(parts.join("-"));
}

function mounts(interaction: NormalizedInteractionIr): string {
  return `listOf(${interaction.mounts.map((mount) => `AppSpecInteractionMount(AppSpecInteractionMountId(${kotlinStringLiteral(mount.id)}), ${hosts(mount.requiredHosts)})`).join(", ")})`;
}

function hosts(values: readonly string[]): string {
  return `setOf(${values.map((host) => `AppSpecHost.${kotlinEnumToken(host)}`).join(", ")})`;
}

function source(interaction: NormalizedInteractionIr): string {
  return `// GENERATED FROM ${interaction.source.file}#${interaction.source.declarationId}`;
}

function sourceValue(interaction: NormalizedInteractionIr): string {
  return `AppSpecInteractionSource(${kotlinStringLiteral(interaction.source.file)}, ${kotlinStringLiteral(interaction.source.declarationId)})`;
}
