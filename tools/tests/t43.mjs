// night vision: each goggle, an enemy shining a weapon light, a fire
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  for (const gear of ['pvs7', 'pvs14', 'gpnvg18']) {
    await b.eval(`(() => { if (window._g) _g.stop(); UI.go('game');
      const lo = gr => ({ primary: 'm4', sidearm1: 'glock20', sidearm2: null, melee: 'kabar', armor: 'mtv', gear: gr, utils: [null, null, null], ammo: {}, att: {} });
      const parts = [{ id: 'me', name: 'You', team: 0, loadout: lo('${gear}'), skins: {} }, { id: 'x', name: 'Light', team: 1, isBot: true, loadout: lo('nogear'), skins: {} }, { id: 'y', name: 'Dark', team: 1, isBot: true, loadout: lo('nogear'), skins: {} }];
      const g = window._g = new Game({ mapId: 'oldtown', seed: 1001, mode: 'deathmatch', night: true, participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game'));
      g.units.forEach(u => u.ai = null); g.start();
      const me = g.byId.me; me.x = 46 * T; me.y = 36 * T; me.z = g.groundAt(me.x, me.y); me.gearOn = true; me.light = false; g.input.yaw = 0; g.input.pitch = 0;
      const x = g.byId.x; x.x = me.x + 330; x.y = me.y + 60; x.z = g.groundAt(x.x, x.y); x.angle = Math.atan2(me.y - x.y, me.x - x.x); x.light = true;
      const y = g.byId.y; y.x = me.x + 200; y.y = me.y - 60; y.z = g.groundAt(y.x, y.y); y.light = false;
      g.addFire(me.x + 260, me.y - 140, 40, 60, null, g.groundAt(me.x + 260, me.y - 140)); })()`);
    await b.sleep(1800); await b.shot('210-nv-' + gear);
  }
};
