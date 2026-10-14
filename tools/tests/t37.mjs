// shadow close-ups: walls, roofs, interiors, terrain, soldiers
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  const views = [
    ['oldtown', 1001, `const bd = m.buildings[2]; me.x = (bd.x - 2) * T; me.y = (bd.y + bd.h + 3) * T; g.input.yaw = -0.6; g.input.pitch = 0.05;`, 'wall'],
    ['oldtown', 1001, `const bd = m.buildings.find(b => b.stories >= 2) || m.buildings[0]; me.x = (bd.x + 3) * T; me.y = (bd.y + 3) * T; me.z = g.groundAt(me.x, me.y); g.input.yaw = 0.7; g.input.pitch = -0.1;`, 'inside'],
    ['farm', 1002, `me.x = 40 * T; me.y = 40 * T; g.input.yaw = 0.3; g.input.pitch = -0.25;`, 'terrain'],
    ['mansion', 1009, `me.x = 70 * T; me.y = 30 * T; g.input.yaw = 1.57; g.input.pitch = 0.25;`, 'manor'],
  ];
  for (const [map, seed, place, tag] of views) {
    await b.eval(`(() => { if (window._g) _g.stop(); UI.go('game'); const parts = [{ id: 'me', name: 'You', team: 0, loadout: DEFAULT_LOADOUT, skins: {} }, { id: 'x', name: 'x', team: 1, isBot: true, loadout: DEFAULT_LOADOUT, skins: {} }];
      const g = window._g = new Game({ mapId: '${map}', seed: ${seed}, mode: 'deathmatch', participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game')); g.units.forEach(u => u.ai = null); g.start();
      const m = g.map, me = g.byId.me; ${place} if (!me.z) me.z = g.groundAt(me.x, me.y); const x = g.byId.x; x.x = me.x + Math.cos(g.input.yaw) * 90; x.y = me.y + Math.sin(g.input.yaw) * 90; x.z = g.groundAt(x.x, x.y); })()`);
    await b.sleep(1600); await b.shot('170-shadow-' + tag);
  }
};
