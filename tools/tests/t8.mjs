// headshot damage and bot vertical behaviour
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  console.log(await b.eval(`(() => { UI.go('game'); const lo = p => ({ primary: p, sidearm1: 'glock20', sidearm2: null, melee: 'kabar', armor: 'mtv', gear: 'nogear', utils: [null, null, null], ammo: {} });
    const parts = [{ id: 'me', name: 'You', team: 0, loadout: lo('m24'), skins: {} }, { id: 'e', name: 'Enemy', team: 1, isBot: true, loadout: lo('ak47'), skins: {} }, { id: 'e2', name: 'Enemy2', team: 1, isBot: true, loadout: lo('ak47'), skins: {} }];
    const g = window._g = new Game({ mapId: 'farm', seed: 1002, mode: 'deathmatch', participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game'));
    g.units.forEach(u => u.ai = null);
    const me = g.byId.me, e = g.byId.e; me.x = 60 * T; me.y = 42 * T; me.angle = 0; const out = [];
    for (const [label, stance, tz] of [['body', 'stand', 35], ['head', 'stand', 56], ['crouch-head', 'crouch', 33], ['prone-body', 'prone', 6]]) {
      e.hp = 100; e.alive = true; e.invulnT = 0; e.stance = stance; e.z = 0; e.x = me.x + 200; e.y = me.y;
      me.pitch = Math.atan2(tz - eyeZ(me), 200); me.slot = 0; me.mag[0] = 5; me.fireCd = 0;
      const it = Object.assign({}, g.wstat(me, 0), { spread: 0 }); g.shoot(me, it); for (let i = 0; i < 40; i++) g.updateProjectiles(1/60);
      out.push(label + ':' + (100 - Math.max(0, e.hp)).toFixed(0)); }
    // shooting over a crouched target: aim at standing chest height
    e.hp = 100; e.alive = true; e.stance = 'crouch'; me.pitch = Math.atan2(48 - eyeZ(me), 200); const it2 = Object.assign({}, g.wstat(me, 0), { spread: 0 }); g.shoot(me, it2); for (let i = 0; i < 40; i++) g.updateProjectiles(1/60);
    out.push('over-crouched:' + (100 - e.hp).toFixed(0));
    return out.join(' '); })()`));
  // bots on old town: do they use stairs to chase a player upstairs?
  console.log(await b.eval(`(() => { _g.stop(); const parts = [{ id: 'me', name: 'You', team: 0, loadout: botLoadout(10), skins: {} }]; for (let i = 0; i < 6; i++) parts.push({ id: 'b' + i, name: 'Bot' + i, team: 1, isBot: true, loadout: botLoadout(10), skins: {} });
    const g = window._g = new Game({ mapId: 'oldtown', seed: 1001, mode: 'zone', participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game'));
    const me = g.byId.me, s = g.map.stairs[0], m = g.map, l = s.landing; me.x = (l % m.w) * T + T / 2; me.y = ((l / m.w) | 0) * T + T / 2; me.z = 96; me.invulnT = 1e9;
    let maxUp = 0, stances = {}, jumps = 0;
    for (let i = 0; i < 30 * 60; i++) { me.hp = 100; g.update(1/30); g.units.forEach(u => { if (u.ai) { if (u.z > 60) maxUp = Math.max(maxUp, 1); stances[u.stance] = (stances[u.stance] || 0) + 1; if (!u.grounded && u.vz > 0) jumps++; } }); }
    return JSON.stringify({ botsReachedUpstairs: maxUp, stances, jumpFrames: jumps, hpLostByMe: me.deaths, t: g.time.toFixed(0) }); })()`));
};
