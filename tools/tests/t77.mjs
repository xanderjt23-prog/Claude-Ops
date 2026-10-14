// running with a gun: screenshots through the walk bob (env GUNS)
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1200);
  for (const gun of (process.env.GUNS || 'm4').split(',')) {
    await b.eval(`(() => { if (window._g) _g.stop(); (window._iv || []).forEach(clearInterval); window._iv = []; UI.go('game'); const prim = ITEMS['${gun}'].cat === 'primary';
      const lo = { primary: prim ? '${gun}' : 'm4', sidearm1: prim ? 'glock20' : '${gun}', sidearm2: null, melee: 'kabar', armor: 'mtv', gear: 'nogear', utils: [null, null, null], ammo: {}, att: {} };
      const g = window._g = new Game({ mapId: 'killhouse', seed: 1000, mode: 'deathmatch', participants: [{ id: 'me', name: 'You', team: 0, loadout: lo, skins: {} }, { id: 'x', name: 'x', team: 1, isBot: true, loadout: lo, skins: {} }], localId: 'me', role: 'local' }, document.querySelector('#game'));
      g.units.forEach(u => u.ai = null); g.start(); const me = g.byId.me; me.x = 8 * T; me.y = 17 * T; g.byId.x.x = 3 * T; g.byId.x.y = 3 * T; if (!prim) me.slot = 1;
      let n = 0; _iv.push(setInterval(() => { me.moving = true; me.walk = (n++) * 0.09; me.x = 8 * T; me.y = 17 * T; }, 5)); })()`);
    await b.sleep(1500);
    for (let i = 0; i < 3; i++) { await b.shot('350-' + gun + '-run' + i); await b.sleep(170); }
  }
};
