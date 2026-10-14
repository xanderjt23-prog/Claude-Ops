export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  for (const [gun, tag] of (process.env.GUNS || 'ak47,m4').split(',').map(g => [g, g])) for (const old of (process.env.OLD ? [true, false] : [false])) {
    await b.eval(`(() => { if (window._g) _g.stop(); UI.go('game'); window._realHas = window._realHas || GunReal.has; GunReal.has = ${old} ? (() => false) : window._realHas;
      for (const k in GunModel) {} const lo = { primary: '${gun}', sidearm1: 'glock20', sidearm2: null, melee: 'kabar', armor: 'mtv', gear: 'nogear', utils: [null, null, null], ammo: {}, att: {} };
      const parts = [{ id: 'me', name: 'You', team: 0, loadout: lo, skins: { ${gun}: '${old ? 'old' : 'new'}' } }, { id: 'x', name: 'x', team: 1, isBot: true, loadout: lo, skins: {} }];
      const g = window._g = new Game({ mapId: 'killhouse', seed: 1000, mode: 'deathmatch', participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game'));
      g.units.forEach(u => u.ai = null); g.start(); const me = g.byId.me; me.x = 8 * T; me.y = 17 * T; g.input.yaw = 0; g.input.pitch = 0; g.byId.x.x = 3 * T; g.byId.x.y = 3 * T; })()`);
    await b.sleep(1300); await b.shot('240-' + tag + (old ? '-old' : '-new'));
  }
};
