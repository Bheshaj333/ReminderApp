"""
Builds Play Store marketing screenshots (1080x1920) from raw phone screenshots.

Each slide: brand gradient + soft glows, headline + subline, and the app screen inside a
phone frame that runs off the bottom edge. The phone's status bar and gesture handle are
cropped off and replaced with a clean status bar.

Usage:  python scripts/make-store-screenshots.py
Input:  docs/store-assets/screenshots/{lock-screen,today,new-reminder,voice,reminders-list}.jpeg
        (retake a screenshot -> save it under the same name -> rerun)
Output: docs/store-assets/phone/01-*.png ...
"""
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), '..', 'docs', 'store-assets')
SRC = os.path.join(ROOT, 'screenshots')
OUT = os.path.join(ROOT, 'phone')
FONTS = 'C:/Windows/Fonts/'

W, H = 1080, 1920
SS = 2  # supersample for smooth edges

SLIDES = [
    # (source file, headline line 1, headline line 2 (accent), subline, glow tint[, 'full'])
    # 'full' shrinks the phone so the whole screen (incl. bottom buttons) is visible
    ('lock-screen.jpeg', 'It speaks.', 'You listen.',
     'Your reminder read out loud, even on the lock screen', (120, 70, 220), 'full'),
    ('today.jpeg', 'Always know', "what's next.",
     'A live countdown to your next reminder', (40, 200, 190)),
    ('new-reminder.jpeg', 'Rings again', 'until you act.',
     'Up to 11 rings, as far apart as you like', (72, 150, 255)),
    ('voice.jpeg', 'Pick a voice', 'you love.',
     'Many languages · speed · pitch · preview', (180, 110, 240)),
    ('reminders-list.jpeg', 'Any schedule.', 'Never missed.',
     'Once, daily, weekends, every 3 months…', (40, 200, 190)),
]

STATUS_CROP = 0.046   # fraction of the raw screenshot height taken by the status bar
GESTURE_CROP = 0.030  # fraction taken by the gesture handle at the bottom


def font(name, size):
    return ImageFont.truetype(FONTS + name, size * SS)


