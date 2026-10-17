#!/usr/bin/env python3
"""
build_assets.py - Generate the website brand asset set from the authoritative
HakimeRAD brand sources.

Sources (read-only, never modified):
  ../social media/hakimerad_marketing/assets/lockup/   official lockups + wordmarks
  ../social media/hakimerad_marketing/assets/fonts/    IBM Plex Sans TTFs (SIL OFL 1.1)
  ../social media/hakimerad_marketing/05_BRAND_AND_CREATIVE_GUIDE.md  palette + type rules

Outputs (inside templet-project/):
  fonts/            IBM Plex Sans woff2 subsets + licence
  images/brand/     lockups + wordmarks (png + svg) + the logogram (build_logogram.py)
  images/           og-hakimerad.jpg, hero-poster.jpg, abstract-*.jpg
  images/           favicon png set
  favicon.ico, favicon.svg, site.webmanifest

The icon set and the logogram are owned by scripts/build_logogram.py. This
script delegates to it rather than drawing its own icons, so `npm run assets`
can never overwrite the logogram with a placeholder.

Palette (brand guide s2, D-006) - the only four colours permitted:
  Deep Navy #0A2540 | Clinical Blue #0077B6 | Cyan Beam #00B4D8 | Clean Silver #F1F5F9
"""

from __future__ import annotations

import math
import os
import shutil
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import build_logogram  # noqa: E402  (same directory, see sys.path above)

# --------------------------------------------------------------------------- #
# Paths
# --------------------------------------------------------------------------- #
HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
TEAM = os.path.dirname(os.path.dirname(SITE))
BRAND = os.path.join(TEAM, "social media", "hakimerad_marketing", "assets")

LOCKUP_SRC = os.path.join(BRAND, "lockup")
FONT_SRC = os.path.join(BRAND, "fonts")

FONT_OUT = os.path.join(SITE, "fonts")
BRAND_OUT = os.path.join(SITE, "images", "brand")
IMG_OUT = os.path.join(SITE, "images")

# --------------------------------------------------------------------------- #
# Brand tokens
# --------------------------------------------------------------------------- #
NAVY = (10, 37, 64)  # #0A2540
BLUE = (0, 119, 182)  # #0077B6
CYAN = (0, 180, 216)  # #00B4D8
SILVER = (241, 245, 249)  # #F1F5F9
WHITE = (255, 255, 255)
NAVY_BODY = (176, 196, 214)  # #B0C4D6 - brand guide body-on-navy

WEIGHTS = {
    "Regular": "IBMPlexSans-Regular.ttf",
    "Medium": "IBMPlexSans-Medium.ttf",
    "SemiBold": "IBMPlexSans-SemiBold.ttf",
    "Bold": "IBMPlexSans-Bold.ttf",
}

# Latin basics + the punctuation/symbols the site actually uses.
SUBSET_UNICODES = (
    "U+0020-007E,U+00A0,U+00A9,U+00B1,U+00B7,U+00D7,U+2013,U+2014,U+2018,"
    "U+2019,U+201C,U+201D,U+2022,U+2026,U+2192,U+2264,U+2265,U+00B0,U+2713"
)


def log(msg: str) -> None:
    print(f"[assets] {msg}")


def ensure_dirs() -> None:
    for d in (FONT_OUT, BRAND_OUT, IMG_OUT):
        os.makedirs(d, exist_ok=True)


