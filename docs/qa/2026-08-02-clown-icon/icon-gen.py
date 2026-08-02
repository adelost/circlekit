#!/usr/bin/env python3
"""Proof generator for RingIcons.Clown.

The path data below is the source for the filled Kotlin vector. The marker
deliberately remains filled in OUTLINE style so its face survives at 11–18 px.
`check` pins those exact paths into the shipped files; `proof` emits an
SVG/HTML size ladder from the same data.
"""

from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[3]

FILLED = [
    "M5.3 5.4a3 3 0 1 0 0.001 0ZM9 4a3 3 0 1 0 0.001 0ZM15 4a3 3 0 1 0 0.001 0Z"
    "M18.7 5.4a3 3 0 1 0 0.001 0ZM4.6 10a3 3 0 1 0 0.001 0ZM19.4 10a3 3 0 1 0 0.001 0Z",
    "M12 4.5C7.8 4.5 5.5 7.7 5.5 12.1C5.5 17 8.1 20.5 12 20.5s6.5 -3.5 6.5 -8.4"
    "C18.5 7.7 16.2 4.5 12 4.5Z"
    "M8.8 8.9a1.15 1.15 0 1 0 0.001 0Z"
    "M15.2 8.9a1.15 1.15 0 1 0 0.001 0Z"
    "M12 10.2a2.05 2.05 0 1 0 0.001 0Z"
    "M7.8 14.3C8.7 16.4 10.1 17.4 12 17.4s3.3 -1 4.2 -3.1"
    "c-1.4 0.8 -2.8 1.1 -4.2 1.1s-2.8 -0.3 -4.2 -1.1Z",
    "M12 10.9a1.35 1.35 0 1 0 0.001 0Z",
]

def svg(paths: list[str], size: int) -> str:
    body = "".join(f'<path d="{path}" fill="#f1efe9" fill-rule="evenodd"/>' for path in paths)
    return f'<svg width="{size}" height="{size}" viewBox="0 0 24 24">{body}</svg>'


def proof() -> str:
    ladders = []
    for label in ("FILLED", "OUTLINE STYLE · SAME SILHOUETTE"):
        icons = "".join(svg(FILLED, size) for size in (72, 34, 18))
        ladders.append(f'<section><h2>{label}</h2><div class="icons">{icons}</div></section>')
    return (
        '<!doctype html><html><head><meta charset="utf-8"><style>'
        'body{margin:0;background:#000;color:#f1efe9;font-family:sans-serif;padding:36px;width:520px}'
        'h1{font-size:18px;letter-spacing:.08em}h2{font-size:11px;color:#a78bc1;letter-spacing:.12em}'
        'section{margin-top:28px}.icons{display:flex;align-items:center;gap:34px;padding:24px;'
        'border:1px solid #494b4d;border-radius:24px}</style></head><body>'
        '<h1>RING ICON · CLOWN</h1>' + ''.join(ladders) + '</body></html>\n'
    )


def check() -> None:
    filled_source = (ROOT / "designkit/src/main/java/com/adelost/designkit/ui/RingIcons.kt").read_text()
    filled_source = re.sub(r'"\s*\+\s*"', "", filled_source)
    for path in FILLED:
        assert path in filled_source, f"filled path drift: {path}"
    outline_source = (ROOT / "designkit/src/main/java/com/adelost/designkit/ui/RingIconsOutline.kt").read_text()
    assert "val Clown: ImageVector by lazy { RingIcons.Clown }" in outline_source
    assert "RingIcons.Clown" in (
        ROOT / "designkit/src/main/java/com/adelost/designkit/ui/RingIconAccentCatalog.kt"
    ).read_text()
    assert "RingIconsOutline.Clown" in (
        ROOT / "designkit/src/main/java/com/adelost/designkit/ui/RingIconsOutlineCatalog.kt"
    ).read_text()


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in {"check", "proof"}:
        raise SystemExit("usage: icon-gen.py check|proof")
    if sys.argv[1] == "check":
        check()
    else:
        print(proof(), end="")
