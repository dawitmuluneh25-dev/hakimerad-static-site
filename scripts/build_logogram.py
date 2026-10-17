#!/usr/bin/env python3
"""
build_logogram.py - Generate the HakimeRAD logogram assets.

The logogram is the symbol half of the identity: a broken ring (four arcs) with a
2x2 grid of rounded squares sitting in the ring's wide eastern gap. It is the
mark the owner supplied in October 2026; the wordmark is unchanged.

Provenance of the geometry below
--------------------------------
Measured once, pixel-exactly, from the owner's highest-resolution master
(`hakimerad-team/logo/hakimerad-logo-variant-01-axial-aperture-croped.png`,
1430x456), by classifying every pixel to the nearest brand ink and running a
connected-component analysis:

    ring centre ....... (262.5, 231.0) in master pixels
    outer radius ...... 161.5
    inner radius ...... 110.0   -> stroke 51.5, drawn at mid radius 135.75
    small gaps ........ 9 deg, centred on 90 / 180 / 270 deg
    wide gap .......... 65 deg, centred on 0 deg    (the squares sit in it)
    square ............ 60 x 60, corner radius 12, 12 px gutter (132 x 132 grid)

The mark is emitted on a 375 x 323 canvas with the ring's left edge at x=0 and
the squares' right edge at x=375, so the viewBox is the exact optical box.

One deliberate correction: in the master the square grid sits 3.5 px above the
ring's centre line (a 1% asymmetry from the source render). It is centred here,
which is what the design intends and is invisible at any real size.

Everything is drawn from these constants, so the SVG and every raster size are
guaranteed to agree.

Palette (brand guide s2 / D-006) - only these four colours exist:
    Deep Navy #0A2540 | Clinical Blue #0077B6 | Cyan Beam #00B4D8 | Clean Silver #F1F5F9
"""

from __future__ import annotations

import math
import os
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
BRAND_OUT = os.path.join(SITE, "images", "brand")
IMG_OUT = os.path.join(SITE, "images")

NAVY = "#0A2540"
BLUE = "#0077B6"
CYAN = "#00B4D8"
WHITE = "#FFFFFF"

# --- Geometry (master units; the viewBox is exactly the mark's optical box) ---
VB_W, VB_H = 375.0, 323.0
CX = CY = 161.5  # ring centre
R_OUT = 161.5
R_IN = 110.0
R_MID = (R_OUT + R_IN) / 2.0
STROKE = R_OUT - R_IN

GAP_SMALL = 9.0
GAP_WIDE = 65.0

# How much of an icon tile's width the mark fills (shared by the SVG and raster
# tile builders so they cannot drift apart).
TILE_MARK_WIDTH_RATIO = 0.76

SQ = 60.0
SQ_RX = 12.0
SQ_GAP = 12.0
GRID_W = SQ * 2 + SQ_GAP  # 132

# Arcs, as (start, end) clockwise from east; y grows downward in both SVG and PIL.
ARCS = [
    (GAP_WIDE / 2, 90 - GAP_SMALL / 2),
    (90 + GAP_SMALL / 2, 180 - GAP_SMALL / 2),
    (180 + GAP_SMALL / 2, 270 - GAP_SMALL / 2),
    (270 + GAP_SMALL / 2, 360 - GAP_WIDE / 2),
]

# Squares: (x, y, colour). The grid's right edge is flush with the mark's right
# edge (VB_W), its vertical centre sits on the ring's centre line.
_gx = VB_W - GRID_W
_gy = CY - GRID_W / 2
SQUARES = [
    (_gx, _gy, BLUE),
    (_gx + SQ + SQ_GAP, _gy, CYAN),
    (_gx, _gy + SQ + SQ_GAP, CYAN),
    (_gx + SQ + SQ_GAP, _gy + SQ + SQ_GAP, BLUE),
]


def log(msg: str) -> None:
    print(f"[logogram] {msg}")


def _pt(angle_deg: float, radius: float) -> tuple[float, float]:
    a = math.radians(angle_deg)
    return CX + radius * math.cos(a), CY + radius * math.sin(a)


