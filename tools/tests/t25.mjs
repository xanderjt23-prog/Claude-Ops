export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  await b.eval(`(() => { UI.go('game'); const parts = []; for (let t = 0; t < 2; t++) for (let k = 0; k < 4; k++) parts.push({ id: t + '_' + k, name: 'B' + t + k, team: t, isBot: true, loadout: botLoadout(4), skins: {} }); parts[0].id = 'me';
    const g = window._g = new Game({ mapId: 'oldtown', seed: 3, mode: 'deathmatch', participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game')); g.start(); g.byId.me.isBot = true; g.byId.me.ai = new BotBrain(g, g.byId.me);
    window._p0 = g.units.map(u => [u.x, u.y]); for (let k = 0; k < 600; k++) g.update(1 / 30); })()`);
  console.log(await b.eval(`JSON.stringify({ t: Math.round(_g.time), moved: _g.units.map((u, i) => Math.round(Math.hypot(u.x - _p0[i][0], u.y - _p0[i][1]))), alive: _g.units.filter(u => u.alive).length, kills: _g.units.reduce((s, u) => s + u.kills, 0), up: _g.units.filter(u => u.z - _g.groundAt(u.x, u.y) > 40).length })`));
};
