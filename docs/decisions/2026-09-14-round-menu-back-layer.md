# Round menus: back is its own layer, row text is sized for the smallest watch

Owner: lsrc:0. Base: CircleKit 0.3.81 (6006a8c). Scope: shared round menu
chrome and row typography in DesignKit/RingKit, consumed by Agentmux Link and
Skyvw through a version bump.

## Request (Mattias, verbatim)

2026-09-14 21:45, about Link 1.2.17 in round watch preview on his phone:

> "Hm, finns inga riktig bakknapp i Dev Host eller liknande liksom. Om du förstår problemet. Eh, ja, så frågan är vad man ska göra där helt enkelt."

2026-09-14 21:47:

> "Försök gärna fixa även i DSL:et att menyerna inte ska hoppa så här liksom. Eh, bakknappen ska väl vara ett eget lager så att de andra meny-itemsen ska inte tryckas undan så pass mycket helst, utan försök och lösa det på något snyggt sätt så att det, ja. Och sen vet jag, kan texten vara mindre på menyerna också? Hoppas inte det förstör någonting med resten utav UX:en men de är lite större än vad de borde vara just nu. De kan faktiskt vara mindre så att man kan få plats mer på klockan. Jag tror fortfarande det är läsbart även om det är mindre. Det är ju ändå rätt mycket information som ska visas och annars har man ju knapparna som guidelines, men försök ändå räkna ut vad som hade varit optimal storlek men ändå tillåta dig att läsa bättre. Och detta ska ju vara i DSL:et så att det kommer ju vara likadant även för Skive. Det detta är ett gemensamt problem som vi har."

What the requests establish: a visible back on DEV HOST, rows that do not
jump or get pushed aside by back, smaller row text chosen by calculation, and
all of it in the shared kit. Everything below marked "Choice (lsrc:0)" is my
decision, not Mattias's.

## Findings at 0.3.81

- `RingRoundBackHost` mounts X at `HOUR_9` and publishes it through
  `LocalRoundChromeReservation`. On the 192 dp canon the 48 dp hit target
  claims the left edge down to x = 49.1 dp, so an action row keeps
  124.9 dp instead of 155.9 dp and its text column 82.9 dp instead of
  113.9 dp (27 % narrower). "DISPLAY PREVIEW" and "Up to date · v1.2.17"
  wrap or clip there.
- Passive readings (`multiline` information rows) avoided that tax by
  shifting each measured line sideways only while it passed the X
  (`CircleReadingTitle`, `readingValueClearance`, `readingInkShiftDp`).
  Scrolling therefore moves their text left and right: the jump.
