from PIL import Image, ImageEnhance, ImageFilter, ImageOps
import sys
from pathlib import Path

def warm_tone(img, strength=0.08):
    # overlay a warm color
    overlay = Image.new('RGB', img.size, (255, 170, 120))
    return Image.blend(img, overlay, strength)

def process(input_path, output_path):
    img = Image.open(input_path).convert('RGB')

    # auto-contrast crop small extremes
    img = ImageOps.autocontrast(img, cutoff=1)

    # gentle brightness & contrast
    img = ImageEnhance.Brightness(img).enhance(1.05)
    img = ImageEnhance.Contrast(img).enhance(1.06)

    # slight warmth
    img = warm_tone(img, strength=0.06)

    # slight saturation
    img = ImageEnhance.Color(img).enhance(1.06)

    # gentle denoise via median filter and then sharpen
    img = img.filter(ImageFilter.MedianFilter(size=3))
    img = ImageEnhance.Sharpness(img).enhance(1.1)

    # save high-quality jpeg
    img.save(output_path, format='JPEG', quality=95)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('Usage: python edit_preview.py <input> <output>')
        sys.exit(1)
    process(sys.argv[1], sys.argv[2])
