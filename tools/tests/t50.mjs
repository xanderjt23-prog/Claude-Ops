// large side views of chosen guns (env IDS=a,b,c; ATT=json attachments)
import fs from 'fs';
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(3000);
  const ids = (process.env.IDS || 'g36,ak47,scar,m82').split(','), atts = process.env.ATT || '[]';
  for (const id of ids) {
    const data = await b.eval(`(() => { try {
      const W = 1400, H = 520, R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); R.setSize(W, H); R.setClearColor(0xd9dcd2);
      const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x666655, 0.9)); const sun = new THREE.DirectionalLight(0xffffff, 0.7); sun.position.set(3, 4, 5); sc.add(sun);
      const m = GunModel.get(ITEMS['${id}'], { atts: ${atts} }); m.rotation.y = Math.PI / 2; sc.add(m);
      const box = new THREE.Box3().setFromObject(m), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
      const half = Math.max(s.x / 2 * 1.08, s.y / 2 * 1.08 * W / H), cam = new THREE.OrthographicCamera(c.x - half, c.x + half, c.y + half * H / W, c.y - half * H / W, -100, 100);
      cam.position.set(0, 0, 50); R.render(sc, cam);
      const cam2 = new THREE.PerspectiveCamera(35, W / H, 0.1, 500); cam2.position.set(c.x - s.x * 0.2, c.y + s.x * 0.25, s.x * 0.95); cam2.lookAt(c); const R2 = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); R2.setSize(W, H); R2.setClearColor(0xd9dcd2); R2.render(sc, cam2);
      const out = document.createElement('canvas'); out.width = W; out.height = H * 2; const g = out.getContext('2d'); g.drawImage(R.domElement, 0, 0); g.drawImage(R2.domElement, 0, H); g.font = '20px sans-serif'; g.fillStyle = '#111'; g.fillText(ITEMS['${id}'].name, 10, 26);
      return out.toDataURL(); } catch (e) { return "ERR " + e.stack; } })()`); if (!data.startsWith("data")) { console.log(data); continue; }
    fs.writeFileSync('tools/tests/shots/250-' + id + '.png', Buffer.from(data.split(',')[1], 'base64'));
  }
};
