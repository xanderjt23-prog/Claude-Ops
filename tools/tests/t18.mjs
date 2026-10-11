export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  await b.eval(`(() => { UI.go('game'); const lo = u => ({ primary: 'stg44', sidearm1: 'luger', sidearm2: null, melee: 'trenchknife', armor: 'flakvest', gear: 'nogear', utils: u, ammo: {} });
    const parts = [{ id: 'me', name: 'You', team: 0, loadout: lo(['mine', 'satchel', 'thermite']), skins: {} }, { id: 'x', name: 'x', team: 1, isBot: true, loadout: lo(['gas', 'stick', 'mine']), skins: {} }];
    const g = window._g = new Game({ mapId: 'omaha', seed: 5, mode: 'deathmatch', participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game')); g.start();
    g.byId.x.ai = null; const me = g.byId.me, x = g.byId.x; x.x = me.x + 200; x.y = me.y; x.z = g.groundAt(x.x, x.y);
    window._log = [];
    [0, 1, 2].forEach((s, k) => setTimeout(() => { g.useUtil(me, s, me.x + 150, me.y + 40 * k); _log.push('me' + s + ':' + g.nades.length + '/' + g.claymores.length); }, 300 + k * 400));
    [0, 1, 2].forEach((s, k) => setTimeout(() => { g.useUtil(x, s, me.x + 60, me.y); _log.push('x' + s + ':' + g.nades.length + '/' + g.claymores.length); }, 1600 + k * 400));
  })()`);
  await b.sleep(3000); await b.shot('90-utils'); await b.sleep(6000);
  console.log(await b.eval(`JSON.stringify({ log: _log, nades: _g.nades.length, mines: _g.claymores.length, fires: (_g.fires || []).length, smokes: (_g.smokes || []).length, hp: _g.units.map(u => Math.round(u.hp)) })`));
};
