#!/usr/bin/env python3
"""Generate premium PWA app icons and iOS splash screens for "אלוף הידע"."""
import math
import os
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------------------
# Color helpers
# ---------------------------------------------------------------------------
def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))

NAVY   = hex2rgb("#0b1220")
MID1   = hex2rgb("#1a2c4f")
MID2   = hex2rgb("#243b66")

GOLD_HI  = hex2rgb("#ffe07a")
GOLD_LO  = hex2rgb("#d9a521")
GOLD_RING= hex2rgb("#a6791a")
STAR_COL = hex2rgb("#fff4cf")
RIB_BLUE = hex2rgb("#3ea6ff")
RIB_PURP = hex2rgb("#7c5cff")


# ---------------------------------------------------------------------------
# Background gradient (radial-ish toward center-top blending over diagonal navy)
# ---------------------------------------------------------------------------
def make_background(size):
    """Smooth gradient: deep navy corners -> brighter blue center-top."""
    bg = Image.new("RGB", (size, size))
    px = bg.load()
    # bright focus point at center, slightly up
    cx, cy = size * 0.5, size * 0.42
    maxd = math.hypot(size * 0.5, size * 0.5) * 1.05
    for y in range(size):
        for x in range(size):
            d = math.hypot(x - cx, y - cy) / maxd
            d = max(0.0, min(1.0, d))
            # ease
            t = d * d
            # near-center vertical bias toward MID2(top) / MID1
            vert = y / size
            center_col = lerp(MID2, MID1, vert)
            col = lerp(center_col, NAVY, t)
            px[x, y] = col
    return bg


# ---------------------------------------------------------------------------
# Star polygon
# ---------------------------------------------------------------------------
def star_points(cx, cy, r_out, r_in, rot=-math.pi / 2):
    pts = []
    for i in range(10):
        ang = rot + i * math.pi / 5
        r = r_out if i % 2 == 0 else r_in
        pts.append((cx + r * math.cos(ang), cy + r * math.sin(ang)))
    return pts


