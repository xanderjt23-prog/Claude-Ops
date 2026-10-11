// generate every map (built-in + each generator theme), time it, render previews into a contact sheet
import fs from 'fs';
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  const only = process.env.ONLY || '';
  const r = await b.eval(`(() => { const NL = String.fromCharCode(10), out = [], sheet = document.createElement('canvas'); sheet.width = 1400; sheet.height = 1200; const g = sheet.getContext('2d'); g.fillStyle = '#222'; g.fillRect(0, 0, 1400, 1200); let k = 0;
    const add = (label, mk) => { if ('${only}' && !label.includes('${only}')) return; try { const t0 = performance.now(); const m = mk(); const ms = Math.round(performance.now() - t0);
      const c = Tex.cv(224, 168); MapRenderer.preview(m, c); g.drawImage(c, (k % 6) * 232 + 4, Math.floor(k / 6) * 196 + 4); g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText(label + ' ' + ms + 'ms', (k % 6) * 232 + 6, Math.floor(k / 6) * 196 + 188); k++;
      out.push(label + ': ' + ms + 'ms, ' + m.w + 'x' + m.h + ', buildings ' + m.buildings.length + ', stairs ' + m.stairs.length + ', spawns ' + m.spawns[0].length + '/' + m.spawns[1].length); } catch (e) { out.push(label + ' ERR ' + e.stack.split(NL).slice(0, 3).join(' | ')); } };
    MAPS.forEach((mp, i) => add(mp.id, () => makeMap(mp.id, 1000 + i)));
    Object.keys(MAPGEN_THEMES).forEach((th, i) => add('gen-' + th, () => makeMap('gen', 5000 + i * 77, { gen: true, theme: th, size: ['medium', 'large', 'xl'][i % 3] })));
    window._sheet = sheet.toDataURL(); return out.join(NL); })()`);
  console.log(r);
  const data = await b.eval('window._sheet');
  if (typeof data === 'string' && data.startsWith('data:')) fs.writeFileSync('tools/tests/shots/110-maps.png', Buffer.from(data.split(',')[1], 'base64'));
};
