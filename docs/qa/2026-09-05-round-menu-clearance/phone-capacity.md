# Phone content capacity follow-up (0.3.60)

The final native Phone check of 0.3.59 exposed an older width assumption:
the host's inner content column can be narrower than the surface-class maximum.
Three 56 dp rings plus two 34 dp gaps were forced into 200 dp; Compose squeezed
their width without changing height, making oval buttons and broken words.

RingMenuGrid now derives the number of columns from the actual remaining width,
the declared maximum capacity, diameter and gaps. No host/product branch, smaller
font, changed icon shape, or second grid policy. The Phone launcher also scrolls
so reduced capacity and short landscape bounds do not strand the final action.

Existing CircleGridPolicyTest: red first (1/2), green (2/2), including narrow Phone,
full-width Phone, Round and Wide. RingRowLogicTest 17/17 remains green; Phone debug
build passes. The normal publisher builds the exact signed Phone/Wear release.

Pixel checklist for phone-capacity.png: circles, not ovals; CONTROLS and LAYOUTS
are whole words; APP UPDATE and DEV are visible; same nine declared entries and
callbacks. All checked on actual Phone RESPONSIVE via the existing named probe.
This is not a new Wear hardware claim: Wear 192 dp evidence remains in README.md,
and the current Wear emulator's QEMU renderer subsequently crashed on the host.