# ---------------------------------------------------------------------------
# Medal emblem rendered on a transparent RGBA layer at full canvas resolution
# ---------------------------------------------------------------------------
def make_medal_layer(size, medal_diam, center=None):
    """Return an RGBA layer (size x size) with ribbons + medal + star + shadow."""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    if center is None:
        cx, cy = size / 2, size / 2
    else:
        cx, cy = center
    R = medal_diam / 2

    # ---- ribbons (drawn first, tucked behind medal) ----
    rib = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rib)
    rib_w = R * 0.62
    top_y = cy - R * 2.05
    apex_x = cx
    apex_y = cy - R * 0.15
    # blue ribbon (left)
    rd.polygon([
        (apex_x - rib_w * 0.15, apex_y),
        (apex_x - rib_w * 1.05, top_y),
        (apex_x - rib_w * 1.05 + rib_w, top_y),
        (apex_x + rib_w * 0.35, apex_y),
    ], fill=RIB_BLUE + (255,))
    # purple ribbon (right)
    rd.polygon([
        (apex_x + rib_w * 0.15, apex_y),
        (apex_x + rib_w * 1.05, top_y),
        (apex_x + rib_w * 1.05 - rib_w, top_y),
        (apex_x - rib_w * 0.35, apex_y),
    ], fill=RIB_PURP + (255,))
    layer.alpha_composite(rib)

    # ---- drop shadow ----
    sh = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    off = R * 0.10
    sbox = [cx - R, cy - R + off, cx + R, cy + R + off]
    sd.ellipse(sbox, fill=(0, 0, 0, 150))
    sh = sh.filter(ImageFilter.GaussianBlur(R * 0.10))
    layer.alpha_composite(sh)

    # ---- medal disc with radial gold gradient (hi top-left -> lo bottom-right) ----
    medal = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mp = medal.load()
    lx, ly = cx - R * 0.45, cy - R * 0.45   # highlight focus top-left
    maxd = R * 1.9
    x0, y0 = int(cx - R - 2), int(cy - R - 2)
    x1, y1 = int(cx + R + 2), int(cy + R + 2)
    R2 = R * R
    for y in range(y0, y1):
        for x in range(x0, x1):
            dx, dy = x - cx, y - cy
            if dx * dx + dy * dy <= R2:
                t = math.hypot(x - lx, y - ly) / maxd
                t = max(0.0, min(1.0, t))
                mp[x, y] = lerp(GOLD_HI, GOLD_LO, t) + (255,)
    layer.alpha_composite(medal)

    md = ImageDraw.Draw(layer)
    # outer ring outline
    ring_w = max(2, int(R * 0.06))
    md.ellipse([cx - R, cy - R, cx + R, cy + R], outline=GOLD_RING + (255,), width=ring_w)
    # inner decorative ring
    ri = R * 0.80
    md.ellipse([cx - ri, cy - ri, cx + ri, cy + ri],
               outline=GOLD_RING + (120,), width=max(1, int(R * 0.02)))

    # soft inner highlight (top-left glow)
    hi = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    hd = ImageDraw.Draw(hi)
    hr = R * 0.55
    hcx, hcy = cx - R * 0.30, cy - R * 0.30
    hd.ellipse([hcx - hr, hcy - hr, hcx + hr, hcy + hr], fill=(255, 255, 255, 70))
    hi = hi.filter(ImageFilter.GaussianBlur(R * 0.18))
    # clip highlight to medal
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse([cx - R, cy - R, cx + R, cy + R], fill=255)
    layer.paste(hi, (0, 0), Image.composite(hi.split()[3], Image.new("L", (size, size), 0), mask))

    # ---- star ----
    star_r = R * 0.58
    pts = star_points(cx, cy, star_r, star_r * 0.42)
    # subtle star shadow
    sst = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(sst).polygon(
        [(p[0] + R * 0.015, p[1] + R * 0.02) for p in pts], fill=(120, 80, 10, 130))
    sst = sst.filter(ImageFilter.GaussianBlur(R * 0.03))
    layer.alpha_composite(sst)
    md.polygon(pts, fill=STAR_COL + (255,))
    # star outline
    md.line(pts + [pts[0]], fill=GOLD_RING + (90,), width=max(1, int(R * 0.012)), joint="curve")

    return layer


# ---------------------------------------------------------------------------
# Build a full square icon (background + medal) at 4x supersample
# ---------------------------------------------------------------------------
def build_icon(final_size, medal_frac=0.72):
    SS = 4
    big = final_size * SS if final_size * SS <= 4096 else 4096
    # always supersample relative to final
    big = final_size * SS
    bg = make_background(big)
    medal = make_medal_layer(big, big * medal_frac)
    out = bg.convert("RGBA")
    out.alpha_composite(medal)
    out = out.convert("RGB")
    return out.resize((final_size, final_size), Image.LANCZOS)


def build_splash(w, h, medal_width_frac=0.28, medal_y_frac=0.38):
    SS = 2
    bw, bh = w * SS, h * SS
    # background: reuse square gradient logic but on portrait canvas
    bg = Image.new("RGB", (bw, bh))
    px = bg.load()
    cx, cy = bw * 0.5, bh * 0.42
    maxd = math.hypot(bw * 0.5, bh * 0.5) * 1.05
    for y in range(bh):
        for x in range(bw):
            d = min(1.0, math.hypot(x - cx, y - cy) / maxd)
            t = d * d
            vert = y / bh
            center_col = lerp(MID2, MID1, vert)
            px[x, y] = lerp(center_col, NAVY, t)
    out = bg.convert("RGBA")
    medal_diam = bw * medal_width_frac
    center = (bw * 0.5, bh * medal_y_frac)
    medal = make_medal_layer_canvas(bw, bh, medal_diam, center)
    out.alpha_composite(medal)
    out = out.convert("RGB")
    return out.resize((w, h), Image.LANCZOS)


