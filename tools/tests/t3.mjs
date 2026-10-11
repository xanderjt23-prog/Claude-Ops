// long simulated bot matches with periodic 3D renders: checks for errors during heavy action
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  for (const [map, night, mode] of [['oldtown', false, 'snd'], ['desert', true, 'zone'], ['farm', false, 'survival'], ['rustyard', false, 'snd'], ['airfield', true, 'snd'], ['snowbase', false, 'zone'], ['killhouse', false, 'deathmatch'], ['ruins', false, 'zone'], ['forest', true, 'snd']]) {
    console.log(await b.eval(`(() => { UI.go('game'); const parts = [];
      for (let i = 0; i < 10; i++) parts.push({ id: i ? 'b' + i : 'me', name: 'Bot' + i, team: i % 2, isBot: true, loadout: botLoadout(30), skins: {} });
      const g = new Game({ mapId: '${map}', seed: 99, mode: '${mode}', night: ${night}, respawns: 3, participants: parts, localId: 'me', role: 'local', teamNames: ['Alpha','Bravo'] }, document.querySelector('#game'));
      let err = null; const t0 = performance.now();
      try { for (let i = 0; i < 30 * 150 && !g.ended; i++) { g.update(1/30); if (i % 60 === 0) g.render(1/30); } g.render(1/30); } catch (e) { err = e.stack; }
      const r = JSON.stringify({ map: '${map}', err, t: g.time.toFixed(0), ended: g.ended, kills: g.units.reduce((s, u) => s + u.kills, 0), bases: g.bases.map(b => Math.round(b.hp)), corpses: g.view.corpseViews.size, upstairs: g.units.filter(u => u.z > 60).length, maxZ: Math.round(Math.max(...g.units.map(u => u.z))), secs: ((performance.now() - t0) / 1000).toFixed(1) });
      window._g = g; return r; })()`));
    await b.shot('21-sim-' + map);
    await b.eval(`_g.stop()`);
  }
};
