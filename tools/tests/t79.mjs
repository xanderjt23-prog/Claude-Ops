// generate maps from descriptions: what was understood, the score, and top-down previews in one image
import fs from 'fs';
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1000);
  const prompts = JSON.parse(process.env.PROMPTS);
  const r = await b.eval(`(() => { try { const out = [], ps = ${JSON.stringify(prompts)}; const sheet = document.createElement('canvas'); sheet.width = 448 * 3; sheet.height = 336 * Math.ceil(ps.length / 3); const g = sheet.getContext('2d');
    ps.forEach((p, k) => { const t0 = performance.now(); let best = null, bs = -1; for (let s = 0; s < 4; s++) { const mm = makeMap('gen', 1000 + s * 7919, { gen: true, theme: 'described', size: 'medium', prompt: p }); const sc = scoreMap(mm); if (sc > bs) { bs = sc; best = mm; } }
      const c = document.createElement('canvas'); c.width = 448; c.height = 336; MapRenderer.preview(best, c); g.drawImage(c, (k % 3) * 448, Math.floor(k / 3) * 336); g.fillStyle = '#ff0'; g.font = '14px sans-serif'; g.fillText(p.slice(0, 55), (k % 3) * 448 + 6, Math.floor(k / 3) * 336 + 16);
      const bl = best.buildings.map(b => b.w + 'x' + b.h + '/' + (b.stories || 1)).slice(0, 4).join(' ');
      out.push(p + ' => ' + best.described.name + ' | ' + best.described.summary + ' | score ' + bs.toFixed(0) + ' | ' + bl + ' | ' + Math.round(performance.now() - t0) + 'ms'); });
    return JSON.stringify({ out, img: sheet.toDataURL('image/png') }); } catch (e) { return JSON.stringify({ out: [e.stack] }); } })()`);
  const d = JSON.parse(r); d.out.forEach(l => console.log(l)); if (d.img) fs.writeFileSync('tools/tests/shots/s-desc.png', Buffer.from(d.img.split(',')[1], 'base64'));
};
