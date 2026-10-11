import sys, os, subprocess, base64, json, numpy as np, imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe(); SR = 44100; base = os.path.dirname(os.path.abspath(sys.argv[0]))
os.makedirs(os.path.join(base, 'cut'), exist_ok=True)
data = {}; total = 0
for line in open(os.path.join(base, 'cuts.txt'), encoding='utf8'):
    line = line.strip()
    if not line or line.startswith('#'): continue
    name, src, ss, dur = line.split()[:4]; ss, dur = float(ss), float(dur)
    raw = subprocess.run([FF, '-v', 'error', '-ss', str(ss), '-t', str(dur), '-i', os.path.join(base, src), '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    x = np.frombuffer(raw, dtype=np.float32).copy()
    x -= x.mean()
    # one-pole high-pass (removes DC / mic-overload thump); stronger on clips that clipped
    fc = 110.0 if name in ('shotgun', 'dryfire', 'pump') else 35.0
    a = 1.0 / (1.0 + 2 * np.pi * fc / SR); y = np.zeros_like(x); prev_x = prev_y = 0.0
    for _ in range(2):
        for i in range(len(x)): prev_y = a * (prev_y + x[i] - prev_x); prev_x = x[i]; y[i] = prev_y
        x, y, prev_x, prev_y = y.copy(), np.zeros_like(x), 0.0, 0.0
    n = len(x); fi = int(0.002 * SR); fo = int(min(0.35, dur * 0.3) * SR)
    x[:fi] *= np.linspace(0, 1, fi); x[n - fo:] *= np.linspace(1, 0, fo) ** 2
    x *= 0.89 / (np.abs(x).max() + 1e-9)  # peak -1 dBFS
    wav = os.path.join(base, 'cut', name + '.f32'); x.astype(np.float32).tofile(wav)
    mp3 = os.path.join(base, 'cut', name + '.mp3')
    r = subprocess.run([FF, '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', wav, '-c:a', 'libmp3lame', '-b:a', '96k', mp3], capture_output=True)
    if r.returncode: print(name, r.stderr.decode()[:300]); sys.exit(1)
    b = open(mp3, 'rb').read(); total += len(b)
    data[name] = base64.b64encode(b).decode()
    print('%-11s %5.2fs %6d bytes' % (name, n / SR, len(b)))
print('total', total // 1024, 'KB')
json.dump(data, open(os.path.join(base, 'cut', 'sounds.json'), 'w'))
