#!/usr/bin/env python3
# Meeting Planner · icon generator
# SPDX-License-Identifier: Apache-2.0
"""Draws every icon from code so the repository carries no binary source.

    python3 tools/make_icons.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
TEAL = (23, 97, 111, 255)
TEAL_DARK = (12, 58, 68, 255)
CREAM = (220, 238, 240, 255)
LIGHT = (143, 211, 222, 255)
AMBER = (227, 165, 72, 255)


def icon(size, maskable=False):
    scale = 4
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if maskable:
        d.rectangle([0, 0, s, s], fill=TEAL)
        pad = s * 0.20
    else:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=TEAL)
        pad = s * 0.155

    # A globe turned into a clock: the two ideas the app joins.
    cx = cy = s / 2
    r = (s - 2 * pad) / 2 - s * 0.02
    stroke = max(3, int(s * 0.028))

    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=CREAM, width=stroke)
    d.ellipse([cx - r * 0.46, cy - r, cx + r * 0.46, cy + r], outline=LIGHT, width=max(2, int(stroke * 0.7)))
    d.line([cx - r, cy, cx + r, cy], fill=LIGHT, width=max(2, int(stroke * 0.7)))

    # The hour hand is amber, so the icon reads as a clock even at 32 pixels.
    d.line([cx, cy, cx, cy - r * 0.62], fill=AMBER, width=int(stroke * 1.15))
    d.line([cx, cy, cx + r * 0.52, cy + r * 0.30], fill=CREAM, width=int(stroke * 0.95))
    dot = max(3, int(s * 0.032))
    d.ellipse([cx - dot, cy - dot, cx + dot, cy + dot], fill=AMBER)

    return img.resize((size, size), Image.LANCZOS)


def main():
    icons = ROOT / "icons"
    icons.mkdir(exist_ok=True)

    square = icon(1024)
    square.save(icons / "icon-1024.png")
    icon(512).save(icons / "icon-512.png")
    icon(192).save(icons / "icon-192.png")
    icon(512, maskable=True).save(icons / "icon-512-maskable.png")

    icon(180).save(ROOT / "apple-touch-icon.png")
    icon(32).save(ROOT / "favicon-32.png")
    icon(32).save(ROOT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])

    # The SVG is the same drawing in vector form, so the favicon stays sharp.
    svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#17616f"/>
  <circle cx="32" cy="32" r="17.5" fill="none" stroke="#dceef0" stroke-width="1.9"/>
  <ellipse cx="32" cy="32" rx="8" ry="17.5" fill="none" stroke="#8fd3de" stroke-width="1.4"/>
  <path d="M14.5 32h35" stroke="#8fd3de" stroke-width="1.4"/>
  <path d="M32 32V21.2" stroke="#e3a548" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M32 32l9.1 5.3" stroke="#dceef0" stroke-width="1.9" stroke-linecap="round"/>
  <circle cx="32" cy="32" r="2.1" fill="#e3a548"/>
</svg>
"""
    (icons / "icon.svg").write_text(svg, encoding="utf-8")

    print("icons written:", ", ".join(sorted(p.name for p in icons.iterdir())))


if __name__ == "__main__":
    main()
