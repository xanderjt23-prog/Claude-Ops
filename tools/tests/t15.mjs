export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  for (const [map, nt, per] of [['farm_xl', 6, 6], ['highland', 2, 6], ['killhouse', 2, 3]]) {
    await b.eval(`(() => { if (window._g) _g.stop(); UI.go('game'); const parts = [];
      for (let t = 0; t < ${nt}; t++) for (let k = 0; k < ${per}; k++) parts.push({ id: t + '_' + k, name: 'B' + t + k, team: t, isBot: true, loadout: botLoadout(5), skins: {} });
      parts[0].id = 'me';
      const g = window._g = new Game({ mapId: '${map}', seed: 77, mode: 'deathmatch', teams: ${nt}, participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game'));
      g.start(); window._T = { u: 0, r: 0, n: 0, parts: {} };
      const U = g.update.bind(g), R = g.view.render.bind(g.view);
      g.update = dt => { const t = performance.now(); U(dt); _T.u += performance.now() - t; _T.n++; };
      g.view.render = dt => { const t = performance.now(); R(dt); _T.r += performance.now() - t; };
      ['updateUnits', 'updateParticles', 'updateLights', 'updateLasers', 'flushGround', 'updateProjectiles'].forEach(k => { const f = g.view[k].bind(g.view); g.view[k] = (...a) => { const t = performance.now(); const r = f(...a); _T.parts[k] = (_T.parts[k] || 0) + performance.now() - t; return r; }; });
    })()`);
    await b.sleep(8000);
    console.log(map, await b.eval(`JSON.stringify({ n: _T.n, updMs: +(_T.u / _T.n).toFixed(1), renMs: +(_T.r / _T.n).toFixed(1), parts: Object.fromEntries(Object.entries(_T.parts).map(([k, v]) => [k, +(v / _T.n).toFixed(1)])), calls: _g.view.renderer.info.render.calls, tris: _g.view.renderer.info.render.triangles })`));
  }
};