def background(tint):
    """Deep teal radial gradient with two soft glows (one tinted per slide)."""
    small = Image.new('RGB', (108, 192))
    px = small.load()
    for y in range(192):
        for x in range(108):
            d = ((x - 54) ** 2 + (y - 60) ** 2) ** 0.5 / 140
            d = min(1, d) ** 1.1
            px[x, y] = tuple(int(a + (b - a) * d) for a, b in zip((22, 74, 66), (4, 16, 17)))
    bg = small.resize((W * SS, H * SS), Image.BICUBIC).convert('RGBA')
    glow = Image.new('RGBA', bg.size, (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    g.ellipse([-300 * SS, 1100 * SS, 700 * SS, 2100 * SS], fill=tint + (70,))
    g.ellipse([600 * SS, -250 * SS, 1400 * SS, 550 * SS], fill=(60, 220, 190, 55))
    glow = glow.filter(ImageFilter.GaussianBlur(170 * SS))
    return Image.alpha_composite(bg, glow)


def clean_screen(path):
    """Crop status bar + gesture handle, then draw a tidy status bar in the screen's own colours."""
    im = Image.open(path).convert('RGB')
    w, h = im.size
    top, bottom = int(h * STATUS_CROP), int(h * (1 - GESTURE_CROP))
    body = im.crop((0, top, w, bottom))
    bar_h = int(w * 0.075)
    screen = Image.new('RGB', (w, body.height + bar_h), body.getpixel((w // 2, 2)))
    screen.paste(body, (0, bar_h))
    # status bar text colour: dark on light screens, white on dark ones
    r, g, b = body.getpixel((w // 2, 2))
    ink = (255, 255, 255) if (r * 299 + g * 587 + b * 114) / 1000 < 128 else (30, 40, 36)
    d = ImageDraw.Draw(screen)
    f = ImageFont.truetype(FONTS + 'seguisb.ttf', int(w * 0.034))
    d.text((int(w * 0.07), int(bar_h * 0.22)), '9:41', font=f, fill=ink)
    # battery + signal glyphs
    bx, by, bw, bh = int(w * 0.86), int(bar_h * 0.36), int(w * 0.06), int(bar_h * 0.32)
    d.rounded_rectangle([bx, by, bx + bw, by + bh], radius=bh // 4, outline=ink, width=max(2, w // 400))
    d.rounded_rectangle([bx + 4, by + 4, bx + int(bw * 0.8), by + bh - 4], radius=bh // 6, fill=ink)
    d.rectangle([bx + bw + 2, by + bh // 3, bx + bw + 6, by + 2 * bh // 3], fill=ink)
    sx = int(w * 0.78)
    for i in range(4):
        hgt = int(bh * (0.35 + 0.22 * i))
        d.rectangle([sx + i * int(w * 0.011), by + bh - hgt, sx + i * int(w * 0.011) + int(w * 0.007), by + bh], fill=ink)
    return screen


def phone(screen, width):
    """Screen inside a dark rounded phone frame with a thin rim highlight."""
    bezel = int(width * 0.028)
    sw = width - 2 * bezel
    sh = int(screen.height * sw / screen.width)
    screen = screen.resize((sw, sh), Image.LANCZOS)
    radius = int(width * 0.11)
    frame = Image.new('RGBA', (width, sh + 2 * bezel), (0, 0, 0, 0))
    d = ImageDraw.Draw(frame)
    d.rounded_rectangle([0, 0, width - 1, sh + 2 * bezel - 1], radius=radius, fill=(10, 14, 13, 255))
    d.rounded_rectangle([1, 1, width - 2, sh + 2 * bezel - 2], radius=radius, outline=(90, 120, 112, 255), width=max(2, SS))
    mask = Image.new('L', (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, sw - 1, sh - 1], radius=radius - bezel, fill=255)
    frame.paste(screen, (bezel, bezel), mask)
    # punch-hole camera
    cx, cy, cr = width // 2, bezel + int(width * 0.04), int(width * 0.016)
    d.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], fill=(5, 8, 8, 255))
    return frame


def slide(src, line1, line2, sub, tint, mode='bleed'):
    canvas = background(tint)
    d = ImageDraw.Draw(canvas)

    # Brand pill
    pill_font = font('seguisb.ttf', 24)
    label = 'TALKING REMINDER'
    tw = d.textlength(label, font=pill_font) + 6 * SS * (len(label) - 1) * 0  # letter spacing drawn manually below
    x = 90 * SS
    y = 120 * SS
    cx = x
    for ch in label:
        d.text((cx, y), ch, font=pill_font, fill=(168, 240, 220, 230))
        cx += d.textlength(ch, font=pill_font) + 5 * SS

    # Headline
    h1 = font('georgiab.ttf', 92)
    d.text((x, 185 * SS), line1, font=h1, fill=(255, 255, 255, 255))
    d.text((x, 295 * SS), line2, font=h1, fill=(140, 240, 210, 255))
    d.text((x, 425 * SS), sub, font=font('segoeui.ttf', 36), fill=(255, 255, 255, 200))

    # Phone: shadow, then frame; it runs off the bottom edge
    screen = clean_screen(os.path.join(SRC, src))
    py = 545 * SS
    if mode == 'full':
        # widest phone whose full height still fits above a bottom margin
        avail = H * SS - py - 70 * SS
        pw = int(avail / (screen.height / screen.width * 0.944 + 0.056))
    else:
        pw = 800 * SS
    ph = phone(screen, pw)
    px = (W * SS - pw) // 2
    shadow = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([px + 10 * SS, py + 30 * SS, px + pw - 10 * SS, py + ph.height], radius=90 * SS, fill=(0, 0, 0, 150))
    canvas = Image.alpha_composite(canvas, shadow.filter(ImageFilter.GaussianBlur(40 * SS)))
    glow = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([px - 60 * SS, py - 40 * SS, px + pw + 60 * SS, py + 600 * SS], fill=(120, 232, 200, 40))
    canvas = Image.alpha_composite(canvas, glow.filter(ImageFilter.GaussianBlur(90 * SS)))
    canvas.alpha_composite(ph, (px, py))
    return canvas.resize((W, H), Image.LANCZOS).convert('RGB')


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.endswith('.png'):
            os.remove(os.path.join(OUT, f))
    names = ['lock-screen-alarm', 'today-next-up', 'ring-again', 'voice', 'any-schedule']
    for i, (s, name) in enumerate(zip(SLIDES, names), 1):
        out = os.path.join(OUT, f'{i:02d}-{name}.png')
        slide(*s).save(out, optimize=True)
        print('wrote', os.path.relpath(out))
