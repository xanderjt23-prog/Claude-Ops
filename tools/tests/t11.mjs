// gun models (third person + first person), optics, lasers, roof junctions
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  const setup = (gun, att, night, gear) => b.eval(`(() => { if (window._g) _g.stop(); UI.go('game');
    const lo = (p, a) => ({ primary: p, sidearm1: 'glock20', sidearm2: null, melee: 'kabar', armor: 'mtv', gear: '${gear || 'nogear'}', utils: [null, null, null], ammo: {}, att: a ? { [p]: a } : {} });
    const guns = ['ak47', 'm4', 'm24', 'r870', 'mg42', 'mp40', 'stg44', 'garand'];
    const parts = [{ id: 'me', name: 'You', team: 0, loadout: lo('${gun}', ${JSON.stringify(att || null)}), skins: {} }].concat(guns.map((g, i) => ({ id: 'e' + i, name: g, team: 1, isBot: true, loadout: lo(g, i % 2 ? { optic: 'reddot', laser: 'laser', under: 'vgrip', muzzle: 'supp762' } : { optic: 'acog', muzzle: 'comp' }), skins: {} })));
    const g = window._g = new Game({ mapId: 'killhouse', seed: 1000, mode: 'deathmatch', night: ${!!night}, participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game'));
    g.units.forEach(u => u.ai = null); g.start();
    const me = g.byId.me; me.x = 8 * T; me.y = 17 * T; me.z = g.groundAt(me.x, me.y); g.input.yaw = 0; g.input.pitch = -0.05; me.gearOn = true;
    guns.forEach((id, i) => { const u = g.byId['e' + i]; u.x = me.x + 90 + (i % 4) * 0; u.y = me.y - 75 + i * 21; u.z = g.groundAt(u.x, u.y); u.angle = Math.PI / 2 * (i % 2 ? 1 : -1); u.ai = null; u.tAngle = u.angle; });
  })()`);
  await setup('m4', { optic: 'holo', under: 'agrip', muzzle: 'supp556', laser: 'laser' }); await b.sleep(1500); await b.shot('60-guns3p');
  await b.eval(`_g.input.rmb = true`); await b.sleep(800); await b.shot('61-holo-ads');
  await setup('ak47', { optic: 'pso', mag: 'drum' }); await b.sleep(1200); await b.shot('62-ak-hip');
  await b.eval(`_g.input.rmb = true`); await b.sleep(800); await b.shot('63-pso-ads');
  await setup('m24', { optic: 'sniper8', under: 'bipod', muzzle: 'brake' }); await b.sleep(1200); await b.shot('64-m24');
  await setup('glock20', null); await b.eval(`_g.byId.me.slot = 1`); await b.sleep(1200); await b.shot('65-pistol');
  await setup('m4', { optic: 'reddot', laser: 'irlaser' }, true, 'pvs14'); await b.eval('_g.input.yaw = 0.5'); await b.sleep(300); await b.sleep(1500); await b.shot('66-night-ir');
  await b.eval(`_g.input.rmb = true`); await b.sleep(800); await b.shot('67-reddot-ads');
  // roof edge close-up on the old town
  await b.eval(`(() => { _g.stop(); const parts = [{ id: 'me', name: 'You', team: 0, loadout: DEFAULT_LOADOUT, skins: {} }, { id: 'x', name: 'x', team: 1, isBot: true, loadout: DEFAULT_LOADOUT, skins: {} }];
    const g = window._g = new Game({ mapId: 'oldtown', seed: 1001, mode: 'deathmatch', participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game')); g.units.forEach(u => u.ai = null); g.start();
    const m = g.map, bd = m.buildings.find(b => b.style && b.style.stories === 2) || m.buildings[0], me = g.byId.me;
    me.x = (bd.x - 3) * T; me.y = (bd.y - 3) * T; me.z = g.groundAt(me.x, me.y); g.input.yaw = Math.atan2(bd.y * T + 40 - me.y, bd.x * T + 40 - me.x); g.input.pitch = 0.5; g.byId.x.x = 3 * T; g.byId.x.y = 3 * T; return [bd.x, bd.y, bd.w, bd.h, bd.style]; })()`);
  await b.sleep(1500); await b.shot('68-roof');
};
