// bot battle: find bots that shake (many direction reversals in a second with almost no net movement), and what they
// were doing at the time
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html');
  console.log(await b.eval(`(() => { try { UI.go('game');
    const parts = []; for (let t = 0; t < 2; t++) for (let k = 0; k < 8; k++) parts.push({ id: t + '_' + k, name: 'B' + t + k, team: t, isBot: true, loadout: botLoadout(6), skins: {} }); parts[0].id = 'me';
    const g = window._g = new Game({ mapId: '${process.env.MAP || 'farm'}', seed: ${process.env.SEED || 7}, mode: 'deathmatch', participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game')); g.start(); g.byId.me.isBot = true; g.byId.me.ai = new BotBrain(g, g.byId.me);
    const hist = new Map(), found = {}, dt = 1 / 30;
    for (let k = 0; k < 30 * 120; k++) {
      g.update(dt);
      for (const u of g.units) { if (!u.alive || !u.ai) { hist.delete(u); continue; }
        let h = hist.get(u); if (!h) hist.set(u, h = []);
        const ai = u.ai; h.push({ x: u.x, y: u.y, t: g.time, st: (ai.target ? 'T' : '-') + (ai.detour ? 'D' : '') + (ai.path && ai.path.length ? 'P' : '') + (ai.strafe > 0 ? 'R' : ai.strafe < 0 ? 'L' : '0') });
        if (h.length > 30) h.shift();
        if (h.length === 30) { let rev = 0; for (let i = 2; i < 30; i++) { const ax = h[i - 1].x - h[i - 2].x, ay = h[i - 1].y - h[i - 2].y, bx = h[i].x - h[i - 1].x, by = h[i].y - h[i - 1].y; if (ax * bx + ay * by < -0.3) rev++; }
          const net = Math.hypot(h[29].x - h[0].x, h[29].y - h[0].y);
          if (rev >= 8 && net < 24) { const key = u.id; if (!found[key] || found[key].rev < rev) found[key] = { rev, net: +net.toFixed(1), t: +g.time.toFixed(1), states: [...new Set(h.map(s => s.st))].join(' ') }; } } }
    }
    return JSON.stringify(found); } catch (e) { return e.stack; } })()`));
};