def make_medal_layer_canvas(cw, ch, medal_diam, center):
    """Medal layer on a non-square (portrait) canvas."""
    layer = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    cx, cy = center
    R = medal_diam / 2

    rib = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rib)
    rib_w = R * 0.62
    top_y = cy - R * 2.05
    apex_x, apex_y = cx, cy - R * 0.15
    rd.polygon([(apex_x - rib_w * 0.15, apex_y), (apex_x - rib_w * 1.05, top_y),
                (apex_x - rib_w * 1.05 + rib_w, top_y), (apex_x + rib_w * 0.35, apex_y)],
               fill=RIB_BLUE + (255,))
    rd.polygon([(apex_x + rib_w * 0.15, apex_y), (apex_x + rib_w * 1.05, top_y),
                (apex_x + rib_w * 1.05 - rib_w, top_y), (apex_x - rib_w * 0.35, apex_y)],
               fill=RIB_PURP + (255,))
    layer.alpha_composite(rib)

    sh = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    off = R * 0.10
    ImageDraw.Draw(sh).ellipse([cx - R, cy - R + off, cx + R, cy + R + off], fill=(0, 0, 0, 150))
    layer.alpha_composite(sh.filter(ImageFilter.GaussianBlur(R * 0.10)))

    medal = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    mp = medal.load()
    lx, ly = cx - R * 0.45, cy - R * 0.45
    maxd = R * 1.9
    R2 = R * R
    for y in range(int(cy - R - 2), int(cy + R + 2)):
        for x in range(int(cx - R - 2), int(cx + R + 2)):
            dx, dy = x - cx, y - cy
            if dx * dx + dy * dy <= R2:
                t = min(1.0, math.hypot(x - lx, y - ly) / maxd)
                mp[x, y] = lerp(GOLD_HI, GOLD_LO, t) + (255,)
    layer.alpha_composite(medal)

    md = ImageDraw.Draw(layer)
    md.ellipse([cx - R, cy - R, cx + R, cy + R], outline=GOLD_RING + (255,), width=max(2, int(R * 0.06)))
    ri = R * 0.80
    md.ellipse([cx - ri, cy - ri, cx + ri, cy + ri], outline=GOLD_RING + (120,), width=max(1, int(R * 0.02)))

    star_r = R * 0.58
    pts = star_points(cx, cy, star_r, star_r * 0.42)
    sst = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    ImageDraw.Draw(sst).polygon([(p[0] + R * 0.015, p[1] + R * 0.02) for p in pts], fill=(120, 80, 10, 130))
    layer.alpha_composite(sst.filter(ImageFilter.GaussianBlur(R * 0.03)))
    md.polygon(pts, fill=STAR_COL + (255,))
    return layer


# ---------------------------------------------------------------------------
# Render everything
# ---------------------------------------------------------------------------
def save(img, name):
    p = os.path.join(OUT, name)
    img.save(p, "PNG", optimize=True)
    print("wrote", name, img.size)


def main():
    # master 1024
    master = build_icon(1024)
    save(master, "icon-1024.png")
    save(master.resize((512, 512), Image.LANCZOS), "icon-512.png")
    save(master.resize((192, 192), Image.LANCZOS), "icon-192.png")
    save(master.resize((180, 180), Image.LANCZOS), "apple-touch-icon.png")
    save(master.resize((32, 32), Image.LANCZOS), "favicon-32.png")
    save(master.resize((16, 16), Image.LANCZOS), "favicon-16.png")

    # maskable: content within central 80% -> medal_frac scaled to 0.72*0.8
    mask512 = build_icon(512, medal_frac=0.72 * 0.8)
    save(mask512, "icon-512-maskable.png")
    save(build_icon(192, medal_frac=0.72 * 0.8), "icon-192-maskable.png")

    # splash screens
    sizes = [(1290, 2796), (1179, 2556), (1170, 2532), (1284, 2778),
             (1125, 2436), (828, 1792), (750, 1334)]
    for w, h in sizes:
        sp = build_splash(w, h)
        save(sp, f"splash-{w}x{h}.png")


if __name__ == "__main__":
    main()
