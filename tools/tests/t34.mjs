// bot movement quality: how often are bots stuck (want to move but barely move) and how often do they fire at targets they can't hit
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  for (const map of ['oldtown', 'mansion', 'harbor']) {
    const r = await b.eval(`(() => { if (window._g) _g.stop(); UI.go('game'); const parts = [];
      for (let t = 0; t < 2; t++) for (let k = 0; k < 5; k++) parts.push({ id: t + '_' + k, name: 'B' + t + k, team: t, isBot: true, loadout: botLoadout(6), skins: {} });
      parts[0].id = 'me';
      const g = window._g = new Game({ mapId: '${map}', seed: 9, mode: 'score', minutes: 4, participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game'));
      g.byId.me.isBot = true; g.byId.me.ai = new BotBrain(g, g.byId.me);
      let stuckSec = 0, moveSec = 0, blindShots = 0, shots = 0; const last = new Map(), why = {};
      for (let step = 0; step < 30 * 240; step++) {
        g.update(1 / 30);
        if (step % 30 === 0) for (const u of g.units) { if (!u.alive || !u.ai) continue; const p = last.get(u);
          if (p && u.ai.wantMove) { moveSec++; if (Math.hypot(u.x - p.x, u.y - p.y) < 12) { stuckSec++; const k = (u.ai.target ? 'combat' : u.ai.lastSeen ? 'investigate' : 'explore') + (u.ai.path && u.ai.path.length ? '+path' : '-nopath') + (u.ai.noPath ? '-unreach' : '') + (u.stance !== 'stand' ? '-' + u.stance : ''); why[k] = (why[k] || 0) + 1; if (k.startsWith('investigate+path') && (why.samples = why.samples || []).length < 8) { const w = u.ai.path[0], ls = u.ai.lastSeen; why.samples.push([Math.round(u.x/T*10)/10, Math.round(u.y/T*10)/10, Math.round(u.z - g.groundAt(u.x,u.y)), 'wp', Math.round(w.x/T*10)/10, Math.round(w.y/T*10)/10, 'goal', Math.round(ls.x/T), Math.round(ls.y/T), Math.round(ls.z - g.groundAt(ls.x, ls.y)), 'len', u.ai.path.length, 'tile', g.map.obj[g.tileAt(w.x, w.y)], g.map.stair[g.tileAt(w.x,w.y)]].join(' ')); } } }
          last.set(u, { x: u.x, y: u.y }); }
        for (const u of g.units) if (u.alive && u.ai && u.ai.target && u.firePrev && u.lastShotT === g.time) { shots++; if (!u.ai.clear) blindShots++; }
      }
      return JSON.stringify({ time: Math.round(g.time), kills: g.units.reduce((s, u) => s + u.kills, 0), stuckPct: +(100 * stuckSec / Math.max(1, moveSec)).toFixed(1), botSecondsMoving: moveSec, shots, blindShots, why });
    })()`);
    console.log(map, r);
  }
};
