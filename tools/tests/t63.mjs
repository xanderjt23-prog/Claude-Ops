// pose sweep for a reload kind: env GUN, KIND, P, POSES = json list of pose arrays
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  const gun = process.env.GUN || 'm4', poses = JSON.parse(process.env.POSES), p = process.env.P || '0.15';
  await b.eval(`(() => { UI.go('game'); const prim = ITEMS['${gun}'].cat === 'primary', atts = ${process.env.ATT || '[]'};
      const lo = { primary: prim ? '${gun}' : 'm4', sidearm1: prim ? 'glock20' : '${gun}', sidearm2: null, melee: 'kabar', armor: 'mtv', gear: 'nogear', utils: [null, null, null], ammo: {}, att: { '${gun}': Object.fromEntries(atts.map(a => [ITEMS[a].slot, a])) } };
      const parts = [{ id: 'me', name: 'You', team: 0, loadout: lo, skins: {} }, { id: 'x', name: 'x', team: 1, isBot: true, loadout: lo, skins: {} }];
      const g = window._g = new Game({ mapId: 'killhouse', seed: 1000, mode: 'deathmatch', participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game'));
      g.units.forEach(u => u.ai = null); g.start(); const me = g.byId.me; me.x = 8 * T; me.y = 17 * T; g.input.yaw = 0; g.input.pitch = 0; g.byId.x.x = 3 * T; g.byId.x.y = 3 * T; if (!prim) me.slot = 1; me.mag[me.slot] = 0;
      window._rT = setInterval(() => { const w = g.wstat(me); me.reloadT = w.reload * (1 - ${p}) + 1e-4; }, 2); })()`);
  for (let i = 0; i < poses.length; i++) { await b.eval(`window._rlPose = { '${process.env.KIND || 'mag'}': ${JSON.stringify(poses[i])} }`); await b.sleep(900); await b.shot('320-' + gun + '-pose' + i); }
};
