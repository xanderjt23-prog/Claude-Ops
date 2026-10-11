export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  console.log(await b.eval(`(() => {
    const m = { id: 'gen', seed: 5000, w: 92, h: 70, floor: new Uint8Array(92 * 70), obj: new Uint8Array(92 * 70), hp: new Float32Array(92 * 70), tint: new Uint8Array(92 * 70), spawns: [[], []], ffa: [], zone: null, buildings: [] };
    const rng = mulberry32(5000), B = builder(m, rng), K = genKit(m, B, rng);
    const log = []; const fp = K.fillPlot; K.fillPlot = (x, y, w, h, pick) => { const r = fp(x, y, w, h, pick); log.push([x, y, w, h, r.length].join(',')); return r; };
    GENT.town(m, B, rng, K, { spawn: 6 });
    const cnt = {}; K.occ.forEach(v => cnt[v] = (cnt[v] || 0) + 1);
    return JSON.stringify({ log, cnt, b: m.buildings.length });
  })()`));
};
