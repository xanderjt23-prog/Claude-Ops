export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  for (const [map, nt, per, mode] of [['farm_xl', 6, 6, 'snd'], ['omaha', 3, 4, 'zone'], ['highland', 2, 6, 'deathmatch']]) {
    await b.eval(`(() => { if (window._g) _g.stop(); UI.go('game'); const parts = [];
      for (let t = 0; t < ${nt}; t++) for (let k = 0; k < ${per}; k++) parts.push({ id: t + '_' + k, name: 'B' + t + k, team: t, isBot: true, loadout: Object.assign(botLoadout(5), {}), skins: {} });
      parts[0].isBot = false; parts[0].id = 'me';
      const g = window._g = new Game({ mapId: '${map}', seed: 77, mode: '${mode}', teams: ${nt}, massive: ${map.endsWith('xl')}, participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game'));
      g.start(); const me = g.byId.me; me.isBot = true; me.ai = new BotBrain(g, me); window._fr = 0; const f = () => { window._fr++; requestAnimationFrame(f); }; f(); })()`);
    await b.sleep(20000);
    const r = await b.eval(`JSON.stringify({ frames: _fr, time: Math.round(_g.time), alive: _g.units.filter(u => u.alive).length, kills: _g.units.reduce((s, u) => s + u.kills, 0), shots: _g.bullets.length, ended: _g.ended, bases: (_g.bases || []).map(b => Math.round(b.hp)), zone: _g.zone && _g.zone.prog.map(Math.round) })`);
    console.log(map, r);
    await b.shot('80-' + map);
  }
};
