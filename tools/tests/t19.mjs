// walk up every staircase (centred and off-centre) and report the ones where you get stuck
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  const maps = await b.eval(`MAPS.map(m => m.id)`);
  for (const id of maps) {
    const r = await b.eval(`(() => { const parts = [{ id: 'me', name: 'me', team: 0, loadout: DEFAULT_LOADOUT, skins: {} }, { id: 'x', name: 'x', team: 1, isBot: true, loadout: DEFAULT_LOADOUT, skins: {} }];
      const g = new Game({ mapId: '${id}', seed: 1000 + MAPS.findIndex(m => m.id === '${id}'), mode: 'deathmatch', participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game'));
      const m = g.map, me = g.byId.me, bad = []; let n = 0, up = 0;
      m.stairs.forEach((s, si) => { for (const off of [-4, 0, 4]) for (const ang of [0, 0.25, -0.25]) {
        const sx = (s.sx - s.dx) * T + T / 2 + (s.dy ? off : 0), sy = (s.sy - s.dy) * T + T / 2 + (s.dx ? off : 0);
        me.x = sx; me.y = sy; me.z = g.supportAt(sx, sy, 999) ; me.z = (m.buildings[s.bld].ground || 0) + (s.h0 || 0); me.vz = 0; me.grounded = true; me.stance = 'stand'; me.onLadder = false;
        const a = Math.atan2(s.dy, s.dx) + ang; n++;
        for (let k = 0; k < 120; k++) g.moveBody(me, { mx: Math.cos(a), my: Math.sin(a) }, 1 / 60, 150);
        const top = (m.buildings[s.bld].ground || 0) + (s.h1 || SH); if (me.z >= top - 2) up++;
        const px = me.x, py = me.y; for (let k = 0; k < 40; k++) g.moveBody(me, { mx: -Math.cos(a + 1), my: -Math.sin(a + 1) }, 1 / 60, 150); const moved = Math.hypot(me.x - px, me.y - py);
        if (me.z < top - 2 && moved < 4 || g.collides(me.x, me.y, UNIT_R, me.z, 56)) bad.push(si + 'L' + (s.level||0) + ':' + off + ':' + ang + '->' + Math.round(me.z - (m.buildings[s.bld].ground || 0)));
      } });
      g.stop(); return { stairs: m.stairs.length, levels: m.stairs.map(s => s.level || 0).join(''), tries: n, reachedTop: up, bad: bad.slice(0, 12), nbad: bad.length }; })()`);
    console.log(id, JSON.stringify(r));
  }
};