- `RenderRingScreen` never paints a round back ("Product-level X@9 owns
  visible round back navigation"). Link's DEV HOST route renders it without a
  back host, so WATCH EXACT on a phone has no visible escape.

## Choice (lsrc:0): a fixed top escape layer

The shared round back is a `BackRing` fixed at 12 o'clock, centre 24 dp from
the canvas top, over a canvas-coloured cap that is opaque behind the ring
(to 39 dp) and fades out at 45 dp. The screen title moves below it (title top
43 dp, letters from 45.4 dp). Rows scroll under the cap and
fade before they reach the control. The layer reserves no rim slot, so every
row keeps one stable, circle-only straight edge and nothing moves sideways.

Why the top, measured on the 192 dp canon:

- It is the only rim position that costs rows no width. Any side slot
  (9, 10, 11 o'clock) intersects the scrolling row band and must be paid
  either by every row (27 % text column) or per row (the jump).
- The circle is already narrow there: at y = 9 dp the half chord is 40.6 dp,
  so the 30 dp ring fits with 25 dp of glass on each side, and the whole 48 dp
  target (y 0..48) lies on the canvas. The cost is vertical: the first row's
  letters start 16.6 dp lower at rest (73.5 vs 56.9 dp, measured), but by the
  third row the list is 8 dp ahead because rows no longer wrap.
- It is where a reader looks first and reads as the page header, and it uses
  the existing `BackRing` atom: one back glyph on Phone and Round, declared
  label, 48 dp target, existing accessibility tests.
- Bottom (the Wear primary-action position) was rejected: back is not the
  primary action and the last row would scroll under it.

Who paints it (choice, lsrc:0): `RenderRingScreen` on ROUND paints the layer
whenever the phone renderer would show a back for the same screen
(`Rows.showBack`, every other case), unless a host above already owns the
escape: `RingRoundBackHost` (shared) or a product shell that publishes a rim
reservation (Skyvw's X@9/X@10 shells). Back pops the navigator, then calls
`onExit`, exactly like the phone header. The DEV HOST screen gets its back
this way with no Link code change.

Per-line reading shifts are removed. A host that still mounts side chrome
gets one stable, reservation-aware straight edge for every row kind.

## Choice (lsrc:0): row text sizes, derived

The round canvas is always 192 logical dp, scaled to the physical face, so the
smallest face is the worst case for letter size.

Model and assumptions:

- Smallest supported face 1.2 in (30.48 mm) drawn as 192 dp:
  0.1587 mm per canvas dp. A 1.4 in face gives 0.1852 mm (17 % larger).
- Viewing distance 300 mm: 1 arcmin = 0.0873 mm.
- Onest metrics from `res/font/onest.ttf` OS/2: cap height 0.707 em,
  x-height 0.527 em. At 1.2 in and 300 mm, 1 sp gives 1.286' cap height and
  0.959' x-height.
- Floors (choice, lsrc:0): a row title is a short bold uppercase identity read
  at a glance, so its cap height must reach 12'. A row value carries mixed
  case, so its x-height must reach 8'. For reference, display ergonomics
  guidance (ISO 9241-3/-303, MIL-STD-1472, quoted from memory, not
  re-verified) puts continuous reading text at 16' cap height, 20..22'
  preferred, and short non-critical labels around 10..12'. 20/20 letter
  recognition is 5', so 12' keeps a 2.4x acuity reserve.
- Rendering margin 5 %, then round up to the 0.5 sp grid. CircleKit type does
  not follow Android font scale (`circleFixedSp` divides it out), so the floor
  has to hold without an OS escape hatch.

| Token | Old | Letter size old | Floor (+5 %) | New | Letter size new |
|---|---|---|---|---|---|
| `MenuDesign.titleSize` | 11 sp | 14.1' cap | 9.80 sp | 10 sp | 12.9' cap |
| `MenuDesign.titleSizeNoIcon` | 12 sp | 15.4' cap | title + 1 sp | 11 sp | 14.1' cap |
| `MenuDesign.subSize` | 9.5 sp | 9.1' x | 8.76 sp | 9 sp | 8.6' x |

The +1 sp for icon-less titles is the existing relation, kept. The tokens are
computed in `CircleGlanceLegibility`, so changing a floor or the face changes
every row consistently. The fitted title's emergency shrink floor (7.5 sp) is
unchanged and only applies when a title still does not fit.

Width effect on the 192 dp canon: the row text column grows from 82.9 dp to
113.9 dp (back layer) and each glyph is 9 % (title) and 5 % (value) narrower.
"DISPLAY PREVIEW" needs 95 dp at 10 sp; "Connected via Tailscale" 99 dp at
9 sp. Both now fit on one line. Icon rows stay 44 dp tall because the 30 dp
ring, not text, sets their height; the vertical gain is fewer wrapped lines.

Phone WATCH EXACT preview scales the same canvas: 216 is 1.125x, 280 is 1.46x,
360 is 1.875x the 192 dp face. Judging size on a 360 preview overstates the
watch by almost 2x.

## Consumer notes

- Link: settings, recipient picker, conversation and capture already use
  `RingRoundBackHost` and move to the top layer on bump. DEV HOST gains a
  back. `LinkWatchConversation`'s `WatchTurnReader` pads its top with
  `MenuDesign.roundTitleTopPadding` (26 dp), which is now under the escape
  cap; it should use `roundTitleTopPadding(LocalRoundBackLayer.current)`.
- Skyvw: its route/modal shells mount their own X@9/X@10 and publish the
  reservation, so CircleKit paints no second back. Its reading lists stop
  jumping and take the stable reservation-aware edge (narrower than the old
  centred reading). Adopting the shared layer means replacing its own reading
  back with `RingRoundBackHost` and dropping that slot from the reservation;
  its clock at HOUR_12 must then be checked against the top escape.

## Evidence

- Failing first: `RingRoundBackLayerTest` against 0.3.81 behaviour extracted
  unchanged into `roundBackHostReservation()` (X@9) and
  `roundRendererPaintsBack()` (always false): 2/2 red. The row edge was
  49.12 dp with back vs 18.03 dp without; DEV HOST had no painted back.
  After the change 3/3 green (the third pins the escape geometry).
- `CircleGlanceLegibilityTest` 2/2: 10/11/9 sp, each clears its floor and one
  0.5 sp step smaller does not.
- Module unit tests: RingKit 89/89, Showcase catalog 27/27, DesignKit 113/114.
  The one failure, `RingIconStyleTest.strokes are always thick`, fails with
  the identical message on a clean 6006a8c checkout; icons are untouched.
- Instrumentation on pixel35 (API 35, emulator-5588): `RingRowAccessibilityTest`
  and `BackRingAccessibilityTest`, 13/13. New:
  `scrollingPastBackNeverMovesARowSideways` (reading and action left edge and
  width constant over five scroll steps) and
  `roundHostPreviewPaintsItsOwnNamedBackWithoutAProductHost` (48 dp named
  back on a bare `RenderRingScreen`, tap reaches `onExit`). The two reading
  tests now mount the shared layer; the X@10 product-shell tests are unchanged.
- `scripts/check-adaptive-contract.sh` ok, `scripts/check-file-length.sh` PASS.

Screenshots: `docs/qa/2026-09-14-round-menu-back-layer/{before,after}-{192,216,280,360}.png`.
Each strip shows the Showcase SETTINGS list (a Link-like fixture: passive
status, wrapping actions, dated reading) at rest, after a 50 dp and a 100 dp
slow drag, and DEV / HOST. Phone Showcase debug build in WATCH EXACT on
pixel35, named probe commands, one `input swipe` per scroll step. Originals:
`~/lsrc/.artifacts/circlekit-round-menu-back-layer-2026-09-14/`.

Reviewed pixel checklist (after): back ring whole and inside the glass at all
four sizes; rows passing the top vanish under the opaque cap instead of
crossing the ring; row and reading x positions identical between rest and both
scroll steps; "DISPLAY PREVIEW", "CONNECTED · Connected via Tailscale" and
"LAYOUT · WATCH EXACT" on one line; DEV HOST has a visible back. Text at the
bottom arc is clipped by the circle while its row is below the band, as before.

Limits: the before DEV HOST strip shows the Showcase's own X@9 shell chrome,
not Link's missing back; the after DEV HOST back is painted by
`RenderRingScreen` itself because the Showcase no longer mounts chrome for
screens, the same path Link's DEV HOST route uses. No Link or Skyvw build, no
physical watch, no TalkBack traversal. Letter-size floors are a design
judgement, not a user study.
