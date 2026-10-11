// ============================================================================
// Weapon models for the 3D view: guns are built from extruded side profiles
// (receiver, stock, grip, magazine) plus barrels, sights, rails and fitted
// attachments. Model space: barrel points along -z, grip at the origin,
// 1 unit ~ 1.9 cm. Used for the first-person weapon and (scaled) on soldiers.
// ============================================================================
const GunModel = (() => {
  const geoCache = {}, matCache = {};
  const WOOD = new Set(['ak47', 'rpk', 'mosin', 'k98k', 'enfield', 'garand', 'm14', 'svd', 'thompson', 'r870', 'bar', 'nagant', 'mod29', 'python', 'deagle']);
  function mat(key, make) { return matCache[key] || (matCache[key] = make()); }
  const metal = () => mat('metal', () => new THREE.MeshPhongMaterial({ color: 0x23252a, shininess: 60, specular: 0x555555 }));
  const darkMetal = () => mat('dmetal', () => new THREE.MeshPhongMaterial({ color: 0x141518, shininess: 40, specular: 0x333333 }));
  const polymer = () => mat('poly', () => new THREE.MeshLambertMaterial({ color: 0x1d1e1f }));
  const wood = () => mat('wood', () => { const c = document.createElement('canvas'); c.width = 64; c.height = 16; const g = c.getContext('2d'); g.fillStyle = '#6b4424'; g.fillRect(0, 0, 64, 16); for (let i = 0; i < 14; i++) { g.strokeStyle = `rgba(${i % 2 ? '40,20,5' : '150,100,60'},0.35)`; g.beginPath(); g.moveTo(0, Math.random() * 16); g.bezierCurveTo(20, Math.random() * 16, 44, Math.random() * 16, 64, Math.random() * 16); g.stroke(); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return new THREE.MeshPhongMaterial({ map: t, shininess: 20, specular: 0x222222 }); });
  const glass = (tint) => mat('glass' + tint, () => new THREE.MeshPhongMaterial({ color: tint, shininess: 100, specular: 0xffffff, transparent: true, opacity: 0.75 }));
  const emissive = (col) => mat('em' + col, () => new THREE.MeshBasicMaterial({ color: col }));
  // profile (u forward, v up) extruded across the width, centred
  function ext(key, pts, depth, bevel) {
    const k = key + ':' + depth;
    if (!geoCache[k]) {
      const sh = new THREE.Shape(); pts.forEach(([u, v], i) => i ? sh.lineTo(u, v) : sh.moveTo(u, v)); sh.closePath();
      const b = bevel === undefined ? Math.min(0.15, depth * 0.12) : bevel;
      const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.05, depth - b * 2), bevelEnabled: b > 0, bevelSize: b, bevelThickness: b, bevelSegments: 1, curveSegments: 6 });
      g.translate(0, 0, -(depth - b * 2) / 2); g.rotateY(Math.PI / 2); geoCache[k] = g;
    }
    return geoCache[k];
  }
  const box = (w, h, d) => { const k = `b${w},${h},${d}`; return geoCache[k] || (geoCache[k] = new THREE.BoxGeometry(w, h, d)); };
  const cyl = (r1, r2, l, seg) => { const k = `c${r1},${r2},${l},${seg || 12}`; if (!geoCache[k]) { const g = new THREE.CylinderGeometry(r1, r2, l, seg || 12); g.rotateX(Math.PI / 2); geoCache[k] = g; } return geoCache[k]; };

  function build(it, o) {
    o = o || {};
    const g = new THREE.Group(), L = Math.max(10, Art.weaponLen(it)) * 0.525, t = it.type, atts = o.atts || [], has = s => atts.find(a => ITEMS[a] && ITEMS[a].slot === s);
    const skin = o.camo || polymer(), stockMat = WOOD.has(it.id) ? wood() : skin, furn = WOOD.has(it.id) ? wood() : polymer();
    const add = (geo, m, x, y, z, rx, ry, rz) => { const me = new THREE.Mesh(geo, m); me.position.set(x || 0, y || 0, z || 0); if (rx || ry || rz) me.rotation.set(rx || 0, ry || 0, rz || 0); g.add(me); return me; };
    // u (forward) -> -z
    const P = (u) => -u;
    let tip = -L, railTop = 1.2, sightU = 0.25 * L;
    if (it.cat === 'melee') {
      if (it.id === 'fists') return g;
      const blade = { Knife: 7, Blade: 13, Sword: 18 }[t];
      add(ext('handle' + it.id, [[-1.2, -0.45], [2.6, -0.5], [2.6, 0.5], [-1.2, 0.45]], 0.9), it.id === 'katana' ? polymer() : wood(), 0, 0, 0);
      if (blade) {
        const pts = it.id === 'katana' ? [[2.6, -0.45], [2.6 + blade, -0.1], [2.6 + blade + 1.5, 0.6], [2.6 + blade * 0.6, 0.55], [2.6, 0.45]] : [[2.6, -0.5], [2.6 + blade, -0.2], [2.6 + blade + 1.2, 0.4], [2.6 + blade * 0.7, 0.55], [2.6, 0.5]];
        add(ext('blade' + it.id, pts, 0.18, 0.03), mat('steel', () => new THREE.MeshPhongMaterial({ color: 0xb8bcc2, shininess: 120, specular: 0xffffff })), 0, 0, 0);
        add(box(0.4, 1.8, 0.4), metal(), 0, 0, P(2.6));
      } else {
        add(ext('shaft' + it.id, [[2.6, -0.4], [12, -0.4], [12, 0.4], [2.6, 0.4]], 0.8), wood(), 0, 0, 0);
        if (t === 'Axe') add(ext('axehead', [[10.5, -0.5], [13, -0.5], [13.6, -3.4], [11.2, -2.6], [10.5, 0.5]], 0.35, 0.05), metal(), 0, 0, 0);
        else if (t === 'Hammer') add(box(2.4, 2.4, 3.8), darkMetal(), 0, 0, P(12));
        else add(box(1.2, 1.2, 2.4), metal(), 0, 0, P(12.5)); // club / shovel head
      }
      g.userData.tip = new THREE.Vector3(0, 0, -6); return g;
    }
    if (t === 'Rocket Launcher') {
      add(cyl(1.5, 1.5, L * 1.25, 16), mat('rpgtube', () => new THREE.MeshLambertMaterial({ color: 0x4b5320 })), 0, 0.8, P(L * 0.35));
      add(cyl(1.2, 1.2, L * 0.5, 16), wood(), 0, 0.8, P(L * 0.25));
      const war = new THREE.Mesh(new THREE.ConeGeometry(2.2, 6, 12).rotateX(-Math.PI / 2), metal()); war.position.set(0, 0.8, -L * 1.0 - 3.6); g.add(war);
      add(cyl(1.6, 1.6, 2, 12), mat('rpgw', () => new THREE.MeshLambertMaterial({ color: 0x4b5320 })), 0, 0.8, -L * 0.98);
      add(ext('rpggrip', [[0, -0.2], [0.8, -0.2], [0.6, -3.2], [-0.2, -3.0]], 1.1), furn, 0, 0, 0);
      add(ext('rpggrip2', [[0, -0.2], [0.8, -0.2], [0.6, -3.0], [-0.2, -2.8]], 1.1), furn, 0, 0, P(L * 0.32));
      add(box(0.5, 1.4, 0.5), metal(), -1.0, 2.3, P(L * 0.2));
      g.userData.tip = new THREE.Vector3(0, 0.8, -L);
      return g;
    }
    if (t === 'Flamethrower') {
      add(ext('flbody', [[0, -0.8], [L * 0.7, -0.6], [L * 0.7, 0.8], [0, 1.0]], 1.6), skin, 0, 0, 0);
      add(cyl(0.55, 0.7, L * 0.45, 10), metal(), 0, 0.4, P(L * 0.9));
      add(ext('flgrip', [[0.05 * L, -0.6], [0.18 * L, -0.6], [0.15 * L, -3.4], [0.02 * L, -3.2]], 1.1), polymer(), 0, 0, 0);
      add(ext('flgrip2', [[0.5 * L, -0.6], [0.6 * L, -0.6], [0.58 * L, -3.0], [0.48 * L, -2.8]], 1.1), polymer(), 0, 0, 0);
      add(cyl(0.3, 0.3, 1.2, 8), emissive(0xff7a20), 0, -0.4, P(L * 1.1));
      g.userData.tip = new THREE.Vector3(0, 0.4, -L * 1.12); return g;
    }
    if (t === 'Grenade Launcher') {
      add(ext('glframe', [[-0.32 * L, 0.8], [0.6 * L, 0.8], [0.6 * L, 1.6], [-0.32 * L, 1.4]], 1.4), metal(), 0, 0, 0);
      add(cyl(2.6, 2.6, 0.32 * L, 6), darkMetal(), 0, -0.6, P(0.2 * L));
      add(cyl(1.15, 1.15, 0.5 * L, 14), metal(), 0, 0.2, P(0.58 * L));
      add(ext('glstock', [[0, 0.9], [-0.42 * L, 0.6], [-0.44 * L, -1.8], [-0.36 * L, -1.8], [0, -0.3]], 1.2), polymer(), 0, 0, 0);
      add(ext('glgrip', [[0.0, -0.6], [0.1 * L, -0.6], [0.08 * L, -3.6], [-0.03 * L, -3.4]], 1.1), polymer(), 0, 0, 0);
      tip = -0.85 * L; g.userData.tip = new THREE.Vector3(0, 0.2, tip); return g;
    }
    if (t === 'Heavy Machine Gun') {
      add(box(3.2, 3.0, 0.42 * L), darkMetal(), 0, 0.4, P(0.18 * L));
      if (it.spinup) { // rotary barrels
        const spin = new THREE.Group(); spin.position.set(0, 0.4, 0); g.add(spin);
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, b = new THREE.Mesh(cyl(0.3, 0.3, 0.6 * L, 8), metal()); b.position.set(Math.cos(a) * 0.9, Math.sin(a) * 0.9, P(0.7 * L)); spin.add(b); }
        const ring = new THREE.Mesh(cyl(1.3, 1.3, 0.6, 12), darkMetal()); ring.position.set(0, 0, P(0.8 * L)); spin.add(ring);
        g.userData.spin = spin;
      } else {
        add(cyl(1.0, 1.0, 0.35 * L, 14), darkMetal(), 0, 0.4, P(0.55 * L)); // perforated jacket
        for (let k = 0; k < 5; k++) add(box(2.1, 0.4, 0.9), metal(), 0, 0.4, P(0.42 * L + k * 0.06 * L));
        add(cyl(0.42, 0.42, 0.35 * L, 10), metal(), 0, 0.4, P(0.85 * L));
      }
      add(box(0.5, 2.6, 0.5), metal(), 1.2, -1.0, 1.2); add(box(0.5, 2.6, 0.5), metal(), -1.2, -1.0, 1.2); // spade grips
      add(box(3.8, 0.8, 1.6), darkMetal(), 0, -1.6, 0.6); // ammo can
      tip = -L; g.userData.tip = new THREE.Vector3(0, 0.4, tip); return g;
    }
    const pistolish = t === 'Pistol' || t === 'Revolver';
    if (pistolish) {
      const slideMat = mat('slide', () => new THREE.MeshPhongMaterial({ color: 0x2a2c30, shininess: 70, specular: 0x666666 }));
      if (t === 'Revolver') {
        add(cyl(0.45, 0.45, 0.75 * L, 12), slideMat, 0, 0.9, P(0.55 * L));
        add(ext('rvframe', [[-0.1 * L, -0.2], [0.35 * L, -0.2], [0.35 * L, 1.5], [0.05 * L, 1.6], [-0.15 * L, 1.0]], 1.1), slideMat, 0, 0, 0);
        add(cyl(1.0, 1.0, 0.25 * L, 6), metal(), 0, 0.7, P(0.17 * L));
        add(ext('rvgrip', [[-0.15 * L, 0.6], [0.06 * L, 0.0], [0.0, -2.8], [-0.32 * L, -2.6], [-0.3 * L, -0.4]], 1.15), wood(), 0, 0, 0);
        tip = -0.92 * L; sightU = 0.6 * L;
      } else {
        add(ext('slide' + it.id, [[-0.1 * L, 0.3], [0.88 * L, 0.3], [0.9 * L, 1.2], [0.75 * L, 1.45], [-0.08 * L, 1.45]], 1.05), o.camo && it.id !== 'luger' ? skin : slideMat, 0, 0, 0);
        add(ext('frame', [[-0.05 * L, -0.3], [0.8 * L, -0.3], [0.8 * L, 0.3], [-0.05 * L, 0.3]], 0.95), polymer(), 0, 0, 0);
        add(ext('pgrip', [[-0.08 * L, -0.2], [0.24 * L, -0.2], [0.14 * L, -3.0], [-0.2 * L, -2.8]], 1.15), it.id === 'm1911' || it.id === 'luger' || it.id === 'p38' ? wood() : polymer(), 0, 0, 0);
        add(cyl(0.22, 0.22, 0.4, 8), darkMetal(), 0, 0.85, P(0.9 * L));
        add(box(0.3, 0.35, 0.3), darkMetal(), 0, 1.6, P(0.82 * L)); add(box(0.7, 0.35, 0.3), darkMetal(), 0, 1.6, P(0.0));
        tip = -0.92 * L; sightU = 0.4 * L; railTop = 1.45;
      }
      add(ext('tguard', [[0.12 * L, -0.25], [0.42 * L, -0.25], [0.4 * L, -1.0], [0.16 * L, -1.0]], 0.3, 0.02), polymer(), 0, 0, 0);
      if (has('mag') === 'extmag') add(box(0.85, 1.6, 0.9), polymer(), 0, -3.4, P(0.0));
      if (has('optic')) add(box(0.7, 0.6, 0.9), darkMetal(), 0, railTop + 0.35, P(sightU));
      if (has('optic')) add(box(0.6, 0.5, 0.05), glass(0x88ccff), 0, railTop + 0.55, P(sightU) + 0.45);
    } else {
      // long guns: receiver, handguard, stock, grip, magazine, barrel
      const recvL = (t === 'Submachine Gun' ? 0.5 : 0.42) * L, hgEnd = t === 'Sniper Rifle' || t === 'Anti-Materiel Rifle' ? 0.62 * L : t === 'Shotgun' ? 0.7 * L : 0.72 * L;
      add(ext('recv' + it.id, [[0, -1.0], [recvL, -1.0], [recvL, 0.95], [recvL - 0.6, 1.2], [0.4, 1.2], [0, 0.9]], 1.5), skin, 0, 0, 0);
      add(box(0.3, 0.7, 1.2), darkMetal(), 0.78, 0.4, P(recvL * 0.45)); // ejection port
      if (t !== 'Sniper Rifle' || !WOOD.has(it.id)) add(ext('hg' + it.id, [[recvL, -0.85], [hgEnd, -0.75], [hgEnd, 0.95], [recvL, 1.05]], t === 'Shotgun' ? 1.5 : 1.75), furn === wood() ? wood() : skin, 0, 0, 0);
      else add(ext('hgw' + it.id, [[recvL, -1.0], [hgEnd, -0.6], [hgEnd, 0.5], [recvL, 0.8]], 1.4), wood(), 0, 0, 0);
      for (let k = 0; k < 3 && t !== 'Shotgun'; k++) add(box(0.2, 0.5, 0.25 * (hgEnd - recvL) / 1.2), darkMetal(), 0.9, 0.1, P(recvL + (k + 0.6) * (hgEnd - recvL) / 3.5)); // vents
      const br = t === 'Anti-Materiel Rifle' ? 0.55 : t === 'Shotgun' ? 0.5 : t.includes('Machine') ? 0.42 : 0.3;
      add(cyl(br, br, L - hgEnd + 0.4, 12), metal(), 0, 0.25, P((hgEnd + L) / 2));
      // stock
      if (t !== 'Submachine Gun' || ['mp5', 'thompson', 'vector', 'p90'].includes(it.id)) {
        const sl = t === 'Submachine Gun' ? 0.24 * L : t.includes('Sniper') || t === 'Anti-Materiel Rifle' || t === 'Marksman Rifle' ? 0.4 * L : 0.34 * L;
        const pts = WOOD.has(it.id) ? [[0.02, 0.85], [-sl, 0.55], [-sl - 0.3, 0.6], [-sl - 0.3, -2.1], [-sl + 0.3, -2.0], [-0.06 * L, -0.4], [0.02, -0.7]] : [[0.02, 0.9], [-sl * 0.2, 0.9], [-sl, 0.8], [-sl - 0.25, 0.8], [-sl - 0.25, -1.9], [-sl + 0.6, -1.9], [-sl * 0.3, -0.6], [0.02, -0.6]];
        add(ext('stock' + it.id, pts, 1.3), stockMat, 0, 0, 0);
      } else add(box(0.25, 0.25, 0.3 * L), metal(), 0.5, 0.2, 0.15 * L); // folded wire stock
      // pistol grip (not on traditional wooden rifles with straight wrists)
      if (!['mosin', 'k98k', 'enfield', 'garand', 'm14', 'r870', 'svd'].includes(it.id)) add(ext('grip', [[0.04 * L, -0.9], [0.13 * L, -0.9], [0.11 * L, -3.6], [0.02 * L, -3.4]], 1.15), polymer(), 0, 0, 0);
      add(ext('tguard2', [[0.1 * L, -0.95], [0.22 * L, -0.95], [0.21 * L, -1.7], [0.12 * L, -1.7]], 0.3, 0.02), polymer(), 0, 0, 0);
      // magazine
      const magU = (t === 'Submachine Gun' ? 0.32 : 0.24) * L, magLen = has('mag') === 'extmag' ? 1.5 : 1;
      if (has('mag') === 'drum') add(cyl(2.0, 2.0, 1.6, 16), darkMetal(), 0, -2.6, P(magU)).rotation.set(0, Math.PI / 2, 0);
      else if (t === 'Light Machine Gun') { add(box(2.4, 2.8, 3.2), darkMetal(), -1.7, -1.5, P(0.3 * L)); }
      else if (t === 'Shotgun') { add(cyl(0.45, 0.45, hgEnd - recvL + 3, 10), metal(), 0, -0.55, P(hgEnd - 1)); add(ext('pump', [[recvL + 1, -1.2], [recvL + 0.45 * (hgEnd - recvL), -1.2], [recvL + 0.45 * (hgEnd - recvL), 0.0], [recvL + 1, 0.0]], 1.8), furn, 0, 0, 0); }
      else if (it.mag && !it.spinup && !['mosin', 'k98k', 'garand'].includes(it.id)) {
        const curve = it.cal === '762x39' || it.cal === '545x39' ? 1.2 : it.cal === '556' || it.cal === '792x33' ? 0.6 : 0;
        const ml = (t === 'Submachine Gun' ? 3.6 : t === 'Pistol' ? 2.6 : 3.0) * magLen;
        add(ext('mag' + it.id + magLen, [[magU - 0.5, -0.9], [magU + 0.7, -0.9], [magU + 0.7 + curve, -0.9 - ml], [magU - 0.5 + curve * 1.1, -0.9 - ml - 0.2]], 0.9), darkMetal(), 0, 0, 0);
      }
      if (['mosin', 'k98k', 'enfield'].includes(it.id)) add(new THREE.SphereGeometry(0.45, 8, 6), metal(), 1.3, 0.8, P(0.08 * L)); // bolt handle
      // sights / rail
      if (!it.norail && !it.scope) for (let k = 0; k < (hgEnd - 0.5) / 0.7; k++) add(box(0.9, 0.22, 0.4), darkMetal(), 0, railTop + 0.1, P(0.4 + k * 0.7));
      if (!has('optic') && !it.scope) { add(box(0.25, 1.1, 0.35), darkMetal(), 0, 1.6, P(hgEnd - 0.4)); add(box(0.8, 0.6, 0.5), darkMetal(), 0, 1.5, P(0.05 * L)); }
      if (it.scope && has('optic') !== 'sniper8') { add(cyl(0.75, 0.75, 0.32 * L, 14), darkMetal(), 0, 2.2, P(0.28 * L)); add(cyl(0.95, 0.75, 1.2, 14), darkMetal(), 0, 2.2, P(0.44 * L)); add(cyl(0.9, 0.75, 1.0, 14), darkMetal(), 0, 2.2, P(0.12 * L)); add(cyl(0.3, 0.3, 0.8, 8), metal(), 0, 3.1, P(0.28 * L)).rotation.set(0, 0, 0); }
      sightU = 0.24 * L; tip = -L;
      // muzzle
      const mz = has('muzzle');
      if (mz === 'supp9' || mz === 'supp556' || mz === 'supp762') { add(cyl(0.62, 0.62, 4.4, 14), darkMetal(), 0, 0.25, -L - 2.1); tip = -L - 4.3; }
      else if (mz === 'brake') { add(box(1.5, 0.8, 1.6), darkMetal(), 0, 0.25, -L - 0.7); tip = -L - 1.5; }
      else if (mz === 'comp') { add(cyl(0.5, 0.5, 1.4, 10), darkMetal(), 0, 0.25, -L - 0.6); tip = -L - 1.3; }
      else if (mz === 'flashhider') { add(cyl(0.45, 0.4, 1.2, 6), darkMetal(), 0, 0.25, -L - 0.5); tip = -L - 1.1; }
      else if (!it.flame) add(cyl(br + 0.12, br + 0.12, 0.8, 10), darkMetal(), 0, 0.25, -L - 0.3);
      // underbarrel
      const ub = has('under'), ubU = (recvL + hgEnd) / 2;
      if (ub === 'vgrip') add(box(0.85, 2.6, 0.85), polymer(), 0, -2.0, P(ubU));
      if (ub === 'agrip') add(ext('agrip', [[ubU - 1.2, -0.8], [ubU + 1.2, -0.8], [ubU - 0.6, -2.2], [ubU - 1.4, -2.0]], 0.9), polymer(), 0, 0, 0);
      if (ub === 'bipod') { add(box(0.25, 0.25, 4), metal(), 0.5, -0.9, P(hgEnd - 2)); add(box(0.25, 0.25, 4), metal(), -0.5, -0.9, P(hgEnd - 2)); }
      if (has('mag') === 'shells') for (let k = 0; k < 4; k++) add(cyl(0.3, 0.3, 1.2, 8), mat('shell', () => new THREE.MeshLambertMaterial({ color: 0xb22222 })), 0.95, 0.2 + k * 0.0, P(recvL * 0.3 + k * 0.7)).rotation.set(Math.PI / 2, 0, 0);
      const lz = has('laser');
      if (lz) { add(box(0.7, 0.8, 1.6), polymer(), -1.15, 0.2, P(hgEnd - 1.6)); add(new THREE.SphereGeometry(0.18, 6, 4), emissive(lz === 'laser' ? 0xff2020 : 0x404040), -1.15, 0.2, P(hgEnd - 0.75)); }
    }
    // optics
    const op = has('optic'), oy = railTop + 0.85, oz = P(sightU);
    if (op === 'reddot') { add(cyl(0.62, 0.62, 2.0, 16), darkMetal(), 0, oy, oz); add(box(0.6, 0.6, 1.0), darkMetal(), 0, railTop + 0.25, oz); add(new THREE.CircleGeometry(0.5, 12), glass(0x88aaff), 0, oy, oz + 1.01); }
    if (op === 'holo') { add(box(1.5, 0.35, 2.2), darkMetal(), 0, railTop + 0.3, oz); add(box(0.2, 1.4, 0.3), darkMetal(), 0.7, oy + 0.1, oz - 0.95); add(box(0.2, 1.4, 0.3), darkMetal(), -0.7, oy + 0.1, oz - 0.95); add(box(1.6, 0.25, 0.3), darkMetal(), 0, oy + 0.8, oz - 0.95); add(box(1.2, 1.0, 0.05), glass(0xaaccff), 0, oy + 0.15, oz - 0.95); }
    if (op === 'acog' || op === 'thermscope' || op === 'pso') {
      const side = op === 'pso' ? -1.4 : 0;
      if (op === 'thermscope') { add(box(1.6, 1.8, 4.0), polymer(), side, oy + 0.3, oz); add(cyl(0.95, 0.95, 0.6, 16), glass(0x553377), side, oy + 0.3, oz - 2.2); }
      else { add(cyl(0.6, 0.75, 3.4, 14), darkMetal(), side, oy + 0.1, oz); add(cyl(0.82, 0.82, 0.8, 14), darkMetal(), side, oy + 0.1, oz - 1.8); add(box(0.6, 0.5, 1.2), darkMetal(), side, railTop + 0.25, oz); }
    }
    if (op === 'sniper8') { add(cyl(0.8, 0.8, 0.4 * L, 16), darkMetal(), 0, 2.4, P(0.28 * L)); add(cyl(1.15, 0.8, 1.6, 16), darkMetal(), 0, 2.4, P(0.48 * L)); add(cyl(1.05, 0.8, 1.2, 16), darkMetal(), 0, 2.4, P(0.08 * L)); add(cyl(0.35, 0.35, 1.0, 8), metal(), 0, 3.4, P(0.28 * L)); add(box(0.6, 0.9, 0.6), metal(), 0, 1.6, P(0.2 * L)); }
    g.userData.tip = new THREE.Vector3(0, pistolish ? 0.85 : 0.25, tip);
    g.userData.sightY = op ? oy : pistolish ? 1.6 : it.scope ? 2.2 : 1.6;
    return g;
  }
  // one mesh per material: far fewer draw calls for the guns carried by other soldiers
  function merge(src) {
    src.updateMatrixWorld(true);
    const byMat = new Map();
    src.traverse(o => { if (!o.isMesh) return; const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld); if (!byMat.has(o.material)) byMat.set(o.material, []); byMat.get(o.material).push(g); });
    const out = new THREE.Group();
    for (const [m, list] of byMat) {
      const cat = name => { let n = 0; list.forEach(g => n += g.attributes[name] ? g.attributes[name].array.length : 0); const a = new Float32Array(n); let off = 0; list.forEach(g => { if (g.attributes[name]) { a.set(g.attributes[name].array, off); off += g.attributes[name].array.length; } }); return a; };
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(cat('position'), 3)); geo.setAttribute('normal', new THREE.BufferAttribute(cat('normal'), 3));
      if (list.every(g => g.attributes.uv)) geo.setAttribute('uv', new THREE.BufferAttribute(cat('uv'), 2));
      out.add(new THREE.Mesh(geo, m));
    }
    out.userData = Object.assign({}, src.userData); delete out.userData.spin;
    return out;
  }
  // cached builds are cloned (geometry and materials are shared)
  const cache = {};
  function get(it, o) {
    const key = it.id + '|' + ((o && o.camoId) || '') + '|' + ((o && o.atts) || []).join(',') + (o && o.merged ? '|m' : '');
    if (o && o.merged) { if (!cache[key]) cache[key] = merge(build(it, o)); const c = cache[key].clone(); c.userData = Object.assign({}, cache[key].userData); return c; }
    if (!cache[key]) cache[key] = build(it, o);
    const c = cache[key].clone(); c.userData = Object.assign({}, cache[key].userData);
    if (cache[key].userData.spin) c.userData.spin = c.children[cache[key].children.indexOf(cache[key].userData.spin)];
    return c;
  }
  return { get };
})();
