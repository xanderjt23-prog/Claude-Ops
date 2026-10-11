// every map with N teams; timings, errors, screenshots
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  const maps = await b.eval(`MAPS.map(m => m.id)`);
  for (const id of maps) {
    const r = await b.eval(`(() => { try { if (window._g) window._g.stop(); UI.go('game');
      const massive = MAPS.find(m => m.id === '${id}').massive, nt = massive ? 6 : 4, per = massive ? 6 : 3;
      const parts = [{ id: 'me', name: 'You', team: 0, loadout: Object.assign({}, DEFAULT_LOADOUT, { att: { m4: { optic: 'acog', muzzle: 'supp556', under: 'vgrip', laser: 'laser' } } }), skins: {} }];
      for (let t = 0; t < nt; t++) for (let k = 0; k < per; k++) if (t || k) parts.push({ id: 'b' + t + k, name: 'B' + t + k, team: t, isBot: true, loadout: botLoadout(3), skins: {} });
      const t0 = performance.now();
      const g = window._g = new Game({ mapId: '${id}', seed: 1234, mode: '${id}' === 'mansion' ? 'snd' : 'deathmatch', teams: nt, massive, participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game'));
      g.start(); return { ms: Math.round(performance.now() - t0), w: g.map.w, h: g.map.h, units: g.units.length };
    } catch (e) { return 'ERR ' + e.stack; } })()`);
    await b.sleep(2500);
    const st = await b.eval(`(() => { const g = _g, me = g.byId.me; return { fps: Math.round(g.fps || 0), alive: g.units.filter(u => u.alive).length, meZ: Math.round(me.z), gz: Math.round(g.groundAt(me.x, me.y)), maxH: Math.round(Math.max(...g.map.hc)) }; })()`);
    console.log(id, JSON.stringify(r), JSON.stringify(st));
    await b.shot('50-' + id);
  }
};
