// simulate whole matches: score battle (2 min) and deathmatch with 3 lives
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  for (const [mode, extra, map] of [['score', { minutes: 2 }, 'oldtown'], ['deathmatch', { lives: 3 }, 'killhouse'], ['score', { minutes: 2, ffa: true }, 'desert']]) {
    const r = await b.eval(`(() => { if (window._g) _g.stop(); UI.go('game'); const parts = []; const ffa = ${!!extra.ffa};
      for (let t = 0; t < (ffa ? 6 : 2); t++) for (let k = 0; k < (ffa ? 1 : 3); k++) parts.push({ id: t + '_' + k, name: 'B' + t + k, team: t, isBot: true, loadout: botLoadout(6), skins: {} });
      parts[0].id = 'me';
      let ended = null;
      const g = window._g = new Game(Object.assign({ mapId: '${map}', seed: 9, mode: '${mode}', participants: parts, localId: 'me', role: 'local', ffa, onEnd: res => ended = res }, ${JSON.stringify(extra)}), document.querySelector('#game'));
      g.byId.me.isBot = true; g.byId.me.ai = new BotBrain(g, g.byId.me);
      const t0 = performance.now(); let steps = 0;
      while (!g.ended && steps < 30 * 60 * 16) { g.update(1 / 30); steps++; }
      const res = g.ended ? g._endRes || null : null;
      return JSON.stringify({ ended: g.ended, simT: Math.round(g.time), realMs: Math.round(performance.now() - t0), timeLimit: g.timeLimit,
        scores: g.teamScores ? g.teamScores() : null, units: g.units.map(u => [u.name, u.team, u.kills, u.deaths, u.assists, u.lives === Infinity ? 'inf' : u.lives, u.out ? 'OUT' : '']) });
    })()`);
    console.log(mode, JSON.stringify(extra), r.slice(0, 1200));
  }
};
