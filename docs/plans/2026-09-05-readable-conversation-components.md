# Readable conversation controls · 0.3.57

Mattias requested simpler Link conversations without forking shared atoms.

Delivered shared seams:
- Named selection uses stable IDs and existing rows; descriptions grow rather
  than shrink or cross icon contours. Showcase declares a named-selection case.
- Message prose and composer share sentence-case, OLED-black presentation.
- Action captions sit below the measured progress ring, never over its stroke.
- Ordinary action timing can be declared once by a conversation host. Default
  instrument timing is unchanged. Immediate actions do not flash a receipt.
- Continuous press only shows arming feedback until active, then exposes the
  consumer's actual recording waveform. Explicit long confirmations stay held.
- Info uses the same CircleIconDisc metrics as other row actions. It consumes
  its pointer independently: opening help cannot also toggle the parent row.
- Explanations close explicitly or with Back, and block underlying pointers.
- The shared player supports an honest loading state with Stop still available.
- Standalone round dialogs use the existing chrome slots/reservation law.

Focused proof: CircleActionCueTest, RingSelectionTest, RingRowInfoTest; Android
ReadableActionCueTest tests caption bounds and real info-pointer isolation.
The pointer test first failed (one unwanted setting change), then passed after
the CircleIconDisc gesture-owner fix. No snapshot or source-text assertions.

Visual checks on pixel35: named selection, playback, conversation composer and
WatchExact selection. Long descriptions wrap; round lists intentionally scroll.
Files: /tmp/circlekit-final-{selection,player,conversation,round-selection}.png.
Link additionally exercises actual shared host routes and recording gestures.
Do not confuse explicit preview fixtures with real network/audio delivery.

Consumer notes: recompile when pinning all Maven modules to 0.3.57. The added
RingPlaybackState.LOADING requires exhaustive consumers to handle loading.
LocalCircleTapTiming defaults to null: Skyvw's deliberate action law remains.
No Skyvw setting, palette, routing or runtime changed in this feature.

Rollback: pin the six Maven modules to 0.3.56; existing immutable payloads stay
published. Showcase APKs retain IDs/signers and require a forward version for
an installed-device rollback. Publication source/tag and APK checksums are in
the release's PROVENANCE.txt, not guessed from branch state.
