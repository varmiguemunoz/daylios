import sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
TILE = (19, 19, 19, 255)


def logo() -> Image.Image:
    image = Image.open(ROOT / 'build' / 'logo.png').convert('RGBA')
    return image.crop(image.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox())


def fit(image: Image.Image, box: int) -> Image.Image:
    scale = box / max(image.size)
    return image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)


def paste_center(canvas: Image.Image, image: Image.Image) -> Image.Image:
    canvas.alpha_composite(image, ((canvas.width - image.width) // 2, (canvas.height - image.height) // 2))
    return canvas


def tile(size: int, inset: float, radius: float, mark: float) -> Image.Image:
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    edge = round(size * inset)
    ImageDraw.Draw(canvas).rounded_rectangle(
        (edge, edge, size - edge - 1, size - edge - 1), radius=round(size * radius), fill=TILE
    )
    return paste_center(canvas, fit(logo(), round(size * mark)))


def silhouette(size: int) -> Image.Image:
    alpha = fit(logo(), size).getchannel('A')
    black = Image.new('RGBA', alpha.size, (0, 0, 0, 255))
    black.putalpha(alpha)
    return paste_center(Image.new('RGBA', (size, size), (0, 0, 0, 0)), black)


def main() -> None:
    tile(1024, 0.1, 0.18, 0.56).save(ROOT / 'build' / 'icon.png')
    tile(512, 0.1, 0.18, 0.56).save(ROOT / 'resources' / 'icon.png')
    silhouette(18).save(ROOT / 'resources' / 'trayTemplate.png')
    silhouette(36).save(ROOT / 'resources' / 'trayTemplate@2x.png')
    tray = tile(256, 0.0, 0.2, 0.74)
    tray.save(ROOT / 'resources' / 'tray.ico', sizes=[(16, 16), (20, 20), (24, 24), (32, 32), (48, 48), (64, 64)])


if __name__ == '__main__':
    sys.exit(main())
