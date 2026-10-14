export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  const views = [['monastery', 1018, (W, H) => [W / 2 - 34, H / 2 + 26, -0.9, 0.05]], ['dam', 1019, (W, H) => [W / 2 - 4, H * 0.4 + 26, -1.57, 0.08]], ['station', 1020, (W, H) => [W / 2 - 20, H * 0.42 + 9, 0.15, -0.02]]];
  for (const [map, seed, f] of views) {
    await b.eval(`(() => { if (window._g) _g.stop(); UI.go('game'); const parts = [{ id: 'me', name: 'You', team: 0, loadout: DEFAULT_LOADOUT, skins: {} }, { id: 'x', name: 'x', team: 1, isBot: true, loadout: DEFAULT_LOADOUT, skins: {} }];
      const g = window._g = new Game({ mapId: '${map}', seed: ${seed}, mode: 'deathmatch', participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game')); g.units.forEach(u => u.ai = null); g.start();
      const m = g.map, me = g.byId.me, v = (${f.toString()})(m.w, m.h); me.x = v[0] * T; me.y = v[1] * T; me.z = g.supportAt(me.x, me.y, 9999); g.input.yaw = v[2]; g.input.pitch = v[3]; g.byId.x.x = 2 * T; g.byId.x.y = 2 * T; })()`);
    await b.sleep(1800); await b.shot('230-' + map);
  }
};
