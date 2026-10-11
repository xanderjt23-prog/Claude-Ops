import sys, re, json, time, os, urllib.request, urllib.parse, html
UA = {'User-Agent': 'Mozilla/5.0 (FrontlineOps hobby game asset download)'}
picks = [l.split() for l in open(sys.argv[1], encoding='utf8').read().strip().splitlines() if l.strip()]
out = sys.argv[2]; meta = {}
for key, user, sid in picks:
    page = f'https://freesound.org/people/{urllib.parse.quote(user)}/sounds/{sid}/'
    if os.path.exists(f'{out}/{key}.mp3'): continue
    s = urllib.request.urlopen(urllib.request.Request(page, headers=UA), timeout=30).read().decode('utf8', 'replace')
    m = re.search(r'data-mp3="([^"]+)"', s); t = re.search(r'data-title="([^"]*)"', s)
    lic = 'CC0' if 'creativecommons.org/publicdomain/zero' in s else ('CC BY' if 'creativecommons.org/licenses/by/' in s else 'check')
    url = m.group(1).replace('-lq.mp3', '-hq.mp3')
    data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()
    open(f'{out}/{key}.mp3', 'wb').write(data)
    json.dump({'title': html.unescape(t.group(1)), 'author': user, 'license': lic, 'source': page}, open(f'{out}/{key}.json', 'w'))
    print(key, user, sid, lic, len(data) // 1024, 'KB', html.unescape(t.group(1)))
    time.sleep(1.2)
