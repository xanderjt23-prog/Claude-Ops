export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1000);
  console.log(await b.eval(`(() => { const out = []; for (const s of [1000, 8919, 16838, 24757, 32676, 40595]) { const m = makeMap('gen', s, { gen: true, theme: 'described', size: 'medium', prompt: 'a casino in the desert with a big car park' }); out.push(s + ':' + m.buildings.slice(0, 2).map(b => b.w + 'x' + b.h).join(',') + ' ' + (m.described && m.described.summary)); } return out.join(' | '); })()`));
};
