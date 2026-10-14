// contact sheet: every gun fitted into its own cell (side view), env TYPES filters, OUT names the file
import fs from 'fs';
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  const groups = (process.env.GROUPS || 'Assault Rifle,Battle Rifle|Marksman Rifle,Sniper Rifle,Anti-Materiel Rifle|Shotgun,Light Machine Gun|Submachine Gun|Pistol,Revolver').split('|');
  for (let gi = 0; gi < groups.length; gi++) {
    const data = await b.eval(`(() => {
      const types = ${JSON.stringify(groups[gi].split(','))}, ids = '${process.env.IDS || ''}', list = Object.values(ITEMS).filter(it => ids ? ids.split(',').includes(it.id) : types.includes(it.type));
      const cols = 3, CW = 600, CH = 300, rows = Math.ceil(list.length / cols), out = document.createElement('canvas'); out.width = cols * CW; out.height = rows * CH;
      const g = out.getContext('2d'); g.fillStyle = '#d9dcd2'; g.fillRect(0, 0, out.width, out.height);
      const R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); R.setSize(CW, CH); R.setClearColor(0xd9dcd2);
      list.forEach((it, i) => {
        const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x666655, 0.9)); const sun = new THREE.DirectionalLight(0xffffff, 0.7); sun.position.set(3, 4, 5); sc.add(sun);
        const want = ${process.env.ATT || '[]'}, used = {}, atts = want.filter(a => { const sl = ITEMS[a].slot; if (used[sl] || !attachFits(a, it.id)) return false; return (used[sl] = true); }); const m = GunModel.get(it, { atts }); m.rotation.y = Math.PI / 2; sc.add(m);
        const box = new THREE.Box3().setFromObject(m), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
        const half = Math.max(s.x / 2 * 1.06, s.y / 2 * 1.1 * CW / CH);
        const cam = new THREE.OrthographicCamera(c.x - half, c.x + half, c.y + half * CH / CW, c.y - half * CH / CW, -100, 100); cam.position.set(0, 0, 50); R.render(sc, cam);
        g.drawImage(R.domElement, (i % cols) * CW, Math.floor(i / cols) * CH); g.font = '18px sans-serif'; g.fillStyle = '#111'; g.fillText(it.name + ' (' + Math.round(s.x / ${'0.02'} ) + ')', (i % cols) * CW + 8, Math.floor(i / cols) * CH + 22);
        g.strokeStyle = '#999'; g.strokeRect((i % cols) * CW, Math.floor(i / cols) * CH, CW, CH);
      });
      return out.toDataURL(); })()`);
    fs.writeFileSync('tools/tests/shots/260-' + (process.env.OUT || 'g') + gi + '.png', Buffer.from(data.split(',')[1], 'base64'));
  }
};
