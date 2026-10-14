// every magazine gun: is the top of the seated magazine inside the gun (magwell, receiver, stock)? Points just above
// the magazine's top face are tested with an odd/even ray count against every other mesh
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1200);
  console.log(await b.eval(`(() => { const out = [], rc = new THREE.Raycaster(), V = THREE.Vector3;
    for (const id of Object.keys(ITEMS)) { const it = ITEMS[id]; if (!GunReal.has(id) || !it.mag) continue;
      const g = GunModel.get(it, {}); g.updateMatrixWorld(true);
      const mags = []; g.traverse(o => { if (o.name === 'mag' && o.type === 'Group') mags.push(o); }); if (!mags.length) continue;
      const inMag = o => { for (let p = o; p; p = p.parent) if (p.name === 'mag') return true; return false; };
      const others = []; g.traverse(o => { if (o.isMesh && !inMag(o)) { o.material = o.material.clone(); o.material.side = THREE.DoubleSide; others.push(o); } });
      const mb = new THREE.Box3(); mags.forEach(m => mb.union(new THREE.Box3().setFromObject(m)));
      const ax = (g.userData.reload || {}).magAxis, up = ax ? ax.clone().negate() : new V(0, 1, 0), side = (g.userData.reload || {}).sideMag, top = (g.userData.reload || {}).topMag;
      if (side || top) continue;
      let miss = 0, n = 0;
      for (const f of [0.25, 0.5, 0.75]) {
        const z = mb.min.z + (mb.max.z - mb.min.z) * f, x = (mb.min.x + mb.max.x) / 2;
        // the magazine's top surface at this z: cast down onto the magazine from above
        rc.set(new V(x, 50, z), new V(0, -1, 0)); const hm = rc.intersectObjects(mags, true)[0]; if (!hm) continue;
        const p = hm.point.clone().addScaledVector(up, 0.12); n++;
        let inside = false; for (const o of others) { rc.set(p, new V(0, 1, 0)); const c = rc.intersectObject(o, false).length; if (c % 2) { inside = true; break; } }
        if (!inside) miss++;
      }
      out.push(id + (miss ? ' GAP ' + miss + '/' + n : ' ok'));
    }
    return out.join(' | '); })()`));
};
