// building close-ups on several maps
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  const shots = [['oldtown', 1001, 'brick'], ['mansion', 1009, 'manor'], ['desert', 1004, 'mud'], ['harbor', 1013, 'harbor'], ['farm', 1002, 'farm']];
  for (const [map, seed, tag] of shots) {
    console.log(tag, await b.eval(`(() => { if (window._g) _g.stop(); UI.go('game'); const parts = [{ id: 'me', name: 'You', team: 0, loadout: DEFAULT_LOADOUT, skins: {} }, { id: 'x', name: 'x', team: 1, isBot: true, loadout: DEFAULT_LOADOUT, skins: {} }];
      const g = window._g = new Game({ mapId: '${map}', seed: ${seed}, mode: 'deathmatch', participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game')); g.units.forEach(u => u.ai = null); g.start();
      const m = g.map, bs = m.buildings.filter(b => b.style && b.stories >= 1).sort((a, c) => c.w * c.h * (c.stories || 1) - a.w * a.h * (a.stories || 1)); const bd = bs[0], me = g.byId.me;
      me.x = (bd.x + bd.w / 2 + bd.w * 0.55) * T; me.y = (bd.y + bd.h + 9) * T; me.z = g.groundAt(me.x, me.y) ; g.input.yaw = Math.atan2((bd.y + bd.h / 2) * T - me.y, (bd.x + bd.w / 2) * T - me.x); g.input.pitch = 0.12;
      g.byId.x.x = 3 * T; g.byId.x.y = 3 * T; return JSON.stringify([bd.x, bd.y, bd.w, bd.h, bd.stories]); })()`));
    await b.sleep(1800); await b.shot('140-' + tag);
  }
};