def arc_path(start: float, end: float, radius: float) -> str:
    """SVG path for one arc, drawn clockwise in screen coordinates."""
    x0, y0 = _pt(start, radius)
    x1, y1 = _pt(end, radius)
    large = 1 if (end - start) > 180 else 0
    return f"M{x0:.2f} {y0:.2f}A{radius:.2f} {radius:.2f} 0 {large} 1 {x1:.2f} {y1:.2f}"


def mark_body(arc_colour: str, *, stroke_attr: str = "stroke", pad: str = "  ") -> str:
    """The mark's elements, with no <svg> wrapper, so they can be embedded.

    `arc_colour` may be the literal `currentColor`, which lets the header re-tint
    the ring with CSS (navy on a light field, white in dark mode) while the
    squares keep their brand colours - exactly the light/dark lockup rule in the
    brand guide, but with one asset and no extra request.
    """
    lines = [
        f'{pad}<g fill="none" {stroke_attr}="{arc_colour}" stroke-width="{STROKE:g}">'
    ]
    for start, end in ARCS:
        lines.append(f'{pad}  <path d="{arc_path(start, end, R_MID)}"/>')
    lines.append(f"{pad}</g>")
    for x, y, colour in SQUARES:
        lines.append(
            f'{pad}<rect x="{x:g}" y="{y:g}" width="{SQ:g}" height="{SQ:g}" '
            f'rx="{SQ_RX:g}" fill="{colour}"/>'
        )
    return "\n".join(lines)


def mark_svg(arc_colour: str, *, stroke_attr: str = "stroke", extra_attrs: str = "") -> str:
    """The mark as a standalone SVG document."""
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VB_W:g} {VB_H:g}" '
        f'width="{VB_W:g}" height="{VB_H:g}"{extra_attrs}>\n'
        "  <title>HakimeRAD</title>\n"
        f"{mark_body(arc_colour, stroke_attr=stroke_attr)}\n"
        "</svg>\n"
    )


def tile_svg(size: int = 100) -> str:
    """Square app/favicon tile: navy field with the centred inverse mark."""
    scale = (size * TILE_MARK_WIDTH_RATIO) / VB_W
    tx = (size - VB_W * scale) / 2
    ty = (size - VB_H * scale) / 2
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" '
        f'width="{size}" height="{size}" role="img" aria-label="HakimeRAD">\n'
        "  <title>HakimeRAD</title>\n"
        f'  <rect width="{size}" height="{size}" rx="{size * 0.22:g}" fill="{NAVY}"/>\n'
        f'  <g transform="translate({tx:.2f} {ty:.2f}) scale({scale:.6f})">\n'
        f"{mark_body(WHITE, pad='    ')}\n"
        "  </g>\n"
        "</svg>\n"
    )


