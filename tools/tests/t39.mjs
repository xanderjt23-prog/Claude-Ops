// ballistics: drop by distance for several guns, flight to the map edge, damage falloff; modifiers in a simulated match
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  console.log(await b.eval(`(() => { UI.go('game'); const parts = [{ id: 'me', name: 'me', team: 0, loadout: DEFAULT_LOADOUT, skins: {} }, { id: 'x', name: 'x', team: 1, isBot: true, loadout: DEFAULT_LOADOUT, skins: {} }];
    const g = window._g = new Game({ mapId: 'airfield', seed: 1007, mode: 'deathmatch', participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game'));
    g.units.forEach(u => { u.x = -9999; u.alive = false; });
    const out = {};
    for (const id of ['glock20', 'mp5', 'm4', 'm24', 'm82', 'r870']) {
      const it = ITEMS[id], y0 = 40 * T, z0 = 400; // fired level, high above everything, along the runway
      const bal = ballistics(it), bl = { x: 2 * T, y: y0, z: z0, dz: 0, dx: 1, dy: 0, speed: bal.v, v0: bal.v, k: bal.k, dmg: it.dmg, pen: 0, range: it.range, dist: 0, drop: GRAVITY_PX, lastIdx: -1, auth: false, structMul: 1, team: 9 };
      const marks = {}; let alive = true, steps = 0, t = 0;
      while (alive && steps++ < 50000) { alive = g.updateBullet(bl, 1 / 600); t += 1 / 600; for (const m of [50, 100, 150]) if (!marks[m] && bl.dist >= m * 32) marks[m] = { dropCm: Math.round((z0 - bl.z) / 32 * 100), speed: Math.round(bl.speed / 32), energyPct: Math.round(g.energy(bl) * 100), ms: Math.round(t * 1000) }; }
      out[id] = { muzzle: Math.round(bal.v / 32) + ' m/s', at50m: marks[50], at100m: marks[100], at150m: marks[150], flew: Math.round(bl.dist / 32) + ' m' };
    }
    g.stop(); return JSON.stringify(out, null, 1); })()`));
  console.log(await b.eval(`(() => { const parts = []; for (let t = 0; t < 2; t++) for (let k = 0; k < 4; k++) parts.push({ id: t + '_' + k, name: 'B' + t + k, team: t, isBot: true, loadout: botLoadout(8), skins: {} });
    parts[0].id = 'me';
    const g = new Game({ mapId: 'oldtown', seed: 3, mode: 'score', minutes: 2, mods: MODIFIERS.map(m => m.id), participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game'));
    g.byId.me.isBot = true; g.byId.me.ai = new BotBrain(g, g.byId.me);
    const hp0 = g.units.map(u => u.hp); let steps = 0, maxZ = 0; while (!g.ended && steps++ < 30 * 130) { g.update(1 / 30); g.units.forEach(u => maxZ = Math.max(maxZ, u.z - g.groundAt(u.x, u.y))); }
    g.stop(); return JSON.stringify({ mods: [...g.mods], maxHp: g.maxHp, spawnHp: hp0[0], ended: g.ended, kills: g.units.reduce((s, u) => s + u.kills, 0), magsFull: g.units.every(u => u.mag[0] === g.wstat(u, 0).mag || !g.wstat(u, 0).mag), highestJump: Math.round(maxZ) }); })()`));
};