# --------------------------------------------------------------------------- #
# 1. Fonts - subset IBM Plex Sans to woff2
# --------------------------------------------------------------------------- #
def build_fonts() -> None:
    try:
        from fontTools import subset  # noqa: F401
    except ImportError:
        log("fontTools unavailable - skipping webfont build")
        return

    for weight, filename in WEIGHTS.items():
        src = os.path.join(FONT_SRC, filename)
        if not os.path.isfile(src):
            log(f"missing source font {filename} - skipped")
            continue
        dst = os.path.join(FONT_OUT, f"IBMPlexSans-{weight}.woff2")
        cmd = [
            sys.executable,
            "-m",
            "fontTools.subset",
            src,
            f"--unicodes={SUBSET_UNICODES}",
            "--layout-features=kern,liga,clig,calt,tnum,onum,frac,numr,dnom",
            "--flavor=woff2",
            "--desubroutinize",
            "--no-hinting",
            f"--output-file={dst}",
        ]
        subprocess.run(cmd, check=True, capture_output=True)
        log(f"font {weight}: {os.path.getsize(dst):,} bytes")

    lic_src = os.path.join(FONT_SRC, "license.txt")
    if os.path.isfile(lic_src):
        shutil.copy2(lic_src, os.path.join(FONT_OUT, "LICENSE-IBMPlexSans.txt"))
        log("font licence copied")


# --------------------------------------------------------------------------- #
# 2. Lockups and wordmarks
# --------------------------------------------------------------------------- #
def trim_alpha(im: Image.Image, pad_ratio: float = 0.0) -> Image.Image:
    """Trim a transparent PNG to its ink box, with optional proportional padding."""
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    if pad_ratio:
        w, h = im.size
        px, py = int(w * pad_ratio), int(h * pad_ratio)
        canvas = Image.new("RGBA", (w + 2 * px, h + 2 * py), (0, 0, 0, 0))
        canvas.paste(im, (px, py), im)
        im = canvas
    return im


def build_lockups() -> None:
    pairs = [
        ("HakimeRAD_Lockup_Light.png", "hakimerad-lockup-light.png", False),
        ("HakimeRAD_Lockup_Dark.png", "hakimerad-lockup-dark.png", False),
        ("HakimeRAD_Wordmark_Light_Transparent.png", "hakimerad-wordmark-light.png", True),
        ("HakimeRAD_Wordmark_Dark_Transparent.png", "hakimerad-wordmark-dark.png", True),
    ]
    for src_name, dst_name, is_transparent in pairs:
        src = os.path.join(LOCKUP_SRC, src_name)
        if not os.path.isfile(src):
            log(f"missing lockup {src_name} - skipped")
            continue
        im = Image.open(src).convert("RGBA")
        if is_transparent:
            im = trim_alpha(im)
            target_w = 900
        else:
            target_w = 1200
        ratio = target_w / im.width
        im = im.resize((target_w, max(1, round(im.height * ratio))), Image.LANCZOS)
        dst = os.path.join(BRAND_OUT, dst_name)
        im.save(dst, optimize=True)
        log(f"lockup {dst_name}: {im.size[0]}x{im.size[1]} {os.path.getsize(dst):,} bytes")

    # Outlined production SVG - reword the aria-label so the files are self-describing.
    for src_name, dst_name in (
        ("HakimeRAD_Wordmark_Light.svg", "hakimerad-wordmark-light.svg"),
        ("HakimeRAD_Wordmark_Dark.svg", "hakimerad-wordmark-dark.svg"),
    ):
        src = os.path.join(LOCKUP_SRC, src_name)
        if not os.path.isfile(src):
            log(f"missing svg {src_name} - skipped")
            continue
        with open(src, "r", encoding="utf-8") as fh:
            svg = fh.read()
        svg = svg.replace('width="570.8" height="69.8"', 'width="571" height="70"')
        dst = os.path.join(BRAND_OUT, dst_name)
        with open(dst, "w", encoding="utf-8") as fh:
            fh.write(svg)
        log(f"svg {dst_name}")


# --------------------------------------------------------------------------- #
# 3. Abstract brand artwork (brand guide s4 - approved visual language)
# --------------------------------------------------------------------------- #
def load_font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(os.path.join(FONT_SRC, WEIGHTS[weight]), size)


