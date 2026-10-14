// orbit views of a map area (env MAP, AT=x,y tiles, R radius tiles, H height): 4 views in one image
import fs from 'fs';
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html');
  const map = process.env.MAP || 'mansion';
  await b.eval(`(() => { UI.go('game');
    const parts = [{ id: 'me', name: 'You', team: 0, loadout: DEFAULT_LOADOUT, skins: {} }, { id: 'x', name: 'x', team: 1, isBot: true, loadout: botLoadout(3), skins: {} }];
    const g = window._g = new Game({ mapId: '${map}', seed: 1234, mode: 'deathmatch', participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game')); g.units.forEach(u => u.ai = null); g.start(); g.night = false; })()`);
  await b.sleep(3000);
  const data = await b.eval(`(() => { try {
    const g = _g, v = Object.values(g).find(o => o && o.vmRoot), m = g.map, R = v.renderer;
    const at = '${process.env.AT || ''}'.split(',').map(Number), cx = (at[0] || m.w / 2) * T, cy = (at[1] || m.h / 2) * T, rad = ${process.env.R || 40} * T, hh = ${process.env.H || 900};
    const W = 960, Hh = 600, out = document.createElement('canvas'); out.width = W * 2; out.height = Hh * 2; const c2 = out.getContext('2d');
    const cam = new THREE.PerspectiveCamera(50, W / Hh, 5, 20000); const gz = g.groundAt(cx, cy);
    v.updateLights && 0; R.setSize(W, Hh, false); R.setPixelRatio(1);
    [0, 1, 2, 3].forEach(k => { const a = k * Math.PI / 2 + 0.6; cam.position.set(cx + Math.cos(a) * rad, gz + hh, cy + Math.sin(a) * rad); cam.lookAt(cx, gz + 60, cy); cam.updateMatrixWorld();
      R.clear(); R.render(v.scene, cam); c2.drawImage(R.domElement, (k % 2) * W, (k >> 1) * Hh); c2.fillStyle = '#fff'; c2.font = '20px sans-serif'; c2.fillText('view ' + k, (k % 2) * W + 10, (k >> 1) * Hh + 26); });
    return out.toDataURL(); } catch (e) { return 'ERR ' + e.stack; } })()`);
  if (!data.startsWith('data')) return console.log(data);
  fs.writeFileSync('tools/tests/shots/290-' + map + (process.env.TAG || '') + '.png', Buffer.from(data.split(',')[1], 'base64'));
};
