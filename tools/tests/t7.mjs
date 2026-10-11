export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  console.log(await b.eval(`(() => { UI.go('game'); const lo = p => ({ primary: p, sidearm1: 'glock20', sidearm2: null, melee: 'kabar', armor: 'noarmor', gear: 'nogear', utils: [null, null, null], ammo: {} });
    const parts = [{ id: 'me', name: 'You', team: 0, loadout: lo('m24'), skins: {} }, { id: 'e', name: 'Enemy', team: 1, isBot: true, loadout: lo('ak47'), skins: {} }];
    const g = window._g = new Game({ mapId: 'farm', seed: 1002, mode: 'deathmatch', participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game'));
    g.units.forEach(u => u.ai = null); g.start(); return 'ok'; })()`));
  await b.sleep(1200);
  console.log(await b.eval(`(() => { const v = _g.view, r = v.vmRoot; return JSON.stringify({ vm: v.vm, pos: r.position, rot: [r.rotation.x, r.rotation.y, r.rotation.z], flash: v.vmFlash.visible, me: { stance: _g.byId.me.stance, z: _g.byId.me.z, walk: _g.byId.me.walk, moving: _g.byId.me.moving, reload: _g.byId.me.reloadT, swing: _g.byId.me.swingT, scoped: _g.byId.me.scoped }, pts: v.points.map(p => [p.intensity, Math.round(p.position.y)]) }, (k, val) => k === 'model' ? undefined : val); })()`));
  await b.shot('40-debug');
};
