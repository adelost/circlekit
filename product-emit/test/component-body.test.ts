import assert from "node:assert/strict";
import test from "node:test";
import {
  body,
  emitComponentBodyKotlin,
  optional,
  required,
  type BodyAtomDeclaration,
  type ComponentBodyDeclaration,
  validateComponentBody,
} from "../src/core/index.js";

const iconAction: BodyAtomDeclaration = {
  id: "icon-action",
  params: {
    icon: required("icon"),
    description: optional("text"),
    onTap: required("event"),
    enabled: required("flag"),
    tint: required("color"),
    size: required("dp"),
    onPress: optional("native:press-feedback"),
  },
  defaulted: ["enabled", "onPress"],
};

const target = {
  packageName: "io.acme.generated",
  functionName: "GeneratedAcmeActionBody",
  sourceFile: "acme/action.ts",
  sourceSha: "abc",
  nativeTypes: { "press-feedback": { type: "(PressState?) -> Unit", imports: ["io.acme.ui.PressState"] } },
  atomFunctions: { "icon-action": { name: "IconAction", import: "io.acme.ui.IconAction" } },
} as const;

const action: ComponentBodyDeclaration = {
  id: "acme-action",
  inputs: {
    wide: required("flag"),
    icon: required("icon"),
    label: required("text"),
    status: optional("text"),
    hint: optional("text"),
    enabled: required("flag"),
    accent: required("accent"),
    narrowSize: required("dp"),
    onTap: required("event"),
    onPress: required("native:press-feedback"),
  },
  phoneDesignWhen: "wide",
  root: body.column(body.phone("actionTextGap", { otherwise: body.dp(5) }), [
    body.atom("icon-action", {
      icon: body.read("icon"),
      description: body.firstPresent(body.read("status"), body.read("hint"), body.read("label")),
      onTap: body.read("onTap"),
      enabled: body.read("enabled"),
      tint: body.accentColor(body.read("accent"), "enabled"),
      size: body.phone("actionDiameter", { otherwise: body.read("narrowSize") }),
      onPress: body.read("onPress"),
    }),
    body.showWhen("wide", [
      body.atom("circle-text", {
        text: body.read("label"),
        color: body.choose("enabled", body.ink("ink"), body.ink("muted")),
        fontSizeSp: body.phone("actionLabelSize"),
        fontWeight: body.weight("bold"),
        letterSpacingSp: body.float(0.55),
        lineHeightSp: body.phone("actionLabelSize", { plus: 2 }),
        textAlign: body.center(),
      }),
      body.withPresent("status", [
        body.atom("circle-text", {
          text: body.read("status"),
          color: body.ink("muted"),
          fontSizeSp: body.phone("actionLabelSize", { plus: -1 }),
        }),
      ]),
    ]),
  ], { flag: "wide", paddingVertical: body.phone("actionPaddingVertical") }),
};

test("a declared body emits the composable it describes, reading the phone design only where it exists", () => {
  assert.equal(emitComponentBodyKotlin(action, [iconAction], target), `// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM acme/action.ts
// Source SHA-256: abc
package io.acme.generated

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.adelost.designkit.ui.CircleAccent
import com.adelost.designkit.ui.CircleAccentStrength
import com.adelost.designkit.ui.CircleText
import com.adelost.designkit.ui.GraphiteTokens
import com.adelost.designkit.ui.circleAccentColor
import com.adelost.designkit.ui.phoneSurfaceDesign
import io.acme.ui.IconAction
import io.acme.ui.PressState

/** The declared body of 'acme-action'. */
@Composable
internal fun GeneratedAcmeActionBody(
    wide: Boolean,
    icon: ImageVector,
    label: String,
    status: String?,
    hint: String?,
    enabled: Boolean,
    accent: CircleAccent,
    narrowSize: Dp,
    onTap: () -> Unit,
    onPress: (PressState?) -> Unit,
    modifier: Modifier = Modifier,
) {
    val phoneDesign = if (wide) phoneSurfaceDesign() else null
    Column(
        modifier = modifier.then(if (wide) Modifier.fillMaxWidth().padding(vertical = requireNotNull(phoneDesign).actionPaddingVertical) else Modifier),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(phoneDesign?.actionTextGap ?: 5.dp),
    ) {
        IconAction(
            icon = icon,
            description = status ?: hint ?: label,
            onTap = onTap,
            enabled = enabled,
            tint = circleAccentColor(accent, if (enabled) CircleAccentStrength.ACTIVE else CircleAccentStrength.INACTIVE),
            size = phoneDesign?.actionDiameter ?: narrowSize,
            onPress = onPress,
        )
        if (wide) {
            CircleText(
                text = label,
                color = if (enabled) GraphiteTokens.Ink else GraphiteTokens.Muted,
                fontSizeSp = requireNotNull(phoneDesign).actionLabelSize.value,
                fontWeight = FontWeight.Bold,
                letterSpacingSp = 0.55f,
                lineHeightSp = requireNotNull(phoneDesign).actionLabelSize.value + 2f,
                textAlign = TextAlign.Center,
            )
            if (status != null) {
                CircleText(
                    text = status,
                    color = GraphiteTokens.Muted,
                    fontSizeSp = requireNotNull(phoneDesign).actionLabelSize.value - 1f,
                )
            }
        }
    }
}
`);
});

test("a body that says something it cannot draw is refused before any Kotlin exists", () => {
  const refused = (why: RegExp, root: ComponentBodyDeclaration["root"]) =>
    assert.throws(() => validateComponentBody({ ...action, root }, [iconAction]), why);
  const text = (props: Parameters<typeof body.atom>[1]) => body.column(body.dp(4), [body.atom("circle-text", props)]);
  const readable = { text: body.read("label"), color: body.ink("ink"), fontSizeSp: body.float(9) };

  // An input nobody declared.
  refused(/reads undeclared input 'title'/, text({ ...readable, text: body.read("title") }));
  // The phone design outside the flag that makes it exist, with nothing to fall back to.
  refused(/outside 'wide' with no otherwise/, text({ ...readable, fontSizeSp: body.phone("actionLabelSize") }));
  // An optional value where the atom needs one.
  refused(/passes optional text to 'circle-text.text'/, text({ ...readable, text: body.read("status") }));
  // A required parameter left out.
  refused(/without 'fontSizeSp'/, text({ text: body.read("label"), color: body.ink("ink") }));
  // An atom nobody declared.
  refused(/undeclared atom 'slider'/, body.column(body.dp(4), [body.atom("slider", {})]));
  // Unwrapping an input that is never absent.
  refused(/unwraps 'label'/, body.column(body.dp(4), [body.withPresent("label", [])]));
  // Adding to a dp.
  refused(/adds to phone 'actionTextGap'/, body.column(body.phone("actionTextGap", { otherwise: body.dp(5), plus: 1 }), []));

  assert.doesNotThrow(() => validateComponentBody(action, [iconAction]));
});
