// where the first-person ejection point is, in view space, for some guns
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1200);
  for (const gun of (process.env.GUNS || 'famas,m249,m4').split(',')) {
    console.log(await b.eval(`(() => { if (window._g) _g.stop(); UI.go('game'); const lo = { primary: '${gun}', sidearm1: 'glock20', sidearm2: null, melee: 'kabar', armor: 'mtv', gear: 'nogear', utils: [null, null, null], ammo: {}, att: {} };
      const g = window._g = new Game({ mapId: 'killhouse', seed: 1000, mode: 'deathmatch', participants: [{ id: 'me', name: 'You', team: 0, loadout: lo, skins: {} }], localId: 'me', role: 'local' }, document.querySelector('#game'));
      g.start(); return 'started'; })()`));
    await b.sleep(1500);
    console.log(gun, await b.eval(`(() => { const v = Object.values(_g).find(o => o && o.vm && o.vmRoot), R = v.vm.rig; if (!R || !R.ej) return 'no ej';
      R.g.updateMatrixWorld(true); const w = R.ej.p.clone().applyMatrix4(R.g.matrixWorld); const s = w.clone().project(v.vmCam);
      return JSON.stringify({ local: R.ej.p.toArray().map(n => +n.toFixed(2)), view: w.toArray().map(n => +n.toFixed(2)), screen: [s.x.toFixed(2), s.y.toFixed(2)], dir: R.ej.dir }); })()`));
  }
};
