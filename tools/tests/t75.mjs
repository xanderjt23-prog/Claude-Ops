// thermal vs normal sight at night: an enemy 600 px away in the open, and the same enemy concealed in a bush
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1000);
  console.log(await b.eval(`(() => { UI.go('game');
    const lo = o => ({ primary: 'm4', sidearm1: 'glock20', sidearm2: null, melee: 'kabar', armor: 'mtv', gear: 'nogear', utils: [null, null, null], ammo: {}, att: { m4: { optic: o } } });
    const g = window._g = new Game({ mapId: 'farm', seed: 3, mode: 'deathmatch', participants: [{ id: 'me', name: 'You', team: 0, loadout: lo('thermscope'), skins: {} }, { id: 'x', name: 'x', team: 1, isBot: true, loadout: lo('reddot'), skins: {} }], localId: 'me', role: 'local' }, document.querySelector('#game'));
    g.units.forEach(u => u.ai = null); g.start(); g.night = true; const me = g.byId.me, x = g.byId.x; me.x = 40 * T; me.y = 40 * T; x.x = me.x + 600; x.y = me.y; x.lastShotT = -99;
    const r = {}; me.scoped = true; r.thermalOpen = g.visibleTo(me, x); me.scoped = false; r.plainOpen = g.visibleTo(me, x);
    x.conceal = 40; me.scoped = true; r.thermalBush = g.visibleTo(me, x); me.scoped = false; r.plainBush = g.visibleTo(me, x);
    g.night = false; me.scoped = true; r.dayThermalBush = g.visibleTo(me, x); me.scoped = false; r.dayPlainBush = g.visibleTo(me, x);
    return JSON.stringify(r); })()`));
};