def _hex_to_rgb(value: str) -> tuple[int, int, int]:
    v = value.lstrip("#")
    return tuple(int(v[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def mark_image(height: int, *, inverse: bool = False, ss: int = 4) -> Image.Image:
    """Rasterise the mark on transparency at the given pixel height.

    `k` converts mark units to supersampled pixels. It must be derived from the
    canvas height, NOT from `ss`: the mark's units are only the same size as
    pixels when the canvas is VB_H tall, which it is only at ss == 1. Using `ss`
    directly drew the mark at the wrong scale (correct at exactly one size, and
    clipped everywhere else).
    """
    width = round(height * VB_W / VB_H)
    W, H = width * ss, height * ss
    k = H / VB_H

    ring = _hex_to_rgb(WHITE if inverse else NAVY)

    # Annulus (outer disc minus inner disc) ...
    annulus = Image.new("L", (W, H), 0)
    ad = ImageDraw.Draw(annulus)
    box = [CX * k - R_OUT * k, CY * k - R_OUT * k, CX * k + R_OUT * k, CY * k + R_OUT * k]
    ad.ellipse(box, fill=255)
    inner = [CX * k - R_IN * k, CY * k - R_IN * k, CX * k + R_IN * k, CY * k + R_IN * k]
    ad.ellipse(inner, fill=0)

    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    solid = Image.new("RGBA", (W, H), ring + (255,))

    for start, end in ARCS:
        # ... intersected with an angular wedge.
        wedge = Image.new("L", (W, H), 0)
        ImageDraw.Draw(wedge).pieslice(box, start, end, fill=255)
        band = Image.new("L", (W, H), 0)
        band.paste(annulus, (0, 0), wedge)
        out.paste(solid, (0, 0), band)

    squares = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(squares)
    for x, y, colour in SQUARES:
        sd.rounded_rectangle(
            [x * k, y * k, (x + SQ) * k - 1, (y + SQ) * k - 1],
            radius=SQ_RX * k,
            fill=_hex_to_rgb(colour) + (255,),
        )
    out = Image.alpha_composite(out, squares)

    return out.resize((width, height), Image.LANCZOS)


def tile_image(size: int, *, rounded: bool = True, ss: int = 4) -> Image.Image:
    """App-icon tile: navy field, centred inverse mark (white ring, brand squares)."""
    px = size * ss
    tile = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    d = ImageDraw.Draw(tile)
    if rounded:
        d.rounded_rectangle([0, 0, px - 1, px - 1], radius=int(px * 0.22), fill=_hex_to_rgb(NAVY) + (255,))
    else:
        d.rectangle([0, 0, px - 1, px - 1], fill=_hex_to_rgb(NAVY) + (255,))

    mark_h = round(px * TILE_MARK_WIDTH_RATIO * VB_H / VB_W)
    mark = mark_image(mark_h, inverse=True, ss=2)
    tile.paste(mark, ((px - mark.width) // 2, (px - mark.height) // 2), mark)
    return tile.resize((size, size), Image.LANCZOS)


def build_vectors() -> None:
    os.makedirs(BRAND_OUT, exist_ok=True)
    for name, arc, attrs in (
        ("hakimerad-logogram.svg", NAVY, ' role="img" aria-label="HakimeRAD"'),
        (
            "hakimerad-logogram-inverse.svg",
            WHITE,
            ' role="img" aria-label="HakimeRAD"',
        ),
    ):
        path = os.path.join(BRAND_OUT, name)
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(mark_svg(arc, extra_attrs=attrs))
        log(f"{name}: {os.path.getsize(path):,} bytes")

    # Standalone favicon: navy tile + inverse mark, one file, no raster fallback needed.
    favicon_svg = tile_svg()
    for path in (os.path.join(SITE, "favicon.svg"), os.path.join(IMG_OUT, "favicon.svg")):
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(favicon_svg)
    log(f"favicon.svg: {os.path.getsize(os.path.join(SITE, 'favicon.svg')):,} bytes")


def build_rasters() -> None:
    os.makedirs(BRAND_OUT, exist_ok=True)
    for name, inverse in (
        ("hakimerad-logogram.png", False),
        ("hakimerad-logogram-inverse.png", True),
    ):
        im = mark_image(320, inverse=inverse)
        path = os.path.join(BRAND_OUT, name)
        im.save(path, optimize=True)
        log(f"{name}: {im.width}x{im.height} {os.path.getsize(path):,} bytes")


def build_icons() -> None:
    os.makedirs(IMG_OUT, exist_ok=True)
    sizes = {
        "favicon-16x16.png": 16,
        "favicon-32x32.png": 32,
        "favicon-48x48.png": 48,
        "apple-touch-icon.png": 180,
        "android-icon-192x192.png": 192,
        "android-icon-512x512.png": 512,
    }
    for name, size in sizes.items():
        im = tile_image(size, rounded=(name != "apple-touch-icon.png"))
        if name == "apple-touch-icon.png":
            # Apple composites its own mask, so this icon must be an opaque square.
            flat = Image.new("RGB", (size, size), _hex_to_rgb(NAVY))
            flat.paste(im, (0, 0), im)
            im = flat
        path = os.path.join(IMG_OUT, name)
        im.save(path, optimize=True)
        log(f"icon {name}: {os.path.getsize(path):,} bytes")

    base = tile_image(256)
    ico = os.path.join(SITE, "favicon.ico")
    base.save(ico, format="ICO", sizes=[(s, s) for s in (16, 32, 48)])
    log(f"favicon.ico: {os.path.getsize(ico):,} bytes")


def main() -> int:
    build_vectors()
    build_rasters()
    build_icons()
    log("done")
    return 0


if __name__ == "__main__":
    sys.exit(main())
