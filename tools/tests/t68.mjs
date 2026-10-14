// hold the trigger and take screenshots (cases ejecting, the belt moving): env GUNS, ATT
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  for (const gun of (process.env.GUNS || 'm4').split(',')) {
    await b.eval(`(() => { if (window._g) _g.stop(); (window._iv || []).forEach(clearInterval); window._iv = []; UI.go('game'); const prim = ITEMS['${gun}'].cat === 'primary', atts = ${process.env.ATT || '[]'};
      const lo = { primary: prim ? '${gun}' : 'm4', sidearm1: prim ? 'glock20' : '${gun}', sidearm2: null, melee: 'kabar', armor: 'mtv', gear: 'nogear', utils: [null, null, null], ammo: {}, att: { '${gun}': Object.fromEntries(atts.map(a => [ITEMS[a].slot, a])) } };
      const parts = [{ id: 'me', name: 'You', team: 0, loadout: lo, skins: {} }, { id: 'x', name: 'x', team: 1, isBot: true, loadout: lo, skins: {} }];
      const g = window._g = new Game({ mapId: 'killhouse', seed: 1000, mode: 'deathmatch', participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game'));
      g.units.forEach(u => u.ai = null); g.start(); const me = g.byId.me; me.x = 8 * T; me.y = 17 * T; g.input.yaw = 0; g.input.pitch = 0; g.byId.x.x = 3 * T; g.byId.x.y = 3 * T; if (!prim) me.slot = 1;
      let n = 0; _iv.push(setInterval(() => { g.input.lmb = (n++ % 40) < 30; if (${process.env.ADS ? 1 : 0}) g.input.rmb = true; me.mag[me.slot] = Math.max(me.mag[me.slot], 3); }, 5)); })()`);
    await b.sleep(2500);
    for (let i = 0; i < 3; i++) { await b.shot('330-' + gun + '-f' + i); await b.sleep(90); }
    await b.eval(`(_iv || []).forEach(clearInterval); _g.input.lmb = false; _iv.push(setInterval(() => { _g.input.lmb = false; _g.input.pitch = -0.75; _g.input.yaw = 1.2; }, 5));`);
    await b.sleep(2500); await b.shot('330-' + gun + '-ground');
    for (let q = 0; q < 2; q++) { console.log(gun, await b.eval(`JSON.stringify(_g.casings.slice(-4).map(c => [Math.round(c.x - _g.byId.me.x), Math.round(c.y - _g.byId.me.y), +c.z.toFixed(1), +c.vz.toFixed(1), +(c.g0 || 0).toFixed(0), +c.t.toFixed(2), c.landed ? 1 : 0]))`)); await b.sleep(500); }
  }
};
