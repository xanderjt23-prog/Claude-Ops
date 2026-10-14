// dump the reload rig of the first-person gun (env GUN)
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  const gun = process.env.GUN || 'm4';
  await b.eval(`(() => { UI.go('game'); const prim = ITEMS['${gun}'].cat === 'primary';
      const lo = { primary: prim ? '${gun}' : 'm4', sidearm1: prim ? 'glock20' : '${gun}', sidearm2: null, melee: 'kabar', armor: 'mtv', gear: 'nogear', utils: [null, null, null], ammo: {}, att: {} };
      const parts = [{ id: 'me', name: 'You', team: 0, loadout: lo, skins: {} }, { id: 'x', name: 'x', team: 1, isBot: true, loadout: lo, skins: {} }];
      const g = window._g = new Game({ mapId: 'killhouse', seed: 1000, mode: 'deathmatch', participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game'));
      g.units.forEach(u => u.ai = null); g.start(); const me = g.byId.me; if (!prim) me.slot = 1; me.mag[me.slot] = 0;
      window._rT = setInterval(() => { const w = g.wstat(me); me.reloadT = w.reload * 0.75; }, 2); })()`);
  await b.sleep(2000);
  console.log(await b.eval(`(() => { const v = _g.view || _g.v3d || Object.values(_g).find(o => o && o.vm); const R = v.vm.rig, f = q => q ? [q.x, q.y, q.z].map(n => +n.toFixed(2)) : null;
    const m = R.parts.mag ? R.parts.mag.map(o => ({ vis: o.visible, pos: f(o.position), par: o.parent.name || o.parent.type, ps: f(o.parent.scale) })) : null;
    return JSON.stringify({ kind: R.kind, parts: Object.keys(R.parts), bottom: f(R.bottom), dir: f(R.dir), len: R.len, rest: f(R.hand && R.hand.userData.rest), hand: f(R.hand && R.hand.position), hv: R.hand && R.hand.visible, m, old: R.old && R.old.map(o => ({ vis: o.visible, pos: f(o.position) })), port: f(R.port) }); })()`));
};
