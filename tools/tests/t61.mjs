// first-person view frozen at points of a reload (env GUNS=a,b; P=fractions; ATT=json array of attachments)
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  for (const gun of (process.env.GUNS || 'ak47,m4').split(',')) for (const p of (process.env.P || '0.5').split(',')) {
    const r = await b.eval(`(() => { try { if (window._g) _g.stop(); if (window._rT) clearInterval(_rT); UI.go('game');
      const prim = ITEMS['${gun}'].cat === 'primary', atts = ${process.env.ATT || '[]'};
      const lo = { primary: prim ? '${gun}' : 'm4', sidearm1: prim ? 'glock20' : '${gun}', sidearm2: null, melee: 'kabar', armor: 'mtv', gear: 'nogear', utils: [null, null, null], ammo: {}, att: { '${gun}': Object.fromEntries(atts.map(a => [ITEMS[a].slot, a])) } };
      const parts = [{ id: 'me', name: 'You', team: 0, loadout: lo, skins: {} }, { id: 'x', name: 'x', team: 1, isBot: true, loadout: lo, skins: {} }];
      const g = window._g = new Game({ mapId: 'killhouse', seed: 1000, mode: 'deathmatch', participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game'));
      g.units.forEach(u => u.ai = null); g.start(); const me = g.byId.me; me.x = 8 * T; me.y = 17 * T; g.input.yaw = 0; g.input.pitch = 0; g.byId.x.x = 3 * T; g.byId.x.y = 3 * T;
      if (!prim) me.slot = 1;
      const v = Object.values(g).find(o => o && o.vm && o.vmRoot); me.mag[me.slot] = ${process.env.LEFT || 0};
      window._rT = setInterval(() => { const w = g.wstat(me); if (${process.env.CYC ? 1 : 0}) { me.reloadT = 0; me.mag[me.slot] = 3; if (v.vm.rig) v.vm.shotT = g.time - 0.06 - ${p} * v.vm.rig.cycleDur; } else me.reloadT = w.reload * (1 - ${p}) + 1e-4; }, 2); return 'ok'; } catch (e) { return e.stack; } })()`);
    if (r !== 'ok') console.log(r);
    await b.sleep(2500); await b.shot('310-' + gun + (process.env.ATT ? '-att' : '') + (process.env.CYC ? '-c' : '-r') + p);
  }
};
