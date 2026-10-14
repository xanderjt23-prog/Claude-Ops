// ============================================================================
// Realistic gun models. Every gun is built from its real dimensions (millimetres;
// u = forward from the trigger, v = up, x = to the gun's right) and the features
// that identify it in real life: receivers, rails, handguards, sights, muzzle
// devices, magazines and stocks, placed where they are on the real gun. Family
// builders share parts (AR-15, AK, bolt-action, shotguns...), options give each
// model its own look. Builders return anchors (mm) used to mount attachments,
// place the hands and find the muzzle and the sight line.
//
// Iron sights that come off when an optic goes on (flip-up BUIS, peep sights) are
// only built when no optic is fitted (s.optic); fixed sights (front sight blocks,
// AK leaf sights, carry handles) are always there, as on the real guns.
// ============================================================================
const GunReal = (() => {
  const S = 0.02; // model units per mm
  const cache = {}, mats = {};
  const M = (k, f) => mats[k] || (mats[k] = f());
  const C = {
    black: () => M('black', () => new THREE.MeshPhongMaterial({ color: 0x1e2023, shininess: 14, specular: 0x262626 })),
    steel: () => M('steel', () => new THREE.MeshPhongMaterial({ color: 0x2b2d31, shininess: 34, specular: 0x444444 })),
    blued: () => M('blued', () => new THREE.MeshPhongMaterial({ color: 0x1a1d24, shininess: 40, specular: 0x3c4250 })),
    bright: () => M('bright', () => new THREE.MeshPhongMaterial({ color: 0x8a8d92, shininess: 60, specular: 0x888888 })),
    park: () => M('park', () => new THREE.MeshLambertMaterial({ color: 0x3a3b38 })),
    poly: () => M('poly', () => new THREE.MeshLambertMaterial({ color: 0x1b1c1d })),
    grey: () => M('grey', () => new THREE.MeshLambertMaterial({ color: 0x34373a })),
    tan: () => M('tan', () => new THREE.MeshLambertMaterial({ color: 0x9b8a64 })),
    tanDark: () => M('tanD', () => new THREE.MeshLambertMaterial({ color: 0x7d6e4f })),
    olive: () => M('olive', () => new THREE.MeshLambertMaterial({ color: 0x4f5636 })),
    green: () => M('green', () => new THREE.MeshLambertMaterial({ color: 0x55603f })),
    odgreen: () => M('odg', () => new THREE.MeshLambertMaterial({ color: 0x3f4a35 })),
    plum: () => M('plum', () => new THREE.MeshLambertMaterial({ color: 0x5a2f2b })),
    hole: () => M('hole', () => new THREE.MeshBasicMaterial({ color: 0x08090a })),
    smoke: () => M('smoke', () => new THREE.MeshLambertMaterial({ color: 0x77766a })), // the 'smoke' polymer of G36/AUG magazines, drawn solid
    brass: () => M('brass', () => new THREE.MeshPhongMaterial({ color: 0xb08a3a, shininess: 90, specular: 0xffe0a0 })),
    glass: () => M('glass', () => new THREE.MeshPhongMaterial({ color: 0x23394d, shininess: 140, specular: 0xffffff, transparent: true, opacity: 0.9 })),
    wood: () => M('wood', () => woodMat('#6b4424', 0)),
    woodLight: () => M('woodL', () => woodMat('#8a5a2c', 3)),
    woodDark: () => M('woodD', () => woodMat('#4a2c18', 7)),
    woodRed: () => M('woodR', () => woodMat('#7a3a20', 11)),
  };
  function woodMat(base, seed) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 32; const g = c.getContext('2d'), r = mulberry32(17 + seed);
    g.fillStyle = base; g.fillRect(0, 0, 128, 32);
    for (let i = 0; i < 26; i++) { g.strokeStyle = `rgba(${i % 2 ? '35,18,5' : '170,115,65'},${0.18 + r() * 0.2})`; g.lineWidth = 0.6 + r(); g.beginPath(); const y = r() * 32; g.moveTo(0, y); g.bezierCurveTo(40, y + (r() - 0.5) * 10, 88, y + (r() - 0.5) * 10, 128, y + (r() - 0.5) * 6); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return new THREE.MeshPhongMaterial({ map: t, shininess: 25, specular: 0x2a2a2a });
  }
  // ---- primitives (all in mm)
  function prof(key, pts, width, bevel) {
    const k = 'p' + key + ':' + width + ':' + pts.length; if (cache[k]) return cache[k];
    const sh = new THREE.Shape(); pts.forEach(([u, v], i) => i ? sh.lineTo(u * S, v * S) : sh.moveTo(u * S, v * S)); sh.closePath();
    const w = width * S, b = Math.min(bevel === undefined ? 1.6 * S : bevel * S, w * 0.3);
    const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.01, w - 2 * b), bevelEnabled: b > 0, bevelSize: b, bevelThickness: b, bevelSegments: 1, curveSegments: 6 });
    g.translate(0, 0, -(w - 2 * b) / 2); g.rotateY(Math.PI / 2); return (cache[k] = g);
  }
  const boxG = (l, h, w) => { const k = `b${l},${h},${w}`; return cache[k] || (cache[k] = new THREE.BoxGeometry(w * S, h * S, l * S)); };
  const cylG = (r0, r1, l, seg) => { const k = `c${r0},${r1},${l},${seg}`; if (!cache[k]) { const g = new THREE.CylinderGeometry(r1 * S, r0 * S, l * S, seg || 12); g.rotateX(Math.PI / 2); cache[k] = g; } return cache[k]; };
  // a turned (lathe) part along the bore: profile [[du, r], ...] from its back end forward
  // closed at both ends (the profile starts and ends on the axis), so optic tubes are solid with flat end faces the
  // lenses sit on, instead of open shells you can see into and through from an angle
  const latheG = (key, pts, seg) => { const k = 'l' + key; if (!cache[k]) { const prof = [[pts[0][0], 0], ...pts, [pts[pts.length - 1][0], 0]]; const g = new THREE.LatheGeometry(prof.map(([u, r]) => new THREE.Vector2(Math.max(0.001, r * S), u * S)), seg || 20); g.rotateX(-Math.PI / 2); cache[k] = g; } return cache[k]; };

  function build(it, o, camo) {
    const g = new THREE.Group();
    const add = (geo, m, u, v, x) => { const me = new THREE.Mesh(geo, m); me.position.set((x || 0) * S, (v || 0) * S, -(u || 0) * S); g.add(me); return me; };
    const P = (key, pts, w, m, x, bev) => { const me = add(prof(it.id + key, pts, w, bev), m, 0, 0, x); me.name = key; return me; };
    const Bx = (u0, u1, v0, v1, w, m, x) => add(boxG(u1 - u0, v1 - v0, w), m, (u0 + u1) / 2, (v0 + v1) / 2, x);
    const Tb = (u0, u1, v, r, m, seg, r1) => add(cylG(r, r1 === undefined ? r : r1, u1 - u0, seg), m, (u0 + u1) / 2, v);
    const Ring = (u, v, r, len, m) => Tb(u - len / 2, u + len / 2, v, r, m, 16);
    const Lt = (key, u0, pts, v, m, x, seg) => add(latheG(key, pts, seg), m, u0, v, x);
    // picatinny rail: base plus cross slots; returns the height of its top
    const rail = (u0, u1, v, w, m) => { Bx(u0, u1, v, v + 5, w, m || C.black()); for (let u = u0 + 3; u < u1 - 3; u += 10) Bx(u, u + 5, v + 5, v + 9, w + 3, m || C.black()); return v + 9; };
    const sideRail = (u0, u1, v, x) => { const sx = Math.sign(x); Bx(u0, u1, v - 8, v + 8, 4, C.black(), x); for (let u = u0 + 3; u < u1 - 3; u += 10) Bx(u, u + 5, v - 9, v + 9, 3, C.black(), x + sx * 3); };
    // dark recesses (ports, vents, slots) shown on both sides of a part of half-width hw
    const holes = (u0, u1, v0, v1, hw, both) => { Bx(u0, u1, v0, v1, 1, C.hole(), hw + 0.6); if (both !== false) Bx(u0, u1, v0, v1, 1, C.hole(), -hw - 0.6); };
    // glass is always a child of the housing it sits in, so it inherits every transform of that housing
    const seat = (parent, glassMesh) => { g.updateMatrixWorld(true); parent.attach(glassMesh); glassMesh.position.x = 0; return glassMesh; };
    const lens = (u, v, r, x, back, parent) => { const me = add(new THREE.CircleGeometry(r * S, 20), C.glass(), u + (back ? -0.4 : 0.4), v, x); me.rotation.y = back ? 0 : Math.PI; return parent ? seat(parent, me) : me; };
    const body = m => camo || m;
    // a part that moves on its own when reloading (magazine, cylinder, feed cover, bolt...): everything fn adds goes
    // into one group named after it, whose origin is the pivot (u, v, x in mm) the part turns about
    const part = (name, fn, pu, pv, px) => {
      const n0 = g.children.length; fn(); const grp = new THREE.Group(); grp.name = name;
      grp.position.set((px || 0) * S, (pv || 0) * S, -(pu || 0) * S);
      g.children.slice(n0).forEach(m => { m.position.sub(grp.position); grp.add(m); }); g.add(grp); return grp;
    };
    // cartridges seated in a part (revolver chambers, a belt): brass, axis along the bore
    const round = (u0, u1, v, x, r) => { const m = add(cylG(r, r, u1 - u0, 10), C.brass(), (u0 + u1) / 2, v, x); m.name = 'rnd'; return m; };
    const s = Object.assign({}, SPEC[it.id] || {}, o || {});
    const k = { add, P, Bx, Tb, Ring, Lt, rail, sideRail, holes, lens, seat, C, body, g, part, round, irons: !s.optic, drum: !!s.drum };
    const B = BUILDERS[SPEC[it.id] ? SPEC[it.id].f : null] || BUILDERS.generic;
    const a = B(it, s, k);
    a.len = a.len || 800; if (k.bip || SPEC[it.id] && SPEC[it.id].f === 'm82') a.hasBipod = true; // guns with their own bipod
    // game proportions: guns are drawn larger and chunkier than life (like the classic models) so they read well in
    // the hand and on soldiers. Length: the grip-to-muzzle distance of the classic model for this weapon class, nudged
    // by the gun's real length so long guns (Barrett, MG 42, Mosin) still come out longer than compact ones. Width:
    // every gun's body is drawn about the same thickness, so wide guns (AA-12, shotguns) aren't bloated.
    const classic = Math.max(10, Art.weaponLen(it)) * 0.525 / S, real = Math.max(1, a.muzzleU);
    const hand = !!a.scale, sl = hand ? 1.75 : Math.max(1.15, Math.min(2.4, classic / real * Math.pow(real / (classic * 0.62), 0.35)));
    const sv = hand ? 1.8 : 1.75 * (a.vmul || 1), sw = hand ? 2.0 : Math.min(2.5, 1.3 / ((a.bodyW || 26) * S));
    const inner = new THREE.Group(); g.children.slice().forEach(c => inner.add(c)); inner.scale.set(sw, sv, sl); g.add(inner);
    if (a.recv0 === undefined) { a.recv0 = -60; a.recv1 = 110; } // receiver span (side-saddle shells and the like)
    for (const key of ['opticU', 'muzzleU', 'foreU', 'hgU0', 'hgU1', 'magU', 'rear', 'len', 'recv0', 'recv1', 'loadU', 'ejU', 'ejU2', 'boltTravel', 'pumpTravel', 'chargeTravel', 'slideTravel']) if (typeof a[key] === 'number') a[key] *= sl;
    for (const key of ['sightV', 'railV', 'boreV', 'magTop', 'foreV', 'loadV', 'ejV']) if (typeof a[key] === 'number') a[key] *= sv;
    if (typeof a.loadX === 'number') a.loadX *= sw; if (typeof a.ejX === 'number') a.ejX *= sw;
    a.magAxis = a.magDir ? [a.magDir[0] * sl, a.magDir[1] * sv] : null; // the magazine's insertion axis (u, v), as scaled
    a.load = a.load || s.load; // how the gun is loaded when it isn't a magazine swap (shells, clips, single rounds)
    // manual actions: 'bolt' (turn-bolt rifles) or 'pump'; how far the bolt / pump / charging handle travels (mm) and how
    // far a bolt handle lifts (radians) before it can come back
    a.manual = s.manual; a.boltLift = s.boltLift || 0; if (s.boltTravel) a.boltTravel = s.boltTravel; if (s.pumpTravel) a.pumpTravel = s.pumpTravel;
    return { g, a };
  }

  // ---- shared parts --------------------------------------------------------------------------------------------
  // magazine along a curve: depth front-to-back, length down the curve, total bend (radians, forward), width
  function magPts(u, top, depth, len, bend) {
    const n = 8, front = [], back = []; let cu = u, cv = top;
    for (let i = 0; i <= n; i++) {
      const th = -Math.PI / 2 + bend * (i / n), px = -Math.sin(th), py = Math.cos(th);
      front.push([cu + px * depth / 2, cv + py * depth / 2]); back.push([cu - px * depth / 2, cv - py * depth / 2]);
      cu += Math.cos(th) * len / n; cv += Math.sin(th) * len / n;
    }
    front[0][1] = top; back[0][1] = top;
    return [...back, ...front.reverse()];
  }
  // a fitted drum magazine takes the place of the gun's own magazine: a short neck into the magwell, then the drum
  // (flat faces to the sides, as AK/AR/MP5 drums sit)
  const drum = (k, u, top) => k.part('mag', () => { k.Bx(u - 22, u + 22, top - 40, top + 2, 26, k.C.black()); const d = k.add(cylG(56, 56, 62, 28), k.C.black(), u + 6, top - 92); d.rotation.y = Math.PI / 2; const h = k.add(cylG(16, 16, 66, 16), k.C.steel(), u + 6, top - 92); h.rotation.y = Math.PI / 2; }, u, top);
  const curvedMag = (k, key, u, top, depth, len, bend, w, m) => k.drum ? drum(k, u, top) : k.part('mag', () => k.P(key + depth + len + bend, magPts(u, top, depth, len, bend), w, m), u, top);
  // a belt of linked rounds from the mouth of the ammo box (top v at x0) bowing out and up the side of the receiver
  // (side: +1 right, -1 left) to the feed tray at v = feedV, then across the tray under the cover
  const belt = (k, u, top, x0, side, feedV) => {
    const pts = [], n = 8;
    for (let i = 0; i < n; i++) { const t = i / (n - 1); pts.push([x0 + side * 16 * Math.sin(t * Math.PI), top + 6 + t * (feedV + 22 - top - 6)]); }
    for (let i = 1; i <= 3; i++) pts.push([x0 - side * i * 11, feedV + 22]); // lying in the tray
    pts.forEach(([x, v]) => { k.round(u - 26, u + 26, v, x, 5); k.Bx(u - 8, u + 8, v - 2, v + 2, 11, k.C.steel(), x).name = 'lnk'; });
  };
  // pistol grip: top front u, top v; rake = backward slope; length down the grip; optional finger nub (A2 style)
  const pistolGrip = (k, u, top, m, rake, len, depth, nub) => {
    rake = rake || 0.32; len = len || 105; depth = depth || 34;
    const pts = [[u - depth + 2, top], [u, top], [u - rake * len * 0.45 + 2, top - len * 0.45], ...(nub ? [[u - rake * len * 0.5 + 5, top - len * 0.5], [u - rake * len * 0.55, top - len * 0.55]] : []), [u - rake * len, top - len], [u - rake * len - depth - 4, top - len + 4], [u - depth - rake * len * 0.4, top - len * 0.4]];
    k.P('grip' + rake + len + depth + (nub ? 'n' : ''), pts, 30, m);
  };
  const arGrip = (k, u, top, m, rake, len) => k.P('argrip' + rake + len, [[u - 12, top], [u + 22, top], [u + 18 - rake * len * 0.9, top - len], [u - 18 - rake * len, top - len + 6]], 28, m);
  const trigGuard = (k, u0, u1, top, m, deep) => { const d = deep || 30; k.P('tg' + u0 + u1 + d, [[u0, top], [u1, top], [u1 - 4, top - d], [u0 + 6, top - d], [u0 + 6, top - d + 4], [u1 - 8, top - d + 4], [u1 - 6, top - 4], [u0, top - 4]], 8, m || k.C.black()); k.Bx(u0 + 18, u0 + 22, top - 22, top, 3, k.C.steel()); };
  const birdcage = (k, u, v, m) => { k.Tb(u, u + 45, v, 11, m || k.C.black(), 12); for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; k.Bx(u + 12, u + 38, v + Math.sin(a) * 9 - 1.5, v + Math.sin(a) * 9 + 1.5, 3, k.C.hole(), Math.cos(a) * 9.5); } return u + 45; };
  const flashCone = (k, u, v, len, r, m) => { k.Tb(u, u + len, v, r * 0.85, m || k.C.black(), 12, r); return u + len; };
  // 3-prong flash hider (HK, SCAR) with slots
  const prong = (k, u, v, len, r, m) => { k.Tb(u, u + len, v, r, m || k.C.black(), 12); for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.5; k.Bx(u + len * 0.35, u + len, v + Math.sin(a) * r * 0.8 - 2, v + Math.sin(a) * r * 0.8 + 2, 3, k.C.hole(), Math.cos(a) * r * 0.9); } return u + len; };
  const frontSightA2 = (k, u, v) => { k.P('fsa2', [[u, v - 14], [u + 34, v - 14], [u + 28, v + 40], [u + 20, v + 64], [u + 12, v + 64], [u + 6, v + 40]], 14, k.C.black()); k.Bx(u + 14, u + 18, v + 64, v + 75, 3, k.C.black()); k.Bx(u + 8, u + 24, v + 58, v + 76, 2, k.C.black(), 6); k.Bx(u + 8, u + 24, v + 58, v + 76, 2, k.C.black(), -6); };
  // flip-up sights on a rail (front: post in ears, rear: aperture), standing up
  const buisFront = (k, u, top) => { k.Bx(u - 12, u + 12, top, top + 8, 18, k.C.black()); k.P('buisf', [[u - 8, top + 8], [u + 8, top + 8], [u + 5, top + 34], [u - 5, top + 34]], 14, k.C.black()); k.Bx(u - 2, u + 2, top + 34, top + 44, 2.5, k.C.steel()); };
  const buisRear = (k, u, top) => { k.Bx(u - 14, u + 14, top, top + 8, 20, k.C.black()); k.P('buisr', [[u - 6, top + 8], [u + 6, top + 8], [u + 4, top + 32], [u - 4, top + 32]], 16, k.C.black()); k.Ring(u, top + 26, 4, 4, k.C.hole()); };
  const akFront = (k, u, v) => { k.P('akfs', [[u, v - 12], [u + 36, v - 12], [u + 32, v + 30], [u + 4, v + 30]], 18, k.C.steel()); k.Bx(u + 15, u + 21, v + 30, v + 46, 3, k.C.steel()); k.Bx(u + 8, u + 28, v + 28, v + 48, 2.5, k.C.steel(), 8); k.Bx(u + 8, u + 28, v + 28, v + 48, 2.5, k.C.steel(), -8); k.Bx(u + 34, u + 50, v - 22, v - 10, 10, k.C.steel()); /* bayonet lug */ };
  const bipodFolded = (k, u, v, m, len) => { k.bip = true; len = len || 160; const mm = m || k.C.black(); k.Ring(u, v, 16, 18, mm); k.Bx(u - len, u, v - 4, v + 4, 6, mm, 11); k.Bx(u - len, u, v - 4, v + 4, 6, mm, -11); k.Bx(u - len - 14, u - len, v - 6, v + 6, 10, k.C.poly(), 11); k.Bx(u - len - 14, u - len, v - 6, v + 6, 10, k.C.poly(), -11); };
  // a real riflescope: eyepiece and objective bells, 30 mm tube, turret housing with elevation (top), windage (right)
  // and parallax (left) turrets, two rings on a base; lenses at both ends. obj = objective radius, mag = power ring
  const scope = (k, u0, u1, v, tube, obj, base) => {
    const L = u1 - u0, C = k.C, key = `${L}:${tube}:${obj}`;
    const tubeM = k.Lt('sc' + key, u0, [[0, tube + 6], [6, tube + 7.5], [42, tube + 7.5], [56, tube + 3], [70, tube + 2], [76, tube + 4], [96, tube + 4], [102, tube], [L * 0.42, tube], [L * 0.42, tube + 5], [L * 0.58, tube + 5], [L * 0.58, tube], [L - 95, tube], [L - 50, obj], [L - 4, obj + 1.5], [L, obj + 1]], v, C.black(), 0, 28);
    k.lens(u0, v, tube + 5, 0, true, tubeM); k.lens(u1 + 0.5, v, obj - 1, 0, false, tubeM);
    const mid = u0 + L * 0.5;
    // turrets are short cylinders standing out of the saddle: elevation on top (with a knurled cap), windage right
    const el = k.add(cylG(10, 10, 20, 16), C.black(), mid, v + tube + 8); el.rotation.x = Math.PI / 2;
    const cap = k.add(cylG(11.5, 11.5, 7, 16), C.steel(), mid, v + tube + 20); cap.rotation.x = Math.PI / 2;
    const w = k.add(cylG(10, 10, 18, 16), C.black(), mid, v, tube + 8); w.rotation.set(0, Math.PI / 2, 0); // windage (right)
    const p = k.add(cylG(12, 12, 14, 16), C.black(), mid, v, -tube - 7); p.rotation.set(0, Math.PI / 2, 0); // parallax (left)
    // rings and base
    for (const ru of [u0 + 110, u1 - 110]) { k.Ring(ru, v, tube + 3.5, 16, C.black()); k.Bx(ru - 8, ru + 8, base, v - tube, 26, C.black()); }
    k.Bx(u0 + 95, u1 - 95, base - 2, base + 4, 22, C.black());
  };
  // PSO-1 style side-mounted scope (SVD, AK side rail): short tube, rubber eyecup, sunshade, side mount to the left
  const pso = (k, u0, v, x) => {
    const psoM = k.Lt('pso', u0, [[0, 17], [30, 17], [34, 13], [60, 13], [64, 14], [150, 14], [160, 18], [215, 20], [218, 18]], v, k.C.black(), x, 22);
    k.lens(u0 + 218.5, v, 16, x, false, psoM); k.lens(u0, v, 12, x, true, psoM);
    const t = k.add(cylG(9, 9, 18, 14), k.C.black(), u0 + 110, v + 20, x); t.rotation.x = Math.PI / 2;
    const w2 = k.add(cylG(9, 9, 16, 14), k.C.black(), u0 + 110, v, x + 20); w2.rotation.y = Math.PI / 2;
    k.Bx(u0 + 70, u0 + 170, v - 50, v - 10, 10, k.C.black(), x * 0.55); // the side mount clamping to the receiver rail
  };

  // ---- family builders ------------------------------------------------------------------------------------------
  // anchors (mm): sightV (sight line), railV (top of the optics rail), opticU (where optics sit), boreV, muzzleU,
  // foreU/foreV (support hand), hgU0/hgU1 (handguard), magU/magTop, rear, bodyW (receiver width), noRail, scopeBuiltIn
  const BUILDERS = {
    // ---- AR-15 / AR-10 family: M4, M16A2, HK416, HK417 (the original, well-liked AR model; HK guns add their
    // flash hider and the 417 its 7.62 magazine)
    ar(it, s, k) {
      const { P, Bx, Tb, Ring, rail, C, body } = k, blk = body(C.black());
      P('lower', [[-65, 0], [-60, 22], [120, 22], [120, -8], [112, -40], [46, -40], [40, -8], [-40, -8], [-65, -2]], 24, blk);
      P('upper', [[-72, 22], [120, 22], [120, 62], [-60, 62], [-72, 50]], 26, blk);
      Bx(0, 55, 30, 50, 2, C.steel(), 13.5); // ejection port cover
      Tb(-55, -35, 44, 6, C.black(), 8).position.x = 14 * S; // forward assist
      trigGuard(k, 0, 40, -8); arGrip(k, -20, -6, C.poly(), 0.3, 108);
      curvedMag(k, 'stanag' + (s.magDepth || 62), 80, 12, s.magDepth || 62, (s.magLen || 185) * (s.magMul || 1), s.ar10 ? 0.05 : 0.18, 24, C.black());
      const carry = s.carry && !s.optic, top = carry ? 62 : rail(-62, 118, 62, 22);
      if (carry) { P('carry', [[-55, 62], [-48, 98], [70, 98], [78, 62], [64, 62], [58, 86], [-38, 86], [-42, 62]], 18, blk); Bx(-50, -36, 98, 112, 14, C.black()); }
      else if (k.irons) buisRear(k, -42, top);
      const hg0 = 122, hg1 = hg0 + (s.hgLen || 180), bv = 42;
      Ring(hg0 - 4, bv, 24, 14, C.black()); // delta ring
      if (s.hg === 'quad') { Bx(hg0, hg1, bv - 22, bv + 22, 44, blk); rail(hg0, hg1, bv + 22, 22); k.sideRail(hg0 + 10, hg1, bv, 24); k.sideRail(hg0 + 10, hg1, bv, -24); Bx(hg0 + 10, hg1, bv - 30, bv - 22, 18, C.black()); if (k.irons) buisFront(k, hg1 - 14, bv + 31); }
      else { Tb(hg0, hg1, bv, 22, blk, 12); for (let u = hg0 + 14; u < hg1 - 10; u += 22) Ring(u, bv, 23, 6, C.poly()); }
      const muzzle = hg1 + (s.barrel || 160);
      Tb(hg1, muzzle, bv, s.ar10 ? 8.5 : 7.5, C.steel(), 10);
      if (s.fsb !== false) frontSightA2(k, hg1 + 6, bv); else Bx(hg1 + 4, hg1 + 28, bv - 11, bv + 11, 22, C.black()); // low gas block
      const end = s.hkfh ? prong(k, muzzle - 5, bv, 52, 11) : birdcage(k, muzzle - 5, bv);
      let rear;
      if (s.stock === 'fixed') { P('a2stock', [[-62, 58], [-330, 50], [-345, 52], [-345, -78], [-320, -78], [-150, 6], [-62, 10]], 34, C.poly()); rear = -345; }
      else { Tb(-260, -62, 44, 14, C.black(), 12); P(s.stock === 'crane' ? 'crane' : 'm4stock', s.stock === 'crane' ? [[-145, 70], [-275, 70], [-280, -50], [-262, -52], [-210, 20], [-145, 26]] : [[-150, 60], [-270, 60], [-275, -40], [-258, -44], [-200, 18], [-150, 26]], s.stock === 'crane' ? 36 : 30, C.poly()); rear = -278; }
      Bx(-80, -60, 56, 64, 30, C.black()); // charging handle latch
      return { sightV: carry ? 100 : top + 26, railV: carry ? 98 : top, opticU: 10, boreV: bv, muzzleU: end, foreU: (hg0 + hg1) / 2 + 10, hgU0: hg0, hgU1: hg1, magU: 80, magTop: -38, rear, len: end - rear, ejU: 27, ejV: 40 };
    },
    // ---- AK family: AK-47 (wood), RPK, AK-12 and Galil ACE (polymer, rails)
    ak(it, s, k) {
      const { P, Bx, Tb, Ring, rail, holes, C, body } = k, bv = 30;
      const wood = s.poly ? body(C.black()) : C.wood(), stl = body(s.poly ? C.black() : C.steel());
      // stamped receiver: trunnion at the front, dimples over the magazine, rivets
      P('akrecv', [[-150, 0], [150, 0], [150, 46], [-120, 48], [-150, 34]], 32, stl);
      Bx(110, 150, 2, 44, 33, C.steel()); for (const u of [-130, -110, 118, 140]) Ring(u, 10, 2, 34, C.steel());
      Bx(80, 104, 14, 26, 1, C.hole(), 16.6); Bx(80, 104, 14, 26, 1, C.hole(), -16.6); // mag-well dimples
      // dust cover (ribbed) and the long right-side selector lever, bolt carrier and charging handle
      if (!s.poly) {
        // the stamped dust cover: flat sides with a smooth rounded top, no rails; the recoil spring button at its back
        P('akcover', [[-146, 46], [116, 46], [116, 54], [-146, 54]], 28, stl); const dc = k.add(cylG(14, 14, 262, 20), stl, -15, 54); dc.scale.y = 0.62;
        Ring(-150, 50, 5, 8, C.steel());
      }
      else { P('akcover', [[-150, 48], [118, 48], [118, 62], [-140, 58]], 28, stl); rail(-140, 118, 60, 22); }
      P('aksel', [[-120, 38], [-40, 38], [-30, 30], [-40, 26], [-120, 32]], 3, C.steel(), 17.5);
      k.part('charger', () => { Bx(-60, 60, 34, 46, 2, C.steel(), 16.5); Bx(40, 66, 36, 48, 14, C.steel(), 22); }, 0, 40); // carrier and charging handle (right)
      trigGuard(k, 40, 118, 0, C.steel()); pistolGrip(k, 32, 2, wood, 0.4, 102, 32);
      // magazine: steel 30-rounder with its rib; AK-12 plum polymer; RPK 40-rounder
      curvedMag(k, 'akm', 160, 6, 72, (s.magLen || 212) * (s.magMul || 1), (s.curve || 0.42) * 1.4, 26, s.mag === 'poly' ? C.plum() : s.mag === 'black' ? C.black() : C.steel());
      // rear sight: the tangent leaf block on top of the trunnion
      if (!s.poly) { P('akrs', [[110, 48], [160, 48], [158, 62], [116, 66]], 26, C.steel()); Bx(132, 140, 60, 74, 14, C.steel()); }
      // optics on a classic AK go on a side mount: the rail plate riveted to the left of the receiver, a clamp arm
      // and a short top rail over the dust cover
      let akRail = 62;
      let psoV = 0;
      if (s.optic && !s.poly) Bx(-60, 60, 18, 38, 5, C.black(), -18.5); // the side rail plate
      if (s.optic === 'pso') { pso(k, -150, 104, -27); psoV = 104; } // the PSO-1 clamps straight onto the side rail
      else if (!s.poly && s.optic) { Bx(-50, 50, 18, 84, 8, C.black(), -22); Bx(-50, 50, 76, 84, 44, C.black(), -4); akRail = rail(-56, 56, 84, 22); }
      if (s.poly && k.irons) buisRear(k, -120, 69); // flip-up rear sight on the AK-12 / Galil top rail
      // handguards: lower (with finger grooves) and upper over the gas tube; or a railed polymer guard
      const hg0 = 162, hg1 = hg0 + (s.hgLen || 225);
      if (s.poly) { Bx(hg0, hg1, bv - 22, bv + 22, 42, wood); rail(hg0, hg1, bv + 30, 22); k.sideRail(hg0 + 20, hg1 - 10, bv, 23); k.sideRail(hg0 + 20, hg1 - 10, bv, -23); Bx(hg0 + 4, hg1 - 4, bv + 22, bv + 30, 24, wood); }
      else {
        P('akhgl', [[hg0, bv - 24], [hg0 + 30, bv - 26], [hg1 - 10, bv - 24], [hg1, bv - 14], [hg1, bv + 12], [hg0, bv + 14]], 40, wood);
        for (let u = hg0 + 50; u < hg1 - 40; u += 50) Bx(u, u + 20, bv - 20, bv - 8, 1, C.hole(), 20.6); // grooves
        Tb(hg0 + 4, hg1 - 50, bv + 30, 13, wood, 14); Ring(hg0 + 8, bv + 30, 14, 10, C.steel());
        Bx(hg0 - 2, hg0 + 10, bv - 26, bv + 46, 42, C.steel()); // handguard retainer
      }
      const gb = hg1 + 5; Tb(hg1 - 60, gb + 22, bv + 30, 9, C.steel(), 12); // gas tube
      Bx(gb, gb + 30, bv - 6, bv + 40, 24, C.steel()); // gas block
      const muzzle = gb + (s.barrel || 165);
      Tb(hg1, muzzle, bv, 8.5, C.steel(), 12); Tb(gb + 30, muzzle - 40, bv - 16, 3, C.steel(), 6); // barrel, cleaning rod
      if (s.poly) { k.Bx(gb + 6, gb + 24, bv + 40, bv + 54, 3, C.steel()); } else akFront(k, muzzle - 58, bv);
      let end = muzzle;
      if (s.muzzle === 'ak12') { Tb(muzzle, muzzle + 64, bv, 13, C.black(), 12); for (let u = muzzle + 14; u < muzzle + 56; u += 14) holes(u, u + 6, bv - 4, bv + 4, 13); end = muzzle + 64; }
      else if (s.muzzle === 'slant') { P('slant', [[muzzle, bv - 10], [muzzle + 40, bv - 10], [muzzle + 50, bv + 10], [muzzle, bv + 10]], 18, C.steel()); end = muzzle + 50; }
      else { Tb(muzzle, muzzle + 24, bv, 10, C.steel(), 10); end = muzzle + 24; } // thread protector
      if (s.bipod) bipodFolded(k, muzzle - 70, bv - 14, C.steel(), 220);
      let rear;
      if (s.stock === 'fold') { Tb(-340, -150, 40, 9, C.black(), 10); P('ak12st', [[-200, 56], [-338, 58], [-348, 50], [-348, -58], [-328, -62], [-246, 6], [-200, 18]], 30, C.black()); Bx(-300, -230, 58, 72, 30, C.black()); rear = -348; }
      else if (s.stock === 'club') { P('rpkst', [[-150, 44], [-412, 28], [-422, 32], [-422, -82], [-386, -82], [-300, -46], [-250, -40], [-150, 2]], 34, C.wood()); rear = -422; }
      else { P('akst', [[-150, 46], [-396, 22], [-404, 26], [-404, -84], [-374, -84], [-230, -22], [-150, 4]], 34, wood); Bx(-408, -396, -84, 26, 36, C.steel()); rear = -408; }
      return { opticBuilt: !!psoV, sightV: psoV || (s.poly ? 101 : 74), railV: s.poly ? 69 : akRail, opticU: s.poly ? -10 : 0, boreV: bv, muzzleU: end, foreU: (hg0 + hg1) / 2, hgU0: hg0, hgU1: hg1, magU: 160, magTop: 0, rear, len: end - rear, bodyW: 32, ejU: 80, ejV: 38, rockIn: true, chargeTravel: 120, chargeSide: 1 };
    },
    // ---- HK G36: polymer body, carry handle with the 3x optic and the red dot on top, ventilated handguard,
    // translucent curved magazine with side lugs, skeleton side-folding stock, short exposed barrel
    g36(it, s, k) {
      const { P, Bx, Tb, Ring, rail, holes, C, body } = k, gr = body(C.grey()), bv = 34;
      // receiver/body: from the stock hinge to the magwell, the trigger housing with its integral guard below
      P('g36body', [[-150, 0], [150, 0], [168, 10], [168, 58], [-150, 60]], 34, gr);
      P('g36trig', [[-80, 2], [100, 2], [100, -10], [86, -46], [-20, -46], [-30, -8], [-80, -8]], 30, gr); // trigger housing with the closed guard
      Bx(10, 76, -42, -20, 1, C.hole(), 15.6); Bx(10, 76, -42, -20, 1, C.hole(), -15.6); // the opening through the guard
      P('g36grip', [[-30, -10], [8, -10], [-14, -110], [-52, -104], [-48, -40]], 32, gr);
      Bx(86, 104, -18, 0, 22, gr); // magwell flare
      // magazine: translucent smoke, curved, with the clip lugs on the side
      curvedMag(k, 'g36m', 128, 2, 68, 205 * (s.magMul || 1), 0.42, 26, C.smoke());
      if (!k.drum) k.part('mag', () => Bx(112, 132, -40, -20, 30, C.smoke()), 128, 2);
      // ventilated handguard (long slots), bipod/bayonet stud, gas block and front sight post under the handle front
      const hg0 = 168, hg1 = 448;
      P('g36hg', [[hg0, 6], [hg1 - 10, 8], [hg1, 18], [hg1, 52], [hg0, 56]], 40, gr);
      for (let u = hg0 + 20; u < hg1 - 30; u += 30) { holes(u, u + 18, 14, 26, 20); holes(u, u + 18, 34, 46, 20); }
      Bx(hg1 - 30, hg1 + 6, 52, 60, 24, gr);
      // carry handle: rear post, long top bar housing the 3.5x optic (glass at both ends), red dot on top, front post.
      // With another optic fitted the handle is swapped for a flat Picatinny rail on the receiver (as on the G36 KV)
      if (s.optic) {
        const top = rail(-130, 160, 60, 22); k.part('charger', () => Bx(-20, 0, 40, 52, 12, C.black(), 17), 0, 46);
        const muzzle = hg1 + 70; Tb(hg1, muzzle, bv, 8, C.steel(), 12); const end = prong(k, muzzle, bv, 60, 13);
        P('g36st', [[-150, 58], [-386, 54], [-398, 50], [-398, -64], [-380, -68], [-372, -50], [-372, 34], [-176, 34], [-170, 6], [-150, 4]], 30, gr);
        P('g36st2', [[-372, -50], [-238, 14], [-226, 30], [-250, 30], [-372, -26]], 26, gr); Bx(-404, -398, -68, 54, 36, C.poly());
        return { sightV: top + 30, railV: top, opticU: 10, boreV: bv, muzzleU: end, foreU: 300, hgU0: hg0, hgU1: hg1, magU: 128, magTop: 2, rear: -404, len: end + 404, bodyW: 34, ejU: 50, ejV: 40, chargeTravel: 100, chargeSide: 1 };
      }
      P('g36carry', [[-110, 60], [-104, 124], [168, 124], [176, 60], [154, 60], [146, 104], [-82, 104], [-88, 60]], 24, gr);
      const g36o = Tb(-110, 40, 112, 17, C.black(), 18), g36e = P('g36eye', [[-140, 100], [-110, 100], [-110, 124], [-140, 120]], 34, C.poly()); k.lens(-141, 112, 12, 0, true, g36e); k.lens(41, 112, 15, 0, false, g36o);
      Bx(0, 80, 124, 128, 26, gr); Bx(0, 80, 126, 148, 4, gr, 11); Bx(0, 80, 126, 148, 4, gr, -11); const rdTop = Bx(0, 80, 146, 150, 26, gr); k.seat(rdTop, Bx(70, 74, 128, 146, 18, C.glass())); // open red dot housing on top (the close-range sight)
      k.part('charger', () => Bx(-20, 0, 98, 108, 12, C.black(), 13), 0, 100); // charging handle under the carry handle
      const muzzle = hg1 + 70; Tb(hg1, muzzle, bv, 8, C.steel(), 12); const end = prong(k, muzzle, bv, 60, 13);
      // skeletonised folding stock: top bar, butt, angled lower bar
      P('g36st', [[-150, 58], [-386, 54], [-398, 50], [-398, -64], [-380, -68], [-372, -50], [-372, 34], [-176, 34], [-170, 6], [-150, 4]], 30, gr);
      P('g36st2', [[-372, -50], [-238, 14], [-226, 30], [-250, 30], [-372, -26]], 26, gr);
      Bx(-404, -398, -68, 54, 36, C.poly());
      return { sightV: 137, railV: 150, opticU: 30, boreV: bv, muzzleU: end, foreU: 300, hgU0: hg0, hgU1: hg1, magU: 128, magTop: 2, rear: -404, len: end + 404, bodyW: 34, ejU: 50, ejV: 40, integratedOptic: true, chargeTravel: 100, chargeSide: 1 };
    },
    // ---- FN SCAR-H: tan aluminium upper with a full-length top rail, side and bottom rails at the front, folding
    // sights, polymer lower with a flared magwell, side-folding telescopic stock with a cheek riser
    scar(it, s, k) {
      const { P, Bx, Tb, Ring, rail, holes, C, body } = k, tan = body(C.tan()), td = body(C.tanDark()), bv = 46;
      P('scarup', [[-150, 20], [420, 20], [420, 70], [-150, 70]], 36, tan); const top = rail(-150, 420, 70, 22);
      k.sideRail(250, 412, bv, 19); k.sideRail(250, 412, bv, -19); Bx(270, 412, 12, 20, 20, C.black()); for (let u = 274; u < 408; u += 10) Bx(u, u + 5, 8, 12, 23, C.black());
      holes(-20, 70, 30, 52, 18, false); // ejection port (right)
      k.part('charger', () => Bx(170, 200, 42, 52, 12, C.black(), -24), 0, 47); Bx(150, 230, 46, 50, 3, C.hole(), -18.6); // left side charging handle and its slot
      for (let u = 280; u < 400; u += 26) holes(u, u + 12, 26, 36, 18); // cooling slots
      // polymer lower: trigger housing, flared magwell, ambi selector
      P('scarlow', [[-70, 20], [126, 20], [126, -6], [116, -50], [52, -50], [46, -10], [-70, -10]], 30, td);
      Bx(-36, -18, 4, 14, 4, C.black(), 16); Bx(-36, -18, 4, 14, 4, C.black(), -16);
      trigGuard(k, 6, 52, -10, td); pistolGrip(k, 0, -8, C.black(), 0.3, 112, 34, true);
      curvedMag(k, 'scarm', 88, -10, 66, 150 * (s.magMul || 1), 0.12, 26, C.black()); // 20-round 7.62 mag, nearly straight
      if (k.irons) { buisFront(k, 396, top); buisRear(k, -124, top); }
      const muzzle = 420 + 115; Tb(420, muzzle, bv, 9, C.steel(), 12); Bx(410, 436, bv - 12, bv + 14, 24, C.black()); // barrel, gas block
      const end = prong(k, muzzle, bv, 58, 13);
      // folding stock: hinge, telescopic body, cheek riser, butt pad
      Bx(-170, -150, 14, 66, 34, C.black());
      P('scarst', [[-170, 68], [-392, 64], [-404, 58], [-404, -56], [-386, -62], [-312, -10], [-244, 6], [-170, 26]], 34, tan);
      Bx(-344, -236, 64, 80, 30, tan); Bx(-410, -404, -60, 58, 38, C.poly()); holes(-300, -200, 20, 44, 17);
      return { sightV: top + 34, railV: top, opticU: 30, boreV: bv, muzzleU: end, foreU: 300, hgU0: 230, hgU1: 420, magU: 88, magTop: -40, rear: -410, len: end + 410, bodyW: 36, ejU: 25, ejV: 41, chargeTravel: 110, chargeSide: -1 };
    },
    // ---- bullpups: FAMAS (long carry handle with both sights, big trigger guard, bipod legs) and Steyr AUG
    bullpup(it, s, k) {
      const { P, Bx, Tb, Ring, rail, holes, C, body } = k;
      if (s.kind === 'aug') {
        const gr = body(C.green());
        // one-piece polymer stock with the receiver in its top, the 1.5x scope in the carrying handle
        P('augbody', [[-430, 6], [-260, 0], [-60, 4], [60, -4], [196, 2], [212, 26], [210, 44], [-80, 58], [-420, 54], [-436, 36]], 62, gr);
        P('augguard', [[-80, -4], [64, -4], [64, -108], [44, -120], [-56, -120], [-80, -70]], 44, gr); Bx(-60, 44, -104, -16, 1, C.hole(), 22.6); Bx(-60, 44, -104, -16, 1, C.hole(), -22.6);
        P('augfg', [[120, 0], [152, 0], [148, -104], [124, -104]], 28, gr); // folding foregrip
        curvedMag(k, 'augm', -190, 10, 62, 175 * (s.magMul || 1), 0.24, 26, C.smoke());
        let augTop = 0;
        if (s.optic) { Bx(-250, 60, 54, 62, 26, gr); augTop = rail(-250, 60, 62, 22); } // A3: rail in place of the scope
        else {
          P('augmount', [[-260, 56], [96, 56], [86, 80], [-250, 80]], 26, gr); // the handle
          const augT = Tb(-270, 60, 94, 15, C.black(), 18), augO = Tb(60, 124, 94, 19, C.black(), 18, 15); k.lens(125, 94, 16, 0, false, augO); k.lens(-271, 94, 11, 0, true, augT);
        }
        k.part('charger', () => Bx(-40, 0, 40, 56, 6, C.black(), 30), 0, 48); // charging handle (left)
        const muzzle = 196 + 260; Tb(196, muzzle, 30, 9, C.steel(), 12); Ring(212, 30, 13, 16, C.black()); const end = prong(k, muzzle, 30, 44, 12);
        Bx(-440, -430, -10, 56, 60, C.black());
        return { sightV: s.optic ? augTop + 30 : 94, railV: s.optic ? augTop : 108, opticU: -100, boreV: 30, muzzleU: end, foreU: 136, foreV: -60, hgU0: 60, hgU1: 196, magU: -190, magTop: 10, rear: -440, len: end + 440, bodyW: 62, ejU: -270, ejV: 32, integratedOptic: !s.optic, foreVert: true, chargeTravel: 100, chargeSide: -1 };
      }
      const bk = body(C.black());
      // the receiver/body: one continuous solid block with a flat top (v = 60) from the butt to the front of the
      // handguard, where it bevels down to the barrel
      P('famasbody', [[-430, 0], [-40, 0], [20, -4], [150, 0], [186, 22], [186, 46], [164, 60], [-430, 60]], 50, bk);
      // two separate layouts, chosen before any handle geometry exists:
      //  - optic fitted: flat-top receiver only. The body above is already a solid prism with a flat, low top from the
      //    butt to the handguard; a rail lies flush on it. No handle, rear support or front leg is ever built.
      //  - no optic: the classic FAMAS with its integrated carrying handle (rear aperture support, long bar, front leg)
      //    and the charging handle under it.
      let famTop = 0;
      if (s.optic) {
        famTop = rail(-300, 110, 60, 22);
        k.part('charger', () => Bx(-120, -40, 44, 56, 10, C.black(), 27), 0, 50); // charging handle on the right side of the receiver
      } else {
        // (shortened from the real rifle's so the whole handle, rear support included, stays on screen in first person)
        P('famascarry', [[-110, 60], [-96, 104], [118, 104], [128, 60], [104, 60], [96, 90], [-72, 90], [-82, 60]], 18, bk);
        Bx(-110, -80, 104, 107, 18, C.black()); Bx(-100, -90, 107, 122, 3, C.black(), 8); Bx(-100, -90, 107, 122, 3, C.black(), -8); // rear aperture sight: two thin ears you look between
        k.part('charger', () => Bx(-60, 40, 86, 96, 10, C.black()), 0, 91); // charging handle under the carry handle
      }
      // front sight: a short block on the front of the receiver top, post between two ears (both layouts)
      Bx(132, 156, 60, 72, 20, C.black()); Bx(142, 146, 72, 86, 3, C.black()); Bx(136, 152, 72, 88, 2, C.black(), 7); Bx(136, 152, 72, 88, 2, C.black(), -7);
      P('famasguard', [[-40, 0], [44, 0], [44, -16], [34, -112], [0, -118], [-32, -112], [-40, -16]], 36, bk); Bx(-26, 30, -100, -14, 1, C.hole(), 18.6); Bx(-26, 30, -100, -14, 1, C.hole(), -18.6);
      curvedMag(k, 'famasm', -175, 0, 60, 135 * (s.magMul || 1), 0.15, 24, C.black());
      const muzzle = 186 + 200; Tb(186, muzzle, 30, 8, C.steel(), 12); const end = flashCone(k, muzzle, 30, 40, 12);
      Bx(40, 176, 14, 22, 6, C.black(), 28); Bx(40, 176, 14, 22, 6, C.black(), -28); // bipod legs folded flat against the sides of the body
      Bx(-440, -430, -10, 60, 48, C.poly());
      return { sightV: s.optic ? famTop + 30 : 114, railV: s.optic ? famTop : 104, opticU: -80, boreV: 30, muzzleU: end, foreU: 120, hgU0: 60, hgU1: 186, magU: -175, magTop: 0, rear: -440, len: end + 440, bodyW: 50, ejU: -250, ejV: 40, chargeTravel: 90, chargeSide: 1 };
    },
    // ---- StG 44: long stamped receiver, gas cylinder over the barrel, front sight hood, tangent rear sight, wood butt
    stg(it, s, k) {
      const { P, Bx, Tb, Ring, holes, C, body } = k, stl = body(C.blued());
      P('stgrecv', [[-180, 0], [190, 0], [190, 52], [-160, 52], [-180, 40]], 30, stl);
      P('stgwell', [[110, 0], [176, 0], [172, -44], [114, -44]], 32, stl);
      curvedMag(k, 'stgm', 143, -30, 54, 240 * (s.magMul || 1), 0.34, 24, C.blued());
      trigGuard(k, 20, 90, 0, stl); P('stggrip', [[-24, 2], [16, 2], [0, -98], [-40, -92]], 30, C.wood());
      P('stgtrig', [[-60, 2], [100, 2], [100, -10], [-50, -10]], 26, stl);
      Bx(-60, 30, 30, 44, 1.5, C.hole(), 15.6); k.part('charger', () => Bx(110, 140, 30, 46, 10, stl, -18), 0, 38); // ejection port, charging handle (left)
      Tb(190, 470, 62, 11, stl, 14); Ring(470, 62, 12, 10, stl); // gas cylinder with its nut
      P('stghg', [[190, 6], [390, 10], [390, 50], [190, 52]], 30, stl); for (let u = 210; u < 380; u += 30) holes(u, u + 14, 20, 32, 15); // vented handguard
      P('stgrs', [[20, 52], [80, 52], [76, 64], [26, 68]], 22, stl); // tangent rear sight
      const muzzle = 470 + 160; Tb(390, muzzle, 30, 8, C.blued(), 12); Tb(muzzle - 6, muzzle + 10, 30, 10, C.blued(), 12);
      P('stgfs', [[muzzle - 50, 22], [muzzle - 16, 22], [muzzle - 18, 68], [muzzle - 48, 68]], 18, stl); Bx(muzzle - 36, muzzle - 30, 44, 64, 3, C.steel());
      P('stgstock', [[-180, 48], [-434, 26], [-444, 30], [-444, -72], [-414, -72], [-180, 10]], 34, C.wood()); Bx(-448, -440, -72, 30, 36, C.steel());
      return { sightV: 70, railV: 64, opticU: 0, boreV: 30, muzzleU: muzzle + 10, foreU: 300, hgU0: 190, hgU1: 390, magU: 143, magTop: -30, rear: -448, len: muzzle + 458, bodyW: 30, ejU: -15, ejV: 37, noRail: true, chargeTravel: 110, chargeSide: -1 };
    },
    // ---- wooden-stocked rifles: each has its own stock line, sights, bolt or operating rod, bands and muzzle
    wood(it, s, k) {
      const { P, Bx, Tb, Ring, holes, C } = k, wd = s.dark ? C.woodDark() : s.red ? C.woodRed() : C.wood(), stl = C.blued(), bv = 30;
      const fore = s.fore || 520, wrist = s.pistolWrist ? [[-40, -40], [10, -46], [30, -34]] : [[-40, -26], [30, -32]];
      // one-piece stock: butt, wrist, fore-end; the butt drop and comb differ per rifle
      P('wstock', [[fore, bv - 22], [fore, bv + 8], [140, bv + 16], [-30, bv + 18], [-110, bv + 6], [-420, -4 + (s.drop || 0)], [-432, 0 + (s.drop || 0)], [-432, -96], [-398, -100], [-130, -42], ...wrist, [80, -14], [140, bv - 24]], 40, wd);
      Bx(-436, -430, -100, (s.drop || 0) + 2, 40, s.plate === 'wood' ? wd : stl); // butt plate
      if (s.upper) P('wupper', [[s.upper0 || 170, bv + 8], [s.upper1 || fore - 30, bv + 8], [s.upper1 || fore - 30, bv + 26], [(s.upper0 || 170) + 10, bv + 30]], 32, wd);
      // receiver
      if (s.hex) { const r = k.add(cylG(16, 16, 230, 6), stl, 60, bv + 14, 0); r.rotation.z = Math.PI / 6; } else Tb(-110, 170, bv + 14, 15, stl, 14);
      trigGuard(k, 6, 66, -14, stl, 26);
      const muzzle = fore + (s.barrel || 260); Tb(fore - 40, muzzle, bv + 10, 8, stl, 12);
      // barrel bands and nose cap
      (s.bands || [fore - 20, fore - 170]).forEach(u => Ring(u, bv + 8, 22, 12, stl));
      if (s.rod) Tb(fore - 40, muzzle - 30, bv - 10, 3, C.bright(), 8); // cleaning rod under the barrel
      if (s.bolt === 'straight') k.part('bolt', () => { Tb(-60, -10, bv + 18, 7, stl, 10); const h = k.add(cylG(3.5, 3.5, 54, 8), stl, -30, bv + 16, 22); h.rotation.set(0, Math.PI / 2, 0); k.add(new THREE.SphereGeometry(8 * S, 10, 8), stl, -30, bv + 16, 50).name = 'knob'; }, 0, bv + 18);
      else if (s.bolt === 'down') k.part('bolt', () => { Tb(-60, -10, bv + 18, 7, stl, 10); const h = k.add(cylG(3.5, 3.5, 44, 8), stl, -34, bv + 4, 20); h.rotation.set(0.75, Math.PI / 2, 0); k.add(new THREE.SphereGeometry(8 * S, 10, 8), stl, -34, bv - 10, 34).name = 'knob'; }, 0, bv + 18);
      else if (s.bolt === 'enfield') k.part('bolt', () => { Tb(-70, -20, bv + 18, 7, stl, 10); const h = k.add(cylG(3.5, 3.5, 40, 8), stl, -60, bv + 8, 20); h.rotation.set(0.5, Math.PI / 2, 0); k.add(new THREE.SphereGeometry(7 * S, 10, 8), stl, -64, bv - 2, 34).name = 'knob'; }, 0, bv + 18);
      if (s.oprod) k.part('bolt', () => { Bx(40, 200, bv + 2, bv + 12, 6, stl, 17); Bx(28, 48, bv + 2, bv + 18, 14, stl, 20); }, 0, bv); // operating rod and its handle (right)
      if (s.gascyl) { Tb(fore - 60, muzzle - 40, bv - 8, 8, stl, 12); Bx(muzzle - 60, muzzle - 36, bv - 18, bv + 18, 18, stl); }
      if (s.mag) k.part('mag', () => P('wmag', [[70, -6], [140, 4], [140, -96 - (s.magLong || 0)], [72, -96 - (s.magLong || 0)]], 26, stl), 105, -2);
      if (s.svtBolt) k.part('bolt', () => { Bx(-40, 60, bv + 12, bv + 22, 6, stl, 17); Bx(-40, -24, bv + 10, bv + 24, 14, stl, 22); }, 0, bv + 17); // the bolt carrier and its handle (right)
      // rear sights: aperture with protective ears (Garand/M14/Enfield), tangent leaf (Mosin, K98k, SVT)
      if (s.rsight === 'aperture') { Bx(-96, -66, bv + 28, bv + 34, 22, stl); if (k.irons) { Bx(-92, -70, bv + 34, bv + 54, 4, stl, 9); Bx(-92, -70, bv + 34, bv + 54, 4, stl, -9); Bx(-86, -76, bv + 34, bv + 50, 8, stl); Ring(-81, bv + 46, 2.5, 3, C.hole()); } }
      else { P('wrs', [[140, bv + 22], [200, bv + 22], [196, bv + 32], [146, bv + 36]], 22, stl); Bx(170, 178, bv + 30, bv + 40, 14, stl); }
      // front sight: hooded post or post between ears at the muzzle
      if (s.fsight === 'hood') { Ring(muzzle - 22, bv + 26, 9, 22, stl); Bx(muzzle - 34, muzzle - 10, bv + 14, bv + 20, 12, stl); }
      else { Bx(muzzle - 34, muzzle - 12, bv + 12, bv + 26, 10, stl); Bx(muzzle - 26, muzzle - 22, bv + 26, bv + 38, 3, stl); Bx(muzzle - 30, muzzle - 16, bv + 22, bv + 40, 2.5, stl, 6); Bx(muzzle - 30, muzzle - 16, bv + 22, bv + 40, 2.5, stl, -6); }
      let end = muzzle;
      if (s.brake) { Tb(muzzle, muzzle + 70, bv + 10, 12, stl, 12); for (let u = muzzle + 10; u < muzzle + 64; u += 11) holes(u, u + 6, bv + 4, bv + 16, 12); end = muzzle + 70; } // SVT-40 six-port brake
      else if (s.flash) { Tb(muzzle, muzzle + 56, bv + 10, 10, stl, 10); for (let i = 0; i < 3; i++) holes(muzzle + 18, muzzle + 54, bv + 7 + i * 3, bv + 8 + i * 3, 10); end = muzzle + 56; } // M14 slotted flash suppressor
      if (s.nose) { P('enfnose', [[fore - 24, bv - 20], [fore + 22, bv - 4], [fore + 22, bv + 22], [fore - 24, bv + 26]], 32, stl); Tb(fore + 22, fore + 42, bv + 10, 9, stl, 10); } // Enfield nose cap and spike lug
      // optics: no rail on these rifles, so a mount is clamped on the receiver when one is fitted
      if (s.optic) Bx(-60, 110, bv + 28, bv + 40, 22, C.black());
      return { rockIn: !!(s.oprod && s.mag), wellView: !!(s.oprod && s.mag), loadU: 50, loadV: bv + 28, ejU: 30, ejV: bv + 20, ejX: 18, sightV: s.rsight === 'aperture' ? bv + 46 : bv + 38, railV: bv + 40, opticU: 20, boreV: bv + 10, muzzleU: end, foreU: fore - 140, hgU0: 170, hgU1: fore, magU: 105, magTop: -2, rear: -436, len: end + 436, bodyW: 40, noRail: !s.optic };
    },
    // ---- bolt-action and DMR sniper rifles: M24 (HS stock), AWM and L96 (green, thumbhole), SVD (skeleton stock,
    // PSO-1), Mk 14 EBR (chassis). The built-in scope is a full riflescope on rings.
    sniper(it, s, k) {
      const { P, Bx, Tb, Ring, rail, holes, C, body } = k, bv = 40;
      let rear, top = 76, scopeV = 120;
      if (s.kind === 'awm' || s.kind === 'l96') {
        const gr = body(C.green());
        P('aichassis', [[-90, 0], [300, 6], [300, 44], [-90, 50]], 50, gr);
        P('aistock', [[-90, 50], [-200, 54], [-404, 54], [-414, 58], [-414, -86], [-394, -90], [-300, -32], [-232, -32], [-182, -88], [-150, -92], [-120, -12], [-90, -6]], 46, gr); // thumbhole
        Bx(-250, -186, -82, -40, 1, C.hole(), 23.6); Bx(-250, -186, -82, -40, 1, C.hole(), -23.6);
        if (s.kind === 'awm') Bx(-340, -230, 54, 72, 30, gr); // adjustable cheek piece
        trigGuard(k, -10, 48, 0, gr); k.part('mag', () => P('aimag', [[56, 0], [116, 0], [116, -62], [56, -62]], 30, C.black()), 86, 0);
        Bx(240, 300, -6, 0, 30, C.black()); // bipod stud rail
        rear = -414;
      } else if (s.kind === 'svd') {
        P('svdrecv', [[-150, 0], [140, 0], [140, 44], [-150, 44]], 30, body(C.steel())); k.part('charger', () => Bx(-20, 10, 26, 38, 12, C.steel(), 20), 0, 32); // carrier handle (right) P('svdcov', [[-150, 44], [120, 44], [120, 56], [-140, 52]], 26, body(C.steel()));
        Bx(60, 140, 20, 30, 6, C.black(), -18); // PSO side rail on the left
        P('svdstock', [[-150, 42], [-426, 30], [-436, 34], [-436, -88], [-404, -88], [-332, -32], [-262, -30], [-222, -84], [-190, -86], [-150, -10]], 32, C.woodRed()); // skeleton thumbhole stock
        Bx(-330, -242, 30, 44, 28, C.woodRed());
        trigGuard(k, 0, 56, 0, C.steel()); curvedMag(k, 'svdm', 92, 0, 64, 100 * (s.magMul || 1), 0.12, 24, C.steel());
        P('svdhg', [[140, 12], [400, 14], [400, 50], [140, 48]], 38, C.woodRed()); for (let u = 170; u < 390; u += 34) holes(u, u + 18, 22, 32, 19);
        rear = -436; top = 56;
      } else if (s.kind === 'mk14') {
        const tn = body(C.tan());
        P('mk14chassis', [[-60, -2], [380, 2], [380, 64], [-60, 64]], 42, tn); top = rail(-60, 380, 64, 22);
        k.sideRail(160, 372, 34, 23); k.sideRail(160, 372, 34, -23); for (let u = 170; u < 360; u += 30) holes(u, u + 14, 6, 18, 21);
        k.part('bolt', () => Bx(20, 120, 40, 52, 8, C.steel(), 24), 0, 40); // operating rod handle (right)
        Tb(-300, -60, 40, 15, C.black(), 14); P('mk14stock', [[-180, 60], [-322, 60], [-328, -50], [-308, -54], [-232, 10], [-180, 22]], 34, C.black()); Bx(-300, -200, 60, 74, 30, C.black());
        trigGuard(k, 20, 66, -2); pistolGrip(k, 20, -2, C.black(), 0.3, 110, 34, true);
        curvedMag(k, 'mk14m', 104, -2, 62, 125 * (s.magMul || 1), 0.06, 26, C.black());
        if (k.irons) { buisFront(k, 360, top); buisRear(k, -40, top); }
        rear = -328;
      } else { // M24: HS Precision sporter stock, Remington 700 action
        const st = body(C.olive());
        P('m24stock', [[300, 2], [300, 36], [-60, 42], [-130, 32], [-422, 32], [-432, 36], [-432, -90], [-402, -94], [-140, -30], [-60, -26], [0, -42], [40, -32], [80, -12], [140, -6]], 46, st);
        trigGuard(k, 10, 70, -10, C.black()); Bx(-436, -430, -94, 36, 46, C.poly()); rear = -436;
      }
      // action and bolt (bolt-action rifles)
      if (s.kind !== 'mk14' && s.kind !== 'svd') { Tb(-96, 166, bv + 12, 18, C.steel(), 18); holes(10, 70, bv + 6, bv + 22, 18, false); k.part('bolt', () => { Tb(-64, -20, bv + 22, 8, C.steel(), 10); const h = k.add(cylG(3.5, 3.5, 46, 8), C.steel(), -40, bv + 12, 22); h.rotation.set(0.25, Math.PI / 2, 0); k.add(new THREE.SphereGeometry(8 * S, 10, 8), C.black(), -40, bv + 2, 44).name = 'knob'; }, 0, bv + 22); }
      const bstart = s.kind === 'svd' ? 400 : s.kind === 'mk14' ? 380 : 160, muzzle = (s.kind === 'svd' ? 400 : s.kind === 'mk14' ? 380 : 300) + (s.barrel || 360);
      const br = s.kind === 'svd' ? 8 : s.kind === 'mk14' ? 9 : 11;
      Tb(bstart, muzzle, s.kind === 'svd' ? bv - 8 : bv + 10, br, C.steel(), 14, s.kind === 'm24' ? 9 : br);
      const mv = s.kind === 'svd' ? bv - 8 : bv + 10;
      let end = muzzle;
      if (s.kind === 'awm') { Bx(muzzle, muzzle + 76, mv - 14, mv + 14, 32, C.black()); holes(muzzle + 12, muzzle + 34, mv - 10, mv + 10, 16); holes(muzzle + 46, muzzle + 68, mv - 10, mv + 10, 16); end = muzzle + 76; } // AWM brake
      else if (s.kind === 'l96') { Tb(muzzle, muzzle + 40, mv, 12, C.black(), 12); end = muzzle + 40; }
      else if (s.kind === 'svd') { Tb(muzzle, muzzle + 76, mv, 11, C.steel(), 12); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; Bx(muzzle + 20, muzzle + 74, mv + Math.sin(a) * 9 - 1.5, mv + Math.sin(a) * 9 + 1.5, 3, C.hole(), Math.cos(a) * 10); } end = muzzle + 76; akFront(k, muzzle - 70, mv); Tb(400, 500, mv + 30, 7, C.steel(), 10); Bx(30, 70, 56, 66, 22, C.steel()); }
      else if (s.kind === 'mk14') end = prong(k, muzzle, mv, 56, 12);
      // optics: the rifle's built-in riflescope (PSO-1 side mount on the SVD)
      if (s.kind === 'svd') { pso(k, -150, 108, -24); scopeV = 108; }
      else if (it.scope && !s.optic) { scope(k, -150, 190, s.kind === 'mk14' ? top + 44 : 122, 15, s.kind === 'm24' ? 24 : 26, s.kind === 'mk14' ? top : bv + 26); scopeV = s.kind === 'mk14' ? top + 44 : 122; }
      if (!s.optic && !it.scope && s.kind !== 'mk14') { Bx(muzzle - 30, muzzle - 10, mv + 10, mv + 28, 4, C.black()); }
      return { loadU: 40, loadV: bv + 26, ejU: 40, ejV: bv + 14, ejX: 18, rockIn: s.kind === 'svd' || s.kind === 'mk14', wellView: s.kind === 'mk14', chargeTravel: s.kind === 'svd' ? 110 : 0, chargeSide: 1, sightV: scopeV, railV: s.kind === 'mk14' ? top : bv + 32, opticU: 0, boreV: mv, muzzleU: end, foreU: 200, hgU0: 140, hgU1: 300, magU: s.kind === 'mk14' ? 104 : s.kind === 'svd' ? 92 : 86, magTop: 0, rear, len: end - rear, scopeBuiltIn: !!it.scope, bodyW: 46, noRail: s.kind === 'svd' };
    },
    // ---- Barrett M82A1: long upper receiver with the slotted barrel jacket at its front, rail, carry handle,
    // lower receiver with the grip and 10-round magazine, butt with recoil pad and monopod, chevron double-chamber
    // muzzle brake, bipod folded under the barrel
    m82(it, s, k) {
      const { P, Bx, Tb, Ring, rail, holes, C, body } = k, bk = body(C.black()), bv = 52;
      P('m82up', [[-280, 20], [360, 20], [360, 88], [-260, 88], [-280, 74]], 100, bk); const top = rail(-220, 260, 88, 40); // upper: 2x wide
      for (let u = 140; u < 350; u += 38) holes(u, u + 26, 32, 72, 50); // barrel jacket slots
      holes(-120, -20, 46, 70, 50, false); // ejection port (right)
      k.part('charger', () => Bx(-120, -60, 56, 70, 12, C.steel(), -55), 0, 63); // charging handle (left)
      P('m82low', [[-440, -6], [140, -6], [140, 20], [-440, 20]], 96, bk); // lower: 2x wide
      P('m82butt', [[-440, 20], [-488, 34], [-488, -112], [-440, -112], [-380, -36], [-300, -6]], 48, bk); Bx(-496, -488, -112, 34, 52, C.poly()); // butt and recoil pad
      Bx(-430, -400, -112, -60, 16, C.steel()); // monopod (stowed)
      trigGuard(k, -60, 0, -6); pistolGrip(k, -60, -6, C.poly(), 0.3, 118, 36);
      k.part('mag', () => { P('m82mag', [[40, -6], [146, -6], [146, -112], [40, -112]], 40, bk); for (let v = -100; v < -20; v += 18) Bx(46, 140, v, v + 4, 41, C.black()); }, 92, -6);
      const muzzle = 360 + 600; Tb(360, muzzle, bv, 14, C.steel(), 14);
      // the iconic arrow-head brake: a flat plate, a short neck off the barrel flaring into a triangle that points forward
      P('m82brake', [[muzzle, bv - 16], [muzzle + 30, bv - 16], [muzzle + 30, bv - 42], [muzzle + 124, bv], [muzzle + 30, bv + 42], [muzzle + 30, bv + 16], [muzzle, bv + 16]], 64, C.black());
      holes(muzzle + 40, muzzle + 70, bv - 14, bv + 14, 32); holes(muzzle + 80, muzzle + 100, bv - 8, bv + 8, 32); // the side ports
      // bipod: hinged at the front of the upper receiver, legs folded forward under the barrel
      Bx(330, 362, 8, 22, 54, bk); Bx(360, 620, bv - 34, bv - 26, 8, C.steel(), 16); Bx(360, 620, bv - 34, bv - 26, 8, C.steel(), -16); Bx(600, 630, bv - 38, bv - 22, 14, C.poly(), 16); Bx(600, 630, bv - 38, bv - 22, 14, C.poly(), -16);
      // scope rings straight on the rail, no posts or carry handle under it
      if (!s.optic) scope(k, -200, 180, top + 36, 17, 28, top);
      if (k.irons && s.optic) { buisRear(k, -200, top); }
      return { sightV: top + 36, railV: top, opticU: -20, boreV: bv, muzzleU: muzzle + 124, foreU: 270, hgU0: 140, hgU1: 360, magU: 92, magTop: -6, rear: -496, len: muzzle + 124 + 496, ejU: -70, ejV: 58, scopeBuiltIn: true, bodyW: 50, vmul: 0.9, chargeTravel: 120, chargeSide: -1 };
    },
    // ---- shotguns
    shotgun(it, s, k) {
      const { P, Bx, Tb, Ring, rail, holes, C, body } = k, bv = 40;
      if (s.kind === 'ksg') { // KSG: bullpup, twin magazine tubes under the barrel, top rail, pump with a vertical grip
        const bk = body(C.black());
        P('ksgbody', [[-330, 0], [-60, 0], [80, -6], [200, -4], [200, 64], [-330, 70]], 50, bk); const top = rail(-290, 190, 70, 22);
        Tb(-200, 330, 16, 14, C.black(), 14).position.x = 13 * S; Tb(-200, 330, 16, 14, C.black(), 14).position.x = -13 * S;
        P('ksgguard', [[-40, 0], [44, 0], [34, -110], [-8, -116], [-40, -100]], 34, bk); Bx(-26, 26, -100, -14, 1, C.hole(), 17.6); Bx(-26, 26, -100, -14, 1, C.hole(), -17.6);
        holes(-200, -120, 20, 52, 25, false); // ejection port
        k.part('pump', () => { P('ksgpump', [[180, -18], [336, -18], [336, 30], [180, 30]], 52, C.poly()); for (let u = 196; u < 330; u += 16) Bx(u, u + 6, -14, 26, 53, C.black());
        P('ksgfg', [[244, -18], [276, -18], [272, -110], [248, -110]], 28, C.poly()); }, 260, 0);
        Tb(200, 482, 46, 11, C.steel(), 12); Bx(-342, -330, -20, 70, 48, C.poly());
        if (k.irons) { buisFront(k, 170, top); buisRear(k, -270, top); }
        return { load: 'shells', loadU: -200, loadV: 0, ejU: -200, ejV: 0, ejX: 0, ejBottom: true, recv0: -300, recv1: -130, sightV: top + 30, railV: top, opticU: -80, boreV: 46, muzzleU: 482, foreU: 260, foreV: -60, hgU0: 180, hgU1: 336, magU: -100, magTop: 0, rear: -342, len: 824, foreVert: true, bodyW: 50 };
      }
      if (s.kind === 'aa12') { // AA-12: long box receiver, carry handle with a rail, front sight post, 20-round drum
        const bk = body(C.black());
        P('aa12body', [[-130, -6], [330, -6], [330, 72], [-120, 72], [-130, 60]], 48, bk);
        P('aa12handle', [[-80, 72], [-70, 104], [290, 104], [300, 72], [270, 72], [264, 92], [-48, 92], [-54, 72]], 22, bk); const top = rail(-70, 292, 104, 22);
        for (let u = 0; u < 300; u += 40) holes(u, u + 24, 10, 22, 24); // recoil spring housing vents
        holes(-90, -10, 34, 56, 24, false); Bx(-120, -60, 44, 54, 10, C.black(), -28); // ejection port, charging handle (left)
        P('aa12well', [[40, -6], [170, -6], [170, -30], [40, -30]], 40, bk);
        k.part('mag', () => { k.add(cylG(72, 72, 64, 28), C.black(), 106, -92); k.add(cylG(18, 18, 68, 16), C.steel(), 106, -92); }, 106, -6); // 20-round drum, flat faces forward and back, flush under the magwell
        trigGuard(k, -40, 20, -6); pistolGrip(k, -40, -6, C.poly(), 0.32, 112, 36);
        const muzzle = 330 + 150; Tb(330, muzzle, 46, 13, C.steel(), 14); Ring(muzzle - 6, 46, 15, 12, C.black());
        Bx(muzzle - 26, muzzle - 10, 52, 98, 8, C.black()); // front sight post
        P('aa12stock', [[-130, 66], [-372, 66], [-382, 58], [-382, -64], [-354, -68], [-130, -6]], 46, C.poly()); Bx(-388, -382, -68, 66, 50, C.poly());
        return { ejU: -50, ejV: 45, sightV: 112, railV: top, opticU: 60, boreV: 46, muzzleU: muzzle, foreU: 250, hgU0: 180, hgU1: 330, magU: 106, magTop: -6, rear: -388, len: muzzle + 388, bodyW: 48, vmul: 0.85 };
      }
      // tube-fed shotguns: receiver, barrel over the magazine tube with its cap
      const recv = body(s.kind === 'r870' ? C.blued() : C.black()), furn = s.kind === 'r870' ? C.wood() : C.black();
      P('sgrecv', [[-80, 0], [132, 0], [132, 66], [-56, 68], [-80, 56]], 34, recv);
      holes(10, 80, 14, 50, 17, false); // ejection port (right)
      Bx(20, 40, 0, 10, 6, C.steel(), 17); // slide release / bolt handle
      trigGuard(k, 0, 60, 0, recv);
      const fore = 132 + (s.barrel || 470);
      Tb(132, fore, bv + 16, 11.5, C.steel(), 14); // barrel
      Tb(132, fore - 40, bv - 14, 11, C.steel(), 14); Ring(fore - 46, bv - 14, 12.5, 14, C.black()); // magazine tube and cap
      Bx(fore - 60, fore - 40, bv - 4, bv + 6, 8, C.steel()); // barrel ring to the tube
      if (s.kind === 'spas12') {
        Tb(150, 430, bv + 16, 16, C.black(), 16); for (let u = 160; u < 420; u += 24) holes(u, u + 12, bv + 8, bv + 24, 16); // perforated heat shield
        k.part('pump', () => { P('spaspump', [[150, bv - 30], [362, bv - 30], [362, bv + 2], [150, bv + 2]], 48, C.black()); for (let u = 170; u < 352; u += 16) Bx(u, u + 6, bv - 28, bv, 49, C.poly()); }, 256, bv);
        pistolGrip(k, -10, 0, C.poly(), 0.3, 108, 34);
        // top-folding stock with the butt hook (folded over the receiver, as usually carried)
        Tb(-290, -80, 56, 5, C.steel(), 8); Tb(-290, -80, 22, 5, C.steel(), 8); Bx(-304, -290, -44, 76, 30, C.steel()); P('spashook', [[-300, -44], [-260, -54], [-250, -46], [-290, -36]], 8, C.steel());
      } else if (s.kind === 'm1014') {
        // semi-auto: fixed fore-end, Picatinny top rail with ghost-ring sights, telescoping stock with a pistol grip
        P('m1014fe', [[140, bv - 30], [380, bv - 30], [388, bv - 14], [388, bv + 4], [140, bv + 6]], 46, C.poly());
        const top = rail(-60, 128, 66, 22);
        if (k.irons) { Bx(-50, -20, top, top + 24, 22, C.black()); Bx(-46, -24, top + 24, top + 34, 6, C.black(), 7); Bx(-46, -24, top + 24, top + 34, 6, C.black(), -7); Ring(-35, top + 26, 4, 4, C.hole()); }
        Bx(fore - 40, fore - 20, bv + 26, bv + 46, 6, C.black()); Bx(fore - 44, fore - 16, bv + 28, bv + 48, 2, C.black(), 6); Bx(fore - 44, fore - 16, bv + 28, bv + 48, 2, C.black(), -6); // ghost ring front post
        pistolGrip(k, -10, 0, C.poly(), 0.32, 112, 34, true);
        Tb(-300, -80, 38, 15, C.black(), 14); P('m1014st', [[-180, 56], [-318, 56], [-322, -60], [-302, -64], [-230, 10], [-180, 24]], 34, C.poly()); Bx(-290, -230, 56, 66, 30, C.poly());
        return { load: 'shells', loadU: 60, loadV: 0, ejU: 45, ejV: 32, ejX: 18, sightV: top + 30, railV: top, opticU: 20, boreV: bv + 16, muzzleU: fore, foreU: 270, hgU0: 140, hgU1: 388, magU: 40, magTop: 0, rear: -322, len: fore + 322, shotgun: true, bodyW: 34 };
      } else {
        // Remington 870: wooden pump with grooves on the tube, wood stock with a straight wrist
        k.part('pump', () => { P('sgpump', [[200, bv - 30], [384, bv - 30], [384, bv + 2], [200, bv + 2]], 46, furn); for (let u = 214; u < 374; u += 12) Bx(u, u + 4, bv - 28, bv - 2, 47, C.woodDark());
        Bx(160, 300, bv - 8, bv - 4, 8, C.steel()); }, 292, bv); // the fore-end and its action bars
        P('sgstock', [[-80, 54], [-180, 42], [-404, 28], [-414, 32], [-414, -88], [-384, -88], [-180, -26], [-80, 6]], 38, furn); Bx(-420, -414, -88, 32, 40, C.poly());
      }
      if (s.optic) rail(-50, 120, 66, 22); // a saddle-mount rail over the receiver for the optic
      Bx(fore - 18, fore - 8, bv + 27, bv + 33, 4, C.brass()); // bead sight
      const rear = s.kind === 'spas12' ? -304 : -420;
      return { load: 'shells', loadU: 60, loadV: 0, ejU: 45, ejV: 32, ejX: 18, sightV: bv + 34, railV: 68, opticU: 20, boreV: bv + 16, muzzleU: fore, foreU: 290, hgU0: 200, hgU1: 384, magU: 40, magTop: 0, rear, len: fore - rear, shotgun: true, bodyW: 34, noRail: s.kind === 'r870' && !s.optic };
    },
    // ---- machine guns
    lmg(it, s, k) {
      const { P, Bx, Tb, Ring, rail, holes, C, body } = k, bv = 40;
      if (s.kind === 'mg42') {
        const bk = body(C.blued());
        P('mg42recv', [[-150, 0], [140, 0], [140, 72], [-130, 72], [-150, 52]], 40, bk); k.part('cover', () => P('mg42cov', [[-60, 72], [130, 72], [130, 84], [-50, 86]], 38, bk), 130, 78);
        Tb(140, 520, bv, 23, bk, 14); for (let u = 160; u < 500; u += 26) { holes(u, u + 14, bv - 6, bv + 6, 22); Bx(u, u + 14, bv + 18, bv + 24, 12, C.hole()); } // perforated jacket
        holes(380, 470, bv - 22, bv - 10, 22, false); // the barrel-change hatch on the right
        const muzzle = 590; Tb(520, muzzle, bv, 9, C.steel(), 12); Tb(muzzle - 24, muzzle + 10, bv, 17, C.blued(), 14); // muzzle booster
        P('mg42stock', [[-150, 52], [-424, 30], [-434, 34], [-434, -62], [-404, -62], [-150, 4]], 32, C.black());
        pistolGrip(k, 10, 0, C.black(), 0.4, 100, 32); trigGuard(k, 20, 80, 0, bk);
        k.part('box', () => { const dr = k.add(cylG(44, 44, 70, 22), C.steel(), 70, -36, -40); dr.rotation.set(0, Math.PI / 2, 0); belt(k, 70, 8, -40, -1, 50); }, 70, 0, -40); // 50-round belt drum on the left
        bipodFolded(k, 480, bv - 20, C.black(), 140); Bx(-40, -20, 72, 98, 12, C.black()); Bx(476, 494, bv + 22, bv + 54, 8, C.black()); // rear and front sights
        return { beltSide: 0, ejU: 40, ejV: 10, ejDown: true, sightV: 96, railV: 84, opticU: 0, boreV: bv, muzzleU: muzzle + 10, foreU: 200, hgU0: 140, hgU1: 500, magU: 80, magTop: 0, rear: -434, len: muzzle + 444, noRail: true, bodyW: 40 };
      }
      if (s.kind === 'bar') {
        P('barrecv', [[-140, 0], [200, 0], [200, 62], [-140, 66]], 34, body(C.blued()));
        holes(-60, 20, 30, 50, 17, false); k.part('charger', () => Bx(0, 40, 0, 10, 10, C.steel(), -18), 0, 5); // ejection port, charging handle (left)
        P('barstock', [[-140, 58], [-444, 30], [-454, 34], [-454, -82], [-424, -82], [-140, 6]], 38, C.wood());
        P('barhg', [[200, 4], [400, 10], [400, 50], [200, 56]], 42, C.wood()); trigGuard(k, 10, 70, 0, C.blued());
        k.part('mag', () => { P('barmag', [[76, 0], [158, 0], [158, -104], [76, -104]], 32, C.blued()); for (let v = -94; v < -10; v += 22) Bx(82, 152, v, v + 4, 33, C.black()); }, 117, 0);
        const muzzle = 720; Tb(400, muzzle, bv, 9, C.blued(), 12); Tb(400, 560, bv + 22, 8, C.blued(), 10); const end = flashCone(k, muzzle, bv, 34, 12, C.blued());
        bipodFolded(k, 680, bv - 12, C.blued(), 200); Bx(-20, 20, 66, 86, 14, C.blued()); Bx(muzzle - 30, muzzle - 10, bv + 10, bv + 34, 6, C.blued());
        return { sightV: 86, railV: 66, opticU: 0, boreV: bv, muzzleU: end, foreU: 300, hgU0: 200, hgU1: 400, magU: 117, magTop: 0, rear: -454, len: end + 454, noRail: true, bodyW: 34, ejU: -20, ejV: 40, chargeTravel: 110, chargeSide: -1 };
      }
      if (s.kind === 'pkm') {
        P('pkmrecv', [[-140, 0], [160, 0], [160, 66], [-140, 66]], 40, body(C.steel())); k.part('cover', () => P('pkmcov', [[-130, 66], [160, 66], [160, 78], [-120, 78]], 38, C.steel()), 160, 72);
        Bx(60, 90, 30, 46, 14, C.steel(), 24); // charging handle (right)
        P('pkmstock', [[-140, 60], [-424, 36], [-434, 40], [-434, -72], [-404, -72], [-324, -40], [-262, -36], [-202, -62], [-172, -62], [-140, 4]], 32, C.wood()); // skeleton
        pistolGrip(k, 20, 0, C.wood(), 0.38, 100, 32); trigGuard(k, 30, 90, 0, C.steel());
        k.part('box', () => { P('pkmbox', [[60, 0], [176, 0], [176, -124], [60, -124]], 74, C.odgreen()); Bx(70, 166, -118, -110, 75, C.black()); belt(k, 118, 0, 30, 1, 46); }, 118, 0); // ammo box, the belt feeding in from the right
        const muzzle = 160 + 560; Tb(160, muzzle, bv, 10, C.steel(), 12); for (let u = 180; u < muzzle - 80; u += 22) Ring(u, bv, 11.5, 6, C.black()); // fluted barrel
        Tb(160, 430, bv - 24, 9, C.steel(), 10); Bx(176, 200, bv + 10, bv + 60, 8, C.steel()); Bx(150, 224, bv + 60, bv + 68, 10, C.wood()); // gas tube, carry handle
        const end = flashCone(k, muzzle, bv, 60, 13); bipodFolded(k, 440, bv - 34, C.steel(), 180); Bx(-10, 30, 78, 94, 14, C.steel()); akFront(k, muzzle - 60, bv);
        let pkTop = 78; if (s.optic) { Bx(-50, 50, 20, 98, 8, C.black(), -25); Bx(-50, 50, 90, 98, 48, C.black(), -5); pkTop = rail(-56, 56, 98, 22); } // side-rail scope mount
        return { beltSide: -1, ejU: 60, ejV: 36, sightV: 94, railV: pkTop, opticU: 0, boreV: bv, muzzleU: end, foreU: 280, hgU0: 160, hgU1: 430, magU: 118, magTop: 0, rear: -434, len: end + 434, sideRail: true, bodyW: 40 };
      }
      // M249 SAW and M60
      const m60 = s.kind === 'm60', bk = body(m60 ? C.park() : C.black());
      P('lmgrecv', [[-160, 0], [170, 0], [170, 72], [-160, 72]], 48, bk);
      k.part('cover', () => P('lmgcover', [[-110, 72], [170, 72], [170, 92], [-90, 98]], 46, bk), 170, 82); // feed tray cover, hinged at its front
      holes(20, 90, 20, 50, 24, false); Bx(60, 100, 30, 44, 14, C.black(), -30); // ejection port, charging handle (left)
      let top = 98; if (!m60) { const cv = k.g.getObjectByName('cover'), n0 = k.g.children.length; top = rail(-80, 160, 98, 22); k.g.children.slice(n0).forEach(m => { m.position.sub(cv.position); cv.add(m); }); } // the rail is on the cover
      k.part('box', () => { P('lmgbox', [[30, 0], [170, 0], [170, -124], [30, -124]], 86, C.odgreen()); Bx(36, 164, -120, -112, 88, C.black()); belt(k, 100, 0, -36, -1, 54); }, 100, 0); // ammo box, belt up into the left of the feed tray
      pistolGrip(k, -10, 0, C.poly(), 0.32, 106, 34); trigGuard(k, 0, 60, 0);
      if (m60) { P('m60stock', [[-160, 66], [-434, 46], [-444, 50], [-444, -72], [-414, -72], [-160, 8]], 40, C.poly()); Tb(170, 430, bv - 6, 20, C.poly(), 14); for (let u = 190; u < 420; u += 24) holes(u, u + 12, bv - 12, bv, 20); }
      else { P('m249stock', [[-160, 66], [-396, 54], [-406, 50], [-406, -68], [-380, -72], [-300, -30], [-230, -20], [-160, 6]], 40, C.poly()); holes(-330, -250, -4, 30, 20); Tb(170, 390, bv - 18, 18, C.poly(), 14); Bx(170, 380, bv + 14, bv + 30, 30, C.black()); for (let u = 180; u < 370; u += 22) Bx(u, u + 10, bv + 14, bv + 30, 31, C.hole()); }
      const muzzle = m60 ? 790 : 730; Tb(170, muzzle, bv, 10, C.steel(), 12); const end = flashCone(k, muzzle, bv, 40, 12);
      Bx(330, 350, bv + 14, bv + 72, 10, C.black()); Bx(290, 390, bv + 72, bv + 82, 16, C.black()); // carry handle on the barrel
      bipodFolded(k, muzzle - 110, bv - 16, C.black(), 220); Bx(muzzle - 30, muzzle - 15, bv + 10, bv + 38, 6, C.black());
      return { opticOnCover: !m60, beltSide: 1, ejU: 55, ejV: 35, sightV: m60 ? 104 : top + 18, railV: m60 ? 98 : top, opticU: 20, boreV: bv, muzzleU: end, foreU: 280, hgU0: 170, hgU1: 400, magU: 100, magTop: 0, rear: m60 ? -444 : -406, len: end + (m60 ? 444 : 406), noRail: m60, bodyW: 48 };
    },
    // ---- submachine guns
    smg(it, s, k) {
      const { P, Bx, Tb, Ring, rail, holes, C, body } = k;
      switch (s.kind) {
        case 'mp5': {
          const bk = body(C.black());
          P('mp5recv', [[-100, 0], [150, 0], [150, 50], [-100, 54], [-110, 40]], 30, bk); Tb(-110, 150, 46, 15, bk, 12);
          P('mp5hg', [[150, 0], [270, 6], [276, 30], [270, 48], [150, 50]], 40, C.poly());
          Tb(150, 230, 64, 6, C.black(), 8); Ring(-80, 60, 12, 18, C.black()); P('mp5hood', [[228, 46], [262, 46], [276, 64], [250, 64]], 14, C.black()); const hood = k.add(new THREE.TorusGeometry(11 * S, 2.6 * S, 6, 18), C.black(), 262, 76); hood.rotation.x = -0.32; Bx(258, 262, 62, 78, 3, C.black()); // forward-raked front sight hood around the post
          holes(-20, 40, 28, 42, 15, false); k.part('charger', () => Bx(150, 200, 58, 70, 6, C.black(), -10), 0, 64); // ejection port, cocking handle (left, in its tube)
          const muzzle = 310; Tb(270, muzzle, 30, 8, C.steel(), 10); Tb(muzzle - 6, muzzle + 8, 30, 10, C.black(), 10);
          P('mp5low', [[-40, 0], [60, 0], [60, -20], [-40, -20]], 26, C.poly()); P('mp5grip', [[-30, -18], [10, -18], [-12, -105], [-46, -100]], 28, C.poly()); trigGuard(k, -10, 50, -18, C.poly());
          curvedMag(k, 'mp5mag', 90, 0, 42, 190 * (s.magMul || 1), 0.5, 22, C.black());
          Tb(-280, -100, 30, 5, C.steel(), 8); Tb(-280, -100, 60, 5, C.steel(), 8); Bx(-300, -280, -30, 70, 34, C.black());
          return { sightV: 76, railV: 64, opticU: 10, boreV: 30, muzzleU: muzzle + 8, foreU: 210, hgU0: 150, hgU1: 270, magU: 90, magTop: 0, rear: -300, len: muzzle + 308, bodyW: 30, ejU: 10, ejV: 35, chargeTravel: 90, chargeSide: -1, hkSlap: true };
        }
        case 'uzi': {
          const bk = body(C.park());
          P('uzibody', [[-110, -10], [190, -10], [190, 60], [-110, 60]], 46, bk); Bx(-60, 150, 60, 68, 12, C.black()); k.part('charger', () => Bx(-40, 30, 60, 70, 10, C.black()), 0, 65); // top cover, cocking knob
          for (let u = -80; u < 170; u += 30) Bx(u, u + 14, 6, 50, 1, C.black(), 23.4); // pressed ribs
          P('uzigrip', [[-10, -10], [50, -10], [40, -140], [-20, -140]], 34, C.poly()); if (k.drum) drum(k, 18, -140); else k.part('mag', () => P('uzimag', [[0, -140], [36, -140], [36, -190], [0, -190]], 24, C.black()), 18, -140); trigGuard(k, 40, 110, -10, bk);
          Bx(-12, 4, -100, -40, 8, C.steel(), -18); // grip safety
          const muzzle = 260; Tb(190, muzzle, 28, 10, C.steel(), 10); Ring(200, 28, 14, 14, C.black()); Bx(150, 170, 60, 84, 14, C.black()); Bx(-80, -60, 60, 82, 14, C.black());
          Tb(-330, -110, 50, 4, C.steel(), 6); Tb(-330, -110, 0, 4, C.steel(), 6); Bx(-340, -320, -20, 60, 40, C.steel());
          return { sightV: 84, railV: 70, opticU: 20, boreV: 28, muzzleU: muzzle, foreU: 140, hgU0: 100, hgU1: 190, magU: 18, magTop: -140, rear: -340, len: muzzle + 340, gripMag: true, bodyW: 46, ejU: 40, ejV: 40, chargeTravel: 90, chargeSide: 0 };
        }
        case 'mp7': {
          const bk = body(C.black());
          P('mp7body', [[-100, 0], [200, 0], [220, 30], [200, 60], [-100, 60]], 42, bk); const top = rail(-100, 190, 60, 22);
          holes(-20, 40, 24, 40, 21, false);
          P('mp7grip', [[-10, 0], [44, 0], [34, -170], [-24, -165]], 32, C.poly()); if (k.drum) drum(k, 17, -170); else k.part('mag', () => P('mp7mag', [[0, -170], [34, -170], [34, -200], [0, -200]], 26, C.black()), 17, -170);
          P('mp7fg', [[150, 0], [180, 0], [176, -80], [150, -80]], 22, C.poly()); trigGuard(k, 40, 100, 0, bk);
          const muzzle = 300; Tb(220, muzzle, 32, 7, C.steel(), 10); Tb(-240, -100, 40, 6, C.black(), 8); Tb(-240, -100, 20, 6, C.black(), 8); Bx(-260, -240, -20, 60, 34, C.black());
          if (k.irons) { buisFront(k, 176, top); buisRear(k, -80, top); }
          return { sightV: top + 30, railV: top, opticU: 20, boreV: 32, muzzleU: muzzle, foreU: 163, foreV: -40, hgU0: 140, hgU1: 220, magU: 17, magTop: -170, rear: -260, len: muzzle + 260, gripMag: true, foreVert: true, bodyW: 42, ejU: 10, ejV: 32 };
        }
        case 'p90': {
          // bullpup: the 50-round translucent magazine on top, the ring sight above the muzzle, the grip with its
          // thumbhole under the body, the stock is the rear of the body
          const bk = body(C.black());
          P('p90body', [[-300, -40], [-290, -64], [-150, -64], [-130, -20], [110, -20], [190, 6], [220, 26], [220, 58], [-300, 64]], 58, bk);
          P('p90grip', [[-130, -20], [-50, -20], [-62, -130], [-112, -136], [-150, -64]], 50, bk); // pistol grip behind the trigger
          P('p90front', [[20, -20], [80, -20], [74, -120], [36, -126], [10, -80]], 50, bk); // front of the thumbhole (hand stop)
          P('p90bar', [[-64, -120], [40, -120], [40, -134], [-70, -134]], 40, bk); // bottom of the thumbhole loop
          k.part('mag', () => { Bx(-280, 150, 58, 76, 50, C.smoke()); Bx(-284, -270, 56, 78, 52, C.black()); }, -60, 58); // magazine on top
          let p90Top = 86;
          if (s.optic) { Bx(-60, -40, 76, 92, 20, C.black()); Bx(150, 170, 76, 92, 20, C.black()); p90Top = rail(-70, 180, 92, 22); } // P90 TR rail
          else { const p90r = Ring(170, 98, 18, 24, C.black()); Bx(150, 190, 72, 86, 22, C.black()); k.lens(183, 98, 14, 0, false, p90r); k.lens(157, 98, 14, 0, true, p90r); } // reflex ring sight
          const muzzle = 262; Tb(220, muzzle, 30, 9, C.black(), 12); holes(230, 258, 26, 34, 9);
          return { sightV: s.optic ? p90Top + 30 : 98, railV: p90Top, opticU: s.optic ? 60 : 170, boreV: 30, muzzleU: muzzle, foreU: 50, foreV: -70, hgU0: 0, hgU1: 220, magU: -100, magTop: 64, rear: -300, len: muzzle + 300, topMag: true, integratedOptic: !s.optic, foreVert: true, bodyW: 56 };
        }
        case 'vector': {
          const bk = body(C.black());
          P('vecbody', [[-120, 0], [210, 0], [230, 50], [-120, 60]], 40, bk); const top = rail(-110, 200, 60, 22);
          // the angled lower housing (the Super-V recoil system) in front of the magazine
          P('veclow', [[112, 0], [232, 0], [228, -30], [176, -120], [122, -128], [112, -60]], 36, bk);
          P('vecgrip', [[-10, 0], [40, 0], [22, -110], [-24, -104]], 30, C.poly()); if (k.drum) drum(k, 91, -20); else k.part('mag', () => P('vecmag', [[72, 0], [110, 0], [110, -200], [74, -200]], 24, C.black()), 91, 0);
          if (!k.drum) Bx(66, 116, -46, 0, 32, bk); // the magwell trigGuard(k, 14, 66, 0, bk);
          const muzzle = 300; Tb(220, muzzle, 30, 8, C.steel(), 10); Tb(-300, -120, 40, 12, C.black(), 10); P('vecstock', [[-200, 60], [-300, 60], [-305, -40], [-288, -44], [-240, 10], [-200, 20]], 28, C.poly());
          if (k.irons) { buisFront(k, 186, top); buisRear(k, -96, top); }
          return { sightV: top + 30, railV: top, opticU: 20, boreV: 30, muzzleU: muzzle, foreU: 160, hgU0: 120, hgU1: 220, magU: 80, magTop: -50, rear: -305, len: muzzle + 305, bodyW: 40, wellView: true, ejU: 40, ejV: 42 };
        }
        case 'ump': {
          const bk = body(C.black());
          P('umpbody', [[-110, -4], [190, -4], [210, 20], [210, 52], [-110, 56]], 42, bk); const top = rail(-100, 180, 56, 22);
          P('umpgrip', [[-10, -4], [40, -4], [22, -110], [-26, -104]], 30, C.poly()); trigGuard(k, 16, 66, -4, bk);
          if (k.drum) drum(k, 95, -4); else k.part('mag', () => P('umpmag', [[70, -4], [118, -4], [124, -170], [74, -172]], 26, C.black()), 95, -4);
          for (let u = 120; u < 200; u += 18) holes(u, u + 9, 8, 40, 21);
          k.part('charger', () => Bx(140, 190, 44, 54, 8, C.black(), -14), 0, 49); // cocking handle (left)
          const muzzle = 300; Tb(210, muzzle, 30, 8, C.steel(), 10); Tb(muzzle - 4, muzzle + 10, 30, 11, C.black(), 10);
          Tb(-300, -110, 40, 6, C.black(), 8); P('umpstock', [[-200, 54], [-300, 54], [-305, -40], [-288, -44], [-240, 6], [-200, 16]], 26, C.poly());
          if (k.irons) { Bx(176, 190, top, top + 28, 12, C.black()); Ring(-80, top + 16, 10, 16, C.black()); }
          return { sightV: top + 22, railV: top, opticU: 20, boreV: 30, muzzleU: muzzle + 10, foreU: 160, hgU0: 120, hgU1: 210, magU: 95, magTop: -4, rear: -305, len: muzzle + 315, bodyW: 42, ejU: 30, ejV: 36, chargeTravel: 80, chargeSide: -1, hkSlap: true };
        }
        case 'thompson': {
          P('tmprecv', [[-100, 0], [160, 0], [160, 56], [-90, 60], [-100, 40]], 34, body(C.blued()));
          k.part('charger', () => { Bx(-20, 40, 56, 66, 10, C.steel()); Ring(40, 70, 6, 10, C.steel()); }, 0, 62); // actuator knob on top
          P('tmpstock', [[-100, 50], [-360, 30], [-370, 34], [-370, -76], [-340, -76], [-100, 4]], 34, C.wood()); P('tmpgrip', [[-20, 0], [20, 0], [4, -95], [-34, -90]], 30, C.wood()); trigGuard(k, 10, 70, 0, C.blued());
          P('tmpfg', [[200, 0], [240, 0], [236, -100], [204, -96]], 30, C.wood());
          k.part('mag', () => { const dr = k.add(cylG(56, 56, 40, 24), C.blued(), 136, -62); dr.rotation.set(0, Math.PI / 2, 0); Ring(136, -62, 12, 44, C.steel()); }, 136, 0);
          const muzzle = 160 + 270; Tb(160, muzzle, 30, 11, C.blued(), 10); for (let u = 170; u < 290; u += 12) Ring(u, 30, 15, 5, C.blued());
          Bx(muzzle - 50, muzzle, 20, 40, 24, C.blued()); for (let u = muzzle - 44; u < muzzle - 6; u += 10) Bx(u, u + 5, 34, 42, 16, C.hole()); // Cutts compensator
          Bx(-70, -44, 60, 84, 16, C.blued()); Bx(muzzle - 70, muzzle - 62, 40, 54, 3, C.blued());
          return { sightV: 80, railV: 60, opticU: 0, boreV: 30, muzzleU: muzzle, foreU: 220, foreV: -50, hgU0: 160, hgU1: 280, magU: 136, magTop: 0, rear: -370, len: muzzle + 370, ejU: 40, ejV: 40, foreVert: true, noRail: true, drumMag: true, sideMag: true, bodyW: 34, chargeTravel: 100, chargeSide: 0 };
        }
        case 'mp40': {
          const bk = body(C.blued());
          Tb(-100, 200, 40, 20, bk, 16); P('mp40low', [[-60, 20], [130, 20], [130, -10], [-60, -10]], 34, C.poly());
          for (let u = -80; u < 180; u += 20) Bx(u, u + 10, 30, 50, 41, C.black()); // ribbed receiver tube
          P('mp40grip', [[-30, -8], [16, -8], [0, -100], [-40, -96]], 28, C.poly());
          if (k.drum) drum(k, 140, -30); else k.part('mag', () => P('mp40mag', [[120, 0], [160, 0], [160, -220], [124, -220]], 22, C.blued()), 140, 0); P('mp40well', [[110, 20], [170, 20], [170, -30], [110, -30]], 28, bk);
          const muzzle = 200 + 220; Tb(200, muzzle, 30, 9, C.blued(), 10); Bx(muzzle - 40, muzzle - 30, 0, 26, 30, C.black());
          Tb(-280, -60, 34, 5, C.steel(), 8); Tb(-280, -60, 4, 5, C.steel(), 8); Bx(-300, -280, -20, 50, 30, C.steel()); Ring(muzzle - 20, 54, 6, 16, C.blued());
          Bx(-60, -40, 60, 72, 12, C.blued()); k.part('charger', () => Bx(-60, -40, 30, 44, 12, C.blued(), -24), 0, 37); // rear sight; bolt handle (left)
          return { sightV: 64, railV: 60, opticU: 0, boreV: 30, muzzleU: muzzle, foreU: 140, hgU0: 120, hgU1: 200, magU: 140, magTop: 0, rear: -300, len: muzzle + 300, magFore: true, noRail: true, bodyW: 40, ejU: 90, ejV: 42, chargeTravel: 110, chargeSide: -1 };
        }
        case 'sten': {
          const st = body(C.steel());
          Tb(-120, 220, 40, 18, st, 14); Tb(220, 300, 40, 14, st, 12); for (let u = 230; u < 296; u += 12) holes(u, u + 6, 36, 44, 14);
          k.part('mag', () => k.add(boxG(36, 22, 190), C.black(), 130, 40, -110), 130, 40, -20); // side magazine (left)
          P('stentg', [[-40, 22], [40, 22], [30, -14], [-40, -14]], 8, st); Tb(-330, -120, 40, 6, st, 8); Tb(-330, -120, 6, 5, st, 8).rotation.set(-0.16, 0, 0); Bx(-340, -320, -20, 60, 30, st);
          const muzzle = 380; Tb(300, muzzle, 40, 8, st, 10); Bx(muzzle - 10, muzzle, 58, 72, 4, st); Bx(-60, -40, 58, 70, 10, st); k.part('charger', () => Bx(-60, -40, 34, 46, 10, st, -24), 0, 40); // bolt handle (left)
          return { sightV: 72, railV: 58, opticU: 0, boreV: 40, muzzleU: muzzle, foreU: 260, hgU0: 220, hgU1: 300, magU: 130, magTop: 30, rear: -340, len: muzzle + 340, sideMag: true, noRail: true, bodyW: 36, ejU: 130, ejV: 44, chargeTravel: 110, chargeSide: -1 };
        }
      }
      return BUILDERS.generic(it, s, k);
    },
    // ---- handguns (u = 0 at the top front of the grip, v = 0 at the top of the frame)
    pistol(it, s, k) {
      const { P, Bx, Tb, Ring, holes, C, body } = k, kind = s.kind, len = s.len || 200, rear = -(s.back || 45), front = rear + len;
      const slideM = body(['glock', 'glock18', 'p226', 'fn57'].includes(kind) ? C.black() : kind === 'deagle' ? C.steel() : C.blued());
      const gripM = s.woodGrip ? C.wood() : C.poly(), frameM = ['glock', 'glock18', 'fn57'].includes(kind) ? C.poly() : slideM;
      const mag = s.magMul && s.magMul > 1;
      if (s.revolver) {
        const bv = 30, cyl0 = 8, cyl1 = cyl0 + 42, br = s.barrel || 150, R = 19, cv = bv - 9, top = cv + R;
        P('rvframe', [[-30, -6], [cyl0, -6], [cyl0, top + 6], [cyl0 - 6, top + 6], [-20, bv + 12], [-34, 6]], 22, slideM); // grip frame and recoil shield
        Bx(cyl0 - 1, cyl1 + 8, top + 1, top + 6, 16, slideM); Bx(cyl0 - 1, cyl1 + 8, -6, cv - R - 1, 16, slideM); Bx(cyl1, cyl1 + 8, -6, top + 6, 18, slideM); // top strap, bottom strap, front
        const nCh = it.mag || 6, cu = (cyl0 + cyl1) / 2, hx = -9, hv = cv - 15; // crane hinge pin: low on the left
        const cylinder = () => {
          Tb(cyl0, cyl1, cv, R, C.steel(), 6);
          for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; k.add(cylG(3, 3, 30, 6), C.black(), cu, cv + Math.sin(a) * R, Math.cos(a) * R); }
          for (let i = 0; i < nCh; i++) { const a = Math.PI / 2 + i / nCh * Math.PI * 2; k.round(cyl0 - 1.5, cyl0 + 0.5, cv + Math.sin(a) * 11, Math.cos(a) * 11, 5); } // cartridge heads (the first at the top, under the bore)
        };
        if (s.gate) {
          k.part('cyl', cylinder, cu, cv);
          k.part('gate', () => Bx(cyl0 - 6, cyl0 - 1, cv - 8, cv + 8, 4, slideM, 13), cyl0 - 3, cv - 8, 13); // loading gate (right), hinged at its foot
          k.part('ejrod', () => { Tb(cyl1 + 8, cyl1 + 80, cv, 2.5, C.steel(), 8); Ring(cyl1 + 80, cv, 4, 6, C.steel()); }, cyl1 + 8, cv); // ejector rod, stowed under the barrel
        } else k.part('cyl', () => {
          cylinder();
          Tb(cyl0, cyl1 + 6, hv, 3.5, C.steel(), 8).position.x = hx * S; // the crane's hinge tube
          const arm = k.add(boxG(6, 18, 6), C.steel(), cyl1 + 3, (cv + hv) / 2, hx / 2); arm.rotation.z = Math.atan2(hx, cv - hv); // crane arm to the cylinder
          const rod = Tb(cyl1, cyl1 + Math.min(70, br * 0.5), cv, 3, C.steel(), 8); rod.name = 'ejrod'; // ejector rod (under the barrel)
        }, cu, hv, hx);
        Tb(cyl1, cyl1 + br, bv + 2, s.heavy ? 9 : 6.5, slideM, 12);
        if (s.rib) { Bx(cyl1, cyl1 + br, bv + 9, bv + 18, 8, slideM); for (let u = cyl1 + 8; u < cyl1 + br - 10; u += 16) Bx(u, u + 8, bv + 10, bv + 16, 9, C.hole()); }
        if (s.lug) Bx(cyl1, cyl1 + br, bv - 12, bv + 2, 13, slideM);
        Bx(cyl1 + br - 14, cyl1 + br - 4, bv + 10, bv + 24, 3, slideM); Bx(-24, -10, bv + 14, bv + 28, 8, C.steel());
        P('rvgrip', [[-30, 6], [8, -6], [-4, -94], [-46, -88], [-48, -20]], 30, s.woodGrip === false ? C.poly() : C.wood());
        trigGuard(k, -4, 40, -6, slideM);
        return { sightV: bv + 22, railV: bv + 18, opticU: 0, boreV: bv + 2, muzzleU: cyl1 + br, foreU: 10, hgU0: cyl1, hgU1: cyl1 + br, magU: 0, magTop: 0, rear: -50, len: cyl1 + br + 50, scale: 1.4, noRail: true, load: s.gate ? 'gate' : 'cylinder', loadU: cyl0, loadV: cv };
      }
      const sh = s.slideH || 30, bv = sh * 0.55;
      if (kind === 'luger') {
        Tb(10, front, bv, 7, C.blued(), 12);
        P('lugrecv', [[rear + 30, 0], [70, 0], [70, 26], [rear + 30, 26]], 22, slideM);
        Tb(rear, 40, 34, 8, C.blued(), 10); k.add(new THREE.SphereGeometry(10 * S, 10, 8), C.blued(), rear + 10, 36, 7); k.add(new THREE.SphereGeometry(10 * S, 10, 8), C.blued(), rear + 10, 36, -7);
        P('luggrip', [[rear + 30, 0], [30, 0], [-4, -100], [-48, -94]], 30, C.wood()); trigGuard(k, 20, 76, 0, slideM);
        k.part('mag', () => { P('lugmag', [[rear + 34, -6], [24, -6], [-6, -98], [-44, -92]], 22, C.blued()); Bx(-50, -2, -106, -96, 26, C.wood()); }, 0, 0); // magazine with its wooden base knob
        Bx(front - 10, front, bv + 7, bv + 14, 3, C.blued());
        return { sightV: bv + 16, railV: 30, opticU: 10, boreV: bv, muzzleU: front, foreU: 10, hgU0: 40, hgU1: front, magU: -10, magTop: 0, rear, len, scale: 1.4, noRail: true, magDir: [-0.32, -1] };
      }
      // slide (open-top on the M9 and P38 shows the barrel), frame with its dust cover, grip, trigger guard
      const slideStart = k.g.children.length;
      if (s.openTop) { P('slide', [[rear, 0], [front, 0], [front, sh - 9], [front - len * 0.45, sh - 9], [front - len * 0.5, sh], [rear, sh]], 26, slideM); }
      else if (kind === 'deagle') { P('slide', [[rear, 0], [front, 0], [front, sh], [rear + 20, sh + 2], [rear, sh - 6]], 30, slideM); P('dtri', [[front - len * 0.62, sh - 2], [front, sh - 2], [front, sh + 8], [front - len * 0.62, sh + 8]], 18, slideM); }
      else P('slide', [[rear, 0], [front, 0], [front, sh - (kind === 'makarov' ? 8 : 3)], [front - 8, sh], [rear + 6, sh], [rear, sh - (kind === 'makarov' ? 8 : 2)]], kind === 'm1911' || kind === 'makarov' || kind === 'cz' ? 22 : 26, slideM);
      for (let u = rear + 6; u < rear + 36; u += 7) Bx(u, u + 3, 4, sh - 4, kind === 'm1911' || kind === 'cz' ? 23 : 27, C.black()); // rear serrations
      holes(rear + len * 0.45, rear + len * 0.7, sh - 12, sh - 2, 13, false); // ejection port
      if (kind === 'glock18') for (let u = front - 40; u < front - 8; u += 10) Bx(u, u + 5, sh - 2, sh + 1, 10, C.black());
      Bx(front - 14, front - 6, sh, sh + 7, 4, C.black()); Bx(rear + 4, rear + 14, sh, sh + 7, 16, C.black()); Bx(rear + 7, rear + 11, sh + 2, sh + 7, 3, C.hole()); // sights
      if (kind === 'glock18') Bx(rear + 8, rear + 18, sh - 6, sh - 2, 4, C.steel(), 14);
      { const sl = new THREE.Group(); sl.name = 'slide'; k.g.children.slice(slideStart).forEach(m => sl.add(m)); Tb(rear + 34, front - 2, bv + 3, s.openTop ? 7 : 5.5, C.steel(), 12); /* the barrel stays put when the slide runs back */ k.g.add(sl); } // everything on the slide moves with it
      P('frame', [[rear + 10, 0], [front - 12, 0], [front - 12, -12], [62, -14], [rear + 10, -10]], kind === 'm1911' ? 21 : 25, frameM);
      if (s.rail) for (let u = 64; u < front - 18; u += 10) Bx(u, u + 5, -18, -12, 20, C.black());
      const rk = s.rake || 0.22;
      P('pgrip', [[rear + 12, 0], [24, 0], [16 - rk * 102, -102], [rear + 10 - rk * 102, -98], [rear + 6, -30]], kind === 'm1911' ? 27 : 29, gripM);
      for (let v = -20; v > -90; v -= 12) Bx(rear + 14 - rk * -v, 18 - rk * -v, v, v + 4, (kind === 'm1911' ? 28 : 30), kind === 'glock' || kind === 'glock18' ? C.black() : gripM); // grip texture / finger lines
      // the magazine inside the grip (base plate just below it); an extended one sticks out further, following the rake
      const mb = mag ? 142 : 104;
      k.part('mag', () => { P('pxmag' + mb, [[rear + 14, -4], [20, -4], [16 - rk * mb, -mb + 4], [rear + 12 - rk * mb, -mb + 2]], 22, C.black()); P('pxbase' + mb, [[rear + 8 - rk * mb, -mb + 4], [18 - rk * mb, -mb + 6], [18 - rk * mb, -mb - 2], [rear + 8 - rk * mb, -mb - 4]], 28, C.black()); }, 0, 0);
      trigGuard(k, 20, ['glock', 'glock18', 'p226', 'fn57'].includes(kind) ? 78 : 72, 0, frameM);
      if (s.hammer) Bx(rear - 6, rear + 6, sh - 10, sh + 6, 8, C.steel());
      Tb(front - 4, front + 2, bv + 2, 6, C.black(), 10); Ring(front + 1, bv + 2, 3.5, 2, C.hole());
      return { sightV: sh + 7, railV: sh, opticU: 0, boreV: bv + 2, muzzleU: front + 2, foreU: 10, hgU0: 60, hgU1: front, magU: -10, magTop: 0, rear, len: len + 2, scale: 1.4, magDir: [-rk, -1], slideTravel: Math.min(70, len * 0.32) };
    },
    // anything else (fallback): a plain rifle
    generic(it, s, k) {
      const { P, Bx, Tb, C, body } = k, L = Math.max(10, Art.weaponLen(it)) * 26;
      P('gen', [[-L * 0.35, 0], [L * 0.2, 0], [L * 0.2, 50], [-L * 0.35, 50]], 30, body(C.black()));
      Tb(L * 0.2, L * 0.65, 30, 9, C.steel()); pistolGrip(k, 0, 0, C.poly(), 0.3, 100); trigGuard(k, 10, 70, 0);
      return { sightV: 60, railV: 50, opticU: 0, boreV: 30, muzzleU: L * 0.65, foreU: L * 0.35, hgU0: L * 0.2, hgU1: L * 0.5, magU: 60, magTop: 0, rear: -L * 0.35, len: L };
    },
  };
  // which builder and options each gun uses (lengths in mm from the real guns)
  const SPEC = {
    m4: { f: 'ar', hg: 'round', hgLen: 175, barrel: 150, stock: 'collapsible' },
    hk416: { f: 'ar', hg: 'quad', hgLen: 230, barrel: 120, stock: 'crane', fsb: false, hkfh: true },
    m16: { f: 'ar', hg: 'round', hgLen: 290, barrel: 200, stock: 'fixed', carry: true },
    hk417: { f: 'ar', hg: 'quad', hgLen: 270, barrel: 150, stock: 'crane', fsb: false, hkfh: true, ar10: true, magLen: 150, magDepth: 72 },
    ak47: { f: 'ak', curve: 0.42, hgLen: 225, barrel: 165 },
    rpk: { f: 'ak', curve: 0.36, magLen: 250, hgLen: 225, barrel: 330, stock: 'club', bipod: true },
    ak12: { f: 'ak', poly: true, mag: 'poly', curve: 0.3, hgLen: 235, barrel: 150, stock: 'fold', muzzle: 'ak12' },
    galil: { f: 'ak', poly: true, mag: 'black', curve: 0.28, hgLen: 225, barrel: 160, stock: 'fold', muzzle: 'slant' },
    g36: { f: 'g36' }, scar: { f: 'scar' },
    famas: { f: 'bullpup', kind: 'famas' }, aug: { f: 'bullpup', kind: 'aug' },
    stg44: { f: 'stg' },
    mosin: { f: 'wood', load: 'stripper', manual: 'bolt', boltLift: 1.5, boltTravel: 92, bolt: 'straight', fore: 600, barrel: 250, dark: true, hex: true, rod: true, fsight: 'hood', bands: [580, 420], upper: true, upper0: 200, upper1: 470 },
    k98k: { f: 'wood', load: 'stripper', manual: 'bolt', boltLift: 1.5, boltTravel: 88, bolt: 'down', fore: 520, barrel: 220, upper: true, upper0: 190, upper1: 330, rod: true, fsight: 'hood', pistolWrist: true, bands: [500, 360] },
    enfield: { f: 'wood', load: 'stripper', manual: 'bolt', boltLift: 1.05, boltTravel: 86, bolt: 'enfield', fore: 560, barrel: 70, upper: true, upper0: 180, upper1: 540, mag: true, nose: true, rsight: 'aperture', bands: [380], red: true },
    garand: { f: 'wood', load: 'enbloc', boltTravel: 90, fore: 500, barrel: 230, upper: true, upper0: 160, upper1: 470, rsight: 'aperture', oprod: true, gascyl: true, pistolWrist: true, bands: [470] },
    m14: { f: 'wood', fore: 500, barrel: 200, upper: true, upper0: 160, upper1: 330, mag: true, magLong: 20, rsight: 'aperture', oprod: true, gascyl: true, flash: true, pistolWrist: true, bands: [480] },
    svt40: { f: 'wood', load: 'stripper', svtBolt: true, boltTravel: 90, fore: 430, barrel: 230, upper: true, upper0: 160, upper1: 400, mag: true, dark: true, brake: true, rod: true, fsight: 'hood', bands: [400, 260] },
    m24: { f: 'sniper', kind: 'm24', barrel: 400, load: 'single', manual: 'bolt', boltLift: 1.5, boltTravel: 84 }, awm: { f: 'sniper', kind: 'awm', barrel: 360, manual: 'bolt', boltLift: 1.05, boltTravel: 96 }, l96: { f: 'sniper', kind: 'l96', barrel: 380, manual: 'bolt', boltLift: 1.05, boltTravel: 88 },
    svd: { f: 'sniper', kind: 'svd', barrel: 180 }, mk14: { f: 'sniper', kind: 'mk14', barrel: 150 },
    m82: { f: 'm82' },
    r870: { f: 'shotgun', kind: 'r870', barrel: 470, manual: 'pump', pumpTravel: 96 }, spas12: { f: 'shotgun', kind: 'spas12', barrel: 400, manual: 'pump', pumpTravel: 90 }, m1014: { f: 'shotgun', kind: 'm1014', barrel: 420 }, aa12: { f: 'shotgun', kind: 'aa12' }, ksg: { f: 'shotgun', kind: 'ksg', manual: 'pump', pumpTravel: 100 },
    m249: { f: 'lmg', kind: 'm249' }, m60: { f: 'lmg', kind: 'm60' }, pkm: { f: 'lmg', kind: 'pkm' }, mg42: { f: 'lmg', kind: 'mg42' }, bar: { f: 'lmg', kind: 'bar' },
    mp5: { f: 'smg', kind: 'mp5' }, uzi: { f: 'smg', kind: 'uzi' }, mp7: { f: 'smg', kind: 'mp7' }, p90: { f: 'smg', kind: 'p90' }, vector: { f: 'smg', kind: 'vector' },
    ump45: { f: 'smg', kind: 'ump' }, thompson: { f: 'smg', kind: 'thompson' }, mp40: { f: 'smg', kind: 'mp40' }, sten: { f: 'smg', kind: 'sten' },
    glock20: { f: 'pistol', kind: 'glock', len: 207, rail: true }, glock18: { f: 'pistol', kind: 'glock18', len: 186, rail: true },
    m9: { f: 'pistol', kind: 'm9', len: 217, openTop: true, hammer: true, slideH: 32 }, p38: { f: 'pistol', kind: 'p38', len: 216, openTop: true, hammer: true, woodGrip: true, slideH: 30 },
    m1911: { f: 'pistol', kind: 'm1911', len: 216, hammer: true, woodGrip: true, rake: 0.18, slideH: 29 }, p226: { f: 'pistol', kind: 'p226', len: 196, hammer: true, rail: true, slideH: 33 },
    deagle: { f: 'pistol', kind: 'deagle', len: 270, slideH: 38, back: 55 }, makarov: { f: 'pistol', kind: 'makarov', len: 161, hammer: true, slideH: 27, rake: 0.16 },
    luger: { f: 'pistol', kind: 'luger', len: 222 },
    cz75: { f: 'pistol', kind: 'cz', len: 206, hammer: true, slideH: 28 }, fiveseven: { f: 'pistol', kind: 'fn57', len: 208, rail: true, slideH: 33 },
    python: { f: 'pistol', revolver: true, barrel: 150, rib: true, lug: true, heavy: true }, mod29: { f: 'pistol', revolver: true, barrel: 200, heavy: true }, nagant: { f: 'pistol', revolver: true, barrel: 115, woodGrip: false, gate: true },
  };
  // stand-alone optics for the optic attachments, built in mm like the guns. Each returns a group in model units
  // (before the gun's game scaling) with the mount's base at v = 0, centred on u = 0, and axis = the height of the
  // optic's sight line above its base (mm)
  function miniK() {
    const g = new THREE.Group();
    const add = (geo, m, u, v, x) => { const me = new THREE.Mesh(geo, m); me.position.set((x || 0) * S, (v || 0) * S, -(u || 0) * S); g.add(me); return me; };
    return { g, add, C,
      P: (key, pts, w, m, x) => add(prof('opt' + key, pts, w), m, 0, 0, x),
      Lt: (key, u0, pts, v, m, x, seg) => add(latheG(key, pts, seg), m, u0, v, x),
      Tb: (u0, u1, v, r, m, seg, r1) => add(cylG(r, r1 === undefined ? r : r1, u1 - u0, seg), m, (u0 + u1) / 2, v),
      Ring: (u, v, r, l, m) => add(cylG(r, r, l, 16), m, u, v),
      Bx: (u0, u1, v0, v1, w, m, x) => add(boxG(u1 - u0, v1 - v0, w), m, (u0 + u1) / 2, (v0 + v1) / 2, x),
      seat: (parent, glassMesh) => { g.updateMatrixWorld(true); parent.attach(glassMesh); glassMesh.position.x = 0; return glassMesh; },
      lens(u, v, r, x, back, parent) { const me = add(new THREE.CircleGeometry(r * S, 20), C.glass(), u + (back ? -0.4 : 0.4), v, x); me.rotation.y = back ? 0 : Math.PI; return parent ? this.seat(parent, me) : me; } };
  }
  const OPTICS = {
    // Trijicon/Leupold-style riflescope on rings (the 8x sniper scope)
    sniper8(k) { scope(k, -165, 165, 34, 15, 26, 0); return 34; },
    // Aimpoint CompM4: a 30 mm tube with front and rear hoods, windage/elevation caps, on a LaRue-style riser mount
    reddot(k) {
      const { C, Bx, Lt, Ring } = k, ax = 42;
      Bx(-28, 28, 0, 8, 26, C.black()); Bx(-20, 20, 8, ax - 14, 16, C.black()); Ring(0, ax, 23, 30, C.black()); // clamp, riser, ring
      const cm4 = Lt('cm4', -62, [[0, 21], [6, 22], [22, 22], [26, 19], [96, 19], [100, 22], [124, 23]], ax, C.black(), 0, 24);
      const e = k.add(cylG(8, 8, 14, 12), C.black(), 0, ax + 24); e.rotation.x = Math.PI / 2; // elevation cap
      const w = k.add(cylG(8, 8, 14, 12), C.black(), 0, ax, 24); w.rotation.y = Math.PI / 2; // windage cap
      k.lens(-62, ax, 18, 0, true, cm4); k.lens(61, ax, 19, 0, false, cm4);
      return ax;
    },
    // EOTech EXPS3: base with the battery compartment and buttons at the back, open hood over the window
    holo(k) {
      const { C, Bx } = k, ax = 40;
      Bx(-50, 50, 0, 18, 40, C.black()); Bx(-50, -14, 18, 34, 36, C.black()); // base, battery and button housing
      Bx(-14, 46, 18, 64, 5, C.black(), 18); Bx(-14, 46, 18, 64, 5, C.black(), -18); const hood = Bx(-14, 46, 60, 66, 41, C.black()); // hood
      k.seat(hood, Bx(28, 30, 20, 60, 30, C.glass())); // the window
      return ax;
    },
    // Trijicon ACOG TA31: forged body tapering from the eyepiece to the objective, fibre-optic housing on top with the
    // backup ghost sight, on its flat-top base
    acog(k) {
      const { C, Bx, Lt } = k, ax = 34;
      Bx(-40, 40, 0, 12, 26, C.black()); Bx(-30, 30, 12, ax - 10, 20, C.black());
      const ta31 = Lt('ta31', -76, [[0, 14], [10, 16], [34, 16], [40, 14], [100, 15], [114, 21], [152, 22]], ax, C.black(), 0, 22);
      Bx(-50, 34, ax + 14, ax + 22, 12, C.black()); Bx(36, 44, ax + 18, ax + 30, 4, C.black()); // fibre optic, ghost sight
      k.lens(-76, ax, 11, 0, true, ta31); k.lens(76.5, ax, 20, 0, false, ta31);
      return ax;
    },
    // thermal sight: a boxy housing with a rubber eyecup at the back and a germanium objective in front
    thermscope(k) {
      const { C, Bx, Lt } = k, ax = 42;
      Bx(-40, 40, 0, 10, 30, C.black()); Bx(-84, 84, 10, 74, 52, C.poly()); Bx(-60, 60, 74, 80, 30, C.black());
      Lt('thermcup', -112, [[0, 18], [28, 15]], ax, C.poly(), 0, 18); const tObj = Lt('thermobj', 84, [[0, 26], [30, 28]], ax, C.black(), 0, 22);
      const l = k.lens(114.5, ax, 25, 0, false, tObj); l.material = M('germ', () => new THREE.MeshPhongMaterial({ color: 0x3a2a4a, shininess: 140, specular: 0xffffff }));
      return ax;
    },
    // Trijicon RMR: small aluminium shell with a sloped front, open window
    rmr(k) {
      const { C, Bx, P } = k, ax = 20;
      Bx(-22, 22, 0, 6, 26, C.black());
      P('rmrw', [[-22, 6], [22, 6], [22, 12], [8, 30], [-12, 30], [-22, 20]], 3, C.black(), 11.5); P('rmrw', [[-22, 6], [22, 6], [22, 12], [8, 30], [-12, 30], [-22, 20]], 3, C.black(), -11.5);
      const rmrTop = Bx(-12, 8, 28, 32, 26, C.black()); k.seat(rmrTop, Bx(4, 6, 10, 28, 20, C.glass()));
      return ax;
    },
  };
  function optic(id) { const k = miniK(), f = OPTICS[id]; if (!f) return null; const axis = f(k); return { g: k.g, axis }; }
  function riflescope(len) { const k = miniK(); scope(k, 0, len, 0, 15, 26, -30); return k.g; }
  return { build, has: id => !!SPEC[id], S, C, cylG, boxG, prof, riflescope, optic };
})();
