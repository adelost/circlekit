# Disabled action overrides its glyph colour

Mattias's live Link screenshot exposed a shared atom defect after0.3.62:
RingTextComposer correctly disabled an empty SEND, and CircleIconDisc dimmed its
contour, but the glyph still received its caller/default bright tint.

The existing CircleActionDiscChrome now resolves the glyph override alongside
its contour. Disabled always yields RingTokens.Off, whether the enabled colour
was implicit, white or semantic/custom. The actual CircleStyledIcon consumes
that resolved override for every layer. Enabled presentation and input/hold/send
behaviour are unchanged. No Link-specific branch or icon-default pigment table.

Existing CircleActionDiscChromeTest:2 cases,1 failed before the single state-law
change;2/2 green after. Its mutation inputs cover no override, white and coloured
override. Existing RingTextInputSpecTest2/2 and both Showcase release Kotlin
hosts compile. No new test file, snapshot/source scan or emulator matrix.

Native empty-SEND proof belongs to the current Link owner after consuming the
verified public0.3.63 pin; this source checkpoint is not that screenshot.

The same disabled-state law now reaches Compose semantics: circleSafeTap and
tap-or-hold retain either the explicit name or deliberately merged child name,
declare disabled, and expose no click actions. Disabled continuous-press control
also declares disabled. Enabled pointer/assistive actions are unchanged.
The existing accessibility test adds disabled assertions for named and merged
owners. Its Android test compilation is verified here; the actual named Link
empty/whitespace/nonempty proof remains with that consumer owner.

Publication note: the first0.3.63 staging process was stopped before deploy
(public RingKit63 HTTP404), so both fixes publish in ONE immutable coordinate.
No published payload is overwritten; the original staged APK is superseded by
the final merge build recorded in PROVENANCE.
