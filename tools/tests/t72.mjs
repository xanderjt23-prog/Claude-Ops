// inside Blackwood Manor on each floor, looking at an outside wall with its windows; then the house from outside
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1200);
  await b.eval(`(() => { UI.go('game');
    const parts = [{ id: 'me', name: 'You', team: 0, loadout: DEFAULT_LOADOUT, skins: {} }, { id: 'x', name: 'x', team: 1, isBot: true, loadout: botLoadout(3), skins: {} }];
    const g = window._g = new Game({ mapId: 'mansion', seed: 1234, mode: 'deathmatch', participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game')); g.units.forEach(u => u.ai = null); g.start(); g.night = false;
    const m = g.map, bd = m.buildings.find(b => b.opts && b.opts.storyH); window._bd = bd; g.byId.x.x = 3 * T; g.byId.x.y = 3 * T; })()`);
  await b.sleep(2500);
  console.log(await b.eval(`JSON.stringify({ x: _bd.x, y: _bd.y, w: _bd.w, h: _bd.h, stories: _bd.stories, roof: _g.map.roof[(_bd.y + 3) * _g.map.w + _bd.x + 3], sh: _g.map.sh[(_bd.y + 3) * _g.map.w + _bd.x + 3] })`));
  for (let lv = 0; lv < 4; lv++) {
    await b.eval(`(() => { const g = _g, me = g.byId.me, m = g.map, bd = _bd; (window._iv || []).forEach(clearInterval); window._iv = [];
      const x = (bd.x + 7) * T, y = (bd.y + 10) * T, base = m.base ? m.base[(bd.y + 10) * m.w + bd.x + 7] : 0;
      _iv.push(setInterval(() => { me.x = x; me.y = y; me.z = base + ${lv} * 128; me.vz = 0; g.input.yaw = Math.PI; g.input.pitch = 0.18; }, 5)); })()`);
    await b.sleep(1500); await b.shot('340-manor-floor' + lv);
  }
  await b.eval(`(() => { const g = _g, me = g.byId.me, bd = _bd; (window._iv || []).forEach(clearInterval); window._iv = [];
    const x = (bd.x - 14) * T, y = (bd.y + bd.h / 2) * T; _iv.push(setInterval(() => { me.x = x; me.y = y; g.input.yaw = 0; g.input.pitch = 0.3; }, 5)); })()`);
  await b.sleep(1500); await b.shot('340-manor-outside');
};