def draw_grid_field(draw: ImageDraw.ImageDraw, box, step: int, colour, alpha: int, width: int = 1) -> None:
    """Faint grid field motif."""
    x0, y0, x1, y1 = box
    x = x0
    while x <= x1:
        draw.line([(x, y0), (x, y1)], fill=colour + (alpha,), width=width)
        x += step
    y = y0
    while y <= y1:
        draw.line([(x0, y), (x1, y)], fill=colour + (alpha,), width=width)
        y += step


def draw_aperture(
    draw: ImageDraw.ImageDraw,
    cx: float,
    cy: float,
    radius: float,
    colour,
    width: int = 2,
    blades: int = 6,
    gap: float = 0.30,
    start: float = 0.0,
) -> None:
    """Open-aperture motif: evenly spaced arcs forming an iris."""
    span = (2 * math.pi / blades) * (1 - gap)
    for i in range(blades):
        a0 = start + i * (2 * math.pi / blades)
        draw.arc(
            [cx - radius, cy - radius, cx + radius, cy + radius],
            start=math.degrees(a0),
            end=math.degrees(a0 + span),
            fill=colour + (255,),
            width=width,
        )


def draw_concentric(draw: ImageDraw.ImageDraw, cx, cy, radii, colour, width=1, alpha=90) -> None:
    for r in radii:
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=colour + (alpha,), width=width)


def draw_node_link(draw: ImageDraw.ImageDraw, pts, colour, node_r=5, width=2, alpha=255) -> None:
    for a, b in zip(pts, pts[1:]):
        draw.line([a, b], fill=colour + (alpha,), width=width)
    for p in pts:
        draw.ellipse([p[0] - node_r, p[1] - node_r, p[0] + node_r, p[1] + node_r], fill=colour + (alpha,))


