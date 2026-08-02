# Clown source marker

`RingIcons.Clown` is the monochrome, tintable source marker for synthetic
data. The same artwork identifies both simulator and generated fake jumps;
typed source values remain separate in product data and accessibility copy.

The filled vector and its deliberate OUTLINE-style silhouette alias are checked
against `icon-gen.py`. The proof renders the exact path data at 72, 34 and 18 px:

- `python3 docs/qa/2026-08-02-clown-icon/icon-gen.py check`
- `python3 docs/qa/2026-08-02-clown-icon/icon-gen.py proof`

`path-proof-v3.png` is the checked path-size proof. `showcase-clown.png` is the bounded real-render proof from CircleKit Showcase
→ ATOMS → ICON ACTION → IDLE. It must show the filled clown in the catalog's
Violet accent, with the face, nose and smile legible on the round host.

## Verified 2026-08-02

- `IconCatalogTest`: PASS; catalog, accent and outline-style silhouette agree.
- `ShowcaseManifestTest`: PASS; the named Showcase route remains valid.
- Wear Showcase debug APK: compiled and installed on `wear34`.
- `showcase-clown.png`: PASS; CLOWN is present in the real four-item catalog,
  Violet-tinted, and its hair, eyes, ringed nose and smile remain distinct.
