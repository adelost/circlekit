import {
  type BodyAtomDeclaration,
  type BodyBaseType,
  type BodyNode,
  type BodyType,
  type BodyValue,
  type ComponentBodyDeclaration,
  validateComponentBody,
} from "./component-body-model.js";
import { indent } from "./kotlin-syntax.js";

export interface ComponentBodyKotlinTarget {
  readonly packageName: string;
  readonly functionName: string;
  readonly sourceFile: string;
  readonly sourceSha: string;
  /** The Kotlin spelling of every `native:<ref>` type the body uses. */
  readonly nativeTypes: Readonly<Record<string, Readonly<{ type: string; imports: readonly string[] }>>>;
  /** The Kotlin function that draws every declared atom. CircleKit's circle-text needs no entry. */
  readonly atomFunctions: Readonly<Record<string, Readonly<{ name: string; import: string }>>>;
}

const BUILT_IN_TYPES: Readonly<Record<Exclude<BodyBaseType, `native:${string}`>, Readonly<{ type: string; import?: string }>>> = {
  text: { type: "String" },
  flag: { type: "Boolean" },
  icon: { type: "ImageVector", import: "androidx.compose.ui.graphics.vector.ImageVector" },
  accent: { type: "CircleAccent", import: "com.adelost.designkit.ui.CircleAccent" },
  "choice-state": { type: "CircleChoiceState", import: "com.adelost.designkit.ui.CircleChoiceState" },
  color: { type: "Color", import: "androidx.compose.ui.graphics.Color" },
  dp: { type: "Dp", import: "androidx.compose.ui.unit.Dp" },
  float: { type: "Float" },
  event: { type: "() -> Unit" },
  "font-weight": { type: "FontWeight", import: "androidx.compose.ui.text.font.FontWeight" },
  "text-align": { type: "TextAlign", import: "androidx.compose.ui.text.style.TextAlign" },
};

const INK = { ink: "Ink", muted: "Muted", faint: "Faint" } as const;
const WEIGHT = { medium: "Medium", semibold: "SemiBold", bold: "Bold" } as const;

/**
 * Emit one composable that draws the declared body. Its parameters are the
 * body's inputs in declaration order, then `modifier`. The host keeps only the
 * mapping from its own state to those inputs.
 */
export function emitComponentBodyKotlin(
  declaration: ComponentBodyDeclaration,
  atoms: readonly BodyAtomDeclaration[],
  target: ComponentBodyKotlinTarget,
): string {
  validateComponentBody(declaration, atoms);
  const imports = new Set([
    "androidx.compose.foundation.layout.Arrangement",
    "androidx.compose.foundation.layout.Column",
    "androidx.compose.runtime.Composable",
    "androidx.compose.ui.Alignment",
    "androidx.compose.ui.Modifier",
    "com.adelost.designkit.ui.CircleText",
  ]);
  const emitter = new BodyKotlin(declaration, target, imports);
  const parameters = Object.entries(declaration.inputs)
    .map(([name, type]) => `    ${name}: ${emitter.type(type)},`)
    .join("\n");
  const phoneDesign = declaration.phoneDesignWhen === null ? "" : (() => {
    imports.add("com.adelost.designkit.ui.phoneSurfaceDesign");
    return `    val phoneDesign = if (${declaration.phoneDesignWhen}) phoneSurfaceDesign() else null\n`;
  })();
  const root = indent(emitter.node(declaration.root, "modifier"), 4);
  return `// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM ${target.sourceFile}
// Source SHA-256: ${target.sourceSha}
package ${target.packageName}

${[...imports].sort().map((name) => `import ${name}`).join("\n")}

/** The declared body of '${declaration.id}'. */
@Composable
internal fun ${target.functionName}(
${parameters}
    modifier: Modifier = Modifier,
) {
${phoneDesign}${root}
}
`;
}

class BodyKotlin {
  constructor(
    private readonly declaration: ComponentBodyDeclaration,
    private readonly target: ComponentBodyKotlinTarget,
    private readonly imports: Set<string>,
  ) {}

  type(type: BodyType): string {
    const base = type.base;
    const spelled = isNative(base) ? this.native(base.slice("native:".length)) : this.builtIn(base);
    return type.optional ? `${spelled}?` : spelled;
  }

