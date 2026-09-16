# A settled receipt leaves on its own: 0.3.85 does not, 0.3.86 does

Owner: skyvw:2. Base: CircleKit 0.3.86 (273be46). Scope: `RingActionCueHost`'s
dwell, in RingKit, consumed by any product that mounts the shared centre cue.

## What is wrong in 0.3.85

`RingActionCueHost` gained the product's three cue shapes in 0.3.85, and with
them a dwell that skipped **every cue carrying a hint**:

```kotlin
if (scheduledCue.hint != null) return@LaunchedEffect   // 0.3.85
```

A cue with a hint is not necessarily an opened answer. A confirmation that
explains itself — a settings row that says what it just did — is still a
receipt, and in 0.3.85 that receipt never leaves: it stays on the face until
some later press takes the centre. The reader has to dismiss a card after every
tap on a row that has a sentence.

## The rule, from the product that had it right

Skyvw's own host, which this one replaced, cleared a receipt after its reading
window and waited only for an answer the reader had explicitly OPENED. 0.3.86
states that as a function instead of a condition buried in the effect:

```kotlin
internal fun ringCueDwellsOut(cue: CircleActionCue): Boolean = !cue.isInformation
```

`isInformation` is `lingers && hint != null`: the reader asked for it, so the
reader closes it. Everything else leaves on `cue.dwellMs`, which scales with
what the cue has to say (a bare pulse, a value, or a whole sentence).

## What an adopting product should do

**Pin 0.3.86 or newer if you mount `RingActionCueHost`.** 0.3.85 is published
and immutable, and a product that adopts the cue from it inherits the stuck
receipt with no way to override the host's dwell from outside.

`RingActionCueShapeTest` pins the rule, and it is red on the 0.3.85 condition.
