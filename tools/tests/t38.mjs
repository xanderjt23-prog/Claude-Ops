// route variety: plan paths between the same two points for many bots; also ballistics and modifiers smoke tests
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  console.log(await b.eval(`(() => { UI.go('game'); const parts = []; for (let k = 0; k < 10; k++) parts.push({ id: 'b' + k, name: 'B' + k, team: k % 2, isBot: true, loadout: DEFAULT_LOADOUT, skins: {} }); parts[0].id = 'me'; parts[0].isBot = false;
    const g = window._g = new Game({ mapId: 'oldtown', seed: 1001, mode: 'deathmatch', participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game'));
    const bots = g.units.filter(u => u.ai), a = { x: 4 * T, y: 35 * T, z: 0 }, goal = { x: 86 * T, y: 30 * T, z: 0 };
    const sig = p => p.map(w => ((w.x / T) | 0) + ',' + ((w.y / T) | 0)).join(' ');
    const old = new Set(bots.map(u => { u.x = a.x; u.y = a.y; u.z = g.groundAt(a.x, a.y); const s = u.ai.routeSeed; u.ai.routeSeed = 0; const p = planPath(g, u, goal); u.ai.routeSeed = s; return sig(p); }));
    const now = bots.map(u => { u.ai.routeSeed = 1 + Math.floor(Math.random() * 1e6); return planPath(g, u, goal); });
    const lens = now.map(p => p.length), dist = new Set(now.map(sig));
    // how different are the routes? share of tiles not on the shortest route
    const base = new Set(planPath(g, Object.assign({}, bots[0], { ai: null }), goal).map(w => ((w.x / T) | 0) + ',' + ((w.y / T) | 0)));
    const diff = now.map(p => p.filter(w => !base.has(((w.x / T) | 0) + ',' + ((w.y / T) | 0))).length / p.length);
    g.stop(); return JSON.stringify({ distinctBefore: old.size, distinctNow: dist.size, lengths: lens, offShortest: diff.map(v => Math.round(v * 100) + '%') });
  })()`));
};
