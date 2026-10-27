"""Draws the same 500x44 channel banner at 1x (500x44) and 2x (1000x88) to compare sharpness in TS6.

TS6 shows the middle 30 px of a 44 px slice (y 7-36), hides about 150 px under the name backdrop
on the left and fades out the last ~84 px, so the test content lives in x 160-410, y 9-35.
"""
import sys
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1]
FONT = "C:/Windows/Fonts/arial.ttf"
FONT_BOLD = "C:/Windows/Fonts/arialbd.ttf"


def make(s):
    W, H = 500 * s, 44 * s
    im = Image.new("RGB", (W, H), (58, 60, 66))
    d = ImageDraw.Draw(im)
    p = lambda v: int(round(v * s))  # logical px -> image px

    # Hidden margins (top/bottom 7 px): magenta, should NOT be visible in TS6
    d.rectangle([0, 0, W - 1, p(7) - 1], fill=(255, 0, 255))
    d.rectangle([0, p(37), W - 1, H - 1], fill=(255, 0, 255))

    # Tick every 50 logical px (white, 1 logical px wide): on screen they must stay 50 px apart
    for x in range(0, 500, 50):
        if 190 < x < 300:  # keep the text area clean
            continue
        d.rectangle([p(x), p(7), p(x + 1) - 1, p(37) - 1], fill=(255, 255, 255))

    # Big label
    d.text((p(160), p(10)), f"{s}x", font=ImageFont.truetype(FONT_BOLD, p(20)), fill=(255, 220, 60))

    # Small text, the main sharpness check
    small = ImageFont.truetype(FONT, p(9))
    d.text((p(196), p(10)), "Sharp text 0123456789", font=small, fill=(255, 255, 255))
    d.text((p(196), p(22)), "The quick brown fox", font=small, fill=(255, 255, 255))

    # Grating: alternating 1 logical px black/white columns
    for i, x in enumerate(range(305, 345)):
        d.rectangle([p(x), p(10), p(x + 1) - 1, p(34) - 1], fill=(255, 255, 255) if i % 2 == 0 else (0, 0, 0))

    # Thin circle and diagonals (1 logical px)
    d.ellipse([p(352), p(10), p(376), p(34)], outline=(80, 220, 255), width=p(1))
    for k in range(0, 24, 4):
        d.line([p(382 + k), p(34), p(392 + k), p(10)], fill=(255, 255, 255), width=p(1))

    im.save(f"{OUT}/sharpness_test_{s}x_{W}x{H}.png")


make(1)
make(2)
print("ok")
