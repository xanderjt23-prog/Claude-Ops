// the minigun from the side in first person (env AMMO: rounds left), and frames of its reload
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1200);
  for (const [tag, ammo, p] of [['full', 500, 0], ['low', 6, 0], ['r1', 0, 0.3], ['r2', 0, 0.6], ['r3', 0, 0.85]]) {
    await b.eval(`(() => { if (window._g) _g.stop(); (window._iv || []).forEach(clearInterval); window._iv = []; UI.go('game');
      const lo = { primary: 'm134', sidearm1: 'glock20', sidearm2: null, melee: 'kabar', armor: 'mtv', gear: 'nogear', utils: [null, null, null], ammo: {}, att: {} };
      const g = window._g = new Game({ mapId: 'killhouse', seed: 1000, mode: 'deathmatch', participants: [{ id: 'me', name: 'You', team: 0, loadout: lo, skins: {} }], localId: 'me', role: 'local' }, document.querySelector('#game'));
      g.start(); const me = g.byId.me; me.x = 8 * T; me.y = 17 * T; g.input.yaw = 0; g.input.pitch = 0;
      window._rlPose = ${p ? 'null' : "{ none: [0.1, 1.2, 0, -1, 2, 6], belt: [0.1, 1.2, 0, -1, 2, 6] }"};
      _iv.push(setInterval(() => { me.mag[me.slot] = ${ammo}; const w = g.wstat(me); me.reloadT = ${p} ? w.reload * (1 - ${p}) + 1e-4 : ${p ? 0 : "w.reload * 0.995"}; }, 3)); })()`);
    await b.sleep(2000); await b.shot('360-m134-' + tag);
  }
};
