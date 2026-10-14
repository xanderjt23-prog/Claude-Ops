// weapon model lineup: every gun from the side (orthographic), labelled
import fs from 'fs';
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  const groups = [['Assault Rifle', 'Battle Rifle'], ['Marksman Rifle', 'Sniper Rifle', 'Anti-Materiel Rifle'], ['Shotgun', 'Light Machine Gun'], ['Submachine Gun', 'Pistol', 'Revolver']];
  for (let gi = 0; gi < groups.length; gi++) {
    const data = await b.eval(`(() => {
      const types = ${JSON.stringify(groups[gi])}, list = Object.values(ITEMS).filter(it => types.includes(it.type));
      const cols = 3, rows = Math.ceil(list.length / cols), W = 1500, H = rows * 150 + 20;
      const R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); R.setSize(W, H); R.setClearColor(0xd9dcd2);
      const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x666655, 0.9)); const sun = new THREE.DirectionalLight(0xffffff, 0.7); sun.position.set(3, 4, 2); sc.add(sun);
      const cell = 40; list.forEach((it, i) => { const m = GunModel.get(it, {}); const cx = (i % cols) * cell, cy = -Math.floor(i / cols) * 6; m.rotation.y = Math.PI / 2; m.position.set(cx + 6, cy, 0); sc.add(m); });
      const cam = new THREE.OrthographicCamera(-4, cols * cell - 4, 3, -rows * 6 + 2, -100, 100); cam.position.set(0, 0, 50); cam.lookAt(0, 0, 0);
      R.render(sc, cam);
      const out = document.createElement('canvas'); out.width = W; out.height = H; const g = out.getContext('2d'); g.drawImage(R.domElement, 0, 0); g.font = '15px sans-serif'; g.fillStyle = '#111';
      list.forEach((it, i) => g.fillText(it.name, (i % cols) * (W / cols) + 8, Math.floor(i / cols) * (H - 20) / rows + 18));
      return out.toDataURL(); })()`);
    fs.writeFileSync('tools/tests/shots/190-guns-' + gi + '.png', Buffer.from(data.split(',')[1], 'base64'));
  }
};
