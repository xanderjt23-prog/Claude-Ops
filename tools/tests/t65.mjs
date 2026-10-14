// hold fire through an empty-magazine reload and log the reload timer and the view's progress
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  const gun = process.env.GUN || 'm4';
  await b.eval(`(() => { UI.go('game');
      const lo = { primary: '${gun}', sidearm1: 'glock20', sidearm2: null, melee: 'kabar', armor: 'mtv', gear: 'nogear', utils: [null, null, null], ammo: {}, att: {} };
      const parts = [{ id: 'me', name: 'You', team: 0, loadout: lo, skins: {} }, { id: 'x', name: 'x', team: 1, isBot: true, loadout: lo, skins: {} }];
      const g = window._g = new Game({ mapId: 'killhouse', seed: 1000, mode: 'deathmatch', participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game'));
      g.units.forEach(u => u.ai = null); g.start(); const me = g.byId.me; me.x = 8 * T; me.y = 17 * T; g.byId.x.x = 3 * T; g.byId.x.y = 3 * T; me.mag[me.slot] = 2;
      window._log = []; const v = g.view || Object.values(g).find(o => o && o.vm);
      setInterval(() => { g.input.lmb = true; g.input.mouseDown = true; }, 3);
      setInterval(() => _log.push([+g.time.toFixed(2), me.mag[me.slot], +me.reloadT.toFixed(2), +(v.vm.rl || 0).toFixed(2)]), 100); })()`);
  await b.sleep(+(process.env.WAIT || 25000));
  console.log(await b.eval(`JSON.stringify(_log)`));
};
