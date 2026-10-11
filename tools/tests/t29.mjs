// soldier pose gallery
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  const setup = (yawOff, dist) => b.eval(`(() => { if (window._g) _g.stop(); UI.go('game');
    const lo = (p, s2) => ({ primary: p, sidearm1: s2 || 'glock20', sidearm2: null, melee: 'kabar', armor: 'mtv', gear: 'pvs14', utils: [null, null, null], ammo: {}, att: {} });
    const looks = [['m4', 'stand'], ['ak47', 'crouch'], ['m24', 'prone'], ['mp5', 'stand'], ['glock20', 'stand'], ['kabar', 'stand'], ['m249', 'crouch']];
    const parts = [{ id: 'me', name: 'You', team: 0, loadout: lo('m4'), skins: {} }].concat(looks.map(([g], i) => ({ id: 'e' + i, name: looks[i][0] + ' ' + looks[i][1], team: 1, isBot: true, loadout: lo(['glock20', 'kabar'].includes(g) ? 'm4' : g), skins: {}, uniform: ['multicam', 'woodland', 'desert'][i % 3] })));
    const g = window._g = new Game({ mapId: 'killhouse', seed: 1000, mode: 'deathmatch', participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game'));
    g.units.forEach(u => u.ai = null); g.start();
    const me = g.byId.me; me.x = 22 * T; me.y = 17 * T + ${dist}; me.z = 0; g.input.yaw = -Math.PI / 2 + ${yawOff}; g.input.pitch = -0.12;
    looks.forEach(([w, st], i) => { const u = g.byId['e' + i]; u.x = me.x - 150 + i * 50; u.y = 17 * T; u.z = 0; u.stance = st; u.angle = 0; u.pitch = 0;
      if (w === 'glock20') u.slot = 1; if (w === 'kabar') u.slot = 3; if (i === 3) { u.moving = true; } });
    window._walk = setInterval(() => { const u = g.byId.e3; u.moving = true; u.walk = (u.walk || 0) + 0.2; }, 30);
    g.corpses.push({ x: me.x + 40, y: 17 * T + 60, z: 0, angle: 0.5, helmet: 'red', uniform: 'woodland', armor: 'mtv', armorSkin: 'olive', t: 0, born: g.time, ttl: 60 });
  })()`);
  await setup(0, 230); await b.sleep(1500); await b.shot('120-poses');
  await setup(0.6, 130); await b.sleep(1200); await b.shot('121-poses-close');
};
