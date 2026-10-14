// water: fall into deep water (sink, float up with the head out), swim to the bank and climb out; bullet slowdown
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1000);
  console.log(await b.eval(`(() => { try { UI.go('game');
    const g = window._g = new Game({ mapId: '${process.env.MAP || 'forest'}', seed: 3, mode: 'deathmatch', participants: [{ id: 'me', name: 'You', team: 0, loadout: DEFAULT_LOADOUT, skins: {} }], localId: 'me', role: 'local' }, document.querySelector('#game'));
    g.start(); const m = g.map, me = g.byId.me; let deep = -1, best = 0;
    for (let i = 0; i < m.w * m.h; i++) if (m.floor[i] === F.WATER) { const w = g.waterAt((i % m.w) * T + 16, ((i / m.w) | 0) * T + 16); if (w && w.depth > best) { best = w.depth; deep = i; } }
    if (deep < 0) return 'no water';
    const x = (deep % m.w) * T + 16, y = ((deep / m.w) | 0) * T + 16, w = g.waterAt(x, y); me.x = x; me.y = y; me.z = w.surf + 60; me.vz = 0; me.grounded = false;
    const log = []; const inp = { mx: 0, my: 0, stance: 'stand' };
    for (let k = 0; k < 90; k++) { g.moveBody(me, inp, 1 / 30, 120); if (k % 10 === 0) log.push((me.z - w.surf).toFixed(0) + (me.swim ? 's' : me.wade ? 'w' : '')); }
    // swim toward the nearest dry tile and climb out
    let tgt = null, bd = 1e9; for (let i = 0; i < m.w * m.h; i++) if (m.floor[i] !== F.WATER && !m.obj[i]) { const tx = (i % m.w) * T + 16, ty = ((i / m.w) | 0) * T + 16, d = Math.hypot(tx - x, ty - y); if (d < bd) { bd = d; tgt = [tx, ty]; } }
    let out = -1; for (let k = 0; k < 30 * 20; k++) { const a = Math.atan2(tgt[1] - me.y, tgt[0] - me.x); g.moveBody(me, { mx: Math.cos(a), my: Math.sin(a), stance: 'stand' }, 1 / 30, g.moveSpeed(me, {}, null)); if (!g.waterAt(me.x, me.y) && out < 0) { out = k; } }
    const bal = ballistics(ITEMS.m4), k = bal.k * 830; const v1m = Math.exp(-k * 32), v2m = Math.exp(-k * 64);
    return JSON.stringify({ depth: best, fall: log.join(' '), reachedLandAfterFrames: out, onLandZ: +(me.z - g.groundAt(me.x, me.y)).toFixed(1), m4_speed_after_1m: v1m.toFixed(3), after_2m: v2m.toFixed(4), energy_after_1m: Math.pow(v1m, 1.6).toFixed(3) }); } catch (e) { return e.stack; } })()`));
};
