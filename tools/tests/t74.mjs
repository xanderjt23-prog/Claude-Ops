// run a battle until some bot shakes in place, then log it frame by frame: position, move input, waypoint
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html');
  console.log(await b.eval(`(() => { try { UI.go('game');
    const parts = []; for (let t = 0; t < 2; t++) for (let k = 0; k < 8; k++) parts.push({ id: t + '_' + k, name: 'B' + t + k, team: t, isBot: true, loadout: botLoadout(6), skins: {} }); parts[0].id = 'me';
    const g = window._g = new Game({ mapId: '${process.env.MAP || 'farm'}', seed: 7, mode: 'deathmatch', participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game')); g.start(); g.byId.me.isBot = true; g.byId.me.ai = new BotBrain(g, g.byId.me);
    const last = new Map(); g.units.forEach(u => { const ai = u.ai, o = ai.think.bind(ai); ai.think = dt => { const r = o(dt); last.set(u, r); return r; }; });
    const hist = new Map(); let bot = null; const out = [];
    for (let k = 0; k < 30 * 400 && out.length < 30; k++) {
      g.update(1 / 30);
      if (bot) { const u = bot, ai = u.ai, inp = last.get(u) || {}, wp = ai.path && ai.path[0];
        out.push([+g.time.toFixed(2), +u.x.toFixed(1), +u.y.toFixed(1), +u.z.toFixed(0), +(inp.mx || 0).toFixed(2), +(inp.my || 0).toFixed(2), wp ? wp.x.toFixed(0) + ',' + wp.y.toFixed(0) + ',' + (wp.z || 0).toFixed(0) + (wp.kind ? ':' + wp.kind : '') : '-', ai.path ? ai.path.length : -1, ai.target ? 'T' : '-', u.stance, +ai.pathT.toFixed(2), ai.via ? 'via' : '', u.grounded ? 'g' : 'air', 'fire:' + g.fires.map(f => Math.round(Math.hypot(f.x - u.x, f.y - u.y)) + '/' + Math.round(f.r)).join(','), 'nade:' + g.nades.map(n => n.kind + Math.round(Math.hypot(n.x - u.x, n.y - u.y))).join(','), ai.flee ? 'flee' + ai.flee.t.toFixed(2) : '', g.waterAt(u.x, u.y) ? 'WATER' : '', u.swim ? 'swim' : '', ai.detour ? 'det' : ''].join(' ')); continue; }
      for (const u of g.units) { if (!u.alive) continue; let h = hist.get(u); if (!h) hist.set(u, h = []); h.push([u.x, u.y]); if (h.length > 30) h.shift();
        if (h.length === 30) { let rev = 0; for (let i = 2; i < 30; i++) { const ax = h[i - 1][0] - h[i - 2][0], ay = h[i - 1][1] - h[i - 2][1], bx = h[i][0] - h[i - 1][0], by = h[i][1] - h[i - 1][1]; if (ax * bx + ay * by < -0.3) rev++; }
          if (rev >= 11 && Math.hypot(h[29][0] - h[0][0], h[29][1] - h[0][1]) < 15) { bot = u; break; } } }
    }
    return bot ? bot.id + ' || ' + out.join(' || ') : 'none'; } catch (e) { return e.stack; } })()`));
};
