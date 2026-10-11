export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  console.log(await b.eval(`(() => { const parts = [{ id: 'me', name: 'me', team: 0, loadout: DEFAULT_LOADOUT, skins: {} }, { id: 'x', name: 'x', team: 1, isBot: true, loadout: DEFAULT_LOADOUT, skins: {} }];
    const g = new Game({ mapId: 'oldtown', seed: 1001, mode: 'deathmatch', participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game'));
    const m = g.map, me = g.byId.me, s = m.stairs[0], off = 4, ang = -0.25, out = [];
    const sx = (s.sx - s.dx) * T + T / 2 + (s.dy ? off : 0), sy = (s.sy - s.dy) * T + T / 2 + (s.dx ? off : 0);
    me.x = sx; me.y = sy; me.z = m.base[g.tileAt(sx, sy)]; me.grounded = true; const b0 = me.z;
    const a = Math.atan2(s.dy, s.dx) + ang;
    out.push('stair ' + JSON.stringify({ sx: s.sx, sy: s.sy, dx: s.dx, dy: s.dy, b0 }));
    for (let y = s.sy - 2; y <= s.sy + 2; y++) { let r = ''; for (let x = s.sx - 2; x <= s.sx + 5; x++) { const i = y * m.w + x; r += (m.stair[i] >= 0 ? 'S' : m.obj[i] ? (isWallObj(m.obj[i]) ? '#' : 'o') : m.slab[i] ? '_' : '.'); } out.push(r); }
    for (let k = 0; k < 120; k++) { g.moveBody(me, { mx: Math.cos(a), my: Math.sin(a) }, 1 / 60, 150); if (k % 10 == 0) out.push([k, (me.x / T).toFixed(2), (me.y / T).toFixed(2), Math.round(me.z - b0), g.collides(me.x, me.y, UNIT_R, me.z, 60)].join(' ')); }
    g.stop(); return out.join(' | '); })()`));
};
