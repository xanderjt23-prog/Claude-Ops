// the merged models (Locker preview, other soldiers' guns), top and side, with an optic fitted
import fs from 'fs';
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html');
  const data = await b.eval(`(() => { try {
    const ids = (${JSON.stringify(process.env.IDS || 'famas,m4,ak47,m14')}).split(','), opt = '${process.env.OPT || 'acog'}', W = 700, H = 300;
    const out = document.createElement('canvas'); out.width = W * 2; out.height = H * ids.length; const g = out.getContext('2d');
    const R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); R.setSize(W, H); R.setClearColor(0xd9dcd2);
    ids.forEach((id, row) => [0, 1].forEach(view => {
      const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x666655, 0.9)); const sun = new THREE.DirectionalLight(0xffffff, 0.7); sun.position.set(3, 4, 5); sc.add(sun);
      const m = GunModel.get(ITEMS[id], { merged: true, atts: [opt] }); sc.add(m);
      const box = new THREE.Box3().setFromObject(m), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
      const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 500);
      if (view === 0) { cam.position.set(c.x + s.z * 0.9, c.y + 1, c.z); } else { cam.position.set(c.x, c.y + s.z * 1.4, c.z + 0.01); }
      cam.lookAt(c); R.render(sc, cam); g.drawImage(R.domElement, view * W, row * H); g.fillStyle = '#111'; g.font = '16px sans-serif'; g.fillText(id + ' merged + ' + opt + (view ? ' (top)' : ' (side)'), view * W + 8, row * H + 18);
    }));
    return out.toDataURL(); } catch (e) { return 'ERR ' + e.stack; } })()`);
  if (!data.startsWith('data')) return console.log(data);
  fs.writeFileSync('tools/tests/shots/280-merged.png', Buffer.from(data.split(',')[1], 'base64'));
};