def brand_artwork(width: int, height: int, field=NAVY, seed_layout: str = "wide") -> Image.Image:
    """Deterministic abstract clinical geometry on a brand field."""
    base = Image.new("RGB", (width, height), field)
    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)

    # faint grid field
    draw_grid_field(d, (0, 0, width, height), max(48, width // 24), SILVER, 10)

    if seed_layout == "wide":
        ax, ay = width * 0.72, height * 0.50
        draw_concentric(d, ax, ay, [r for r in range(120, 560, 46)], BLUE, 1, 70)
        draw_aperture(d, ax, ay, 250, CYAN, 3, blades=7, gap=0.34, start=-0.35)
        draw_aperture(d, ax, ay, 168, BLUE, 2, blades=7, gap=0.34, start=0.10)
        pts = [
            (width * 0.06, height * 0.80),
            (width * 0.18, height * 0.63),
            (width * 0.30, height * 0.70),
            (width * 0.42, height * 0.55),
        ]
        draw_node_link(d, pts, CYAN, 6, 2, 200)
        d.line([(0, height * 0.94), (width * 0.30, height * 0.94)], fill=CYAN + (220,), width=4)
    else:  # square / portrait
        ax, ay = width * 0.50, height * 0.42
        draw_concentric(d, ax, ay, [r for r in range(70, 460, 38)], BLUE, 1, 70)
        draw_aperture(d, ax, ay, 200, CYAN, 3, blades=6, gap=0.32, start=-0.4)
        d.line([(0, height * 0.90), (width * 0.34, height * 0.90)], fill=CYAN + (220,), width=4)
        pts = [(width * 0.14, height * 0.80), (width * 0.34, height * 0.72), (width * 0.58, height * 0.80)]
        draw_node_link(d, pts, BLUE, 5, 2, 190)

    return Image.alpha_composite(base.convert("RGBA"), overlay).convert("RGB")


def paste_wordmark(canvas: Image.Image, x: int, y: int, target_w: int, dark_field: bool = True) -> None:
    name = "HakimeRAD_Wordmark_Dark_Transparent.png" if dark_field else "HakimeRAD_Wordmark_Light_Transparent.png"
    wm = Image.open(os.path.join(LOCKUP_SRC, name)).convert("RGBA")
    wm = trim_alpha(wm)
    ratio = target_w / wm.width
    wm = wm.resize((target_w, max(1, round(wm.height * ratio))), Image.LANCZOS)
    canvas.paste(wm, (x, y), wm)


def build_og_image() -> None:
    """1200x630 Open Graph card: navy field, official lockup, tagline, entity line."""
    W, H = 1200, 630
    art = brand_artwork(W, H, NAVY, "wide")
    # darken the artwork so the lockup reads
    shade = Image.new("RGBA", (W, H), NAVY + (206,))
    canvas = Image.alpha_composite(art.convert("RGBA"), shade)

    # The logogram sits above the wordmark, left-aligned with it, with enough
    # clearance to read as a lockup rather than an overlap. The shared social
    # card is where most viewers meet the identity before the site itself.
    mark = build_logogram.mark_image(112, inverse=True)
    canvas.paste(mark, (86, 50), mark)

    paste_wordmark(canvas, 84, 196, 700, dark_field=True)

    d = ImageDraw.Draw(canvas)
    f_tag = load_font("Medium", 26)
    f_small = load_font("Regular", 22)
    f_url = load_font("SemiBold", 24)

    d.line([(86, 306), (280, 306)], fill=CYAN + (255,), width=3)
    d.text((86, 326), "YOUR RELIABLE PARTNER!", font=f_tag, fill=NAVY_BODY + (255,))

    d.text(
        (86, 424),
        "Remote radiology reporting for hospitals, clinics",
        font=f_small,
        fill=SILVER + (235,),
    )
    d.text((86, 456), "and imaging centres in Ethiopia.", font=f_small, fill=SILVER + (235,))

    d.text((86, 542), "hakimerad.health.et", font=f_url, fill=CYAN + (255,))

    dst = os.path.join(IMG_OUT, "og-hakimerad.jpg")
    canvas.convert("RGB").save(dst, quality=88, optimize=True, progressive=True)
    log(f"og image: {os.path.getsize(dst):,} bytes")


def build_hero_poster() -> None:
    """1920x1080 hero base layer - brand abstract geometry, no people, no scanners."""
    W, H = 1920, 1080
    art = brand_artwork(W, H, NAVY, "wide")
    d = ImageDraw.Draw(art)

    # subtle vertical navy->blue single step (the only gradient the brand permits)
    grad = Image.new("L", (1, H))
    for y in range(H):
        grad.putpixel((0, y), int(58 * (y / H) ** 1.6))
    band = Image.new("RGBA", (W, H), BLUE + (255,))
    band.putalpha(grad.resize((W, H)))
    art = Image.alpha_composite(art.convert("RGBA"), band).convert("RGB")

    dst = os.path.join(IMG_OUT, "hero-poster.jpg")
    art.save(dst, quality=82, optimize=True, progressive=True)
    log(f"hero poster: {W}x{H} {os.path.getsize(dst):,} bytes")

    small = art.resize((1280, 720), Image.LANCZOS)
    dst2 = os.path.join(IMG_OUT, "hero-poster-1280.jpg")
    small.save(dst2, quality=80, optimize=True, progressive=True)
    log(f"hero poster 1280: {os.path.getsize(dst2):,} bytes")


def build_section_art() -> None:
    for name, (w, h, layout) in {
        "abstract-diagnostics.jpg": (1200, 900, "square"),
        "abstract-workflow.jpg": (1200, 900, "square"),
    }.items():
        art = brand_artwork(w, h, NAVY, layout)
        dst = os.path.join(IMG_OUT, name)
        art.save(dst, quality=84, optimize=True, progressive=True)
        log(f"section art {name}: {os.path.getsize(dst):,} bytes")


def build_article_art() -> None:
    """Brand-compliant article headers.

    The three images previously used on the blog were AI-generated scenes
    containing a named hospital, a named clinician, a visible patient name and
    date of birth, people, and an "AI analysis" overlay. All of that is
    prohibited by the brand guide (s4) and the claims register (s6), so they are
    replaced with flat abstract geometry in exact brand hex values. No text is
    drawn inside these images.
    """
    out = os.path.join(IMG_OUT, "blog")
    os.makedirs(out, exist_ok=True)
    variants = {
        "blog-radiologist-capacity.jpg": "wide",
        "blog-remote-reporting.jpg": "wide",
        "blog-structured-reporting.jpg": "wide",
    }
    for name, layout in variants.items():
        art = brand_artwork(1200, 675, NAVY, layout)
        if name.endswith("capacity.jpg"):
            # concentric arc motif, shifted left
            d = ImageDraw.Draw(art)
            draw_concentric(d, 300, 340, [r for r in range(80, 420, 34)], BLUE, 1, 80)
            draw_aperture(d, 300, 340, 180, CYAN, 3, blades=6, gap=0.34, start=-0.3)
        elif name.endswith("remote-reporting.jpg"):
            d = ImageDraw.Draw(art)
            pts = [(140, 520), (360, 380), (600, 470), (860, 300), (1080, 250)]
            draw_node_link(d, pts, CYAN, 7, 2, 235)
            d.line([(120, 180), (420, 180)], fill=BLUE + (220,), width=3)
        else:
            d = ImageDraw.Draw(art)
            base_x, base_y = 180, 560
            for i, h in enumerate([90, 140, 200, 260, 320]):
                x = base_x + i * 150
                d.rectangle([x, base_y - h, x + 96, base_y], outline=BLUE + (200,), width=2)
            d.line([(base_x, base_y + 28), (base_x + 5 * 150, base_y + 28)], fill=CYAN + (230,), width=3)
        dst = os.path.join(out, name)
        art.save(dst, quality=84, optimize=True, progressive=True)
        log(f"article art {name}: {os.path.getsize(dst):,} bytes")


# --------------------------------------------------------------------------- #
# 4. Icons and the logogram - owned by build_logogram.py
#
# These icons used to be a typographic "H" drawn here from the wordmark. The
# logogram replaced it in October 2026, so this script now delegates instead of
# drawing its own: one geometry, emitted as the vector mark, every raster size
# and every app icon. Keeping a second icon builder here would mean that
# `npm run assets` silently replaced the logogram with the old placeholder.
# --------------------------------------------------------------------------- #
def build_icons() -> None:
    build_logogram.build_vectors()
    build_logogram.build_rasters()
    build_logogram.build_icons()


def build_manifest() -> None:
    manifest = (
        "{\n"
        '  "name": "HakimeRAD Teleradiology",\n'
        '  "short_name": "HakimeRAD",\n'
        '  "description": "Remote radiology reporting for hospitals, clinics and imaging '
        'centres in Ethiopia.",\n'
        '  "start_url": "/",\n'
        '  "scope": "/",\n'
        '  "display": "standalone",\n'
        '  "background_color": "#F1F5F9",\n'
        '  "theme_color": "#0A2540",\n'
        '  "lang": "en",\n'
        '  "icons": [\n'
        '    { "src": "images/android-icon-192x192.png", "sizes": "192x192", "type": "image/png" },\n'
        '    { "src": "images/android-icon-512x512.png", "sizes": "512x512", "type": "image/png" },\n'
        '    { "src": "images/apple-touch-icon.png", "sizes": "180x180", "type": "image/png" },\n'
        '    { "src": "favicon.svg", "sizes": "any", "type": "image/svg+xml" }\n'
        "  ]\n"
        "}\n"
    )
    for name in ("site.webmanifest",):
        with open(os.path.join(SITE, name), "w", encoding="utf-8") as fh:
            fh.write(manifest)
        log(f"{name} written")


# --------------------------------------------------------------------------- #
def main() -> int:
    ensure_dirs()
    build_fonts()
    build_lockups()
    build_og_image()
    build_hero_poster()
    build_section_art()
    build_article_art()
    build_icons()
    build_manifest()
    log("done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
