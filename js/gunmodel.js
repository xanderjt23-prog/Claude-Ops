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


  // realistic guns (gunreal.js) with their attachments mounted flush on the gun's real surfaces: each attachment
  // measures the finished gun (rail top, handguard bottom, side of the handguard, receiver side) by ray casting
  // against it, so nothing floats above a rail, hangs below a handguard or sinks into the body, whatever the gun
  function buildReal(it, o, g, add, has) {
    const S = GunReal.S, op = !it.scope && has('optic');
    const r = GunReal.build(it, { magMul: has('mag') === 'extmag' ? 1.5 : 1, optic: op || false, drum: has('mag') === 'drum' }, o.camo || null), a = r.a;
    r.g.children.slice().forEach(c => g.add(c));
    g.updateMatrixWorld(true);
    const meshes = []; g.traverseVisible(m => { if (m.isMesh) meshes.push(m); });
    const rc = new THREE.Raycaster(), V = THREE.Vector3;
    const cast = (ox, oy, oz, dx, dy, dz) => { rc.set(new V(ox, oy, oz), new V(dx, dy, dz)); const h = rc.intersectObjects(meshes, false)[0]; return h ? h.point : null; };
    // highest surface over a stretch of the gun (rail slots are skipped by sampling a few points), lowest surface
    // under a point, the left-hand surface at a height
    const topAt = (z0, z1) => { let best = -Infinity; for (let i = 0; i <= 6; i++) for (const x of [-0.2, 0, 0.2]) { const p = cast(x, 60, z0 + (z1 - z0) * i / 6, 0, -1, 0); if (p) best = Math.max(best, p.y); } return best > -Infinity ? best : a.railV * S; };
    // (from below, every bottom face along the line is a hit: the handguard's is the highest one clear of the barrel,
    // so magazines, drums and boxes hanging lower down are skipped)
    const bottomAt = (z, fb) => { rc.set(new V(0, -80, z), new V(0, 1, 0)); let best = -Infinity; for (const h of rc.intersectObjects(meshes, false)) if (h.point.y < a.boreV * S - 0.55) best = Math.max(best, h.point.y); return best > -Infinity ? best : fb; };
    const leftAt = (z, y, fb) => { const p = cast(-60, y, z, 1, 0, 0); return p ? p.x : fb; };
    const bore = a.boreV * S, mzU = a.muzzleU * S, hand = !!a.scale;
    let tip = -mzU, sightY = a.sightV * S;
    // ---- muzzle devices screw on over the end of the barrel
    const mz = has('muzzle'), m0 = mzU - 0.35;
    if (mz === 'supp9' || mz === 'supp556' || mz === 'supp762') { const L = mz === 'supp9' ? 3.6 : 4.6, R = mz === 'supp762' ? 0.68 : 0.6; add(cyl(R, R, L, 18), darkMetal(), 0, bore, -(m0 + L / 2)); add(cyl(R + 0.04, R + 0.04, 0.25, 18), metal(), 0, bore, -(m0 + 0.12)); tip = -(m0 + L); }
    else if (mz === 'brake') { add(box(1.1, 0.75, 1.5), darkMetal(), 0, bore, -(m0 + 0.75)); add(box(1.12, 0.3, 0.32), mat('hole', () => new THREE.MeshBasicMaterial({ color: 0x08090a })), 0, bore, -(m0 + 0.55)); tip = -(m0 + 1.5); }
    else if (mz === 'comp') { add(cyl(0.45, 0.45, 1.3, 12), darkMetal(), 0, bore, -(m0 + 0.65)); add(box(0.3, 0.12, 0.7), mat('hole', () => new THREE.MeshBasicMaterial({ color: 0x08090a })), 0, bore + 0.42, -(m0 + 0.7)); tip = -(m0 + 1.3); }
    else if (mz === 'flashhider') { add(cyl(0.42, 0.38, 1.2, 8), darkMetal(), 0, bore, -(m0 + 0.6)); tip = -(m0 + 1.2); }
    // ---- underbarrel: grips and bipods clamp to the bottom of the handguard
    const ub = has('under'), fz = -a.foreU * S, hgBot = bottomAt(fz, bore - 0.9);
    if (ub === 'vgrip' && !a.foreVert) { add(cyl(0.4, 0.36, 2.5, 12).clone().rotateX(-Math.PI / 2), polymer(), 0, hgBot - 1.25, fz); add(box(0.9, 0.3, 1.3), polymer(), 0, hgBot - 0.15, fz); }
    if (ub === 'agrip' && !a.foreVert) { const ag = add(ext('agripR', [[-1.4, 0], [1.3, 0], [0.9, -1.0], [-0.9, -1.2]], 0.8), polymer(), 0, hgBot + 0.02, fz); ag.rotation.y = 0; }
    if (ub === 'bipod' && !a.hasBipod) { const bz = -(a.hgU1 * S - 1.0), by = bottomAt(bz, hgBot); add(box(1.0, 0.4, 0.8), darkMetal(), 0, by - 0.2, bz); for (const x of [0.38, -0.38]) { add(box(0.22, 0.22, 4.2), metal(), x, by - 0.45, bz - 2.0); add(box(0.3, 0.3, 0.4), polymer(), x, by - 0.45, bz - 4.2); } } // Harris bipod, legs folded forward
    // ---- side-saddle shells along the left of the receiver (shotguns), standing up
    if (has('mag') === 'shells') { const r0 = a.recv0 * S, r1 = a.recv1 * S, n = 6, ys = bore * 0.55; const lx = leftAt(-(r0 + r1) / 2, ys, -0.9); add(box(0.12, 1.3, (r1 - r0) * 0.7), polymer(), lx - 0.06, ys, -(r0 + r1) / 2); for (let i = 0; i < n; i++) { const z = -(r0 + (r1 - r0) * (0.2 + 0.6 * i / (n - 1))); add(cyl(0.3, 0.3, 1.35, 10).clone().rotateX(Math.PI / 2), mat('shell', () => new THREE.MeshLambertMaterial({ color: 0xa81e1e })), lx - 0.42, ys, z); add(cyl(0.31, 0.31, 0.3, 10).clone().rotateX(Math.PI / 2), mat('brassL', () => new THREE.MeshPhongMaterial({ color: 0xb08a3a, shininess: 60 })), lx - 0.42, ys - 0.75, z); } }
    // ---- lasers: on the left side of the handguard's front; on handguns, under the frame's dust cover
    const lz = has('laser');
    if (lz) {
      const em = emissive(lz === 'laser' ? 0xff2020 : 0x404040);
      if (hand) { const z = -((a.hgU0 + a.hgU1) / 2) * S, y = bottomAt(z, -0.4); add(box(0.75, 0.55, 1.5), polymer(), 0, y - 0.28, z); add(new THREE.SphereGeometry(0.12, 6, 4), em, 0, y - 0.28, z - 0.76); }
      else { const z = -(a.hgU1 * S - 1.3), x = leftAt(z, bore, -1.0); add(box(0.6, 0.75, 1.6), polymer(), x - 0.3, bore, z); add(new THREE.SphereGeometry(0.16, 6, 4), em, x - 0.3, bore, z - 0.81); }
    }
    // ---- optics sit on the rail (or slide / mount) top
    if (op && !a.opticBuilt) {
      const sU = a.opticU * S, ob = op === 'sniper8' ? { g: GunReal.riflescope(330), axis: 30 } : GunReal.optic(op);
      if (op === 'sniper8') ob.g.children.forEach(c => { c.position.z += 165 * S; c.position.y += 30 * S; });
      if (ob) {
        const k = hand ? 1.8 : 1.75, half = (op === 'sniper8' ? 165 : op === 'thermscope' ? 84 : op === 'rmr' ? 22 : 50) * S * k;
        const base = topAt(-sU + half * 0.6, -sU - half * 0.6);
        ob.g.scale.set(hand ? 1.8 : 1.9, k, k); ob.g.position.set(0, base, -sU); g.add(ob.g);
        if (a.opticOnCover) { const cv = g.getObjectByName('cover'); if (cv) { g.updateMatrixWorld(true); cv.attach(ob.g); } } // mounted on the feed cover: it lifts with it
        sightY = base + ob.axis * S * k;
      }
    }
    g.userData.tip = new THREE.Vector3(0, bore, tip);
    g.userData.sightY = sightY;
    g.userData.foreDist = a.foreU * S;
    // the support hand: on the vertical grip (built in, or fitted), else under the handguard
    g.userData.foreY = a.foreVert && a.foreV !== undefined ? a.foreV * S : ub === 'vgrip' ? hgBot - 0.6 : hgBot + 0.2;
    g.userData.stockLen = -a.rear * S;
    // how this gun is reloaded, and where rounds go in when it isn't a magazine swap
    const ax = a.magAxis ? new THREE.Vector3(0, a.magAxis[1], -a.magAxis[0]).normalize() : null;
    // where spent cases come out: the ejection port, found on the gun's real surface (so a case never starts inside
    // the receiver), and which way they go. Revolvers, launchers and flamethrowers throw nothing out
    let eject = null, ejDir = 'right';
    if (a.load !== 'cylinder' && a.load !== 'gate') {
      const belt = !!g.getObjectByName('box'), ez0 = a.ejU !== undefined ? -a.ejU * S : hand ? -(a.rear + a.len * 0.57) * S : -(a.magU * S - 1.6), ez = Math.min(ez0, 0.3); // (bullpups eject beside your cheek, out of view: show them from just ahead of the grip)
      const ey = a.ejV !== undefined ? a.ejV * S : hand ? (a.boreV + a.railV) / 2 * S : bore + 0.15;
      if (a.topMag || a.ejBottom || a.ejDown) { ejDir = 'down'; const z = a.topMag ? 1.2 : a.ejDown ? ez0 : ez; rc.set(new V(0, -80, z), new V(0, 1, 0)); const h = rc.intersectObjects(meshes, false)[0]; eject = new V(0, (h ? h.point.y : -1.5) - 0.2, z); }
      else if (a.beltSide === -1) { ejDir = 'left'; eject = new V(leftAt(ez, ey, -1) - 0.2, ey, ez); }
      else { ejDir = belt ? 'rightdown' : 'right'; const p = cast(60, ey, ez, -1, 0, 0); eject = new V((p ? p.x : 0.8) + 0.2, ey, ez); }
    }
    const cal = it.cal || '', caseL = it.type === 'Shotgun' ? 2.3 : cal === '50bmg' ? 3.4 : /54|3006|792x57|338|303|762x51/.test(cal) ? 2.0 : it.type === 'Pistol' || it.type === 'Submachine Gun' ? (cal === '57x28' ? 1.0 : 0.75) : 1.6;
    g.userData.reload = {
      load: a.load, port: new THREE.Vector3((a.loadX || 0) * S, (a.loadV || 0) * S, -(a.loadU || 0) * S),
      eject, ejDir, caseL, caseR: it.type === 'Shotgun' ? 0.38 : cal === '50bmg' ? 0.34 : caseL < 1 ? 0.16 : 0.19, hull: it.type === 'Shotgun', ejBottom: !!a.ejBottom, wellView: !!a.wellView,
      topMag: !!a.topMag, sideMag: !!a.sideMag, rockIn: !!a.rockIn, magAxis: ax, manual: a.manual, boltLift: a.boltLift || 0,
      boltTravel: (a.boltTravel || 0) * S, pumpTravel: (a.pumpTravel || 0) * S, chargeTravel: (a.chargeTravel || 0) * S, chargeSide: a.chargeSide || 0, hkSlap: !!a.hkSlap,
      slideTravel: (a.slideTravel || 0) * S,
    };
    return g;
  }

  function build(it, o) {
    o = o || {};
    const g = new THREE.Group(), L = Math.max(10, Art.weaponLen(it)) * 0.525, t = it.type, atts = o.atts || [], has = s => atts.find(a => ITEMS[a] && ITEMS[a].slot === s);
    const skin = o.camo || polymer(), stockMat = WOOD.has(it.id) ? wood() : skin, furn = WOOD.has(it.id) ? wood() : polymer();
    const add = (geo, m, x, y, z, rx, ry, rz) => { const me = new THREE.Mesh(geo, m); me.position.set(x || 0, y || 0, z || 0); if (rx || ry || rz) me.rotation.set(rx || 0, ry || 0, rz || 0); g.add(me); return me; };
    const seat = (parent, glassMesh) => { g.updateMatrixWorld(true); parent.attach(glassMesh); glassMesh.position.x = 0; return glassMesh; }; // glass lives inside its housing
    // a part that moves on its own when reloading: what fn adds goes into a group named after it, pivoting at (x, y, z)
    const part = (name, fn, x, y, z) => { const n0 = g.children.length; fn(); const grp = new THREE.Group(); grp.name = name; grp.position.set(x || 0, y || 0, z || 0); g.children.slice(n0).forEach(m => { m.position.sub(grp.position); grp.add(m); }); g.add(grp); return grp; };
    const brass = () => mat('brassR', () => new THREE.MeshPhongMaterial({ color: 0xb08a3a, shininess: 90, specular: 0xffe0a0 }));
    // u (forward) -> -z
    const P = (u) => -u;
    let tip = -L, railTop = 1.2, sightU = 0.25 * L, realA = null;
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
      part('rocket', () => {
        const war = new THREE.Mesh(new THREE.ConeGeometry(2.2, 6, 12).rotateX(-Math.PI / 2), metal()); war.position.set(0, 0.8, -L * 1.0 - 3.6); g.add(war);
        add(cyl(1.6, 1.6, 2, 12), mat('rpgw', () => new THREE.MeshLambertMaterial({ color: 0x4b5320 })), 0, 0.8, -L * 0.98);
        add(cyl(0.9, 0.9, L * 0.4, 10), mat('rpgm', () => new THREE.MeshLambertMaterial({ color: 0x5b6230 })), 0, 0.8, -L * 0.98 + L * 0.2 + 1); // motor (inside the tube)
      }, 0, 0.8, -L * 0.98);
      add(ext('rpggrip', [[0, -0.2], [0.8, -0.2], [0.6, -3.2], [-0.2, -3.0]], 1.1), furn, 0, 0, 0);
      add(ext('rpggrip2', [[0, -0.2], [0.8, -0.2], [0.6, -3.0], [-0.2, -2.8]], 1.1), furn, 0, 0, P(L * 0.32));
      add(box(0.5, 1.4, 0.5), metal(), -1.0, 2.3, P(L * 0.2));
      g.userData.tip = new THREE.Vector3(0, 0.8, -L); g.userData.reload = { load: 'rocket' };
      return g;
    }
    if (t === 'Flamethrower') {
      add(ext('flbody', [[0, -0.8], [L * 0.7, -0.6], [L * 0.7, 0.8], [0, 1.0]], 1.6), skin, 0, 0, 0);
      add(cyl(0.55, 0.7, L * 0.45, 10), metal(), 0, 0.4, P(L * 0.9));
      add(ext('flgrip', [[0.05 * L, -0.6], [0.18 * L, -0.6], [0.15 * L, -3.4], [0.02 * L, -3.2]], 1.1), polymer(), 0, 0, 0);
      add(ext('flgrip2', [[0.5 * L, -0.6], [0.6 * L, -0.6], [0.58 * L, -3.0], [0.48 * L, -2.8]], 1.1), polymer(), 0, 0, 0);
      add(cyl(0.3, 0.3, 1.2, 8), emissive(0xff7a20), 0, -0.4, P(L * 1.1));
      part('igniter', () => { for (const [x, y] of it.id === 'lpo50' ? [[0.85, 0.4], [-0.85, 0.4], [0, -0.45]] : [[0, -0.5]]) add(cyl(it.id === 'lpo50' ? 0.24 : 0.42, it.id === 'lpo50' ? 0.24 : 0.42, it.id === 'lpo50' ? 0.9 : 1.2, 10), brass(), x, y, P(L * 0.98)); }, 0, 0, P(L * 0.98));
      g.userData.tip = new THREE.Vector3(0, 0.4, -L * 1.12); g.userData.reload = { load: 'igniter' }; return g;
    }
    if (t === 'Grenade Launcher') {
      const cy = -1.35, hx = -2.2, hy = -3.7;
      add(ext('glrear', [[-0.32 * L, 0.8], [0.04 * L, 0.8], [0.04 * L, 1.5], [-0.32 * L, 1.4]], 1.4), metal(), 0, 0, 0); // the rear frame's top (with the stock)
      add(box(1.4, 5.6, 0.5), metal(), 0, -1.3, P(0.015 * L)); // rear plate (with the grip and stock)
      add(cyl(0.55, 0.55, 0.08 * L, 10), metal(), hx, hy, P(0.06 * L)); add(box(1.0, 1.2, 0.08 * L), metal(), hx + 0.3, hy + 0.5, P(0.06 * L)); // the rear hinge knuckle
      part('cyl', () => {
        part('drum', () => { // the cylinder and the rounds in it turn together (the spring is wound by turning it)
          add(cyl(2.6, 2.6, 0.32 * L, 6), darkMetal(), 0, cy, P(0.2 * L));
          for (let i = 0; i < 6; i++) { const a = Math.PI / 2 + i / 6 * Math.PI * 2; add(cyl(0.62, 0.62, 0.12, 12), brass(), Math.cos(a) * 1.55, cy + Math.sin(a) * 1.55, P(0.04 * L) + 0.04).name = 'rnd'; }
        }, 0, cy, P(0.2 * L));
        add(box(4.6, 5.2, 0.5), metal(), -1.0, -1.6, P(0.38 * L)); // front plate, from the hinge up to the barrel
        add(ext('glframe', [[0.04 * L, 0.8], [0.6 * L, 0.8], [0.6 * L, 1.6], [0.04 * L, 1.5]], 1.4), metal(), 0, 0, 0); // top strap over the cylinder
        add(cyl(0.5, 0.5, 0.3 * L, 10), metal(), hx, hy, P(0.24 * L)); add(box(1.0, 0.6, 0.3 * L), metal(), hx + 0.5, hy - 0.35, P(0.24 * L)); // the hinge tube and bottom strap
        add(cyl(1.15, 1.15, 0.5 * L, 14), metal(), 0, 0.2, P(0.58 * L)); // barrel
      }, hx, hy, P(0.2 * L));
      add(ext('glstock', [[0, 0.9], [-0.42 * L, 0.6], [-0.44 * L, -1.8], [-0.36 * L, -1.8], [0, -0.3]], 1.2), polymer(), 0, 0, 0);
      add(ext('glgrip', [[0.0, -0.6], [0.1 * L, -0.6], [0.08 * L, -3.6], [-0.03 * L, -3.4]], 1.1), polymer(), 0, 0, 0);
      tip = -0.85 * L; g.userData.tip = new THREE.Vector3(0, 0.2, tip); g.userData.reload = { load: 'gl', port: new THREE.Vector3(0, -1.35, P(0.04 * L)) }; return g;
    }
    if (t === 'Heavy Machine Gun') {
      add(box(3.2, 3.0, 0.42 * L), darkMetal(), 0, 0.4, P(0.18 * L));
      if (it.spinup) { // rotary barrels
        const spin = new THREE.Group(); spin.position.set(0, 0.4, 0); g.add(spin);
        // six barrels about 1.4x the length of the housing (the M134's), held by a clamp at the front and one midway
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, b = new THREE.Mesh(cyl(0.3, 0.3, 0.98 * L, 8), metal()); b.position.set(Math.cos(a) * 0.9, Math.sin(a) * 0.9, P(0.88 * L)); spin.add(b); }
        for (const [z, r] of [[0.48, 1.35], [0.95, 1.25], [1.33, 1.25]]) { const ring = new THREE.Mesh(cyl(r, r, 0.6, 12), darkMetal()); ring.position.set(0, 0, P(z * L)); spin.add(ring); }
        g.userData.spin = spin;
      } else {
        add(cyl(1.0, 1.0, 0.35 * L, 14), darkMetal(), 0, 0.4, P(0.55 * L)); // perforated jacket
        for (let k = 0; k < 5; k++) add(box(2.1, 0.4, 0.9), metal(), 0, 0.4, P(0.42 * L + k * 0.06 * L));
        add(cyl(0.42, 0.42, 0.35 * L, 10), metal(), 0, 0.4, P(0.85 * L));
      }
      add(box(0.5, 2.6, 0.5), metal(), 1.2, -1.0, 1.2); add(box(0.5, 2.6, 0.5), metal(), -1.2, -1.0, 1.2); // spade grips
      if (!it.spinup) part('cover', () => add(box(3.0, 0.3, 0.3 * L), darkMetal(), 0, 2.05, P(0.2 * L)), 0, 2.05, P(0.35 * L)); // top cover, hinged at its front
      // ammo can, and the belt running from its mouth in a curve up into the feed on the left of the receiver (the rounds
      // lie along the bore, held by their links; feed order: from the can to the gun)
      part('box', () => {
        add(box(3.8, 0.8, 1.6), darkMetal(), 0, -1.6, 0.6);
        const p0 = new THREE.Vector3(-1.3, -1.12, 0.35), p2 = new THREE.Vector3(-1.62, 0.5, P(0.06 * L)), p1 = new THREE.Vector3(-2.9, -0.5, (p0.z + p2.z) / 2), n = 16;
        for (let i = 0; i < n; i++) { const t = i / (n - 1), a = 1 - t, q = p0.clone().multiplyScalar(a * a).addScaledVector(p1, 2 * a * t).addScaledVector(p2, t * t);
          add(cyl(0.17, 0.17, 1.3, 8), brass(), q.x, q.y, q.z).name = 'rnd'; add(box(0.42, 0.14, 0.5), darkMetal(), q.x, q.y, q.z + 0.2).name = 'lnk'; }
      }, 0, -1.2, 0.6);
      if (it.spinup) add(box(0.5, 1.2, 0.9), darkMetal(), -1.75, 0.5, P(0.06 * L)); // the feeder on the side the belt runs into
      tip = it.spinup ? -1.37 * L : -L; g.userData.tip = new THREE.Vector3(0, 0.4, tip); g.userData.reload = { load: 'belt', eject: new THREE.Vector3(0, -1.0, P(0.3 * L)), ejDir: 'down', caseL: it.cal === '50bmg' ? 3.4 : 2.0, caseR: it.cal === '50bmg' ? 0.34 : 0.19 }; return g;
    }
    const pistolish = t === 'Pistol' || t === 'Revolver';
    if (pistolish && !GunReal.has(it.id)) {
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
      if (has('optic')) seat(add(box(0.7, 0.6, 0.9), darkMetal(), 0, railTop + 0.35, P(sightU)), add(box(0.6, 0.5, 0.05), glass(0x88ccff), 0, railTop + 0.55, P(sightU) + 0.45));
    } else if (GunReal.has(it.id)) {
      return buildReal(it, o, g, add, has);
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
    if (op === 'reddot') { const rd = add(cyl(0.62, 0.62, 2.0, 16), darkMetal(), 0, oy, oz); add(box(0.6, 0.6, 1.0), darkMetal(), 0, railTop + 0.25, oz); seat(rd, add(new THREE.CircleGeometry(0.5, 12), glass(0x88aaff), 0, oy, oz + 1.01)); }
    if (op === 'holo') { add(box(1.5, 0.35, 2.2), darkMetal(), 0, railTop + 0.3, oz); add(box(0.2, 1.4, 0.3), darkMetal(), 0.7, oy + 0.1, oz - 0.95); add(box(0.2, 1.4, 0.3), darkMetal(), -0.7, oy + 0.1, oz - 0.95); const hh = add(box(1.6, 0.25, 0.3), darkMetal(), 0, oy + 0.8, oz - 0.95); seat(hh, add(box(1.2, 1.0, 0.05), glass(0xaaccff), 0, oy + 0.15, oz - 0.95)); }
    if (op === 'acog' || op === 'thermscope' || op === 'pso') {
      const side = op === 'pso' ? -1.4 : 0;
      if (op === 'thermscope') { const th = add(box(1.6, 1.8, 4.0), polymer(), side, oy + 0.3, oz); seat(th, add(cyl(0.95, 0.95, 0.6, 16), glass(0x553377), side, oy + 0.3, oz - 2.2)); }
      else { add(cyl(0.6, 0.75, 3.4, 14), darkMetal(), side, oy + 0.1, oz); add(cyl(0.82, 0.82, 0.8, 14), darkMetal(), side, oy + 0.1, oz - 1.8); add(box(0.6, 0.5, 1.2), darkMetal(), side, railTop + 0.25, oz); }
    }
    let scopeY = 0;
    if (op === 'sniper8' && realA && !realA.scopeBuiltIn) {
      // a real riflescope (bells, turrets, rings) clamped on the rail
      const sc = GunReal.riflescope(330), k = 1.75; sc.scale.set(2.0, k, k); sc.position.set(0, railTop + 30 * GunReal.S * k, -sightU + 165 * GunReal.S * k); g.add(sc); scopeY = railTop + 30 * GunReal.S * k;
    } else if (op === 'sniper8' && !(realA && realA.scopeBuiltIn)) { add(cyl(0.8, 0.8, 0.4 * L, 16), darkMetal(), 0, 2.4, P(0.28 * L)); add(cyl(1.15, 0.8, 1.6, 16), darkMetal(), 0, 2.4, P(0.48 * L)); add(cyl(1.05, 0.8, 1.2, 16), darkMetal(), 0, 2.4, P(0.08 * L)); add(cyl(0.35, 0.35, 1.0, 8), metal(), 0, 3.4, P(0.28 * L)); add(box(0.6, 0.9, 0.6), metal(), 0, 1.6, P(0.2 * L)); }
    g.userData.tip = new THREE.Vector3(0, realA ? realA.boreV * GunReal.S : pistolish ? 0.85 : 0.25, tip);
    g.userData.sightY = scopeY || (op && !(realA && realA.scopeBuiltIn && op === 'sniper8') ? oy : 0) || (realA ? realA.sightV * GunReal.S : pistolish ? 1.6 : it.scope ? 2.2 : 1.6);
    // where the support hand goes (distance forward of the grip, model units)
    g.userData.foreDist = realA ? realA.foreU * GunReal.S : pistolish ? 0.2 * L : 0.6 * L;
    // and how high (model units): under the handguard, or on the vertical grip
    g.userData.foreY = realA ? (realA.foreVert && realA.foreV !== undefined ? realA.foreV * GunReal.S : has('under') === 'vgrip' ? (realA.boreV - 26) * GunReal.S - 1.9 : realA.boreV * GunReal.S - 0.7) : -0.4;
    g.userData.stockLen = realA ? -realA.rear * GunReal.S : 0; // how far the stock reaches back behind the grip
    return g;
  }
  // one mesh per material: far fewer draw calls for the guns carried by other soldiers
  function merge(src) {
    src.updateMatrixWorld(true);
    const byMat = new Map();
    src.traverseVisible(o => { if (!o.isMesh) return; const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld); if (!byMat.has(o.material)) byMat.set(o.material, []); byMat.get(o.material).push(g); });
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