  node(node: BodyNode, modifier: string): string {
    switch (node.kind) {
      case "column": {
        const filled = node.fillWhen === null ? modifier : this.filledWhen(modifier, node.fillWhen);
        return `Column(
    modifier = ${filled},
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.spacedBy(${this.value(node.spacing)}),
) {
${indent(this.children(node.children), 4)}
}`;
      }
      case "atom": {
        const name = this.atomFunction(node.atom);
        const args = Object.entries(node.props).map(([param, value]) => `    ${param} = ${this.value(value)},`).join("\n");
        return `${name}(\n${args}\n)`;
      }
      case "show-when":
        return `if (${node.flag}) {\n${indent(this.children(node.children), 4)}\n}`;
      case "with-present":
        return `if (${node.input} != null) {\n${indent(this.children(node.children), 4)}\n}`;
    }
  }

  value(value: BodyValue): string {
    switch (value.kind) {
      case "read":
        return value.name;
      case "literal":
        if (value.type === "dp") {
          this.imports.add("androidx.compose.ui.unit.dp");
          return `${value.value}.dp`;
        }
        return `${value.value}f`;
      case "ink":
        this.imports.add("com.adelost.designkit.ui.GraphiteTokens");
        return `GraphiteTokens.${INK[value.token]}`;
      case "font-weight":
        this.imports.add("androidx.compose.ui.text.font.FontWeight");
        return `FontWeight.${WEIGHT[value.weight]}`;
      case "text-align":
        this.imports.add("androidx.compose.ui.text.style.TextAlign");
        return "TextAlign.Center";
      case "first-present":
        return value.values.map((item) => this.value(item)).join(" ?: ");
      case "choose":
        return `if (${value.when}) ${this.value(value.then)} else ${this.value(value.otherwise)}`;
      case "accent-color":
        this.imports.add("com.adelost.designkit.ui.CircleAccentStrength");
        this.imports.add("com.adelost.designkit.ui.circleAccentColor");
        return `circleAccentColor(${this.value(value.accent)}, if (${value.activeWhen}) CircleAccentStrength.ACTIVE else CircleAccentStrength.INACTIVE)`;
      case "phone-metric": {
        const float = value.metric === "actionLabelSize" || value.metric === "actionSupportingSize";
        if (value.otherwise !== null) {
          return `phoneDesign?.${value.metric}${float ? "?.value" : ""} ?: ${this.value(value.otherwise)}`;
        }
        const read = `requireNotNull(phoneDesign).${value.metric}${float ? ".value" : ""}`;
        if (value.plus === 0) return read;
        return `${read} ${value.plus < 0 ? "-" : "+"} ${Math.abs(value.plus)}f`;
      }
    }
  }

  private filledWhen(modifier: string, fill: Readonly<{ flag: string; paddingVertical: BodyValue }>): string {
    this.imports.add("androidx.compose.foundation.layout.fillMaxWidth");
    this.imports.add("androidx.compose.foundation.layout.padding");
    const padded = `Modifier.fillMaxWidth().padding(vertical = ${this.value(fill.paddingVertical)})`;
    return `${modifier}.then(if (${fill.flag}) ${padded} else Modifier)`;
  }

  private children(nodes: readonly BodyNode[]): string {
    return nodes.map((child) => this.node(child, "Modifier")).join("\n");
  }

  private atomFunction(atom: string): string {
    if (atom === "circle-text") return "CircleText";
    const bound = this.target.atomFunctions[atom];
    if (bound === undefined) throw new Error(`component body '${this.declaration.id}' has no Kotlin function for atom '${atom}'`);
    this.imports.add(bound.import);
    return bound.name;
  }

  private native(ref: string): string {
    const bound = this.target.nativeTypes[ref];
    if (bound === undefined) throw new Error(`component body '${this.declaration.id}' has no Kotlin type for 'native:${ref}'`);
    bound.imports.forEach((name) => this.imports.add(name));
    return bound.type;
  }

  private builtIn(base: Exclude<BodyBaseType, `native:${string}`>): string {
    const spelled = BUILT_IN_TYPES[base];
    if (spelled.import !== undefined) this.imports.add(spelled.import);
    return spelled.type;
  }
}

function isNative(base: BodyBaseType): base is `native:${string}` {
  return base.startsWith("native:");
}
