export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  for (const [map, nt, per] of [['farm_xl', 6, 6], ['mansion', 2, 6], ['harbor', 2, 6], ['farm', 2, 6], ['killhouse', 2, 3]]) {
    await b.eval(`(() => { if (window._g) _g.stop(); UI.go('game'); const parts = [];
      for (let t = 0; t < ${nt}; t++) for (let k = 0; k < ${per}; k++) parts.push({ id: t + '_' + k, name: 'B' + t + k, team: t, isBot: true, loadout: botLoadout(5), skins: {} });
      parts[0].id = 'me';
      const g = window._g = new Game({ mapId: '${map}', seed: 77, mode: 'deathmatch', teams: ${nt}, participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game'));
      g.start(); const R = g.view.renderer; const orig = R.render.bind(R); window._I = [];
      R.render = (sc, cam) => { R.info.reset(); const t = performance.now(); orig(sc, cam); if (sc === g.view.scene) _I.push([R.info.render.calls, R.info.render.triangles, performance.now() - t]); };
      R.info.autoReset = false; })()`);
    await b.sleep(6000);
    console.log(map, await b.eval(`(() => { const a = _I.slice(-5); const avg = k => Math.round(a.reduce((s, x) => s + x[k], 0) / a.length); return JSON.stringify({ calls: avg(0), tris: avg(1), ms: avg(2), meshes: Object.keys(_g.view.meshes).length, inst: Object.values(_g.view.meshes).reduce((s, m) => s + m.count, 0) }); })()`));
  }
};
