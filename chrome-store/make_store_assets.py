from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(__file__).resolve().parent

header = Image.open(ROOT / 'public/header_lnklokr.png').convert('RGB')
icon = Image.open(ROOT / 'icons/icon-128.png').convert('RGBA')
ui = Image.open(ROOT / 'icons/LnkLokr extension image..JPG').convert('RGB')
og = Image.open(ROOT / 'public/og-image.png').convert('RGB')


def fit_cover(img, size):
    tw, th = size
    scale = max(tw / img.width, th / img.height)
    nw, nh = int(img.width * scale), int(img.height * scale)
    resized = img.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - tw) // 2
    top = (nh - th) // 2
    return resized.crop((left, top, left + tw, top + th))


def fit_contain(img, size, bg=(255, 245, 248)):
    canvas = Image.new('RGB', size, bg)
    tw, th = size
    scale = min(tw / img.width, th / img.height)
    nw, nh = max(1, int(img.width * scale)), max(1, int(img.height * scale))
    resized = img.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas.paste(resized, ((tw - nw) // 2, (th - nh) // 2))
    return canvas


def gradient(size, left=(252, 231, 243), right=(254, 215, 170)):
    w, h = size
    img = Image.new('RGB', size)
    px = img.load()
    for x in range(w):
        t = x / max(w - 1, 1)
        r = int(left[0] + (right[0] - left[0]) * t)
        g = int(left[1] + (right[1] - left[1]) * t)
        b = int(left[2] + (right[2] - left[2]) * t)
        for y in range(h):
            px[x, y] = (r, g, b)
    return img


def font(size):
    for name in ('arial.ttf', 'C:/Windows/Fonts/arial.ttf', 'segoeui.ttf', 'C:/Windows/Fonts/segoeui.ttf'):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


# 1) Required screenshot 1280x800
shot = gradient((1280, 800))
h_banner = fit_contain(header, (1100, 140), bg=(251, 207, 232))
shot.paste(h_banner, (90, 40))
ui_panel = fit_contain(ui, (520, 560), bg=(255, 255, 255))
bordered = Image.new('RGB', (528, 568), (0, 0, 0))
bordered.paste(ui_panel, (4, 4))
shot.paste(bordered, (80, 200))
draw = ImageDraw.Draw(shot)
draw.text((660, 260), 'LnkLokr Saver', fill=(17, 24, 39), font=font(48))
draw.text((660, 330), 'Right-click to save links,', fill=(55, 65, 81), font=font(28))
draw.text((660, 370), 'images & notes from any page.', fill=(55, 65, 81), font=font(28))
draw.text((660, 440), 'Keep · Borrow · Share · Bury', fill=(219, 39, 119), font=font(22))
draw.text((660, 480), 'Dream Keeper', fill=(219, 39, 119), font=font(22))
icon_rgb = Image.new('RGB', icon.size, (255, 255, 255))
icon_rgb.paste(icon, mask=icon.split()[-1])
shot.paste(icon_rgb.resize((96, 96), Image.Resampling.LANCZOS), (660, 540))
shot.save(OUT / 'screenshot-1-1280x800.jpg', 'JPEG', quality=92)
shot.resize((640, 400), Image.Resampling.LANCZOS).save(OUT / 'screenshot-1-640x400.jpg', 'JPEG', quality=92)

# 2) Small promo 440x280
small = gradient((440, 280), left=(251, 207, 232), right=(253, 186, 116))
small.paste(fit_contain(header, (360, 100), bg=(251, 207, 232)), (40, 50))
d = ImageDraw.Draw(small)
d.text((40, 170), 'LnkLokr Saver', fill=(17, 24, 39), font=font(26))
d.text((40, 210), 'Right-click save from any page', fill=(75, 85, 99), font=font(18))
small.save(OUT / 'small-promo-440x280.jpg', 'JPEG', quality=92)

# 3) Marquee 1400x560
fit_cover(og, (1400, 560)).save(OUT / 'marquee-1400x560.jpg', 'JPEG', quality=92)

print('Created:')
for p in sorted(OUT.glob('*.jpg')):
    im = Image.open(p)
    print(f'  {p.name}: {im.size[0]}x{im.size[1]} {im.mode}')
