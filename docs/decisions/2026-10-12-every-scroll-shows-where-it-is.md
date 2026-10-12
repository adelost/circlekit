# Every scroll shows where it is: the scroll position arc

Owner: skyvw:1. Base: CircleKit 0.3.129 (e8894e1). Scope: one DesignKit component that every vertical
scroll in DesignKit, RingKit and RenderKit wears, consumed by Skyvw through a version bump.

## Request (Mattias, verbatim)

2026-10-11 21:57:57Z, on Discord to skyvw:1: four photos of his Samsung watch. Along the right edge of the
round face runs an arc, a dim track with a bright part on it. In two photos the bright part is at the top of
the track, in one further down.

2026-10-11 21:59:01Z, by voice (as transcribed):

> "Ser du att min klocka här har typ en scrollbar som är min Samsung klocka. Jag funderar på om alla sidor som går och scrolla ska ha en liknande del så att man har en scrollbar. Den fadar ut när man inte scrollar men den syns när man scrollar. Och ja, jag undrar som sagt om vi ska bygga det som ett generiskt så att det finns i designspråket så att de sidorna vi har automatiskt lägger till det typ så att det syns om det känns rimligt. Och ja, som sagt ska ju vara generiskt så att man ska inte kunna ha en scrollbar sida där den inte syns i designspråket utan det ska vara en standardkomponent liksom att ha med i design. Eller så här man har någon viss sidotema eller layout eller något åt det hållet."

What the request establishes: every page that scrolls shows where it stands, like the watch; it shows while
the page scrolls and fades out when it does not; it belongs to the design language, so a page gets it without
asking for it, and a page that scrolls without it cannot exist. Everything below marked as a choice is mine,
not Mattias's.

## Findings at 0.3.129

- Nothing in CircleKit or Skyvw shows a scroll position.
- CircleKit's main sources scroll in 11 places: `RoundRingScreens` (hub, detail, launcher, rows),
  `PhoneRingScreens` (the same four), the two phone screens of `ColorSchemePickerScreen`, and
  `SkyvwLinearListHost`.
- Skyvw scrolls in 10 more: both containers of `WearSkyvwListHost`, the settings home, the location
  disclosure, the simulator overlay, the jump metadata editor, the weather glance card, the places list, the
  phone home grid and the benchmark screen.
- DesignKit already knows the face: `LocalCircleSurfaceLayout` is `ROUND` on a watch and in WATCH EXACT, a
  phone class otherwise.

## Choices (skyvw:1), reversible

1. **Shape, from the photos.** On a round face an arc of 60 degrees centred at three o'clock, its line 5 dp
   inside the face's edge. On a phone a straight line down the right edge. The track is the progress ring's
   resting outline and the bright part its full ink, 2.5 dp wide: the kit's own progress tokens, no new colour.
   Both are bands of the kit's one band shape (`circleArcBandPath`, `circleBarPath`), ending as the product
   declares its bands to end. A product hands that one choice to the kit through `LocalCircleBandEnds` (Skyvw:
   `ui.band`), so the arc never ends differently from the product's own bands.
   A scroll in a box lower than half the face, such as a short editor field, keeps the straight line inside its
   own box: an arc at the face's edge would be clipped with the box.
2. **What it says.** The bright part is as long as the share of the page in view, never shorter than a fifth
   of the track, and stands as far along as the page has scrolled.
3. **When it shows.** It comes up when the position moves, by finger, fling or crown, and fades out one second
   after the last movement. It also shows for that second when a page that can scroll opens, because the
   photos show the watch's at the start of its track with nothing scrolled. A page whose content fits shows
   nothing.
4. **One component.** `Modifier.circleVerticalScroll(state)` is a plain scroll and its arc in the one order
   that keeps the arc still while the content moves. `Modifier.circleScrollPosition(state)` goes on a lazy
   list or grid. RingKit adds the same for Wear's `ScalingLazyColumn`, which DesignKit does not know.
5. **The law.** The arc marks its node (`CircleScrollPositionShown`). A test fails when any vertical scroll on
   a mounted screen lacks the mark: RingKit's `EveryScrollShowsWhereItIsTest` for every screen kind on both
   faces and for the phone's list host. In Skyvw, `QaScenesOnTheJvmTest` reads the scrolls a finger can move
   on every declared page and QA scene as the JVM composes them (it runs no layout pass, so a list composed
   while measuring is not there), and `scripts/check-ui-atoms.sh` refuses any scroll in the source that is not
   written through the component.

## Not covered

- Sideways scrolls, such as a row of chips. They are not pages.
- The look itself: the sweep, the inset and the timing are Mattias's to judge on glass, and no test pins them.

## Seen on glass, 2026-10-12

Skyvw built on this CircleKit, DEV rows and a jump's rows, photographed while moving and 3 s later: the 192 dp
watch (wear34c), WATCH EXACT at 192 dp on a phone, and the phone's own layout. On each, the arc or line showed
while the page moved, with its bright part where the page stood, and nothing showed at rest. Pictures:
`~/lsrc/.artifacts/skyvw-2026-10-12/scroll-arc/`.
