# contact sheet: python sheet.py out.png in1.png in2.png ... (crops the lower right where the gun is, labels each)
import sys
from PIL import Image, ImageDraw
out, files = sys.argv[1], sys.argv[2:]
tiles = []
for f in files:
    im = Image.open(f).convert('RGB'); w, h = im.size
    im = im.crop((int(w * 0.3), int(h * 0.3), w, h)).resize((560, 350))
    ImageDraw.Draw(im).text((8, 8), __import__('os').path.basename(f), fill=(255, 255, 0))
    tiles.append(im)
cols = 3; rows = (len(tiles) + cols - 1) // cols
sheet = Image.new('RGB', (560 * cols, 350 * rows))
for i, t in enumerate(tiles): sheet.paste(t, ((i % cols) * 560, (i // cols) * 350))
sheet.save(out)
