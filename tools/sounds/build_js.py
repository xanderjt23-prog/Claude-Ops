# Writes js/sounds.js from cut/sounds.json (made by cut.py) plus licence metadata of every source clip.
import json, os
base = os.path.dirname(os.path.abspath(__file__))
data = json.load(open(os.path.join(base, 'cut', 'sounds.json')))
cuts = [l.split() for l in open(os.path.join(base, 'cuts.txt'), encoding='utf8') if l.strip() and not l.startswith('#')]
srcmeta = {}
for name, src, *_ in cuts:
    key = os.path.splitext(os.path.basename(src))[0]
    meta = json.load(open(os.path.join(base, os.path.dirname(src), key + '.json'), encoding='utf8'))
    s = srcmeta.setdefault(meta['source'], {'title': meta['title'], 'author': meta['author'], 'license': meta['license'], 'source': meta['source'], 'used': []})
    s['used'].append(name)
for s in srcmeta.values():
    if s['license'] == 'CC0': s['license'] = 'CC0 (public domain)'
    s['site'] = 'Freesound' if 'freesound' in s['source'] else 'Wikimedia Commons'
out = '// Real recorded sound effects (cut, normalised and encoded as MP3 by tools/sounds). Embedded as base64 so the game also\n// works when index.html is opened straight from disk, where browsers block fetch() of local files.\n'
out += 'window.SOUND_CREDITS = ' + json.dumps(list(srcmeta.values()), indent=1, ensure_ascii=False) + ';\n'
out += 'window.SOUND_DATA = {\n' + ',\n'.join(f' {k}: "{v}"' for k, v in data.items()) + '\n};\n'
open(os.path.join(base, '..', '..', 'js', 'sounds.js'), 'w', encoding='utf8').write(out)
print(len(data), 'clips,', len(srcmeta), 'sources')
