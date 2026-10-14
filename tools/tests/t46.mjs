// water must block walking; stairs must stay climbable
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  console.log(await b.eval(`(() => { const parts = [{ id: 'me', name: 'me', team: 0, loadout: DEFAULT_LOADOUT, skins: {} }, { id: 'x', name: 'x', team: 1, isBot: true, loadout: DEFAULT_LOADOUT, skins: {} }];
    const g = new Game({ mapId: 'forest', seed: 1003, mode: 'deathmatch', participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game'));
    const m = g.map, me = g.byId.me; let wi = -1;
    for (let i = 0; i < m.w * m.h && wi < 0; i++) { const x = i % m.w, y = (i / m.w) | 0; if (m.floor[i] === F.WATER && m.floor[i - 3] !== F.WATER && m.floor[i - 3] !== F.BRIDGE && m.floor[i - 2] !== F.BRIDGE && !m.obj[i - 3] && !m.obj[i - 4] && m.floor[i + 2] === F.WATER) wi = i; }
    const x0 = ((wi % m.w) - 4) * T + 16, y0 = ((wi / m.w) | 0) * T + 16; me.x = x0; me.y = y0; me.z = g.groundAt(x0, y0); me.grounded = true;
    for (let k = 0; k < 120; k++) g.moveBody(me, { mx: 1, my: 0 }, 1 / 60, 150);
    const tile = g.tileAt(me.x, me.y); g.stop();
    return JSON.stringify({ walkedPx: Math.round(me.x - x0), floorUnderMe: Object.keys(F).find(k => F[k] === m.floor[tile]) }); })()`));
};
