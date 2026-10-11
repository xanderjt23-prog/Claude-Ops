export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  console.log(await b.eval(`(() => { UI.go('game'); const lo = { primary: 'm4', sidearm1: 'glock20', sidearm2: null, melee: 'kabar', armor: 'mtv', gear: 'nogear', utils: [null, null, null], ammo: {}, att: { m4: { laser: 'laser' } } };
    const parts = [{ id: 'me', name: 'You', team: 0, loadout: lo, skins: {} }, { id: 'x', name: 'x', team: 1, isBot: true, loadout: lo, skins: {} }];
    const g = window._g = new Game({ mapId: 'killhouse', seed: 1000, mode: 'deathmatch', participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game')); g.start(); return 'ok'; })()`));
  await b.sleep(1000);
  console.log(await b.eval(`(() => { const V = _g.view, x = _g.byId.x, v = V.unitViews.get(x); return JSON.stringify({ las: v.laser, ws: _g.wstat(x).laser, att: x.att, n: V.laserLines && V.laserLines.geometry.drawRange, lo: x.lo.att }); })()`));
};
