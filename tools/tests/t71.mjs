// fire and report the first-person case pool: how many are alive, and where (screen space)
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1200);
  for (const gun of (process.env.GUNS || 'm249,m4').split(',')) {
    await b.eval(`(() => { if (window._g) _g.stop(); (window._iv || []).forEach(clearInterval); window._iv = []; UI.go('game'); const lo = { primary: '${gun}', sidearm1: 'glock20', sidearm2: null, melee: 'kabar', armor: 'mtv', gear: 'nogear', utils: [null, null, null], ammo: {}, att: {} };
      const g = window._g = new Game({ mapId: 'killhouse', seed: 1000, mode: 'deathmatch', participants: [{ id: 'me', name: 'You', team: 0, loadout: lo, skins: {} }, { id: 'x', name: 'x', team: 1, isBot: true, loadout: lo, skins: {} }], localId: 'me', role: 'local' }, document.querySelector('#game'));
      g.units.forEach(u => u.ai = null); g.start(); const me = g.byId.me; me.x = 8 * T; me.y = 17 * T; g.byId.x.x = 3 * T; g.byId.x.y = 3 * T; _iv.push(setInterval(() => { g.input.lmb = true; me.mag[me.slot] = 50; }, 5)); })()`);
    await b.sleep(2500);
    console.log(gun, await b.eval(`(() => { const v = Object.values(_g).find(o => o && o.vm && o.vmRoot); const live = (v.vmCases || []).filter(c => c.life > 0);
      return JSON.stringify({ shots: v.vm.shots, pool: (v.vmCases || []).length, live: live.length, ej: !!(v.vm.rig && v.vm.rig.ej), manual: v.vm.rig && v.vm.rig.manual, pos: live.slice(0, 3).map(c => { const s = c.mesh.position.clone().project(v.vmCam); return [+s.x.toFixed(2), +s.y.toFixed(2), +c.life.toFixed(2)]; }) }); })()`));
  }
};
