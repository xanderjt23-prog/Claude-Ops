// top-down cutaways of a building, one per storey (everything above the cut is clipped away)
import fs from 'fs';
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html');
  const map = process.env.MAP || 'mansion';
  await b.eval(`(() => { UI.go('game');
    const parts = [{ id: 'me', name: 'You', team: 0, loadout: DEFAULT_LOADOUT, skins: {} }, { id: 'x', name: 'x', team: 1, isBot: true, loadout: botLoadout(3), skins: {} }];
    const g = window._g = new Game({ mapId: '${map}', seed: 1234, mode: 'deathmatch', participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game')); g.units.forEach(u => u.ai = null); g.start(); g.night = false; })()`);
  await b.sleep(3000);
  const data = await b.eval(`(() => { try {
    const g = _g, v = Object.values(g).find(o => o && o.vmRoot), m = g.map, R = v.renderer, bd = m.buildings[${process.env.BI || 0}];
    const x0 = (bd.x - 2) * T, x1 = (bd.x + bd.w + 2) * T, y0 = (bd.y - 2) * T, y1 = (bd.y + bd.h + 2) * T, base = bd.ground || 0;
    const n = bd.stories || 1, W = 900, H = Math.round(W * (y1 - y0) / (x1 - x0)), out = document.createElement('canvas'); out.width = W * 2; out.height = H * Math.ceil(n / 2); const c2 = out.getContext('2d');
    R.setSize(W, H, false); R.setPixelRatio(1);
    for (let k = 0; k < n; k++) { const cut = base + k * SH + 70;
      const cam = new THREE.OrthographicCamera(x0, x1, -y0, -y1, 1, 5000); cam.position.set(0, cut + 2000, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0);
      cam.position.set(0, 3000, 0); cam.rotation.set(-Math.PI / 2, 0, 0); cam.left = x0; cam.right = x1; cam.top = -y0; cam.bottom = -y1; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      const fog = v.scene.fog; v.scene.fog = null; R.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), cut)]; R.clear(); R.render(v.scene, cam); R.clippingPlanes = []; v.scene.fog = fog;
      c2.drawImage(R.domElement, (k % 2) * W, (k >> 1) * H); c2.fillStyle = '#f00'; c2.font = '24px sans-serif'; c2.fillText('storey ' + (k + 1), (k % 2) * W + 10, (k >> 1) * H + 28); }
    return out.toDataURL(); } catch (e) { return 'ERR ' + e.stack; } })()`);
  if (!data.startsWith('data')) return console.log(data);
  fs.writeFileSync('tools/tests/shots/300-' + map + '-floors.png', Buffer.from(data.split(',')[1], 'base64'));
};
