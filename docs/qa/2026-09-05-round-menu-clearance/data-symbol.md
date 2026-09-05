# DATA is not Wi-Fi

Mattias correctly rejected Wi-Fi for Showcase DATA: the page demonstrates data
age/status/work, not a radio transport. A new reusable `data` asset uses three
filled record tiers. Wi-Fi remains exclusively the wireless-network symbol.
The familiar data-stack silhouette is distinct from layers (page composition),
the grid (icon gallery), and refresh (an operation).

This first commit adds the geometry to the shared portable asset catalog and
regenerates RingIcons/catalog. No application-private drawing or global pigment
default. The geometry catalog version changes because its content changed.
After immutable 0.3.61 publication, Showcase's declared DATA and DATA AGE refs
will consume it and the native service sample will stop using Wi-Fi for work.

Small proof: existing CircleAccentTest, asset generation check, RingKit release
compile. `data-symbol.png` is an inspected 18/30/72 px vector rendering from the
same path data, not a native screenshot. The tiers stay separate at 18 px.
The downstream native screenshot remains required; this alone is not DONE.
