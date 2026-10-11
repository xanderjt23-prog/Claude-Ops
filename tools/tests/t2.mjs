// viewmodels, combat, castle, explosions, scope
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  console.log(await b.eval(`(() => { Profile.reset(); UI.go('game'); const lo = p => ({ primary: p, sidearm1: 'glock20', sidearm2: null, melee: 'kabar', armor: 'mtv', gear: 'nogear', utils: ['m67', 'smoke', 'c4'], ammo: {} });
    const parts = [{ id: 'me', name: 'You', team: 0, loadout: lo('m4'), skins: { m4: 'tiger' }, uniform: 'woodland' }, { id: 'a', name: 'Ally', team: 0, isBot: true, loadout: lo('ak47'), skins: {} }, { id: 'e1', name: 'Enemy1', team: 1, isBot: true, loadout: lo('m249'), skins: {} }, { id: 'e2', name: 'Enemy2', team: 1, isBot: true, loadout: lo('r870'), skins: {} }];
    const g = new Game({ mapId: 'desert', seed: 1004, mode: 'snd', participants: parts, localId: 'me', role: 'local', teamNames: ['Alpha', 'Bravo'] }, document.querySelector('#game'));
    window._g = g; g.start(); g.units.forEach(u => u.ai = null);
    const me = g.byId.me, e = g.byId.e1; e.x = me.x + 220; e.y = me.y + 10; g.byId.e2.x = me.x + 300; g.byId.e2.y = me.y - 60; g.byId.a.x = me.x + 60; g.byId.a.y = me.y + 70;
    g.input.yaw = Math.atan2(e.y - me.y, e.x - me.x); return 'ok'; })()`));
  await b.sleep(800); await b.shot('10-vm-rifle');
  await b.eval(`_g.input.lmb = true; setTimeout(() => _g.input.lmb = false, 1500)`); await b.sleep(300); await b.shot('11-shooting'); await b.sleep(1400);
  console.log('enemy hp', await b.eval(`JSON.stringify([_g.byId.e1.hp, _g.byId.e1.alive, _g.byId.me.kills])`)); await b.shot('12-after');
  for (const id of ['m82', 'r870', 'rpg7', 'm134', 'deagle', 'katana', 'lpo50']) { await b.eval(`(() => { const me = _g.byId.me; me.slots[0] = '${id}'; me.mag[0] = ITEMS['${id}'].mag || 0; me.slot = 0; })()`); await b.sleep(450); await b.shot('13-vm-' + id); }
  await b.eval(`(() => { const me = _g.byId.me; me.slots[0] = 'm82'; me.slot = 0; _g.input.rmb = true; })()`); await b.sleep(600); await b.shot('14-scope'); await b.eval(`_g.input.rmb = false`);
  // castle + explosion + smoke
  await b.eval(`(() => { const g = _g, me = g.byId.me, bs = g.bases[1]; me.x = bs.x - 160; me.y = bs.y + 20; g.input.yaw = Math.atan2(bs.y - me.y, bs.x - me.x); g.input.pitch = 0.05; g.explode(bs.x - 60, bs.y + 60, 150, 120, 'me', 'c4', 'c4'); g.smokes.push({ x: bs.x - 80, y: bs.y - 70, r: 10, maxR: 120, t: 10 }); })()`);
  await b.sleep(250); await b.shot('15-castle-boom'); await b.sleep(1500); await b.shot('16-castle-smoke');
  console.log('base', await b.eval(`Math.round(_g.bases[1].hp)`));
};
