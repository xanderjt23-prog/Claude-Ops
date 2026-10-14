// car close-ups
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  for (const [map, seed, tag] of [['oldtown_xl', 1016, 'city'], ['airfield', 1007, 'air']]) {
    console.log(await b.eval(`(() => { if (window._g) _g.stop(); UI.go('game'); const parts = [{ id: 'me', name: 'You', team: 0, loadout: DEFAULT_LOADOUT, skins: {} }, { id: 'x', name: 'x', team: 1, isBot: true, loadout: DEFAULT_LOADOUT, skins: {} }];
      const g = window._g = new Game({ mapId: '${map}', seed: ${seed}, mode: 'deathmatch', participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game')); g.units.forEach(u => u.ai = null); g.start();
      const m = g.map; let best = -1, bc = 0; for (let i = 0; i < m.w * m.h; i++) if (m.obj[i] === 15) { let c = 0; const x = i % m.w, y = (i / m.w) | 0; for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) if (m.obj[(y + dy) * m.w + x + dx] === 15) c++; if (c > bc) { bc = c; best = i; } }
      const me = g.byId.me, cx = (best % m.w) * T, cy = ((best / m.w) | 0) * T; me.x = cx - 110; me.y = cy - 90; me.z = g.groundAt(me.x, me.y) + 30; g.input.yaw = Math.atan2(cy - me.y, cx - me.x); g.input.pitch = -0.32; g.byId.x.x = 2 * T; g.byId.x.y = 2 * T;
      return 'cars near: ' + bc; })()`));
    await b.sleep(1800); await b.shot('200-cars-' + tag);
  }
};
