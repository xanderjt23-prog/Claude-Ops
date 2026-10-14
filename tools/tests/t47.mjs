export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  for (const mods of [['slowbullets'], ['regen', 'bigheads'], ['ricochet'], ['sidearms'], ['slowbullets', 'regen', 'bigheads', 'ricochet', 'sidearms']]) {
    console.log(JSON.stringify(mods), await b.eval(`(() => { const parts = []; for (let t = 0; t < 2; t++) for (let k = 0; k < 4; k++) parts.push({ id: t + '_' + k, name: 'B' + t + k, team: t, isBot: true, loadout: botLoadout(8), skins: {} });
      parts[0].id = 'me';
      const g = new Game({ mapId: 'oldtown', seed: 3, mode: 'score', minutes: 2, mods: ${JSON.stringify(mods)}, participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game'));
      g.byId.me.isBot = true; g.byId.me.ai = new BotBrain(g, g.byId.me);
      let steps = 0, maxSpeed = 0, bounces = 0, regenSeen = false, heads = 0;
      const hit0 = g.damageUnit.bind(g); g.damageUnit = (u, d, a, info) => { if (info && info.head) heads++; return hit0(u, d, a, info); };
      while (!g.ended && steps++ < 30 * 130) { const hp = g.units.map(u => u.hp); g.update(1 / 30); g.bullets.forEach(bl => { maxSpeed = Math.max(maxSpeed, bl.speed); bounces = Math.max(bounces, bl.bounces || 0); }); g.units.forEach((u, i) => { if (u.alive && u.hp > hp[i] && u.healT <= 0) regenSeen = true; }); }
      g.stop(); return JSON.stringify({ ended: g.ended, kills: g.units.reduce((s, u) => s + u.kills, 0), maxBulletMs: Math.round(maxSpeed / 32), maxBounces: bounces, regenSeen, headshots: heads, primaries: g.units.filter(u => u.slots[0]).length }); })()`));
  }
};
