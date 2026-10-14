// Blackwood manor: perimeter of every building - tiles with no wall, or a wall lower than the building
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html');
  console.log(await b.eval(`(() => { try { UI.go('game');
    const parts = [{ id: 'me', name: 'You', team: 0, loadout: DEFAULT_LOADOUT, skins: {} }, { id: 'x', name: 'x', team: 1, isBot: true, loadout: botLoadout(3), skins: {} }];
    const g = window._g = new Game({ mapId: '${process.env.MAP || 'mansion'}', seed: 1234, mode: 'deathmatch', participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game')); g.start();
    const m = g.map, out = [];
    m.buildings.forEach((bd, bi) => { const miss = [], low = []; let maxTop = 0;
      for (let x = bd.x; x < bd.x + bd.w; x++) for (const y of [bd.y, bd.y + bd.h - 1]) chk(x, y);
      for (let y = bd.y; y < bd.y + bd.h; y++) for (const x of [bd.x, bd.x + bd.w - 1]) chk(x, y);
      function chk(x, y) { const i = y * m.w + x, o = m.obj[i]; const t = m.wallTop[i]; maxTop = Math.max(maxTop, t);
        if (!o && !m.lintel[i]) miss.push(x + ',' + y); else if (o && MAT[o].wall && t < (bd.stories || 1) * SH - 10) low.push(x + ',' + y + ':' + t); }
      out.push({ bi, x: bd.x, y: bd.y, w: bd.w, h: bd.h, st: bd.stories, maxTop, miss: miss.length, missAt: miss.slice(0, 12), low: low.length, lowAt: low.slice(0, 12) }); });
    return JSON.stringify(out); } catch (e) { return e.stack; } })()`));
};
