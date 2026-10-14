// for every gun: which other parts does the seated magazine overlap (they block it going in), and which parts lie in
// the path it travels along its insertion axis
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1200);
  console.log(await b.eval(`(() => { const out = [];
    for (const id of Object.keys(ITEMS)) { const it = ITEMS[id]; if (!GunReal.has(id) || it.cat === 'melee') continue;
      const r = GunReal.build(it, { magMul: 1 }), g = r.g; g.updateMatrixWorld(true);
      const mags = []; g.traverse(o => { if (o.name === 'mag') mags.push(o); }); if (!mags.length) continue;
      const mb = new THREE.Box3(); mags.forEach(m => mb.union(new THREE.Box3().setFromObject(m)));
      const top = mb.max.y, inMag = o => { for (let p = o; p; p = p.parent) if (p.name === 'mag') return true; return false; };
      // the column below the magwell: the mag's footprint from its top down to well below it, shrunk a little
      const col = mb.clone(); col.min.x += 0.05; col.max.x -= 0.05; col.min.z += 0.06; col.max.z -= 0.06; col.min.y -= 20; col.max.y = top - 0.15;
      const hits = new Set(); g.traverse(o => { if (!o.isMesh || inMag(o)) return; const bb = new THREE.Box3().setFromObject(o); if (bb.intersectsBox(col) && bb.max.y < top + 2) hits.add(o.name || (o.geometry.type.replace('Geometry', '') + '@' + bb.min.y.toFixed(1))); });
      out.push(id + ': ' + [...hits].join(', ')); }
    return out.join(' ## '); })()`));
};
