// play a described map: a short bot battle (errors?) and a first-person look inside the main building
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1000);
  const P = process.env.DESC || 'a casino in the desert with a big car park';
  console.log(await b.eval(`(() => { try { UI.go('game');
    const parts = []; for (let t = 0; t < 2; t++) for (let k = 0; k < 4; k++) parts.push({ id: t + '_' + k, name: 'B' + t + k, team: t, isBot: true, loadout: botLoadout(6), skins: {} }); parts[0].id = 'me';
    const g = window._g = new Game({ mapId: 'gen', seed: 1000, customMap: { gen: true, theme: 'described', size: 'medium', prompt: ${JSON.stringify(P)} }, mode: 'deathmatch', participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game'));
    g.start(); g.byId.me.isBot = true; g.byId.me.ai = new BotBrain(g, g.byId.me);
    for (let k = 0; k < 30 * 60; k++) g.update(1 / 30);
    const alive = g.units.filter(u => u.alive).length, bd = g.map.buildings[0];
    return JSON.stringify({ desc: g.map.described, cm: g.cfg.customMap, t: Math.round(g.time), alive, kills: g.units.reduce((a, u) => a + (u.kills || 0), 0), main: [bd.x, bd.y, bd.w, bd.h, bd.stories] }); } catch (e) { return e.stack; } })()`));
  await b.eval(`(() => { const g = _g, me = g.byId.me, bd = g.map.buildings[0]; g.byId.me.ai = null; g.units.forEach(u => { if (u !== me) u.ai = null; }); me.alive = true; me.hp = 100;
    window._iv = [setInterval(() => { me.x = (bd.x + bd.w / 2) * T; me.y = (bd.y + bd.h / 2) * T; me.z = g.map.base[(bd.y + (bd.h >> 1)) * g.map.w + bd.x + (bd.w >> 1)]; g.input.yaw = 0.4; g.input.pitch = 0.25; }, 5)]; })()`);
  await b.sleep(1500); await b.shot('370-desc-inside');
};
