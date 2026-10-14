// mansion battle: does the renderer ever run out of instance slots (a wall piece silently not drawn)?
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html');
  console.log(await b.eval(`(() => { try { UI.go('game');
    const parts = []; for (let t = 0; t < 2; t++) for (let k = 0; k < 8; k++) parts.push({ id: t + '_' + k, name: 'B' + t + k, team: t, isBot: true, loadout: botLoadout(6), skins: {} }); parts[0].id = 'me';
    const g = window._g = new Game({ mapId: '${process.env.MAP || 'mansion'}', seed: 7, mode: 'deathmatch', participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game')); g.start(); g.byId.me.isBot = true; g.byId.me.ai = new BotBrain(g, g.byId.me);
    const v = Object.values(g).find(o => o && o.vmRoot); let drops = 0, keys = {}; const orig = v.placeTile.bind(v);
    v.placeTile = i => { const before = {}; for (const k in v.free) before[k] = v.free[k].length; orig(i); v.partsFor(i).forEach(p => { const key = p[0] + '#' + v.regionOf(i); if (v.free[key] && before[key] === 0) { drops++; keys[key] = 1; } }); };
    // also check: every part of every tile currently has a slot
    for (let k = 0; k < 2400; k++) g.update(1 / 30);
    const m = g.map; let missing = 0; const miss = {};
    for (let i = 0; i < m.w * m.h; i++) { const want = v.partsFor(i).length, have = (v.slots.get(i) || []).length; if (have < want) { missing += want - have; v.partsFor(i).forEach(p => miss[p[0]] = (miss[p[0]] || 0) + 1); } }
    return JSON.stringify({ t: Math.round(g.time), drops, keys: Object.keys(keys).slice(0, 10), missing, miss }); } catch (e) { return e.stack; } })()`));
};
