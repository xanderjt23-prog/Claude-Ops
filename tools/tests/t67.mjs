// distance (model units, along the gun) from the firing hand to the top of the magazine, for every magazine gun
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1200);
  console.log(await b.eval(`(() => { UI.go('game'); const lo = { primary: 'm4', sidearm1: 'glock20', sidearm2: null, melee: 'kabar', armor: 'mtv', gear: 'nogear', utils: [null, null, null], ammo: {}, att: {} };
    const g = window._g = new Game({ mapId: 'killhouse', seed: 1000, mode: 'deathmatch', participants: [{ id: 'me', name: 'You', team: 0, loadout: lo, skins: {} }], localId: 'me', role: 'local' }, document.querySelector('#game'));
    g.start(); const v = Object.values(g).find(o => o && o.vm && o.vmRoot), out = [];
    for (const id of Object.keys(ITEMS)) { const it = ITEMS[id]; if (!(it.cat === 'primary' || it.cat === 'sidearm') || !it.mag) continue;
      const m = v.buildGunModel(it, '', 'multicam', []); v.vmRoot.add(m); const R = v.reloadRig(m, it, []); v.vmRoot.remove(m);
      if (R.kind !== 'mag') continue; out.push(id + ':' + (R.top.z - R.grip.userData.rest.z).toFixed(1) + '/' + R.len.toFixed(1)); }
    return out.join(' '); })()`));
};
