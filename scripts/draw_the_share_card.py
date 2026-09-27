#!/usr/bin/env python3
"""Draw the card a link to this page shows when it is pasted somewhere.

**The card carries no numbers, on purpose.** A share card with "485 tests" on it is a
card that is wrong the next morning, and this repository exists because a page should
not do that quietly. So the card says what the project *is* and where it lives, both of
which are true for as long as the project exists, and the numbers stay on the page where
a build puts them.

Drawn with Pillow, once, and committed as a binary. Nothing in the build needs a font
renderer, and a card that is regenerated is a card that can be generated wrongly.

    python3 scripts/draw_the_share_card.py
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

WIDTH, HEIGHT = 1200, 630
INK = (24, 24, 27)
PAPER = (250, 250, 249)
MUTED = (113, 113, 122)
LINE = (228, 228, 231)
AMBER = (217, 119, 6)


def a_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    """The first of these that exists, so the card is the same on any machine."""
    for a_name in (
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/SFNS.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        if Path(a_name).exists():
            return ImageFont.truetype(a_name, size)
    return ImageFont.load_default()


def draw_the_card() -> Image.Image:
    the_card = Image.new("RGB", (WIDTH, HEIGHT), PAPER)
    the_pen = ImageDraw.Draw(the_card)

    the_pen.rectangle([0, 0, WIDTH, 6], fill=INK)

    the_pen.text((80, 70), "ai-sdlc-os", font=a_font(30, bold=True), fill=INK)
    the_pen.text(
        (80, 150),
        "An AI that ships a pull request,",
        font=a_font(58, bold=True),
        fill=INK,
    )
    the_pen.text((80, 222), "and shows its working.", font=a_font(58, bold=True), fill=MUTED)

    the_pen.text(
        (80, 330),
        "Language models do bounded reasoning inside a state machine,",
        font=a_font(24),
        fill=INK,
    )
    the_pen.text(
        (80, 366),
        "a fixed set of tools, and gates a person has to pass.",
        font=a_font(24),
        fill=INK,
    )

    the_pen.line([(80, 440), (WIDTH - 80, 440)], fill=LINE, width=2)

    for where_it_is, (a_colour, a_label) in enumerate(
        [
            (MUTED, "A stage is a stage"),
            (AMBER, "A person approves"),
            (INK, "A pull request follows"),
        ]
    ):
        the_left = 80 + where_it_is * 350
        the_pen.ellipse([the_left, 476, the_left + 12, 488], fill=a_colour)
        the_pen.text((the_left + 26, 468), a_label, font=a_font(21), fill=a_colour)

    the_pen.text(
        (80, 540),
        "github.com/steamnoid/ai-sdlc-os",
        font=a_font(21),
        fill=MUTED,
    )

    return the_card


if __name__ == "__main__":
    where_it_should_land = Path(sys.argv[1] if len(sys.argv) > 1 else "public/og-image.png")
    draw_the_card().save(where_it_should_land, "PNG", optimize=True)
    print(f"drew {where_it_should_land}")
