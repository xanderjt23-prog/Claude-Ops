// ============================================================================
// 3D view: renders the (2D, top-down) simulation as a first-person 3D world
// with three.js. Simulation x/y map to three.js x/z; 1 unit = 1 px (32 = a tile).
// ============================================================================
const EYE = 52, WALL_H = 84, MUZZLE_H = 44, VM_SCALE = 0.8;
// window sills and frames per wall material
const TRIM = { [O.BRICK]: 0xd6cfc0, [O.CONCRETE]: 0x9c998f, [O.STUCCO]: 0xf1ede2, [O.WHITEWOOD]: 0xf5f5f0, [O.WOODWALL]: 0x4a3524, [O.BARNWALL]: 0xece6d4,
  [O.FIELDSTONE]: 0x6e5236, [O.MUDBRICK]: 0x6a5030, [O.METALWALL]: 0x5d6266, [O.RUIN]: 0x787160, [O.PLYWOOD]: 0x8a6a40 };
const WALLISH = [O.WINDOW, O.BROKENWIN, O.BRICK, O.CONCRETE, O.WOODWALL, O.PLYWOOD, O.MUDBRICK, O.BARNWALL, O.WHITEWOOD, O.METALWALL, O.RUIN, O.STUCCO, O.FIELDSTONE];

// objects that never cast shadows (see-through or flat)
const NO_SHADOW = new Set(['glass', 'wheat', 'chain', 'haypile']);
// low-poly foliage and rocks: irregular, faceted shapes instead of perfect spheres
const Foliage = (() => {
  // merge any geometries (indexed or not) into one non-indexed soup with flat normals
  function soup(list) {
    const pos = [], uv = [];
    list.forEach(g => { const n = g.index ? g.toNonIndexed() : g; pos.push(...n.attributes.position.array); if (n.attributes.uv) uv.push(...n.attributes.uv.array); else for (let i = 0; i < n.attributes.position.count; i++) uv.push(0, 0); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g;
  }
  // displace vertices a little (same displacement for shared positions so the surface stays closed)
  function jitter(g, amt, seed) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = hash2(Math.round(x * 3), Math.round(y * 3) + Math.round(z * 7), seed) - 0.5; p.setXYZ(i, x * (1 + k * amt), y * (1 + k * amt * 0.7), z * (1 + k * amt)); } return g; }
  const lump = (r, x, y, z, seed, d) => jitter(new THREE.IcosahedronGeometry(r, d || 0), 0.22, seed).translate(x, y, z);
  return {
    canopy: () => soup([lump(29, 0, 2, 0, 1, 1), lump(21, 17, -7, 8, 2), lump(22, -16, -5, -9, 3), lump(19, 5, 14, -7, 4), lump(17, -7, -9, 15, 5), lump(16, 12, 4, -16, 6), lump(15, -12, 10, 8, 11)]),
    bush: () => soup([lump(12, 0, 2, 0, 7), lump(9, 8, 0, 5, 8), lump(10, -7, 1, -4, 9), lump(8, 2, 6, -7, 10)]).scale(1, 0.85, 1),
    rock: (r, seed) => jitter(new THREE.DodecahedronGeometry(r, 1), 0.35, seed + 20),
    trunk: (r0, r1, h, bend) => { const g = new THREE.CylinderGeometry(r0, r1, h, 7, 4); if (bend) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const t = p.getY(i) / h + 0.5; p.setX(i, p.getX(i) + Math.sin(t * 1.6) * h * bend * 0.3); } g.computeVertexNormals(); } return g; },
    pine: () => soup([[34, 46, 44], [27, 40, 74], [20, 34, 100], [12, 26, 122]].map(([r, h, y], k) => jitter(new THREE.ConeGeometry(r, h, 8, 2), 0.18, 30 + k).translate(0, y, 0))),
    palm: () => soup(Array.from({ length: 8 }, (_, k) => { const f = new THREE.BoxGeometry(34, 1.2, 8, 4, 1, 1), p = f.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i) + 17; p.setY(i, p.getY(i) - x * x * 0.012); p.setZ(i, p.getZ(i) * (1 - x / 40)); } f.translate(0, 2, 0).rotateY(k / 8 * Math.PI * 2 + hash2(k, 3, 3) * 0.4); return f; }).concat([new THREE.IcosahedronGeometry(6, 0)])),
  };
})();
// ---- cars: real body shapes (sedan, hatchback, pickup, SUV, van) built from side profiles. Each car is split
// into parts by material (paint, windows, trim and tyres, rims, lights) so cars can be instanced across the map.
// Model space: length along x (front = +x), width along z, wheels on the ground at y = 0.
const CarModel = (() => {
  const cache = {};
  function merge(list) {
    const pos = [], nor = [], uv = [];
    list.forEach(g0 => { const g = g0.index ? g0.toNonIndexed() : g0; if (!g.attributes.normal) g.computeVertexNormals(); pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); if (g.attributes.uv) uv.push(...g.attributes.uv.array); else for (let i = 0; i < g.attributes.position.count; i++) uv.push(0, 0); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return g;
  }
  // side profile (x, y) extruded across width w, centred on z, with rounded edges
  function side(pts, w, bev) {
    const s = new THREE.Shape(); pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath();
    const b = bev === undefined ? 1.6 : bev;
    const g = new THREE.ExtrudeGeometry(s, { depth: w - 2 * b, bevelEnabled: b > 0, bevelSize: b * 0.8, bevelThickness: b, bevelSegments: 2, curveSegments: 4 });
    g.translate(0, 0, -(w - 2 * b) / 2); g.computeVertexNormals(); return g;
  }
  const box = (x, y, z, w, h, d) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  const STYLES = {
    // body: lower body outline; cabin: window glass outline; roof: roof panel outline; L = half length, wb = wheel x, r = wheel radius
    sedan: { L: 31, W: 28, wb: 19, r: 6, body: [[-31, 6], [31, 6], [31.5, 14], [30, 18], [15, 20.5], [-26, 21], [-31, 18], [-31.5, 12]], cabin: [[13, 20.5], [3, 31], [-15, 31], [-24, 21]], roof: [[3.5, 31], [-15.5, 31], [-15, 32.6], [3, 32.6]] },
    hatch: { L: 27, W: 27, wb: 17, r: 5.8, body: [[-27, 6], [27, 6], [27.5, 14], [26, 18], [13, 20.5], [-26, 21], [-27, 17]], cabin: [[11, 20.5], [1, 31], [-22, 30.5], [-26, 21]], roof: [[1.5, 31], [-22.5, 30.6], [-22, 32.2], [1, 32.6]] },
    pickup: { L: 32, W: 29, wb: 20, r: 6.6, body: [[-32, 6.5], [32, 6.5], [32.5, 16], [31, 21], [17, 23], [-32, 23.5], [-32.5, 10]], cabin: [[15, 23], [7, 35], [-8, 35], [-9, 23]], roof: [[7.5, 35], [-8.5, 35], [-8.5, 36.6], [7, 36.6]], bed: [-31, -10] },
    suv: { L: 31, W: 29, wb: 19, r: 7, body: [[-31, 7.5], [31, 7.5], [31.5, 17], [30, 22], [16, 24], [-31, 24.5], [-31.5, 12]], cabin: [[14, 24], [6, 37], [-29, 37], [-30.5, 24]], roof: [[6.5, 37], [-29.5, 37], [-29, 38.8], [6, 38.8]] },
    van: { L: 32, W: 30, wb: 21, r: 6.4, body: [[-32, 6.5], [32, 6.5], [32.5, 16], [30, 22], [-32, 22]], cabin: [[29, 22], [22, 38], [-31, 40], [-32, 22]], roof: [[22.5, 38], [-31.5, 40], [-31.5, 41.6], [22, 39.6]], panel: true },
  };
  function build(style) {
    if (cache[style]) return cache[style];
    const S = STYLES[style], W = S.W, paint = [], glass = [], trim = [], rim = [], lightF = [], lightR = [];
    paint.push(side(S.body, W));
    if (S.panel) paint.push(side(S.cabin.map(([x, y]) => [x - 0.5, y]), W - 0.6, 1.2)); // van: panel sides, glass only in front
    glass.push(side(S.cabin, W - (S.panel ? 0 : 2), 1.2));
    paint.push(side(S.roof, W - 1, 0.6));
    if (S.panel) { glass.push(box(23, 30, 0, 12, 13, W + 0.4)); glass.push(box(26.8, 30, 0, 2, 14, W - 4)); } // cab windows and windscreen
    // pillars between the windows (B pillar), door seams, mirrors, handles
    const cx = (S.cabin[0][0] + S.cabin[3][0]) / 2, top = S.cabin[1][1];
    paint.push(box(cx, (S.cabin[0][1] + top) / 2, 0, 2.2, top - S.cabin[0][1], W - 0.4));
    trim.push(box(cx + 1, S.body[2][1] - 1, 0, 0.6, 10, W + 0.3)); trim.push(box(cx - 13, S.body[2][1] - 1, 0, 0.6, 10, W + 0.3));
    for (const z of [-1, 1]) { trim.push(box(S.cabin[0][0] - 1, S.cabin[0][1] + 2, z * (W / 2 + 1.4), 3, 2, 2.4)); trim.push(box(cx - 4, S.body[2][1] + 0.5, z * (W / 2 + 0.2), 3, 0.8, 0.6)); }
    // bumpers, grille, lights, number plates
    trim.push(box(S.L + 0.6, 9, 0, 2.4, 4, W - 1)); trim.push(box(-S.L - 0.6, 9, 0, 2.4, 4, W - 1));
    trim.push(box(S.L + 0.5, 14, 0, 1, 4, W * 0.42));
    for (const z of [-1, 1]) { lightF.push(box(S.L + 0.4, 15.5, z * (W / 2 - 4.5), 1, 2.6, 6)); lightR.push(box(-S.L - 0.4, 16, z * (W / 2 - 4), 1, 3, 5)); }
    rim.push(box(S.L + 1.4, 9, 0, 0.4, 2.2, 7)); rim.push(box(-S.L - 1.4, 9.5, 0, 0.4, 2.2, 7));
    if (S.bed) trim.push(box((S.bed[0] + S.bed[1]) / 2, S.body[S.body.length - 2][1] - 1.4, 0, S.bed[1] - S.bed[0], 3, W - 3.4)); // the open bed
    // wheels: tyre, rim, arch shadow
    for (const x of [S.wb, -S.wb]) for (const z of [-1, 1]) {
      const t = new THREE.CylinderGeometry(S.r, S.r, 4.2, 16).rotateX(Math.PI / 2).translate(x, S.r, z * (W / 2 - 2.6)); trim.push(t);
      rim.push(new THREE.CylinderGeometry(S.r * 0.55, S.r * 0.55, 4.6, 10).rotateX(Math.PI / 2).translate(x, S.r, z * (W / 2 - 2.6)));
      trim.push(box(x, S.r + 1, z * (W / 2 - 0.2), S.r * 2.5, S.r * 1.6, 0.5));
    }
    trim.push(box(0, 4.6, 0, S.L * 2 - 6, 3, W - 6)); // underbody
    return (cache[style] = { paint: merge(paint), glass: merge(glass), trim: merge(trim), rim: merge(rim), lightF: merge(lightF), lightR: merge(lightR) });
  }
  const pick = (x, y) => ['sedan', 'sedan', 'hatch', 'pickup', 'suv', 'van'][Math.floor(hash2(x, y, 77) * 6)];
  return { build, pick, STYLES };
})();
const View3DTex = (() => {
  const cache = {};
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  // side textures for walls. Seamless tiles of 128 x 256 px = 32 x 64 world units: walls sample them in
  // world space (see View3D.worldMat), so bricks and boards run on unbroken across tiles and storeys.
  function wall(o) {
    if (cache['w' + o]) return cache['w' + o];
    const W = 128, H = 256, c = cv(W, H), g = c.getContext('2d'), rnd = mulberry32(o * 77 + 3), base = o === O.CONTAINER ? '#cfcfcf' : MapRenderer.prototype.objColor.call(null, o, 0);
    const shade = (k) => Tex.shade(base, k);
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    // draw with wrap-around so the tile repeats without seams
    const wrap = f => { for (const dx of [-W, 0, W]) for (const dy of [-H, 0, H]) { g.save(); g.translate(dx, dy); f(); g.restore(); } };
    const noise = (n, a, sz) => { for (let i = 0; i < n; i++) { const x = rnd() * W, y = rnd() * H, s2 = (sz || 2) + rnd() * (sz || 2), col = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${a * rnd()})`; wrap(() => { g.fillStyle = col; g.fillRect(x, y, s2, s2); }); } };
    const stains = (n, col, len) => { for (let i = 0; i < n; i++) { const x = rnd() * W, y = rnd() * H, w2 = 3 + rnd() * 8, l = len * (0.5 + rnd()); wrap(() => { const gr = g.createLinearGradient(0, y, 0, y + l); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x, y, w2, l); }); } };
    if (o === O.BRICK) {
      const rows = 16, rh = H / rows, bw = W / 4;
      g.fillStyle = '#b9a99a'; g.fillRect(0, 0, W, H); // mortar
      for (let r = 0; r < rows; r++) for (let k = -1; k < 5; k++) {
        const x = k * bw + (r % 2) * bw / 2, y = r * rh, col = Tex.shade(base, 0.78 + rnd() * 0.42);
        wrap(() => { g.fillStyle = col; g.fillRect(x + 1.5, y + 1.5, bw - 3, rh - 3); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x + 1.5, y + 1.5, bw - 3, 2); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x + 1.5, y + rh - 3.5, bw - 3, 2); });
      }
      noise(500, 0.08); stains(4, 'rgba(30,25,20,0.18)', 60);
    } else if (o === O.CONCRETE) {
      noise(1500, 0.07); noise(300, 0.05, 4);
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, 0, W, 2); g.fillRect(0, 0, 2, H); // formwork joints
      g.fillStyle = 'rgba(0,0,0,0.3)'; for (const [x, y] of [[32, 64], [96, 64], [32, 192], [96, 192]]) { g.beginPath(); g.arc(x, y, 2.5, 0, 7); g.fill(); } // tie holes
      stains(6, 'rgba(40,40,35,0.16)', 90);
    } else if (o === O.STUCCO) {
      noise(2500, 0.045); noise(200, 0.04, 5);
      g.strokeStyle = 'rgba(90,80,60,0.18)'; g.lineWidth = 1; for (let k = 0; k < 3; k++) { let x = rnd() * W, y = rnd() * H; g.beginPath(); g.moveTo(x, y); for (let s2 = 0; s2 < 6; s2++) { x += (rnd() - 0.5) * 18; y += rnd() * 14; g.lineTo(x, y); } g.stroke(); }
      stains(3, 'rgba(110,95,70,0.14)', 80);
    } else if (o === O.FIELDSTONE || o === O.RUIN) {
      g.fillStyle = o === O.RUIN ? '#59584a' : '#6b6558'; g.fillRect(0, 0, W, H);
      const rh = o === O.RUIN ? 32 : 22;
      for (let y = 0; y < H; y += rh) for (let x = -(y / rh % 2) * 20; x < W; ) {
        const w2 = (o === O.RUIN ? 40 : 22) + rnd() * 18, col = shade(0.72 + rnd() * 0.5), rx = x, ry = y;
        wrap(() => { g.fillStyle = col; g.beginPath(); if (g.roundRect) g.roundRect(rx + 2, ry + 2, w2 - 4, rh - 4, o === O.RUIN ? 2 : 7); else g.rect(rx + 2, ry + 2, w2 - 4, rh - 4); g.fill(); g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(rx + 4, ry + 3, w2 - 8, 3); });
        x += w2;
      }
      noise(600, 0.08);
      if (o === O.RUIN) for (let k = 0; k < 40; k++) { const x = rnd() * W, y = H * 0.55 + rnd() * H * 0.45, r = 2 + rnd() * 7, col = `rgba(60,${100 + rnd() * 50 | 0},40,0.45)`; wrap(() => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }); }
    } else if (o === O.MUDBRICK) {
      noise(1800, 0.06); noise(200, 0.05, 5);
      // patches where the render has fallen off and the bricks show
      for (let k = 0; k < 3; k++) { const x = rnd() * W, y = rnd() * H; wrap(() => { g.fillStyle = 'rgba(120,80,45,0.35)'; g.beginPath(); g.ellipse(x, y, 16 + rnd() * 10, 10 + rnd() * 6, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(70,45,25,0.35)'; for (let r = -12; r < 12; r += 6) { g.beginPath(); g.moveTo(x - 18, y + r); g.lineTo(x + 18, y + r); g.stroke(); } }); }
      stains(4, 'rgba(90,60,30,0.15)', 70);
    } else if (o === O.METALWALL || o === O.CONTAINER) {
      for (let k = 0; k < W; k += 16) { const gr = g.createLinearGradient(k, 0, k + 16, 0); gr.addColorStop(0, 'rgba(255,255,255,0.16)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.02)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0.3)'); g.fillStyle = gr; g.fillRect(k, 0, 16, H); }
      noise(300, 0.06); stains(o === O.METALWALL ? 7 : 4, 'rgba(120,60,25,0.3)', 70);
      if (o === O.CONTAINER) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, W, 4); }
    } else if (o === O.WHITEWOOD) { // clapboard siding: overlapping horizontal boards
      for (let y = 0; y < H; y += 16) { g.fillStyle = shade(0.92 + rnd() * 0.12); g.fillRect(0, y, W, 16); const gr = g.createLinearGradient(0, y + 10, 0, y + 16); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.28)'); g.fillStyle = gr; g.fillRect(0, y + 10, W, 6); }
      noise(500, 0.04);
    } else { // board walls: vertical planks with grain
      const pw = o === O.PLYWOOD ? 64 : o === O.BARNWALL ? 18 : 16;
      for (let k = 0; k < W; k += pw) { g.fillStyle = shade(0.82 + rnd() * 0.3); g.fillRect(k, 0, pw, H); for (let n = 0; n < 6; n++) { g.strokeStyle = `rgba(${rnd() < 0.5 ? '40,25,10' : '255,230,190'},0.12)`; g.beginPath(); const x0 = k + rnd() * pw; g.moveTo(x0, 0); g.bezierCurveTo(x0 + 3, H * 0.3, x0 - 3, H * 0.6, x0, H); g.stroke(); } g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(k + pw - 1.5, 0, 1.5, H); }
      if (o === O.WOODWALL) for (let y = 0; y < H; y += 64) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, y, W, 3); }
      noise(300, 0.05);
    }
    return (cache['w' + o] = c);
  }
  // texture from the top-down tile art (crates, hay, sandbags...)
  function tile(o, tint) {
    const key = 't' + o + ':' + (tint || 0); if (cache[key]) return cache[key];
    const c = cv(32, 32), g = c.getContext('2d');
    const mm = { w: 1, h: 1, obj: new Uint8Array([o]), floor: new Uint8Array([0]), hp: new Float32Array([MAT[o].hp]), tint: new Uint8Array([tint || 0]) };
    const r = Object.create(MapRenderer.prototype); r.m = mm; g.fillStyle = MapRenderer.prototype.objColor.call(null, o, tint || 0); g.fillRect(0, 0, 32, 32); r.drawObj(g, o, 0, 0, tint || 0, 1);
    return (cache[key] = c);
  }
  function wheat() {
    if (cache.wheat) return cache.wheat;
    const c = cv(64, 72), g = c.getContext('2d'), rnd = mulberry32(5);
    for (let k = 0; k < 40; k++) { const x = rnd() * 64, h = 40 + rnd() * 30; g.strokeStyle = Tex.shade('#c8ac56', 0.7 + rnd() * 0.5); g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, 72); g.lineTo(x + (rnd() - 0.5) * 6, 72 - h); g.stroke(); g.fillStyle = '#dcc070'; g.beginPath(); g.ellipse(x, 72 - h, 2, 5, 0, 0, 7); g.fill(); }
    return (cache.wheat = c);
  }
  function chain() {
    if (cache.chain) return cache.chain;
    const c = cv(32, 64), g = c.getContext('2d'); g.strokeStyle = 'rgba(200,205,210,0.9)'; g.lineWidth = 1;
    for (let k = -64; k < 64; k += 6) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 64, 64); g.moveTo(k + 64, 0); g.lineTo(k, 64); g.stroke(); }
    g.fillStyle = '#8a9096'; g.fillRect(0, 0, 3, 64); g.fillRect(0, 0, 32, 2);
    return (cache.chain = c);
  }
  function dot() {
    if (cache.dot) return cache.dot;
    const c = cv(64, 64), g = c.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.45, 'rgba(255,255,255,0.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64); return (cache.dot = c);
  }
  return { wall, tile, wheat, chain, dot, cv };
})();

class View3D {
  constructor(game, canvas) {
    this.g = game; this.canvas = canvas;
    let q = 'high'; try { q = localStorage.getItem('fo3d-quality') || 'high'; } catch (e) {}
    this.low = q === 'low'; this.quality = q;
    const R = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.low, powerPreference: 'high-performance' });
    R.setPixelRatio(this.low ? 0.75 : Math.min(1.5, window.devicePixelRatio || 1)); R.autoClear = false;
    this.maxAniso = R.capabilities.getMaxAnisotropy();
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, 1, 7000); this.camera.rotation.order = 'YXZ';
    this.vmScene = new THREE.Scene(); this.vmCam = new THREE.PerspectiveCamera(60, 1, 0.3, 300);
    this.texCache = {}; this.matCache = {};
    this.huge = this.g.map.w * this.g.map.h > 15000;
    this.buildLights(); this.buildGround(); this.buildObjects(); this.buildDynamic(); this.buildViewmodelRig();
    this.unitViews = new Map(); this.corpseViews = new Map(); this.baseViews = [];
    game.bases.forEach(b => this.baseViews.push(this.buildCastle(b)));
    // everything static that isn't instanced (roofs, stairs, ladders, castles, terrain) casts and takes shadows
    if (this.shadows) this.scene.traverse(o => { if (o.isMesh && !o.isInstancedMesh) { o.castShadow = !o.userData.ground; o.receiveShadow = true; } });
    this.vm = { id: null, model: null, kick: 0, swap: 0, flash: 0, lastSlot: -1 };
    this.resize();
  }
  // ---------------------------------------------------------------- helpers
  tex(key, make, repeat) {
    if (this.texCache[key]) return this.texCache[key];
    const t = new THREE.CanvasTexture(make()); t.anisotropy = this.maxAniso; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return (this.texCache[key] = t);
  }
  lambert(key, opts) { return this.matCache[key] || (this.matCache[key] = new THREE.MeshLambertMaterial(opts)); }
  // a material whose texture is mapped in world space (walls: x/z along the wall, y up; tops: x/z), so
  // patterns line up across neighbouring tiles, wall pieces of any height and every storey
  worldMat(key, make, extra) {
    const k = 'wm:' + key; if (this.matCache[k]) return this.matCache[k];
    const t = this.tex('wt:' + key, make); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    const m = new THREE.MeshLambertMaterial(Object.assign({ map: t }, extra || {}));
    m.onBeforeCompile = sh => {
      sh.vertexShader = 'varying vec3 vWP;\nvarying vec3 vWN;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
        vec4 wpp = vec4(transformed, 1.0); vec3 wnn = objectNormal;
        #ifdef USE_INSTANCING
          wpp = instanceMatrix * wpp; wnn = mat3(instanceMatrix) * wnn;
        #endif
        vWP = (modelMatrix * wpp).xyz; vWN = normalize(mat3(modelMatrix) * wnn);`);
      sh.fragmentShader = 'varying vec3 vWP;\nvarying vec3 vWN;\n' + sh.fragmentShader.replace('#include <map_fragment>', `
        vec2 wuv = abs(vWN.y) > 0.6 ? vWP.xz / 32.0 : vec2((abs(vWN.x) > abs(vWN.z) ? vWP.z : vWP.x) / 32.0, vWP.y / 64.0);
        diffuseColor *= texture2D(map, wuv);`);
    };
    m.customProgramCacheKey = () => 'worlduv';
    return (this.matCache[k] = m);
  }
  camo(id, uniform) { const list = uniform ? UNIFORMS : CAMOS, c = list.find(x => x.id === id) || list[0]; return this.tex('camo' + (uniform ? 'u' : '') + c.id, () => Art.camoCanvas(c.colors, uniform ? 'uniform' : c.pattern, 64, c.id.length * 31), [1, 1]); }
  resize() {
    const r = this.canvas.getBoundingClientRect(); const w = Math.max(1, r.width), h = Math.max(1, r.height);
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.vmCam.aspect = w / h; this.vmCam.updateProjectionMatrix();
    this.cssW = w; this.cssH = h;
  }
  dispose() { this.renderer.dispose(); this.canvas.style.filter = ''; }

  // ---------------------------------------------------------------- lights & sky
  buildLights() {
    const S = this.scene;
    this.hemi = new THREE.HemisphereLight(0xdfe8ff, 0x4a4a3a, 0.75); S.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff4e0, 0.75); this.sun.position.set(-0.6, 1, -0.35); S.add(this.sun); S.add(this.sun.target);
    // soft sun shadows that follow the camera (High graphics, daytime)
    this.shadows = this.quality === 'high' && !this.g.night && this.g.map.w * this.g.map.h <= 20000; // not on massive maps
    if (this.shadows) {
      this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      const sc = this.sun.shadow.camera; this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
      sc.left = sc.bottom = -820; sc.right = sc.top = 820; sc.near = 10; sc.far = 3400; this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 1.2;
      // light-space axes for snapping the shadow map to its texel grid
      const dir = new THREE.Vector3(0.6, -1, 0.35).normalize(), right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize(), up = new THREE.Vector3().crossVectors(right, dir).normalize();
      this.sunShadow = { dir, right, up, texel: 1640 / 2048 };
      this.hemi.intensity = 0.62; this.sun.intensity = 0.95;
    }
    this.eyeLight = new THREE.PointLight(0x9fb4ff, 0, 220, 1.2); S.add(this.eyeLight);
    // every light costs shading time even when dark, so only create what the time of day needs
    const night0 = this.g.night, nP = night0 ? (this.low ? 4 : 6) : (this.low ? 1 : 3), nS = night0 ? (this.low ? 2 : 3) : 0;
    this.points = []; for (let i = 0; i < nP; i++) { const l = new THREE.PointLight(0xffc070, 0, 300, 1.4); S.add(l); this.points.push(l); }
    this.spots = []; for (let i = 0; i < nS; i++) { const l = new THREE.SpotLight(0xfff6e0, 0, 560, 0.42, 0.45, 1.1); S.add(l); S.add(l.target); this.spots.push(l); }
    // visible beam of a weapon light (all lit units get one)
    const cone = new THREE.ConeGeometry(120, 400, 20, 1, true); cone.translate(0, -200, 0); cone.rotateZ(Math.PI / 2);
    this.beamGeo = cone; this.beamMat = new THREE.MeshBasicMaterial({ color: 0xfff2d0, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.beams = [];
    const night = this.g.night;
    if (night) { this.hemi.color.set(0x8090c0); this.hemi.groundColor.set(0x101018); this.sun.color.set(0x8fa6ff); this.scene.background = new THREE.Color(0x04060c); }
    else { this.scene.background = new THREE.Color(0xa7bfd6); this.scene.fog = new THREE.Fog(0xa7bfd6, this.huge ? 1100 : 1400, this.huge ? 3200 : 4200); }
    if (this.huge) { this.camera.far = 3400; this.camera.updateProjectionMatrix(); } // massive maps: shorter view distance
    // viewmodel lighting
    this.vmHemi = new THREE.HemisphereLight(0xffffff, 0x404040, 1); this.vmScene.add(this.vmHemi);
    this.vmSun = new THREE.DirectionalLight(0xffffff, 0.6); this.vmSun.position.set(0.3, 1, 0.6); this.vmScene.add(this.vmSun);
  }

  // ---------------------------------------------------------------- ground (chunked canvas textures so decals update cheaply)
  buildGround() {
    const g = this.g, m = g.map, CH = 16 * T, src = g.mr.ground, gs = g.mr.gs || 1;
    this.chunks = [];
    for (let cy = 0; cy < m.h * T; cy += CH) for (let cx = 0; cx < m.w * T; cx += CH) {
      const w = Math.min(CH, m.w * T - cx), h = Math.min(CH, m.h * T - cy);
      const c = View3DTex.cv(Math.ceil(w * gs), Math.ceil(h * gs)); c.getContext('2d').drawImage(src, cx * gs, cy * gs, w * gs, h * gs, 0, 0, c.width, c.height);
      const t = new THREE.CanvasTexture(c); t.anisotropy = this.maxAniso;
      const geo = new THREE.PlaneGeometry(w, h, Math.round(w / T), Math.round(h / T)); geo.rotateX(-Math.PI / 2);
      const pos = geo.attributes.position;
      for (let k = 0; k < pos.count; k++) pos.setY(k, groundAt(m, cx + w / 2 + pos.getX(k), cy + h / 2 + pos.getZ(k)));
      geo.computeVertexNormals();
      // vertex shading: slopes and hollows a little darker, broad patches of colour variation
      const colors = new Float32Array(pos.count * 3), nrm = geo.attributes.normal;
      for (let k = 0; k < pos.count; k++) {
        const wx = cx + w / 2 + pos.getX(k), wz = cy + h / 2 + pos.getZ(k), slope = 1 - nrm.getY(k);
        const hollow = Math.max(0, groundAt(m, wx, wz) - (groundAt(m, wx - 40, wz) + groundAt(m, wx + 40, wz) + groundAt(m, wx, wz - 40) + groundAt(m, wx, wz + 40)) / 4);
        const v = Math.max(0.55, Math.min(1.1, 1 - slope * 1.6 + hollow * 0.004 + (valueNoise(wx / 260, wz / 260, 5) - 0.5) * 0.14 - Math.max(0, -hollow) * 0.004));
        colors[k * 3] = colors[k * 3 + 1] = colors[k * 3 + 2] = v;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: t, vertexColors: true }));
      mesh.receiveShadow = true; mesh.userData.ground = true; // terrain takes shadows but doesn't cast them (no acne stripes on slopes)
      mesh.position.set(cx + w / 2, 0, cy + h / 2); this.scene.add(mesh);
      this.chunks.push({ cx, cy, w, h, c, t, dirty: false });
    }
    this.chunkCols = Math.ceil(m.w * T / CH); this.CH = CH;
    if (!this.low) this.buildGrass();
    // land beyond the map edge
    const edge = FLOOR_INFO[m.floor[0]].base;
    const out = new THREE.Mesh(new THREE.PlaneGeometry(16000, 16000).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: new THREE.Color(edge).lerp(new THREE.Color(0x5d7a3a), 0.5).multiplyScalar(0.9) }));
    // the land around the map continues its edge heights and settles to a common level further out
    let lo = Infinity; if (m.hc) for (const v of m.hc) lo = Math.min(lo, v); if (!isFinite(lo)) lo = 0;
    const R = 28, cols = m.w + R * 2, rows = m.h + R * 2, verts = [], idx = [], hgt = (gx, gy) => {
      const ex = Math.max(0, Math.min(m.w, gx)), ey = Math.max(0, Math.min(m.h, gy)), d = Math.hypot(gx - ex, gy - ey);
      if (!d) return groundAt(m, ex * T, ey * T);
      const k = smooth01(d / R); return groundAt(m, ex * T, ey * T) * (1 - k) + (lo - 2) * k + Math.sin(k * Math.PI) * fbm(gx / 9, gy / 9, 71) * 90;
    };
    for (let y = 0; y <= rows; y++) for (let x = 0; x <= cols; x++) verts.push((x - R) * T, hgt(x - R, y - R), (y - R) * T);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const gx = x - R, gy = y - R; if (gx >= 0 && gy >= 0 && gx < m.w && gy < m.h) continue;
      const a = y * (cols + 1) + x, b = a + 1, c = a + cols + 1, d = c + 1; idx.push(a, c, b, b, c, d);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); sg.setIndex(idx); sg.computeVertexNormals();
    const skirt = new THREE.Mesh(sg, out.material); skirt.userData.ground = true; this.scene.add(skirt);
    out.userData.ground = true; out.position.set(m.w * T / 2, lo - 3, m.h * T / 2); this.scene.add(out);
  }
  // grass tufts and pebbles on open ground (instanced per region so off-screen ones are culled)
  buildGrass() {
    const m = this.g.map, RG = 24, cols = Math.ceil(m.w / RG), regions = {};
    const kinds = { [F.GRASS]: [0x6f8f3e, 2], [F.FOREST]: [0x51683a, 2], [F.FIELD]: [0xa08a48, 1], [F.DIRT]: [0x7d8a46, 0.35], [F.SAND]: [0x9c9a5a, 0.18], [F.SNOW]: [0x9aa58a, 0.12], [F.MUD]: [0x5a6a32, 0.6] };
    for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) {
      const i = ty * m.w + tx, kd = kinds[m.floor[i]]; if (!kd || m.obj[i] || m.bld[i] >= 0) continue;
      const n = Math.floor(kd[1] + hash2(tx, ty, 61)); if (!n) continue;
      const r = ((ty / RG) | 0) * cols + ((tx / RG) | 0); (regions[r] || (regions[r] = [])).push([tx, ty, n, kd[0]]);
    }
    const geo = (() => { const a = new THREE.PlaneGeometry(14, 10), b = new THREE.PlaneGeometry(14, 10).rotateY(Math.PI / 2), c = new THREE.PlaneGeometry(14, 10).rotateY(Math.PI / 4); return mergeGeos([a, b, c]).translate(0, 5, 0); })();
    const tex = this.tex('grasstuft', () => { const c = View3DTex.cv(64, 48), g = c.getContext('2d'), r = mulberry32(3); for (let k = 0; k < 34; k++) { const x = 4 + r() * 56, h = 18 + r() * 28; g.strokeStyle = `rgba(${200 + r() * 55 | 0},${220 + r() * 35 | 0},${160 + r() * 60 | 0},1)`; g.lineWidth = 1.5 + r() * 1.5; g.beginPath(); g.moveTo(x, 48); g.quadraticCurveTo(x + (r() - 0.5) * 8, 48 - h * 0.6, x + (r() - 0.5) * 16, 48 - h); g.stroke(); } return c; });
    const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.45, side: THREE.DoubleSide });
    const pebble = new THREE.DodecahedronGeometry(2.6, 0).scale(1, 0.55, 1), pmat = this.lambert('pebble', { color: 0x8c877c, flatShading: true });
    const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), C = new THREE.Color();
    for (const r in regions) {
      const list = regions[r], total = list.reduce((s, e) => s + e[2], 0);
      const inst = new THREE.InstancedMesh(geo, mat, total), peb = new THREE.InstancedMesh(pebble, pmat, Math.ceil(total / 3) + 1);
      let k = 0, kp = 0;
      for (const [tx, ty, n, colr] of list) for (let j = 0; j < n; j++) {
        const x = tx * T + 4 + hash2(tx, ty, j * 3 + 1) * 24, z = ty * T + 4 + hash2(ty, tx, j * 3 + 2) * 24, s = 0.7 + hash2(tx + j, ty, 9) * 0.8;
        P.set(x, groundAt(m, x, z) - 0.5, z); Q.setFromAxisAngle(Y, hash2(tx, ty + j, 4) * 6.28); S.set(s, s * (0.8 + hash2(ty, tx + j, 5) * 0.6), s);
        inst.setMatrixAt(k, M4.compose(P, Q, S)); inst.setColorAt(k, C.set(colr).multiplyScalar(0.85 + hash2(tx, ty, j + 7) * 0.3)); k++;
        if (hash2(tx, ty, j + 99) < 0.3 && kp < peb.count) { P.x += 6; P.y = groundAt(m, P.x, P.z); peb.setMatrixAt(kp++, M4.compose(P, Q, S.setScalar(0.6 + s * 0.5))); }
      }
      peb.count = kp;
      const rx = (r % cols) * RG * T, ry = ((r / cols) | 0) * RG * T, sphere = new THREE.Sphere(new THREE.Vector3(rx + RG * T / 2, 100, ry + RG * T / 2), RG * T * 0.75 + 300);
      [inst, peb].forEach(o => { o.geometry = o.geometry.clone(); o.geometry.boundingSphere = sphere; o.frustumCulled = true; o.receiveShadow = !!this.shadows; this.scene.add(o); });
    }
  }
  groundDirty(x, y, r) {
    const CH = this.CH; r = (r || 30) + 4;
    for (let yy = Math.floor((y - r) / CH); yy <= Math.floor((y + r) / CH); yy++) for (let xx = Math.floor((x - r) / CH); xx <= Math.floor((x + r) / CH); xx++) {
      const ch = this.chunks[yy * this.chunkCols + xx]; if (ch && xx >= 0 && xx < this.chunkCols) ch.dirty = true;
    }
  }
  flushGround() {
    const now = performance.now(); if (now - (this.lastFlush || 0) < 120) return; this.lastFlush = now;
    let n = 0;
    for (const ch of this.chunks) if (ch.dirty && n < 3) { ch.dirty = false; n++; const g = ch.c.getContext('2d'); const gs = this.g.mr.gs || 1; g.clearRect(0, 0, ch.c.width, ch.c.height); g.drawImage(this.g.mr.ground, ch.cx * gs, ch.cy * gs, ch.w * gs, ch.h * gs, 0, 0, ch.c.width, ch.c.height); ch.t.needsUpdate = true; }
  }

  // ---------------------------------------------------------------- map objects (instanced, updated when tiles change)
  // parts that make up a tile's object: [key, makeGeo, makeMat, y, opts]
  partsFor(i) {
    const m = this.g.map, P = [], x = i % m.w, y = (i / m.w) | 0, o = m.obj[i];
    // wall textures repeat vertically so brick courses keep their size on tall walls
    const wallMat = (w) => () => this.worldMat('wall' + w, () => View3DTex.wall(w));
    const tileMat = (k, tint) => () => this.lambert('tile' + k + ':' + (tint || 0), { map: this.tex('tile' + k + ':' + (tint || 0), () => View3DTex.tile(k, tint)) });
    const col = c => () => this.lambert('c' + c, { color: c });
    const flat = c => () => this.lambert('f' + c, { color: c, flatShading: true });
    const B = (w, h, d) => () => new THREE.BoxGeometry(w, h, d);
    const same = (dx, dy, list) => { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) return false; return list.includes(m.obj[ny * m.w + nx]); };
    const horiz = list => same(-1, 0, list) || same(1, 0, list) || !(same(0, -1, list) || same(0, 1, list));
    const nearWall = () => { for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < m.w && ny < m.h) { const n = m.obj[ny * m.w + nx]; if (n && MAT[n].wall && n !== O.WINDOW && n !== O.BROKENWIN) return n; } } return O.CONCRETE; };
    const mat = MAT[o];
    const bw = (m.buildings[m.bld[i]] || {}).wall, wt = isWallObj(o) ? o : bw || nearWall();
    const hor = horiz(WALLISH);
    const inWall = isWallObj(o) || o === O.WINDOW || o === O.BROKENWIN || m.lintel[i];
    const spans = tileSolids(m, i, x * T + T / 2, y * T + T / 2, []);
    // freestanding walls on a slope stand on their tile's centre height: carry the wall down to the lowest corner of
    // the tile so its downhill side meets the ground instead of floating
    if (m.hc && isWallObj(o) && !(m.bld[i] >= 0) && spans.length && spans[0][2] === 'obj') {
      const W1 = m.w + 1, c = y * W1 + x, lo = Math.min(m.hc[c], m.hc[c + 1], m.hc[c + W1], m.hc[c + W1 + 1]);
      if (spans[0][0] - lo > 0.5) spans[0][0] = lo - 1;
    }
    const wallish = isWallObj(o) || o === O.WINDOW || o === O.BROKENWIN;
    if (wallish) {
      // window openings (gaps between the wall pieces): a sill below and a frame around each
      const ws = spans.filter(s => s[2] === 'obj').sort((a, b) => a[0] - b[0]);
      const trim = TRIM[wt] || 0x5b4a36, rot = hor ? 0 : Math.PI / 2;
      for (let k = 0; k < ws.length - 1; k++) {
        const g0 = ws[k][1], g1 = ws[k + 1][0]; if (g1 - g0 < 20) continue;
        P.push(['sill' + trim, B(34, 3, 38), col(trim), g0 - 1, { rot, abs: true }]);
        P.push(['wframe' + trim + ':' + (g1 - g0), () => mergeGeos([new THREE.BoxGeometry(3, g1 - g0, 35).translate(-14.5, 0, 0), new THREE.BoxGeometry(3, g1 - g0, 35).translate(14.5, 0, 0), new THREE.BoxGeometry(32, 3, 35).translate(0, (g1 - g0) / 2 - 1.5, 0)]), col(trim), (g0 + g1) / 2, { rot, abs: true }]);
      }
      // coping along the top of the wall
      const top = ws.length ? ws[ws.length - 1][1] : 0, lt = spans.find(s => s[2] === 'lintel');
      const capY = Math.max(top, lt ? lt[1] : 0), corner = !(same(-1, 0, WALLISH) || same(1, 0, WALLISH)) === !(same(0, -1, WALLISH) || same(0, 1, WALLISH));
      if (capY > 0 && (!m.roofKind || m.roofKind[i] !== 2 && m.roofKind[i] !== 3)) P.push(['cap' + wt + (corner ? 'c' : ''), corner ? B(35, 2.6, 35) : B(32, 2.6, 36), () => this.lambert('cap' + wt, { color: new THREE.Color(Tex.shade(MapRenderer.prototype.objColor.call(null, wt, 0), 0.7)) }), capY + 1.3 + (corner ? 0.25 : 0), { rot, abs: true }]);
    } else if (m.lintel[i]) {
      const lt = spans.find(s => s[2] === 'lintel'); if (lt) P.push(['cap' + wt, B(32, 2.6, 36), () => this.lambert('cap' + wt, { color: new THREE.Color(Tex.shade(MapRenderer.prototype.objColor.call(null, wt, 0), 0.7)) }), lt[1] + 1.3, { rot: hor ? 0 : Math.PI / 2, abs: true }]);
    }
    for (const sp of spans) {
      const h = sp[1] - sp[0], cy = (sp[0] + sp[1]) / 2;
      if (sp[2] === 'obj' && wallish || sp[2] === 'lintel') P.push(['w' + wt + ':' + h, B(32, h, 32), wallMat(wt), cy, { shade: isWallObj(o), abs: true }]);
      else if (sp[2] === 'glass') P.push(['glass' + h, B(32, h, 3), () => this.glassMat || (this.glassMat = new THREE.MeshLambertMaterial({ color: 0x9fc3d8, transparent: true, opacity: 0.35, depthWrite: false })), cy, { rot: hor ? 0 : Math.PI / 2, abs: true }]);
      else if (inWall) continue;
      else if (sp[2] === 'slab') { const f = m.floor[i] === F.TILE || m.floor[i] === F.CONCRETE || m.floor[i] === F.METAL || m.floor[i] === F.MARBLE ? m.floor[i] : F.WOOD; P.push(['slab' + f, B(32, 8, 32), () => this.lambert('slab' + f, { map: this.tex('floor' + f, () => Tex.floorTex(f, 1)) }), sp[1] - 4, { abs: true }]); }
      else if (sp[2] === 'roof' && m.roofKind[i] === 1) P.push(['roofflat', B(32, 8, 32), () => this.lambert('roofflat', { color: 0x8a8780, map: this.tex('floor' + F.CONCRETE, () => Tex.floorTex(F.CONCRETE, 1)) }), sp[1] - 4, { abs: true }]);
    }
    switch (o) {
      case O.CONTAINER: P.push(['container', B(32, 80, 32), () => this.worldMat('container', () => View3DTex.wall(o)), 40, { tint: this.g.mr.objColor(o, m.tint[y * m.w + x]), shade: true }]); break;
      case O.CAR: {
        // a car covers two tiles: the first tile of each pair draws the whole car, centred between them
        const isCar = (dx, dy) => same(dx, dy, [O.CAR]);
        let ax = 0, ay = 0;
        if (isCar(1, 0) || isCar(-1, 0)) { let s0 = x; while (s0 > 0 && m.obj[y * m.w + s0 - 1] === O.CAR) s0--; if ((x - s0) % 2) break; ax = isCar(1, 0) ? 1 : 0; }
        else if (isCar(0, 1) || isCar(0, -1)) { let s0 = y; while (s0 > 0 && m.obj[(s0 - 1) * m.w + x] === O.CAR) s0--; if ((y - s0) % 2) break; ay = isCar(0, 1) ? 1 : 0; }
        const style = CarModel.pick(x, y), parts = CarModel.build(style), c = this.g.mr.objColor(o, m.tint[y * m.w + x]);
        const flip = hash2(x, y, 5) < 0.5 ? Math.PI : 0, rot = (ay ? -Math.PI / 2 : 0) + flip, off = [ax * T / 2, ay * T / 2];
        const lam = (k, opts) => () => this.lambert(k, opts);
        P.push(['car-' + style + '-paint', () => parts.paint, () => this.matCache.carpaint || (this.matCache.carpaint = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 70, specular: 0x555555 })), 0, { tint: c, rot, off, shade: true }]);
        P.push(['car-' + style + '-glass', () => parts.glass, () => this.matCache.carglass || (this.matCache.carglass = new THREE.MeshPhongMaterial({ color: 0x1d2a33, shininess: 110, specular: 0x9ab0c0 })), 0, { rot, off }]);
        P.push(['car-' + style + '-trim', () => parts.trim, lam('cartrim', { color: 0x1b1b1c }), 0, { rot, off }]);
        P.push(['car-' + style + '-rim', () => parts.rim, () => this.matCache.carrim || (this.matCache.carrim = new THREE.MeshPhongMaterial({ color: 0x9a9da2, shininess: 90, specular: 0xcccccc })), 0, { rot, off }]);
        P.push(['car-' + style + '-lf', () => parts.lightF, () => new THREE.MeshBasicMaterial({ color: 0xf2f0dc }), 0, { rot, off }]);
        P.push(['car-' + style + '-lr', () => parts.lightR, () => new THREE.MeshBasicMaterial({ color: 0xb01818 }), 0, { rot, off }]);
        break;
      }
      case O.CRATE: P.push(['crate', B(28, 30, 28), tileMat(O.CRATE), 15, { shade: true }]); break;
      case O.HAY: P.push(['hay', B(30, 28, 30), tileMat(O.HAY), 14, { shade: true }]); break;
      case O.SANDBAG: P.push(['sandbag', B(32, 32, 32), tileMat(O.SANDBAG), 16, { shade: true }]); break;
      case O.TABLE: P.push(['table', B(28, 4, 24), col(0x6a4a2a), 22]); P.push(['tableleg', B(22, 20, 18), col(0x3a2a1a), 10]); break;
      case O.FENCE: P.push(['fence', B(32, 26, 4), col(0x7a5a36), 13, { rot: horiz([O.FENCE]) ? 0 : Math.PI / 2 }]); break;
      case O.CHAINLINK: P.push(['chain', B(32, 60, 1.5), () => new THREE.MeshLambertMaterial({ map: this.tex('chain', View3DTex.chain), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }), 30, { rot: horiz([O.CHAINLINK]) ? 0 : Math.PI / 2 }]); break;
      case O.LOG: P.push(['log', () => new THREE.CylinderGeometry(9, 9, 32, 10).rotateZ(Math.PI / 2), col(0x5a4128), 9]); break;
      case O.BARREL: P.push(['barrel', () => new THREE.CylinderGeometry(11, 11, 36, 14), col(0x9a2a1a), 18]); break;
      case O.ROCK: P.push(['rock', () => Foliage.rock(16, 1), flat(0x8a877f), 12, { rnd: 0.25 }]); break;
      case O.STONE: P.push(['stone', () => Foliage.rock(15, 2).scale(1, 0.55, 1), flat(0x8f8b80), 6, { rnd: 0.2 }]); break;
      case O.TREE: P.push(['trunk', () => Foliage.trunk(5, 7.5, 84), col(0x4a3520), 42]); P.push(['canopy', () => Foliage.canopy(), flat(0x4f7a2e), 100, { rnd: 0.2, vary: true }]); break;
      case O.PINE: P.push(['ptrunk', () => Foliage.trunk(4, 6, 50), col(0x4a3520), 25]); P.push(['pine', () => Foliage.pine(), flat(0x2f4f2a), 0, { rnd: 0.15, vary: true }]); break;
      case O.PALM: P.push(['palmtrunk', () => Foliage.trunk(3.5, 5, 92, 0.25), col(0x7a6040), 46]); P.push(['palmtop', () => Foliage.palm(), flat(0x5f7f2a), 92, { rnd: 0.2, vary: true }]); break;
      case O.BUSH: P.push(['bush', () => Foliage.bush(), flat(0x3f6a2a), 9, { rnd: 0.25, vary: true }]); break;
      case O.WHEAT: P.push(['wheat', () => { const a = new THREE.PlaneGeometry(32, 38), b = new THREE.PlaneGeometry(32, 38).rotateY(Math.PI / 2); return mergeGeos([a, b]); }, () => new THREE.MeshLambertMaterial({ map: this.tex('wheat', View3DTex.wheat), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }), 19, { rnd: 0.3, spin: true }]); break;
      case O.HEDGE: P.push(['hedge', () => new THREE.BoxGeometry(32, 66, 32, 2, 3, 2).translate(0, 0, 0), () => this.lambert('hedge', { map: this.tex('hedge', () => { const c = View3DTex.cv(32, 64), g = c.getContext('2d'), r = mulberry32(9); g.fillStyle = '#2b5020'; g.fillRect(0, 0, 32, 64); for (let k = 0; k < 140; k++) { g.fillStyle = Tex.shade('#3a6a2a', 0.6 + r() * 0.7); g.fillRect(r() * 32, r() * 64, 2 + r() * 3, 2 + r() * 3); } return c; }) }), 33, { vary: true, shade: true }]); break;
      case O.WIRE: P.push(['wire', () => { const parts = []; for (let k = -1; k <= 1; k++) parts.push(new THREE.TorusGeometry(11, 0.6, 4, 14).translate(0, 0, k * 10)); parts.push(new THREE.BoxGeometry(1.5, 26, 1.5).translate(0, -1, -15)); parts.push(new THREE.BoxGeometry(1.5, 26, 1.5).translate(0, -1, 15)); return mergeGeos(parts).rotateY(Math.PI / 2); }, col(0x5f6264), 12, { rot: horiz([O.WIRE]) ? 0 : Math.PI / 2 }]); break;
      case O.HEDGEHOG: P.push(['hedgehog', () => { const a = new THREE.BoxGeometry(4, 4, 46); return mergeGeos([a.clone().rotateX(0.62), a.clone().rotateX(0.62).rotateY(2.09), a.clone().rotateX(0.62).rotateY(-2.09)]); }, col(0x4a4844), 16, { spin: true }]); break;
      case O.HAYPILE: P.push(['haypile', () => new THREE.SphereGeometry(17, 10, 6).scale(1, 0.45, 1), col(0xc9a845), 3, { rnd: 0.2 }]); break;
      default: if (mat && mat.solid && !mat.wall) P.push(['misc' + o, B(32, 40, 32), col(0x777777), 20]);
    }
    return P;
  }
  buildObjects() {
    const m = this.g.map, counts = {}, defs = {};
    const any = i => m.obj[i] || m.slabs[i] || m.roof[i] || m.lintel[i];
    const RG = 32, rcols = Math.ceil(m.w / RG); this.regionOf = i => (((i / m.w) | 0) / RG | 0) * rcols + ((i % m.w) / RG | 0);
    for (let i = 0; i < m.w * m.h; i++) { if (!any(i)) continue; const r = this.regionOf(i); this.partsFor(i).forEach(p => { const k = p[0] + '#' + r; counts[k] = (counts[k] || 0) + 1; }); }
    // windows can turn into broken windows, which need lintel slots
    this.meshes = {}; this.free = {}; this.slots = new Map(); this.matCache = {}; this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
    this.ensureMesh = (p, key, reg) => {
      if (this.meshes[key]) return this.meshes[key];
      const cap = (counts[key] || 0) + 24;
      const geo = p[1](), rx = (reg % rcols) * RG * T, ry = ((reg / rcols) | 0) * RG * T;
      // bounding sphere of the whole region (instances are spread over it), so the region is culled when off screen
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(rx + RG * T / 2, 150, ry + RG * T / 2), RG * T * 0.75 + 400);
      const mesh = new THREE.InstancedMesh(geo, this.matCache[p[0]] || (this.matCache[p[0]] = p[2]()), cap); mesh.frustumCulled = true;
      if (this.shadows && !NO_SHADOW.has(p[0].replace(/[:\d].*$/, ''))) { mesh.castShadow = true; mesh.receiveShadow = true; }
      for (let k = 0; k < cap; k++) mesh.setMatrixAt(k, this.zero);
      mesh.setColorAt(0, new THREE.Color(1, 1, 1)); for (let k = 1; k < cap; k++) mesh.setColorAt(k, new THREE.Color(1, 1, 1));
      this.scene.add(mesh); this.meshes[key] = mesh; this.free[key] = []; for (let k = cap - 1; k >= 0; k--) this.free[key].push(k);
      return mesh;
    };
    for (let i = 0; i < m.w * m.h; i++) if (any(i)) this.placeTile(i);
    this.buildStructures();
    for (const k in this.meshes) { this.meshes[k].instanceMatrix.needsUpdate = true; this.meshes[k].instanceColor.needsUpdate = true; }
  }
  placeTile(i) {
    const m = this.g.map, x = i % m.w, y = (i / m.w) | 0, o = m.obj[i];
    const old = this.slots.get(i);
    if (old) old.forEach(([k, s]) => { const mesh = this.meshes[k]; mesh.setMatrixAt(s, this.zero); this.free[k].push(s); mesh.instanceMatrix.needsUpdate = true; });
    this.slots.delete(i);
    const list = [], hpf = o ? m.hp[i] / MAT[o].hp : 1;
    const reg = this.regionOf(i);
    this.partsFor(i).forEach(p => {
      const key = p[0] + '#' + reg, mesh = this.ensureMesh(p, key, reg), s = this.free[key].pop(); if (s === undefined) return;
      const opt = p[4] || {}, r = hash2(x, y, 11), sc = opt.rnd ? 1 - opt.rnd / 2 + r * opt.rnd : 1;
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), opt.rot !== undefined ? opt.rot : opt.spin || opt.rnd ? r * 6.28 : 0);
      const off = opt.off || [0, 0];
      const mat = new THREE.Matrix4().compose(new THREE.Vector3(x * T + T / 2 + off[0], p[3] * (opt.rnd ? sc : 1) + (opt.abs ? 0 : m.base ? m.base[i] : 0), y * T + T / 2 + off[1]), q, new THREE.Vector3(sc, sc, sc));
      mesh.setMatrixAt(s, mat);
      const c = new THREE.Color(opt.tint || 0xffffff);
      if (opt.vary) c.multiplyScalar(0.8 + hash2(y, x, 3) * 0.4);
      if (opt.shade && hpf < 0.999) c.multiplyScalar(0.55 + 0.45 * Math.max(0, hpf));
      mesh.setColorAt(s, c); mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
      list.push([key, s]);
    });
    this.slots.set(i, list);
  }
  tileChanged(i) {
    this.placeTile(i);
    // a car spans two tiles: when one changes, its neighbours may need to draw (or stop drawing) the car
    const m = this.g.map, x = i % m.w, y = (i / m.w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < m.w && ny < m.h && m.obj[ny * m.w + nx] === O.CAR) this.placeTile(ny * m.w + nx); }
  }
  buildStructures() {
    const m = this.g.map, S = this.scene;
    // pitched and arched roofs (one mesh per building)
    m.buildings.forEach(b => {
      const st = b.style; if (!st || (st.roof !== 'peaked' && st.roof !== 'arched')) return;
      const i0 = b.y * m.w + b.x; if (!m.roof[i0]) return;
      const h0 = m.roof[i0] + (b.ground || 0), x0 = b.x * T - 6, y0 = b.y * T - 6, w = b.w * T + 12, d = b.h * T + 12, alongX = w >= d;
      let mesh;
      if (st.roof === 'arched') {
        const r = (alongX ? d : w) / 2, len = alongX ? w : d;
        const geo = new THREE.CylinderGeometry(r, r, len, 24, 1, true, 0, Math.PI); geo.rotateZ(Math.PI / 2); geo.scale(1, 0.45, 1); if (!alongX) geo.rotateY(Math.PI / 2);
        mesh = new THREE.Mesh(geo, this.lambert('roofmetal', { map: this.tex('wall' + O.METALWALL + 'r', () => View3DTex.wall(O.METALWALL), [6, 2]), side: THREE.DoubleSide }));
      } else {
        const ridge = Math.min(w, d) * 0.32, hw = (alongX ? d : w) / 2, len = alongX ? w : d;
        // two sloped planes + two gable triangles, built along x then turned if the building is deeper than wide
        const v = [0, 0, -hw, len, 0, -hw, len, ridge, 0, 0, ridge, 0, 0, 0, hw, len, 0, hw];
        const idx = [0, 1, 2, 0, 2, 3, 3, 2, 5, 3, 5, 4, 0, 3, 4, 1, 5, 2];
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 4, 0, 4, 1, 0, 1, 0, 0, 4, 0], 2)); geo.setIndex(idx); geo.computeVertexNormals();
        const colr = b.wall === O.BARNWALL ? 0x6e2a22 : b.wall === O.WOODWALL ? 0x4a3a2a : b.wall === O.FIELDSTONE ? 0x55524e : b.wall === O.STUCCO ? 0x9a4a32 : 0x8a3b2b;
        mesh = new THREE.Mesh(geo, this.lambert('rooftile' + colr, { color: colr, map: this.tex('rooftiles', () => { const c = View3DTex.cv(64, 32), g = c.getContext('2d'); g.fillStyle = '#bbb'; g.fillRect(0, 0, 64, 32); g.fillStyle = 'rgba(0,0,0,0.35)'; for (let y = 0; y < 32; y += 8) { g.fillRect(0, y, 64, 2); for (let x = (y / 8 % 2) * 8; x < 64; x += 16) g.fillRect(x, y, 2, 8); } return c; }, [6, 3]), side: THREE.DoubleSide }));
        if (!alongX) mesh.rotation.y = -Math.PI / 2;
      }
      if (st.roof === 'arched') mesh.position.set(x0 + w / 2, h0, y0 + d / 2);
      else mesh.position.set(alongX ? x0 : x0 + w / 2, h0, alongX ? y0 + d / 2 : y0);
      S.add(mesh);
    });
    // stairs: solid steps
    const stepMat = this.lambert('steps', { map: this.tex('floor' + F.WOOD, () => Tex.floorTex(F.WOOD, 1)) });
    m.stairs.forEach(s => {
      const sb = m.base ? m.base[s.sy * m.w + s.sx] : 0;
      for (let k = 0; k < 8; k++) {
        const h = (k + 1) * ((s.h1 - s.h0) || SH) / 8, len = 16;
        const geo = new THREE.BoxGeometry(s.dx ? len : 30, h, s.dx ? 30 : len), st = new THREE.Mesh(geo, stepMat);
        const along = k * len + len / 2;
        st.position.set(s.sx * T + (s.dx ? (s.dx > 0 ? along : T - along) : T / 2), sb + (s.h0 || 0) + h / 2, s.sy * T + (s.dy ? (s.dy > 0 ? along : T - along) : T / 2));
        S.add(st);
      }
    });
    // ladders: two rails and rungs against the wall
    const ladMat = this.lambert('ladder', { color: 0x6b5a3a });
    m.ladders.forEach(L => {
      const g = new THREE.Group(), top = L.top + 14;
      [-9, 9].forEach(o => { const r = new THREE.Mesh(new THREE.BoxGeometry(2.5, top, 2.5), ladMat); r.position.set(0, top / 2, o); g.add(r); });
      for (let y = 10; y < top; y += 12) { const r = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 18), ladMat); r.position.set(0, y, 0); g.add(r); }
      g.position.set(L.x * T + T / 2 + L.dx * (T / 2 - 4), L.base || 0, L.y * T + T / 2 + L.dy * (T / 2 - 4));
      g.rotation.y = L.dx ? 0 : Math.PI / 2;
      S.add(g);
    });
  }

  // ---------------------------------------------------------------- dynamic things: particles, bullets, projectiles
  buildDynamic() {
    const dotTex = this.tex('dot', View3DTex.dot);
    const mk = (n, additive) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('col', new THREE.BufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('size', new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage));
      const mat = new THREE.ShaderMaterial({
        uniforms: { map: { value: dotTex }, scale: { value: 500 } },
        vertexShader: 'attribute float size; attribute vec4 col; varying vec4 vCol; uniform float scale; void main(){ vCol = col; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = min(900.0, size * scale / max(1.0, -mv.z)); gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'uniform sampler2D map; varying vec4 vCol; void main(){ float a = texture2D(map, gl_PointCoord).a * vCol.a; if (a < 0.01) discard; gl_FragColor = vec4(vCol.rgb, a); }',
        transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; this.scene.add(pts);
      return { pts, geo, n, i: 0, pos: geo.attributes.position.array, col: geo.attributes.col.array, size: geo.attributes.size.array };
    };
    this.addP = mk(3000, true); this.normP = mk(3000, false);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(4000 * 6), 3).setUsage(THREE.DynamicDrawUsage));
    lg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(4000 * 8), 4).setUsage(THREE.DynamicDrawUsage));
    this.lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.lines.frustumCulled = false; this.scene.add(this.lines);
    // pools of simple meshes for projectiles
    this.pools = {};
    this.poolDefs = {
      nade: () => new THREE.Mesh(new THREE.SphereGeometry(4, 8, 6), this.lambert('nade', { color: 0x3d4a2a })),
      c4: () => new THREE.Mesh(new THREE.BoxGeometry(12, 4, 8), this.lambert('c4', { color: 0xd8cfa8 })),
      shell: () => new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 16, 8).rotateZ(Math.PI / 2), this.lambert('shell', { color: 0x4a5a2a })),
      claymore: () => new THREE.Mesh(new THREE.BoxGeometry(4, 10, 14), this.lambert('clay', { color: 0x4a5230 })),
    };
    // search & destroy zone ring
    if (this.g.cfg.mode === 'zone' && this.g.map.zone) {
      const z = this.g.map.zone;
      this.zoneMat = new THREE.MeshBasicMaterial({ color: 0xffd34a, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false });
      this.zoneWall = new THREE.Mesh(new THREE.CylinderGeometry(z.r, z.r, 60, 64, 1, true), this.zoneMat); const zg = groundAt(this.g.map, z.x, z.y); this.zoneWall.position.set(z.x, zg + 30, z.y); this.scene.add(this.zoneWall);
      this.zoneRing = new THREE.Mesh(new THREE.RingGeometry(z.r - 5, z.r, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd34a, transparent: true, opacity: 0.7 })); this.zoneRing.position.set(z.x, zg + 1.5, z.y); this.scene.add(this.zoneRing);
    }
  }
  pool(kind) { const p = this.pools[kind] || (this.pools[kind] = { list: [], used: 0 }); if (p.used >= p.list.length) { const m = this.poolDefs[kind](); this.scene.add(m); p.list.push(m); } const m = p.list[p.used++]; m.visible = true; return m; }
  poolsBegin() { for (const k in this.pools) this.pools[k].used = 0; }
  poolsEnd() { for (const k in this.pools) { const p = this.pools[k]; for (let i = p.used; i < p.list.length; i++) p.list[i].visible = false; } }
  colorOf(c) {
    const k = this._cc || (this._cc = {}); if (k[c]) return k[c];
    let r, g, b; if (c[0] === '#') { const n = parseInt(c.length === 4 ? c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c.slice(1), 16); r = (n >> 16) / 255; g = ((n >> 8) & 255) / 255; b = (n & 255) / 255; } else { [r, g, b] = c.split(',').map(v => +v / 255); }
    return (k[c] = [r, g, b]);
  }
  pushP(sys, x, y, z, size, r, g, b, a) { if (sys.i >= sys.n) return; const i = sys.i++; sys.pos[i * 3] = x; sys.pos[i * 3 + 1] = y; sys.pos[i * 3 + 2] = z; sys.size[i] = size; sys.col[i * 4] = r; sys.col[i * 4 + 1] = g; sys.col[i * 4 + 2] = b; sys.col[i * 4 + 3] = a; }
  // spent cases on the ground: real little cases (brass, or red shotgun hulls) that fly out, bounce down and lie there
  updateCasings3D(dt, dim) {
    const G = this.g, list = G.casings || [];
    if (!this.casingMesh) {
      const mk = (geo, color, n) => { const im = new THREE.InstancedMesh(geo, new THREE.MeshPhongMaterial({ color, shininess: 80, specular: 0x886633 }), n); im.frustumCulled = false; im.count = 0; this.scene.add(im); return im; };
      this.casingMesh = mk(new THREE.CylinderGeometry(0.32, 0.3, 1, 8).rotateZ(Math.PI / 2), 0xc9a23a, 400);
      this.hullMesh = mk(new THREE.CylinderGeometry(0.62, 0.62, 1, 8).rotateZ(Math.PI / 2), 0xa32a1f, 400);
      this.casingDummy = new THREE.Object3D();
    }
    G.casings = list.filter(c => (c.t += dt) < c.life);
    let nb = 0, nh = 0; const d = this.casingDummy;
    for (const c of G.casings) {
      if (!c.landed) {
        // (a case handed over from the first-person view starts at that view's gravity and speeds up to full gravity)
        c.vz -= (c.g0 ? c.g0 + (600 - c.g0) * Math.min(1, c.t / 0.5) : 600) * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt; c.yaw += c.spin * dt;
        const floor = G.supportAt ? G.supportAt(c.x, c.y, c.z + 6, 1) : groundAt(G.map, c.x, c.y);
        if (c.z <= floor + 0.3) { c.z = floor + 0.3; if (c.vz < -60) { c.vz *= -0.3; c.vx *= 0.5; c.vy *= 0.5; } else c.landed = true; }
      }
      if (c.t < c.hide) continue;
      const sink = c.life - c.t < 1 ? (1 - (c.life - c.t)) * 0.6 : 0; // fades into the ground at the end, like bodies
      d.position.set(c.x, c.z - sink, c.y); d.rotation.set(c.landed ? 0 : c.t * 9, c.yaw, 0); d.scale.set(c.len, 1, 1); d.updateMatrix();
      if (c.hull) this.hullMesh.setMatrixAt(nh++, d.matrix); else this.casingMesh.setMatrixAt(nb++, d.matrix);
    }
    this.casingMesh.count = nb; this.hullMesh.count = nh; this.casingMesh.instanceMatrix.needsUpdate = this.hullMesh.instanceMatrix.needsUpdate = true;
    this.casingMesh.material.color.setHex(0xc9a23a).multiplyScalar(dim); this.hullMesh.material.color.setHex(0xa32a1f).multiplyScalar(dim);
  }
  updateParticles(dim) {
    const G = this.g, m = G.map, A = this.addP, N = this.normP; A.i = N.i = 0;
    const cx = this.camera.position.x, cz = this.camera.position.z;
    for (const p of G.particles) {
      const k = p.life / p.max;
      if (Math.abs(p.x - cx) > 2200 || Math.abs(p.y - cz) > 2200) continue;
      switch (p.type) {
        case 'flash': if (Math.hypot(p.x - cx, p.y - cz) > 60) this.pushP(A, p.x, p.z !== undefined ? p.z : MUZZLE_H, p.y, 30 * p.size, 1, 0.8, 0.4, 0.9); break;
        case 'spark': this.pushP(A, p.x, (p.z !== undefined ? p.z : groundAt(m, p.x, p.y)) + 20 + 25 * k, p.y, 3, 1, 0.75, 0.3, k); break;
        case 'fire': this.pushP(A, p.x, (p.z !== undefined ? p.z : groundAt(m, p.x, p.y)) + 8 + (1 - k) * 40, p.y, p.size * 2.4, 1, 0.55 + 0.3 * k, 0.2, Math.min(1, k * 1.3)); break;
        case 'glow': { const c = this.colorOf(p.color || '255,200,120'); this.pushP(A, p.x, (p.z !== undefined ? p.z : groundAt(m, p.x, p.y)) + 30, p.y, p.size * 2.2, c[0], c[1], c[2], 0.8 * k); break; }
        case 'smoke': { const c = this.colorOf(p.color || '200,200,200'); this.pushP(N, p.x, (p.z !== undefined ? p.z : groundAt(m, p.x, p.y)) + (p.top ? 14 : 8) + (1 - k) * 55, p.y, p.size * 3.4, c[0] * dim, c[1] * dim, c[2] * dim, Math.min(1, (p.alpha || 0.6) * k * 1.5)); break; }
        case 'blood': this.pushP(N, p.x, (p.z !== undefined ? p.z : groundAt(m, p.x, p.y)) + 4 + 36 * k, p.y, p.size * 2.2, 0.55 * dim, 0.05 * dim, 0.05 * dim, k); break;
        case 'debris': { const c = this.colorOf(p.color || '#888'); this.pushP(N, p.x, (p.z !== undefined ? p.z : groundAt(m, p.x, p.y)) + 3 + 30 * k * k, p.y, p.size * 1.6, c[0] * dim, c[1] * dim, c[2] * dim, Math.min(1, k * 2)); break; }
        case 'casing': { const h = (p.z !== undefined ? p.z : groundAt(m, p.x, p.y)) + Math.max(1, 40 * (k - 0.86) / 0.14); this.pushP(N, p.x, h, p.y, 2.6, 0.8 * dim, 0.63 * dim, 0.25 * dim, 1); break; }
      }
    }
    // bullets: tracer heads and flames become glowing points, the rest streaks
    const L = this.lines.geometry, lp = L.attributes.position.array, lc = L.attributes.color.array; let li = 0;
    for (const b of G.bullets) {
      if (b.flame) { const life = b.dist / b.range; this.pushP(A, b.x, (b.z !== undefined ? b.z : MUZZLE_H) - 6 * life, b.y, 10 + life * 34, 1, 0.55 + 0.3 * (1 - life), 0.15, Math.max(0.1, 0.9 - life * 0.6)); continue; }
      if (b.dragon) { this.pushP(A, b.x, b.z !== undefined ? b.z : MUZZLE_H, b.y, 12, 1, 0.6, 0.2, 1); continue; }
      if (li >= 4000) continue;
      // streak = how far the bullet travelled this frame (real bullet speeds), tracers glow, ordinary rounds are faint
      const len = Math.min(b.dist, Math.max(40, (b.speed || 2000) * (this.fdt || 1 / 60)) * (b.tracer ? 1 : 0.6), 900), a = b.tracer ? 1 : this.g.night ? 0.08 : 0.3;
      const c0 = b.tracer ? [1, 0.35, 0.15] : [1, 0.9, 0.65];
      const bz = b.z !== undefined ? b.z : MUZZLE_H; lp.set([b.x - b.dx * len, bz - (b.dz || 0) * len, b.y - b.dy * len, b.x, bz, b.y], li * 6);
      lc.set([c0[0], c0[1], c0[2], 0, c0[0], c0[1], c0[2], a], li * 8); li++;
      if (b.tracer) this.pushP(A, b.x, bz, b.y, 7, 1, 0.45, 0.2, 1);
    }
    L.setDrawRange(0, li * 2); L.attributes.position.needsUpdate = true; L.attributes.color.needsUpdate = true;
    // flares hang in the sky
    for (const f of G.flares) this.pushP(A, f.x, 220, f.y, 40 + Math.random() * 10, 1, 1, 0.95, 1);
    for (const S of [A, N]) { S.geo.setDrawRange(0, S.i); S.geo.attributes.position.needsUpdate = true; S.geo.attributes.col.needsUpdate = true; S.geo.attributes.size.needsUpdate = true; }
  }
  updateProjectiles() {
    const G = this.g; this.poolsBegin();
    for (const n of G.nades) {
      const flying = ['rocket', 'gl', 'he12', 'illum', 'smoke40'].includes(n.kind);
      if (flying) { const m = this.pool('shell'); m.position.set(n.x, n.z || MUZZLE_H, n.y); m.rotation.set(0, -Math.atan2(n.vy || 0, n.vx || 1), 0); if (n.kind === 'rocket') this.pushP(this.addP, n.x - (n.vx || 0) * 0.012, n.z || MUZZLE_H, n.y - (n.vy || 0) * 0.012, 14, 1, 0.7, 0.3, 1); continue; }
      const h = (n.z || 0) - 4 + (n.air && n.t < n.air ? Math.sin(n.t / n.air * Math.PI) * 70 : 0);
      const m = this.pool(n.kind === 'c4' ? 'c4' : 'nade'); m.position.set(n.x, 4 + h, n.y);
      if (n.kind === 'molotov') this.pushP(this.addP, n.x, 10 + h, n.y, 8 + Math.random() * 5, 1, 0.6, 0.2, 1);
      if (n.kind === 'c4' && Math.sin(G.time * 10) > 0) this.pushP(this.addP, n.x, 7 + h, n.y, 4, 1, 0.1, 0.1, 1);
    }
    for (const c of G.claymores) { const m = this.pool('claymore'); m.position.set(c.x, (c.z || 0) + 5, c.y); m.rotation.set(0, -c.a, 0); }
    this.poolsEnd();
  }

  // ---------------------------------------------------------------- soldiers
  buildSoldier(u, dead) {
    const mats = [], M = opts => { const m = new THREE.MeshLambertMaterial(opts); mats.push(m); return m; };
    const arm = u.lo && ITEMS[u.lo.armor], hasVest = arm && arm.id !== 'noarmor';
    const root = Soldier3D.build({
      uniform: M({ map: this.camo(u.uniform || 'multicam', true) }), skin: M({ color: 0xc9a07a }), boots: M({ color: 0x2a241c }), dark: M({ color: 0x3d3b30 }),
      helmet: M({ color: 0x4a6322 }), band: M({ color: 0x43a047 }),
      vest: hasVest ? M({ map: this.camo(u.skins && u.skins[arm.id] || 'olive') }) : null, vestSize: !hasVest ? 1 : arm.id === 'eod' ? 1.3 : arm.reduce >= 30 ? 1.1 : 1,
      face: u.face || null, gear: !!(u.gear && u.gear.vision), mats,
    });
    if (this.g.mods && this.g.mods.has('bigheads')) root.userData.head.scale.setScalar(1.9);
    const grp = new THREE.Group(); grp.add(root);
    grp.userData = { root, gun: root.userData.gun, helmetMat: root.userData.helmetMat, band: root.userData.band, mats };
    if (this.shadows) root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    if (dead) Soldier3D.pose(root, { dead: true });
    return grp;
  }
  updateUnits(viewer, thermal) {
    const G = this.g, seen = new Set(), me = G.byId[G.localId];
    for (const u of G.units) {
      let v = this.unitViews.get(u);
      if (!v) { v = { grp: this.buildSoldier(u), weapon: null }; this.unitViews.set(u, v); this.scene.add(v.grp); }
      seen.add(u);
      const firstPerson = u === (G.camTarget || null);
      // a unit is hidden only after it has been out of sight for a moment (concealment flickers as soldiers brush past bushes)
      const vis = !viewer || G.visibleTo(viewer, u); if (vis) v.seenT = G.time;
      const show = u.alive && !firstPerson && (vis || G.time - (v.seenT === undefined ? -9 : v.seenT) < 0.3);
      v.grp.visible = show; if (!show) continue;
      v.grp.position.set(u.x, u.z || 0, u.y); v.grp.rotation.y = -u.angle;
      const d = v.grp.userData;
      const it = ITEMS[u.slots[u.slot]];
      const ws = it && G.wstat(u), wkey = it ? it.id + '|' + ((ws && ws.atts) || []).join(',') + '|' + ((u.skins && u.skins[it.id]) || '') : '';
      if (v.weapon !== wkey) {
        v.weapon = wkey; d.gun.clear();
        if (it && it.id !== 'fists') { const gm = GunModel.get(it, { merged: true, atts: (ws && ws.atts) || [], camoId: u.skins && u.skins[it.id], camo: u.skins && u.skins[it.id] && u.skins[it.id] !== 'factory' ? this.lambert('vmcamo' + u.skins[it.id], { map: this.camo(u.skins[it.id]) }) : null }); gm.scale.setScalar(1.15); if (this.shadows) gm.traverse(o => { if (o.isMesh) o.castShadow = true; }); d.gun.add(gm); }
        // support hand on the gun's real foregrip (the soldier rig puts it at gunLen * 0.42 forward of the grip)
        v.gunLen = it ? ((d.gun.children[0] && d.gun.children[0].userData.foreDist) || Math.max(10, Art.weaponLen(it)) * 0.3) * 1.15 / 0.42 : 0;
      }
      // pose the rig: stance, the classic walk cycle, aim pitch, melee swing
      const swing = u.swingT > 0 ? 1 - u.swingT / 0.28 : 0;
      Soldier3D.pose(d.root, { stance: u.stance, walk: u.walk || 0, moving: u.moving,
        pitch: u.pitch || 0, weapon: it, gunLen: v.gunLen, swing, swingYaw: swing ? 0.9 - swing * 1.8 : 0 });
      v.laser = ws && ws.laser && u.alive ? ws.laser : null;
      const friendly = me && (u === me || !G.ffa && u.team === me.team);
      d.helmetMat.color.set(friendly ? 0x4a6322 : 0x262626); d.band.color.set(friendly ? 0x43a047 : 0xd32f2f);
      const hot = thermal ? 1 : 0; if (d.hot !== hot) { d.hot = hot; d.mats.forEach(m => m.emissive.setScalar(hot ? 0.85 : 0)); }
      if (u.invulnT > 0) d.mats.forEach(m => m.emissive.setScalar(0.25 + Math.sin(G.time * 20) * 0.2)); else if (!hot && d.mats[0].emissive.r) d.mats.forEach(m => m.emissive.setScalar(0));
    }
    for (const [u, v] of this.unitViews) if (!seen.has(u)) { this.scene.remove(v.grp); this.unitViews.delete(u); }
    // corpses
    const live = new Set(G.corpses);
    for (const c of G.corpses) if (!this.corpseViews.has(c)) {
      const grp = this.buildSoldier({ uniform: c.uniform, lo: { armor: c.armor }, skins: { [c.armor]: c.armorSkin }, face: c.face }, true);
      grp.position.set(c.x, c.z || 0, c.y); grp.rotation.y = -c.angle + (hash2(Math.round(c.x), Math.round(c.y), 3) - 0.5) * 0.8; grp.userData.helmetMat.color.set(c.helmet === 'green' ? 0x4a6322 : 0x262626); grp.userData.band.color.set(c.helmet === 'green' ? 0x43a047 : 0xd32f2f);
      this.scene.add(grp); this.corpseViews.set(c, grp);
    }
    for (const [c, grp] of this.corpseViews) {
      if (!live.has(c)) { this.scene.remove(grp); this.corpseViews.delete(c); continue; }
      const warm = thermal ? Math.max(0, 0.5 * (1 - (G.time - (c.born || 0)) / 30)) : 0; grp.userData.mats.forEach(m => m.emissive.setScalar(warm));
      // the body sinks into the ground over its last three seconds
      const age = G.time - (c.born || 0), ttl = c.ttl || 45; grp.position.y = (c.z || 0) - (age > ttl - 3 ? (age - ttl + 3) / 3 * 10 : 0);
    }
  }

  // ---------------------------------------------------------------- search & destroy castle
  buildCastle(b) {
    const grp = new THREE.Group(), stone = this.worldMat('castle', () => View3DTex.wall(O.FIELDSTONE)), dark = this.lambert('castled', { color: 0x6d695f });
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); grp.add(m); return m; };
    const s = BASE_HALF;
    add(new THREE.BoxGeometry(s * 2 - 8, 44, s * 2 - 8), stone, 0, 22, 0);
    for (let k = -s + 8; k <= s - 8; k += 9) { add(new THREE.BoxGeometry(5, 7, 5), dark, k, 47, -s + 5); add(new THREE.BoxGeometry(5, 7, 5), dark, k, 47, s - 5); add(new THREE.BoxGeometry(5, 7, 5), dark, -s + 5, 47, k); add(new THREE.BoxGeometry(5, 7, 5), dark, s - 5, 47, k); }
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([dx, dz]) => { add(new THREE.CylinderGeometry(10, 11, 60, 12), stone, dx * (s - 6), 30, dz * (s - 6)); add(new THREE.ConeGeometry(12, 16, 12), dark, dx * (s - 6), 68, dz * (s - 6)); });
    add(new THREE.BoxGeometry(24, 70, 24), stone, 0, 35, 0);
    add(new THREE.BoxGeometry(10, 18, 2), this.lambert('gate', { color: 0x3a2a1a }), 0, 9, s - 3.5);
    add(new THREE.CylinderGeometry(0.8, 0.8, 40, 6), dark, 0, 90, 0);
    const flagMat = new THREE.MeshLambertMaterial({ color: 0xe53935, side: THREE.DoubleSide });
    const flag = add(new THREE.PlaneGeometry(18, 11), flagMat, 9, 103, 0);
    grp.position.set(b.x, b.gz !== undefined ? b.gz : groundAt(this.g.map, b.x, b.y), b.y); this.scene.add(grp);
    return { b, grp, flagMat, flag, stoneMats: [stone] };
  }
  updateBases(me) {
    for (const v of this.baseViews) {
      v.grp.visible = v.b.hp > 0;
      v.flagMat.color.set(me && v.b.team === me.team ? 0x43a047 : 0xe53935);
      v.flag.rotation.y = Math.sin(this.g.time * 3) * 0.3;
      v.grp.scale.y = 0.75 + 0.25 * (v.b.hp / BASE_HP);
    }
  }

  // ---------------------------------------------------------------- first-person weapon
  buildViewmodelRig() {
    this.vmRoot = new THREE.Group(); this.vmScene.add(this.vmRoot);
    this.vmFlash = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex('dot', View3DTex.dot), color: 0xffc060, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.vmFlash.scale.set(9, 9, 1); this.vmScene.add(this.vmFlash);
  }
  buildGunModel(it, skin, uniform, atts) {
    const sleeve = this.lambert('vmsleeve' + uniform, { map: this.camo(uniform || 'multicam', true) }), skinM = this.lambert('vmskin', { color: 0xc9a07a });
    const camo = skin && skin !== 'factory' ? this.lambert('vmcamo' + skin, { map: this.camo(skin) }) : null;
    const g = GunModel.get(it, { atts: atts || [], camo, camoId: skin });
    const box = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); return b; };
    const L = Math.max(10, Art.weaponLen(it)) * 0.525;
    if (it.id === 'fists') { box(2.2, 2.2, 3, skinM, -1.5, 0, -3); box(2.2, 2.2, 3, skinM, 3, 0.3, -2); box(2.6, 2.6, 8, sleeve, -1.5, -0.5, 2); box(2.6, 2.6, 8, sleeve, 3, -0.2, 3); g.userData.tip = new THREE.Vector3(0, 0, -6); return g; }
    // the hands: the firing hand on the grip and the support hand, each a group the animations move; each sleeve is
    // aimed back at its shoulder wherever its hand goes
    const mkHand = (name, w, h, d, armW, x, y, z, sx, sy, sz) => {
      const hg = new THREE.Group(); hg.name = name; hg.position.set(x, y, z); g.add(hg);
      hg.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), skinM));
      const arm = new THREE.Mesh(new THREE.BoxGeometry(armW, armW, 10), sleeve); arm.name = 'vmArm'; hg.add(arm);
      hg.userData.rest = hg.position.clone(); hg.userData.shoulder = hg.position.clone().add(new THREE.Vector3(sx, sy, sz)); return hg;
    };
    mkHand('vmGrip', 2.2, 2.4, 2.6, 2.8, 0.2, -2.6, -0.5, 0.8, -1.6, 10);
    const long = it.cat === 'primary' || it.type === 'Submachine Gun';
    const hz = !long ? 1.5 : it.type === 'Rocket Launcher' ? -L * 0.32 : -(g.userData.foreDist || L * 0.6), hy = !long ? -5 : (g.userData.foreY === undefined ? -0.4 : g.userData.foreY) - 0.9;
    const hand = mkHand('vmHand', 2, 2, 2.4, 1.9, -0.4, hy, hz, -4.6, -4.6, 9.4); hand.visible = hand.userData.idle = long;
    g.scale.setScalar(VM_SCALE); g.userData.sightY = (g.userData.sightY || 1.6) * VM_SCALE;
    // the Barrett's stock is so long its butt would end up behind the camera: hold it further out so the whole
    // stock stays in frame, butt plate just in front of the clip plane
    g.userData.vmPush = it.type === 'Anti-Materiel Rifle' ? Math.max(0, (g.userData.stockLen || 0) * VM_SCALE - 5.0) : 0;
    return g;
  }
  updateViewmodel(me, dt, visible, light) {
    const G = this.g, vm = this.vm;
    this.vmRoot.visible = visible; this.vmFlash.visible = false;
    this.updateCases(dt); for (const c of this.vmCases || []) if (!visible) { c.life = 0; c.mesh.visible = false; }
    if (!visible || !me) return;
    { const cw = G.wstat(me); if (me.scoped && cw && (cw.scope || (cw.optic && cw.optic.scopeKind)) && (vm.ads || 0) > 0.85) { this.vmRoot.visible = false; } }
    const showId = me.swingT > 0 && ITEMS[me.slots[me.slot]].cat !== 'melee' ? me.slots[3] || 'fists' : me.slots[me.slot];
    const it = ITEMS[showId], ws = it.cat === 'melee' || showId !== me.slots[me.slot] ? it : G.wstat(me), atts = (ws && ws.atts) || [], key = showId + ':' + (me.skins[showId] || '') + ':' + atts.join(',');
    if (vm.id !== key) { if (vm.model) this.vmRoot.remove(vm.model); vm.model = this.buildGunModel(it, me.skins[showId], me.uniform, atts); this.vmRoot.add(vm.model); vm.id = key; vm.swap = 1; vm.shotT = undefined; }
    if (me.slot !== vm.lastSlot) { vm.swap = 1; vm.lastSlot = me.slot; vm.shotT = undefined; }
    vm.swap = Math.max(0, vm.swap - dt * 4); vm.kick = Math.max(0, vm.kick - dt * 9); vm.flash = Math.max(0, vm.flash - dt);
    const ads = me.scoped && it.cat !== 'melee';
    vm.ads = (vm.ads || 0) + ((ads ? 1 : 0) - (vm.ads || 0)) * Math.min(1, dt * 12);
    const bobA = me.moving ? 1 - vm.ads * 0.8 : 0, w = me.walk || 0;
    const rTime = (ws && ws.reload) || it.reload || 1;
    let reload = G.auth ? (me.reloadT > 0 ? 1 - me.reloadT / rTime : 0) : me.reloadPct || 0;
    if (!G.auth) reload = vm.rlP = reload > 0 ? Math.min(1, Math.max(reload, (vm.rlP || 0) + dt / rTime)) : 0; // between snapshots
    reload = Math.max(0, Math.min(1, reload));
    // what the reload has to do, worked out when it starts: rounds to load one at a time, and whether the gun is empty
    // (an empty gun has its bolt / slide / action open and needs a round chambering at the end)
    const left = (me.mag && me.mag[me.slot]) || 0;
    if (reload > 0 && !vm.rlOn) { vm.rlOn = true; vm.rlStart = G.time; vm.rlN = Math.max(1, ((ws && ws.mag) || it.mag || 1) - left); vm.rlEmpty = left <= 0; } else if (reload <= 0) vm.rlOn = false;
    if (!vm.rig || vm.rig.g !== vm.model) vm.rig = this.reloadRig(vm.model, it, atts);
    const R = vm.rig, rk = R.kind;
    // manual actions are worked after every shot: the bolt (firing hand) or the pump (support hand)
    const cyc = R.manual && vm.shotT !== undefined && reload <= 0 ? (G.time - vm.shotT - 0.06) / R.cycleDur : -1, ce = cyc > 0 && cyc < 1 ? Math.sin(cyc * Math.PI) : 0;
    const ramp = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }, rl = vm.rl = reload > 0 ? ramp(reload / 0.12) * ramp((1 - reload) / 0.1) : 0; // tilt in, hold, tilt back
    const swing = me.swingT > 0 ? 1 - me.swingT / 0.28 : 0;
    const sy = vm.model.userData.sightY || 1.6, adsY = ws && ws.optic ? -sy - 0.05 : -0.6 - sy;
    const x = 3.4 * (1 - vm.ads) + Math.sin(w) * 0.35 * bobA - rl * 1.1 - ce * 0.4, y = -3.9 * (1 - vm.ads) + adsY * vm.ads + Math.abs(Math.cos(w)) * 0.3 * bobA - vm.swap * 6;
    // [pitch, yaw, roll, right, up, back]: each kind of reload holds the gun so the loading happens in view
    const pose = this.reloadPose(R, reload, vm.rlEmpty), cr = R.manual === 'bolt' ? 0.9 : 0.08, cy = R.manual === 'bolt' ? 0.45 : 0;
    const cb = R.manual === 'bolt' ? ce : ce * 0.3; // working a bolt: the rifle comes out a little so the hand on it doesn't fill the view
    this.vmRoot.position.set(x + rl * (pose[3] + 1.1) - cb * 2.2, y + rl * pose[4] + cb * 1.2, -8.5 - (vm.model.userData.vmPush || 0) + vm.kick * 1.4 * (1 - 0.5 * vm.ads) - rl * pose[5] - cb * 5);
    this.vmRoot.rotation.set(vm.kick * 0.1 + rl * pose[0] + ce * 0.06 + (swing ? Math.sin(swing * Math.PI) * 0.5 : 0), (swing ? -Math.sin(swing * Math.PI) * 0.8 : 0) + Math.sin(w * 0.5) * 0.01 * bobA + rl * pose[1] + ce * cy, rl * pose[2] + ce * cr);
    this.vmRoot.updateMatrixWorld(true);
    this.animateReload(R, reload, { n: vm.rlN || 1, empty: !!vm.rlEmpty, cyc, kick: vm.kick, dry: left <= 0 && it.mag > 0, ammo: left, shots: vm.shots || 0, sinceShot: vm.shotT === undefined ? 9 : G.time - vm.shotT, rpm: (ws && ws.rpm) || it.rpm || 600 });
    if (R.manual && R.ej) {
      const out = R.manual === 'pump' ? 0.22 : 0.4;
      if (cyc >= out && cyc < 1 && vm.ejectedFor !== vm.shotT) { vm.ejectedFor = vm.shotT; this.spawnCase(R); }
      if (reload > 0.07 && vm.rlEmpty && vm.ejectedFor !== 'rl' + vm.rlStart && R.manual === 'bolt') { vm.ejectedFor = 'rl' + vm.rlStart; this.spawnCase(R); }
    }
    if (vm.model.userData.spin) vm.model.userData.spin.rotation.z = G.time * 40 * (me.spin || 0);
    if (vm.flash > 0.03 && !it.flame && it.cat !== 'melee') { const tp = vm.model.userData.tip.clone(); vm.model.localToWorld(tp); this.vmFlash.position.copy(tp); this.vmFlash.visible = true; this.vmFlash.material.rotation = Math.random() * 6; const s = (it.pellets || it.type.includes('Heavy') ? 14 : 9) * (0.8 + Math.random() * 0.4); this.vmFlash.scale.set(s, s, 1); }
    // weapon brightness follows the world light
    const lv = !G.night ? 1 : me.gearOn && me.gear.vision ? 0.9 : Math.min(1, 0.07 + (light ? 0.2 : 0) + (vm.flash > 0.03 ? 0.8 : 0) + (this.localLit || 0));
    this.vmHemi.intensity = lv; this.vmSun.intensity = 0.6 * lv;
  }
  kick() { const vm = this.vm; vm.kick = 1; vm.flash = 0.06; vm.shotT = this.g.time; vm.shots = (vm.shots || 0) + 1; if (vm.rig && vm.rig.ej && !vm.rig.manual) this.spawnCase(vm.rig); }
  spawnCase(R) {
    const ej = R.ej, g = R.g, V = THREE.Vector3, G = this.g; if (!ej) return;
    // aiming (or looking through a scope) the gun is up at the eye: the case comes out of your real gun, in the world, at
    // its true size, instead of out of the enlarged first-person model right in front of the camera
    if (!this.vmRoot.visible || (this.vm.ads || 0) > 0.5) { const me = G.byId[G.localId], it = me && G.wstat(me); if (me && it) G.spawnCasing([0, me.id, me.x, me.y, me.angle], it, true); return; }
    const pool = this.vmCases || (this.vmCases = []);
    let c = pool.find(o => o.life <= 0 && o.key === ej.key);
    if (!c) {
      if (pool.length >= 24) { const o = pool.reduce((a, b) => a.life < b.life ? a : b); this.vmScene.remove(o.mesh); pool.splice(pool.indexOf(o), 1); }
      const grp = new THREE.Group(), M = this.vmMats;
      if (ej.hull) { const h = new THREE.Mesh(new THREE.CylinderGeometry(ej.r, ej.r, ej.l * 0.8, 10).rotateX(Math.PI / 2), M.shell); h.position.z = -ej.l * 0.1; grp.add(h); const b = new THREE.Mesh(new THREE.CylinderGeometry(ej.r * 1.05, ej.r * 1.05, ej.l * 0.2, 10).rotateX(Math.PI / 2), M.brass); b.position.z = ej.l * 0.4; grp.add(b); }
      else grp.add(new THREE.Mesh(new THREE.CylinderGeometry(ej.r, ej.r * 0.85, ej.l, 10).rotateX(Math.PI / 2), M.brass));
      c = { mesh: grp, key: ej.key, v: new V(), w: new V(), life: 0 }; this.vmScene.add(grp); pool.push(c);
    }
    { c.lenVm = ej.l * g.scale.x; c.lenW = ej.lenW; c.hull = ej.hull;
    }
    g.updateMatrixWorld(true);
    const m3 = new THREE.Matrix3().setFromMatrix4(g.matrixWorld), r = Math.random;
    // out of the port: to the right and up (most guns), down (P90, KSG, heavy MGs), right and down (belt-fed), left (PKM)
    const dv = { right: [7, 7.5, 2], rightdown: [7, 5, 1.5], left: [-7, 7.5, 2], down: [0.8, -3, 1] }[ej.dir] || [7, 7.5, 2];
    c.mesh.position.copy(ej.p).applyMatrix4(g.matrixWorld);
    c.mesh.quaternion.setFromRotationMatrix(g.matrixWorld); c.mesh.rotateY(Math.PI / 2 + (r() - 0.5) * 0.4);
    c.mesh.scale.setScalar(VM_SCALE * g.scale.x / VM_SCALE);
    c.v.set(dv[0] * (0.85 + r() * 0.3), dv[1] * (0.85 + r() * 0.3), dv[2] * (0.7 + r() * 0.6)).applyMatrix3(m3);
    c.w.set((r() - 0.5) * 30, 18 + r() * 12, (r() - 0.5) * 10); c.life = 2.5; c.age = 0; c.mesh.visible = true;
  }
  caseToWorld(c) {
    const G = this.g, cam = this.camera; if (!G.casings || !c.lenW) return;
    cam.updateMatrixWorld();
    // same screen position and size: x, y scaled for the wider world field of view, the whole thing by the size ratio
    const f = Math.tan(cam.fov * Math.PI / 360) / Math.tan(30 * Math.PI / 180), k = c.lenW / c.lenVm / f, p = c.mesh.position, v = c.v;
    const wp = new THREE.Vector3(p.x * f * k, p.y * f * k, p.z * k).applyMatrix4(cam.matrixWorld);
    const wv = new THREE.Vector3(v.x * f * k, v.y * f * k, v.z * k).applyQuaternion(cam.quaternion);
    G.casings.push({ x: wp.x, y: wp.z, z: wp.y, vx: wv.x, vy: wv.z, vz: wv.y, g0: 22 * f * k, len: c.lenW, hull: !!c.hull, yaw: Math.random() * 6.28, spin: (Math.random() - 0.5) * 30, t: 0, life: 15 + Math.random() * 15, landed: false, hide: 0 });
    if (G.casings.length > 400) G.casings.shift();
  }
  updateCases(dt) {
    for (const c of this.vmCases || []) {
      if (c.life <= 0) continue;
      c.life -= dt; c.age = (c.age || 0) + dt;
      c.v.y -= 22 * dt; c.mesh.position.addScaledVector(c.v, dt);
      // once it leaves the screen (or after a while) the same case carries on in the world and lands on the ground
      const s = c.mesh.position.clone().project(this.vmCam);
      if (c.life <= 0 || (c.age > 0.05 && (Math.abs(s.x) > 1.05 || s.y < -1.05))) { this.caseToWorld(c); c.life = 0; c.mesh.visible = false; continue; }
      c.mesh.rotation.x += c.w.x * dt; c.mesh.rotation.y += c.w.y * dt; c.mesh.rotation.z += c.w.z * dt;
    }
  }

  // ---------------------------------------------------------------- reloads and manual actions
  // Each gun is reloaded the way the real one is (see the table in reloadRig). Everything is worked out in the gun
  // model's own space (g): the moving parts of the model are named groups made by the gun builders (magazine, drum,
  // cylinder, crane, loading gate, ejector rod, feed cover, ammo box, bolt, pump, charging handle, slide, rocket,
  // igniters); spare pieces are made here (the magazine that drops away, cases, shells, rounds, clips, speed loader).
  reloadPose(R, p, empty) {
    const P = {
      mag: [0.2, 0.6, -0.6, -2.5, 1.5, 6], boltmag: [0.2, -0.45, 0.45, -2.2, 1.2, 6], belt: [0.2, 0.6, -0.6, -2.5, 2.2, 7],
      tube: [0.2, 0.6, -0.6, -2.5, 1.5, 6], port: [0.15, -0.5, 0.75, -2.2, 1.5, 6],
      cylinder: [0.6, 0.4, 0.3, -2.0, 1.5, 3], speedloader: [0.6, 0.4, 0.3, -2.0, 1.5, 3], gate: [0.5, -0.5, 0.3, -1.5, 1.5, 3], gl: [0.5, 0.5, 0.3, -2.0, 1.5, 6],
      top: [0.2, 0.6, 0.9, -2.5, 1.5, 6], rocket: [0.25, -1.0, 0.2, -3, 0, 18], igniter: [0.2, -0.9, 0.2, -3, 0.5, 16],
    }, k = R.kind;
    if (window._rlPose && window._rlPose[k]) return window._rlPose[k];
    if (k === 'shells' && R.ud.ejBottom) return [0.2, 0.8, -2.9, -3, 1, 12]; // KSG: rolled over, the port under the butt faces up
    if (k === 'shells') return P.port;
    if (k === 'shells') { if (!empty) return P.tube; const t = Math.max(0, Math.min(1, (p - 0.22) / 0.08)), a = P.port, b = P.tube; return a.map((v, i) => v + (b[i] - v) * t * t * (3 - 2 * t)); }
    if (k === 'stripper' || k === 'enbloc' || k === 'single') return P.top;
    if (k === 'mag' && R.ud.manual === 'bolt') return P.boltmag;
    if (k === 'mag' && R.ud.wellView) return [0.4, 0.9, -0.4, -3, 1.5, 7];
    if (k === 'mag' && (R.ud.magAxis || R.ud.slideTravel)) return [0.5, 0.6, -0.6, -2.5, 4, 5]; // handguns: up, so the magazine under the grip stays in view
    if (k === 'mag' && R.ud.topMag) return [0.3, 0.8, 0.5, -3, 0, 10]; // P90: seen from the side, the magazine laid on top front end first
    return P[k] || [0.22, -0.25, 0.6, -1.1, -0.9, 0];
  }
  reloadRig(g, it, atts) {
    // how each gun is reloaded (as the real ones are):
    //  mag          box / curved / drum magazine swapped (AK-pattern rifles rock it in front lug first; P90 front end
    //               first; Thompson drum and Sten from the side; handgun magazines along the grip's rake); an empty
    //               gun then has its bolt sent home (charging handle, AR bolt catch, pistol slide release); bolt-action
    //               rifles with box magazines (AWM, L96) open the bolt first and close it last
    //  belt         feed cover up, ammo box (with its belt) swapped, belt laid in the tray, cover down
    //  shells       tube shotguns: shells pushed through the loading port under the receiver into the tube; an empty
    //               gun first gets a shell dropped into the ejection port and the action closed on it (pump guns pump)
    //  stripper     Mosin, K98k, Enfield, SVT-40: bolt open, 5-round clips in the guide, rounds thumbed down
    //  enbloc       Garand: the 8-round clip pressed down into the open action, the bolt slams shut
    //  single       M24: bolt open, rounds pressed in one at a time
    //  cylinder     Python, Model 29: crane swung out, ejector rod pushed, rounds in one by one (or a speed loader)
    //  gate         Nagant: loading gate opened, each case punched out with the rod, rounds in one by one
    //  gl           M32: frame opened on its hinge, spring wound by turning the cylinder, grenades in one by one
    //  rocket       RPG-7: a new rocket slid into the muzzle
    //  igniter      flamethrowers: the igniter cartridges at the nozzle replaced
    const V = THREE.Vector3, R = { g, parts: {}, spares: [], hand: g.getObjectByName('vmHand'), grip: g.getObjectByName('vmGrip') };
    this.vmRoot.updateMatrixWorld(true);
    const gInv = g.matrixWorld.clone().invert();
    const boxOf = objs => { const b = new THREE.Box3(); objs.forEach(o => b.union(new THREE.Box3().setFromObject(o))); return b.applyMatrix4(gInv); };
    const toG = o => new V().setFromMatrixPosition(o.matrixWorld).applyMatrix4(gInv);
    const prep = o => { o.userData.base = { p: o.position.clone(), r: o.rotation.clone() }; o.userData.m3 = new THREE.Matrix3().setFromMatrix4(gInv.clone().multiply(o.parent.matrixWorld).invert()); };
    const NAMES = ['mag', 'drum', 'cyl', 'gate', 'ejrod', 'cover', 'box', 'bolt', 'pump', 'charger', 'slide', 'rocket', 'igniter'];
    g.traverse(o => { if (NAMES.includes(o.name) && o.type === 'Group') (R.parts[o.name] = R.parts[o.name] || []).push(o); });
    Object.values(R.parts).forEach(l => l.forEach(prep));
    const ud = R.ud = g.userData.reload || {}, P = R.parts;
    R.kind = it.type === 'Rocket Launcher' ? 'rocket' : ud.load === 'gl' ? 'gl' : ud.load === 'igniter' ? 'igniter' : ud.load === 'cylinder' || ud.load === 'gate' ? ud.load
      : P.box ? 'belt' : ['shells', 'stripper', 'enbloc', 'single'].includes(ud.load) ? ud.load : P.mag ? 'mag' : 'none';
    if (R.kind === 'cylinder' && (atts || []).includes('speedloader')) R.kind = 'speedloader';
    R.manual = ud.manual && (ud.manual !== 'bolt' || P.bolt) && (ud.manual !== 'pump' || P.pump) ? ud.manual : null;
    R.cycleDur = Math.min(0.85, 60 / (it.rpm || 60) * 0.8);
    R.port = ud.port ? ud.port.clone() : new V(); R.eject = ud.eject ? ud.eject.clone() : R.port.clone();
    const knob = P.bolt && P.bolt[0].getObjectByName('knob'); R.knob = knob || (P.bolt && P.bolt[0].children[0]) || null;
    // spare pieces live in g; the part copies (a dropped magazine or box) live beside their originals
    const M = this.vmMats || (this.vmMats = {
      brass: new THREE.MeshPhongMaterial({ color: 0xb08a3a, shininess: 90, specular: 0xffe0a0 }), lead: new THREE.MeshPhongMaterial({ color: 0x8a8580, shininess: 40 }),
      shell: new THREE.MeshLambertMaterial({ color: 0xa81e1e }), steel: new THREE.MeshPhongMaterial({ color: 0x2b2d31, shininess: 40 }), black: new THREE.MeshLambertMaterial({ color: 0x1b1c1d }),
      olive: new THREE.MeshLambertMaterial({ color: 0x5b6230 }), gold: new THREE.MeshPhongMaterial({ color: 0x8c7a3a, shininess: 50 }) });
    const cylZ = (r, l, m, z) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 12).rotateX(Math.PI / 2), m); c.position.z = z || 0; return c; };
    const spare = (...meshes) => { const s = new THREE.Group(); meshes.forEach(m => s.add(m)); s.visible = false; g.add(s); R.spares.push(s); return s; };
    // a cartridge pointing forward (-z) with its head at z = 0
    const cart = (r, l, nose) => { const c = new THREE.Group(); c.add(cylZ(r, l * 0.72, M.brass, -l * 0.36)); c.add(cylZ(r * 0.8, l * 0.28, nose || M.lead, -l * 0.86)); return c; };
    const shellM = () => { const sh = new THREE.Group(); sh.add(cylZ(0.38, 2.0, M.shell, -1.0)); sh.add(cylZ(0.4, 0.45, M.brass, -0.2)); return sh; };
    const copy = o => { const c = o.clone(); c.userData = { base: o.userData.base, m3: o.userData.m3 }; c.visible = false; o.parent.add(c); R.spares.push(c); return c; };
    const k = R.kind;
    // the empty case thrown out of the ejection port when a bolt or pump is worked
    if (ud.eject) R.ej = { p: ud.eject.clone(), dir: ud.ejDir || 'right', l: ud.caseL || 1.6, r: ud.caseR || 0.19, hull: !!ud.hull, lenW: casingLen(it), key: (ud.hull ? 'h' : 'c') + (ud.caseL || 1.6) + ':' + (ud.caseR || 0.19) };
    // the belt (rounds and links, in feed order from the box): it moves one link along with every shot
    if (P.box) { R.belt = []; P.box[0].traverse(o => { if (o.isMesh && (o.name === 'rnd' || o.name === 'lnk')) R.belt.push(o); }); const byKind = n => R.belt.filter(o => o.name === n); R.beltR = byKind('rnd').map(o => ({ o, p: o.position.clone() })); R.beltL = byKind('lnk').map(o => ({ o, p: o.position.clone() })); }
    if (k === 'mag' || k === 'belt') {
      const list = k === 'mag' ? P.mag : P.box, b = boxOf(list), sz = b.getSize(new V());
      // the axis the magazine slides along, pointing out of the gun
      R.dir = ud.sideMag ? new V(-1, 0, 0) : ud.topMag ? new V(0, 1, 0) : ud.magAxis ? ud.magAxis.clone() : new V(0, -1, 0);
      R.len = Math.abs(sz.x * R.dir.x) + Math.abs(sz.y * R.dir.y) + Math.abs(sz.z * R.dir.z);
      R.bottom = b.getCenter(new V()).addScaledVector(R.dir, R.len / 2);
      R.top = b.getCenter(new V()).addScaledVector(R.dir, -R.len / 2);
      R.old = list.map(copy); R.old.forEach(o => o.traverse(c => { if (c.name === 'rnd' || c.name === 'lnk') c.visible = false; })); // the box coming off is empty
      if (ud.topMag && R.hand) R.supShoulder = R.hand.userData.rest.clone().add(new V(-9, 3, 6)); // reaching over the top: the arm comes from the upper left
      if (P.cover) { const cb = boxOf(P.cover); R.coverRear = new V((cb.min.x + cb.max.x) / 2, cb.max.y, cb.max.z); }
    }
    if (P.charger) { const cb = boxOf(P.charger); R.chargerP = cb.getCenter(new V()); }
    if (k === 'cylinder' || k === 'speedloader' || k === 'gate' || k === 'gl') {
      const cyl = P.cyl[0];
      R.rims = []; cyl.traverse(o => { if (o.name === 'rnd') R.rims.push(o); });
      const rp = R.rims.map(toG); R.cylC = rp.reduce((a, q) => a.add(q), new V()).divideScalar(rp.length);
      const cb = boxOf([P.drum ? P.drum[0] : cyl]); R.cylLen = cb.max.z - cb.min.z; R.cylFront = cb.min.z;
      R.chR = Math.max(...rp.map(q => q.x - R.cylC.x)); // the chamber at the right (the Nagant's loading gate)
      R.gateIdx = rp.reduce((bi, q, i) => q.x > rp[bi].x ? i : bi, 0);
      const gl = k === 'gl', r = gl ? 0.6 : Math.max(0.12, (R.chR || 0.5) * 0.42), l = gl ? 2.6 : r * 7;
      R.rnd = spare(cart(r, l, gl ? M.olive : null)); R.rndL = l;
      R.empties = R.rims.map(() => spare(cylZ(r, l * 0.72, M.brass, -l * 0.36)));
      R.ejrod = P.ejrod ? P.ejrod[0] : null; if (!R.ejrod) cyl.traverse(o => { if (o.name === 'ejrod') { R.ejrodMesh = o; o.userData.base0 = o.position.clone(); } });
      if (k === 'speedloader') {
        const ld = spare(cylZ(R.chR * 1.5, 0.35, M.black, 0.2), cylZ(0.18, 0.5, M.black, 0.6)); // the loader body and its knob
        R.loaderRounds = new THREE.Group(); ld.add(R.loaderRounds); R.rims.forEach(() => R.loaderRounds.add(cart(r, l))); R.loader = ld;
      }
    }
    if (k === 'shells') { R.shell = spare(shellM()); }
    if (k === 'single') R.rnd = spare(cart(0.2, 2.6));
    if (k === 'stripper' || k === 'enbloc') {
      const n = k === 'enbloc' ? 8 : 5, rounds = new THREE.Group();
      for (let i = 0; i < n; i++) { const c = cart(0.2, 2.6); if (k === 'enbloc') c.position.set((i % 2 ? 0.17 : -0.17), 0.21 + i * 0.29, 0); else c.position.set(0, 0.21 + i * 0.4, 0); rounds.add(c); }
      const clip = k === 'enbloc' ? [new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.6, 2.0), M.steel), new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.6, 2.0), M.steel)] : [new THREE.Mesh(new THREE.BoxGeometry(0.55, 2.2, 0.12), M.steel)];
      if (k === 'enbloc') { clip[0].position.set(0.42, 1.3, -1.2); clip[1].position.set(-0.42, 1.3, -1.2); } else clip[0].position.set(0, 1.0, 0.05);
      R.clip = spare(rounds, ...clip); R.clipRounds = rounds; R.clipH = k === 'enbloc' ? 2.6 : 2.1;
    }
    if (k === 'rocket') { const rb = boxOf(P.rocket); R.rocketLen = rb.max.z - rb.min.z; R.rocketFront = new V(0, (rb.min.y + rb.max.y) / 2, rb.min.z); }
    if (k === 'igniter') { R.ign = P.igniter[0].children.slice(); R.ign.forEach(c => { c.userData.p0 = c.position.clone(); }); R.ignOld = R.ign.map(c => { const s = spare(c.clone()); return s; }); }
    return R;
  }
  animateReload(R, p, st) {
    const V = THREE.Vector3, cl = x => x < 0 ? 0 : x > 1 ? 1 : x, sm = t => { t = cl(t); return t * t * (3 - 2 * t); };
    const seg = (a, b) => cl((p - a) / (b - a)), g = R.g;
    let gInv; const refresh = () => { g.updateMatrixWorld(true); gInv = g.matrixWorld.clone().invert(); }; refresh();
    const toG = (o, v) => (v ? v.clone() : new V()).applyMatrix4(o.matrixWorld).applyMatrix4(gInv);
    const place = (o, d, rx, ry, rz) => { const b = o.userData.base; o.position.copy(b.p).add(d.clone().applyMatrix3(o.userData.m3)); o.rotation.set(b.r.x + (rx || 0), b.r.y + (ry || 0), b.r.z + (rz || 0)); };
    const P = R.parts, ud = R.ud, zero = new V(), H = R.hand, Gp = R.grip;
    // back to the resting gun
    Object.values(P).forEach(l => l.forEach(o => { place(o, zero); o.visible = true; }));
    R.spares.forEach(s => { s.visible = false; });
    (R.rims || []).forEach(r => { r.visible = true; });
    if (R.ejrodMesh) R.ejrodMesh.position.copy(R.ejrodMesh.userData.base0);
    if (R.ign) R.ign.forEach(c => { c.position.copy(c.userData.p0); c.visible = true; });
    if (H) { H.position.copy(H.userData.rest); H.visible = !!H.userData.idle; }
    if (Gp) Gp.position.copy(Gp.userData.rest);
    // the hands move through key points [time, position] with smooth steps between them
    const path = keys => { let pos = keys[0][1]; for (let i = 1; i < keys.length; i++) { const [t0] = keys[i - 1], [t1, q] = keys[i]; if (p >= t0) pos = keys[i - 1][1].clone().lerp(q, sm((p - t0) / Math.max(1e-6, t1 - t0))); } return pos; };
    const pouch = from => from.clone().add(new V(-3, -11, 5)), pouchR = from => from.clone().add(new V(3, -10, 5)); // support side / firing side pouches
    const setBolt = (lift, back) => (P.bolt || []).forEach(o => place(o, new V(0, 0, ud.boltTravel * back), 0, 0, (ud.boltLift || 0) * lift));
    const knobAt = () => { refresh(); return R.knob ? toG(R.knob).add(new V(1.0, -0.9, 0.4)) : Gp.userData.rest; }; // the firing hand on the bolt knob, from below and to the right
    const done = () => this.aimArms(R);
    // handguns: the slide runs back with every shot, stays locked back on an empty magazine and goes home when the
    // slide stop is pressed after a full magazine is in
    if (P.slide) {
      const shot = st.kick > 0.6 ? (st.kick - 0.6) / 0.4 : 0, locked = (st.dry && !(p > 0)) || (p > 0 && st.empty) ? (p >= 0.8 ? 1 - sm(seg(0.8, 0.85)) : 1) : 0;
      P.slide.forEach(o => place(o, new V(0, 0, ud.slideTravel * Math.max(shot, locked))));
    }
    // the belt runs into the gun: every round moves one place along per shot, the last one into the feed tray
    for (const list of [R.beltR, R.beltL]) if (list) {
      const n = list.length, ph = p > 0 ? 0 : st.shots ? Math.min(1, st.sinceShot / (60 / st.rpm * 0.85)) : 0;
      const keep = p > 0.2 ? n : Math.min(n, st.ammo === undefined ? n : st.ammo);
      list.forEach((b, i) => { const a = b.p, nx = i + 1 < n ? list[i + 1].p : a.clone().multiplyScalar(2).sub(list[i - 1].p); b.o.position.copy(a).lerp(nx, 1 - ph); b.o.visible = !(ph < 1 && i === n - 1 && ph < 0.5) && n - 1 - i < keep; });
    }
    if (!(p > 0)) {
      // working the action after a shot
      const c = st.cyc;
      if (R.manual && c > 0 && c < 1) {
        const cs = (a, b) => cl((c - a) / (b - a));
        if (R.manual === 'bolt') {
          const lift = sm(cs(0.08, 0.24)) * (1 - sm(cs(0.74, 0.9))), back = sm(cs(0.24, 0.44)) * (1 - sm(cs(0.5, 0.72)));
          setBolt(lift, back); const kn = knobAt();
          Gp.position.copy(c < 0.08 ? Gp.userData.rest.clone().lerp(kn, sm(c / 0.08)) : c < 0.9 ? kn : kn.lerp(Gp.userData.rest, sm((c - 0.9) / 0.1)));
        } else {
          const back = sm(cs(0.05, 0.32)) * (1 - sm(cs(0.42, 0.7))), d = new V(0, 0, ud.pumpTravel * back);
          P.pump.forEach(o => place(o, d)); if (H) H.position.copy(H.userData.rest).add(d);
        }
      }
      return done();
    }
    if (R.kind === 'none') return done();
    if (H) H.visible = true;
    const k = R.kind, Hr = H ? H.userData.rest : new V(), Gr = Gp ? Gp.userData.rest : new V();
    // an empty gun's bolt is sent home once the new rounds are in: charging handle (firing hand if it is on the
    // right, support hand otherwise), the AR bolt catch slapped, or (handguns) the slide stop; returns true if it used
    // the support hand
    const chargeHome = () => {
      if (!st.empty || R.manual || P.slide) return false;
      if (P.charger && ud.chargeTravel > 0) {
        const pull = sm(seg(0.79, 0.84)) * (1 - sm(seg(0.85, 0.87))); P.charger.forEach(o => place(o, new V(0, 0, ud.chargeTravel * pull)));
        refresh(); const hp = toG(P.charger[0]).add(new V(ud.chargeSide > 0 ? 1 : ud.chargeSide < 0 ? -1 : 0, ud.chargeSide === 0 ? 1 : 0, 0.4));
        if (ud.chargeSide > 0 && Gp) { Gp.position.copy(path([[0.74, Gr], [0.79, hp], [0.87, hp.clone().add(new V(0, 0, ud.chargeTravel * 0))], [0.95, Gr]])); return false; }
        if (H && p >= 0.74) { H.position.copy(path([[0.74, H.position.clone()], [0.79, hp], [0.87, hp], [0.97, Hr]])); return true; }
        return false;
      }
      if (H && k === 'mag' && R.top && p >= 0.76) { const bc = R.top.clone().add(new V(-1.6, 0.6, 0.4)); H.position.copy(path([[0.76, H.position.clone()], [0.8, bc], [0.83, bc.clone().add(new V(0.3, 0, 0))], [0.95, Hr]])); return true; } // AR bolt catch
      return false;
    };
    if (k === 'mag' || k === 'belt') {
      const list = k === 'mag' ? P.mag : P.box, A = R.dir, L = R.len, belt = k === 'belt', bolt = R.manual === 'bolt';
      const t0 = belt ? 0.2 : 0.1, out = belt ? 0.42 : 0.34, line = belt ? 0.6 : 0.56, home = belt ? 0.66 : 0.64, seat = belt ? 0.7 : 0.72;
      // bolt-action rifles: the firing hand opens the bolt first and closes it last
      if (bolt) {
        const o = seg(0.02, 0.1), c = seg(0.84, 0.95); setBolt(sm(o * 2) * (1 - sm(c * 2 - 1)), sm(o * 2 - 1) * (1 - sm(c * 2))); const kn = knobAt();
        Gp.position.copy(p < 0.1 ? Gr.clone().lerp(kn, sm(p / 0.02)) : p < 0.84 ? (p < 0.16 ? kn.clone().lerp(Gr, sm((p - 0.1) / 0.06)) : p < 0.8 ? Gr : Gr.clone().lerp(kn, sm((p - 0.8) / 0.04))) : p < 0.95 ? kn : kn.clone().lerp(Gr, sm((p - 0.95) / 0.05)));
      }
      // feed cover opens (hinged at its front) before the box comes off, closes once the belt is laid in the tray
      const open = sm(seg(0.05, 0.15)) * (1 - sm(seg(0.8, 0.88)));
      (P.cover || []).forEach(o => place(o, zero, -1.25 * open));
      // AK-pattern magazines rock: tipped forward to unhook the rear catch, then the front lug; the P90's front end
      // goes in first. The empty one comes out along its axis and falls away
      const rock = ud.rockIn ? 0.45 : ud.topMag ? -0.3 : 0;
      const drop = sm(seg(t0, t0 + 0.08)), fall = seg(t0 + 0.08, t0 + 0.38);
      R.old.forEach(o => { o.visible = p >= t0 && p < t0 + 0.38; place(o, A.clone().multiplyScalar(L * 1.08 * drop).add(new V(0, -14 * fall * fall, 1.5 * fall)), rock * Math.min(1, drop * 2) + fall * 0.9, 0, fall * 0.4); });
      // the full one: fetched from the pouch, lined up on the axis well clear of the gun (so it never passes through
      // the grip or trigger guard), then pushed straight in (an AK one hooks its front lug and rocks back)
      const come = 1 - sm(seg(out, line)), clear = 1 - sm(seg(line, home)), ins = 1 - sm(seg(home, seat));
      const off = A.clone().multiplyScalar(L * 1.08 * ins + (ud.topMag ? 1.2 : 4) * clear + 10 * come).add(new V(-2.5 * come, 0, 2.5 * come));
      const tilt = rock * (p < seat - 0.03 ? 1 : 1 - sm(seg(seat - 0.03, seat + 0.02)));
      list.forEach(o => { o.visible = p < t0 || p >= out; place(o, p >= out ? off : zero, p >= out ? tilt : 0, 0, -0.3 * come); });
      const grip = R.bottom.clone().addScaledVector(A, 0.6), carry = grip.clone().add(off);
      if (H) {
        const keys = belt
          ? [[0, Hr], [0.05, R.coverRear || grip], [0.15, (R.coverRear || grip).clone().add(new V(0, 2, 1))], [0.2, grip], [out, pouch(grip)], [home, carry], [seat, grip], [0.76, grip.clone().add(new V(-1.5, R.len * 1.1, 0))], [0.8, R.coverRear ? R.coverRear.clone().add(new V(0, 2, 1)) : Hr], [0.88, R.coverRear || Hr], [0.98, Hr]]
          : [[0, Hr], [t0, grip], [t0 + 0.08, grip.clone().addScaledVector(A, L * 1.08 * drop)], [out, pouch(grip)], [home, carry], [seat, grip], [0.76, grip.clone().addScaledVector(A, -0.25)], [0.94, Hr]];
        H.position.copy(path(keys));
        if (p >= out && p < seat) H.position.copy(carry);
      }
      chargeHome();
      return done();
    }
    if (k === 'cylinder' || k === 'speedloader' || k === 'gate' || k === 'gl') {
      const cyl = P.cyl[0], gate = k === 'gate', N = R.rims.length;
      // the crane (or the M32's front assembly) swings out on its hinge pin; the Nagant's cylinder stays in and turns
      const open = gate ? 0 : sm(seg(0.02, 0.12)) * (1 - sm(seg(0.86, 0.96)));
      if (!gate) place(cyl, zero, 0, 0, (k === 'gl' ? 0.95 : 1.45) * open);
      if (k === 'gl' && P.drum) place(P.drum[0], zero, 0, 0, -Math.PI * 2 * sm(seg(0.2, 0.3))); // winding the spring: one turn of the cylinder
      refresh();
      const rimP = R.rims.map(r => toG(r));
      if (!gate) {
        // the ejector rod is pushed and the empties fly out the back (the M32's are tipped out)
        const push = sm(seg(0.13, 0.16)) * (1 - sm(seg(0.19, 0.23)));
        if (R.ejrodMesh) R.ejrodMesh.position.z = R.ejrodMesh.userData.base0.z + 0.3 * push;
        const e0 = 0.15, ej = seg(e0, 0.42);
        if (p < 0.42) R.empties.forEach((e, i) => { e.visible = p >= e0; if (p >= e0) { e.position.copy(rimP[i]).add(new V((i - N / 2) * 0.15 * ej, -12 * ej * ej, 1.4 * sm(ej * 4) + 1.2 * ej)); e.rotation.set(ej * 3 * (1 + i * 0.2), 0, ej * 2); } });
        R.rims.forEach(r => { r.visible = p < e0; });
      }
      const cylHold = R.cylC.clone().add(new V(0, -0.8, R.cylFront - R.cylC.z - 0.6));
      if (k === 'speedloader') {
        // all six at once: line the loader up behind the cylinder, push the rounds in, twist to release, pull it away
        const c0 = rimP.reduce((a, q) => a.add(q), new V()).divideScalar(N), ld = R.loader, a = sm(seg(0.3, 0.55)), push = sm(seg(0.55, 0.63)), twist = sm(seg(0.63, 0.68)), away = seg(0.68, 0.82);
        R.loaderRounds.children.forEach((c, i) => c.position.set(rimP[i].x - c0.x, rimP[i].y - c0.y, 0));
        ld.visible = p >= 0.3 && p < 0.82; R.loaderRounds.visible = p < 0.63;
        ld.position.copy(c0).add(new V(0, -8 * (1 - a), 6 * (1 - a) + R.rndL * (1.15 - push))).add(new V(1.5 * away, -10 * away * away, 3 * away));
        ld.rotation.set(0, 0, twist * 0.5);
        if (p >= 0.63) R.rims.forEach(r => { r.visible = true; });
        H.position.copy(p < 0.3 ? path([[0, Hr], [0.12, cylHold], [0.3, pouch(R.cylC)]]) : p < 0.82 ? ld.position.clone().add(new V(0, -0.4, 1.4)) : path([[0.82, pouch(R.cylC)], [1, Hr]]));
        return done();
      }
      // gate: the rod is drawn out and swung over the chamber at the gate, each case punched out backwards through it,
      // the cylinder turned one chamber between strokes
      const step = 2 * Math.PI / N, gi = R.gateIdx, gateP = () => { refresh(); return toG(R.rims[gi]); };
      if (gate) {
        const gOpen = sm(seg(0.03, 0.08)) * (1 - sm(seg(0.92, 0.97)));
        if (P.gate) place(P.gate[0], zero, 0, 0, -1.3 * gOpen);
        const e0 = 0.14, e1 = 0.46, ew = (e1 - e0) / N, l0 = 0.5, l1 = 0.92, lw = (l1 - l0) / N;
        let idx = 0;
        if (p >= e0 && p < e1) { const i = Math.floor((p - e0) / ew), t = (p - e0 - i * ew) / ew; idx = i + sm((t - 0.8) / 0.2); }
        else if (p >= e1 && p < l0) idx = 0;
        else if (p >= l0 && p < l1) { const i = Math.floor((p - l0) / lw), t = (p - l0 - i * lw) / lw; idx = i + sm((t - 0.85) / 0.15); }
        place(cyl, zero, 0, 0, -idx * step);
        const gp = gateP(), rodOut = sm(seg(0.08, 0.13)) * (1 - sm(seg(e1, l0 - 0.01)));
        // which chambers hold a live round, a case or nothing
        R.rims.forEach((r, j) => { const rel = ((j - gi) % N + N) % N; r.visible = p < e0 ? true : p < l0 ? !(p >= e0 + rel * ew + ew * 0.45) : p >= l1 || p >= l0 + rel * lw + lw * 0.85; });
        if (R.ejrod) {
          const rb = R.ejrod.userData.base, rodG = new V().setFromMatrixPosition(R.ejrod.matrixWorld).applyMatrix4(gInv);
          let stroke = 0; if (p >= e0 && p < e1) { const t = ((p - e0) % ew) / ew; stroke = sm(t / 0.45) * (1 - sm((t - 0.5) / 0.3)); }
          const over = new V(gp.x - rodG.x, gp.y - rodG.y, 0).multiplyScalar(rodOut);
          place(R.ejrod, over.add(new V(0, 0, -1.2 * rodOut + (R.cylLen + 0.6) * stroke)));
          if (p >= e0 && p < e1) { const i = Math.floor((p - e0) / ew), t = ((p - e0) % ew) / ew, e = R.empties[i]; if (e && t > 0.4) { const f = (t - 0.4) / 0.6; e.visible = true; e.position.copy(gp).add(new V(0.6 * f, -6 * f * f, 0.8 + 2 * f)); e.rotation.set(f * 4, 0, 0); } }
          H.position.copy(p < l0 ? path([[0, Hr], [0.08, gp.clone().add(new V(0.6, -1.4, -R.cylLen - 1))], [e1, gp.clone().add(new V(0.6, -1.4, -R.cylLen - 1))], [l0, pouch(gp)]]) : H.position);
          if (p >= 0.13 && p < e1) { refresh(); H.position.copy(toG(R.ejrod).add(new V(0.4, -1.2, -0.6))); }
        }
        if (p >= l0 && p < l1) {
          const i = Math.floor((p - l0) / lw), t = ((p - l0) % lw) / lw, rnd = R.rnd; rnd.visible = t < 0.85;
          const a = gp.clone().add(new V(3, -5, 4)), b = gp.clone().add(new V(0, 0, R.rndL * 1.05)), c = gp.clone().add(new V(0, 0, 0.05));
          rnd.position.copy(t < 0.55 ? a.lerp(b, sm(t / 0.55)) : b.lerp(c, sm((t - 0.55) / 0.3))); rnd.rotation.set(0, 0, 0);
          H.position.copy(rnd.position).add(new V(1.8, -2.4, R.rndL * 0.7 + 1.4)); // below and to the right, so the gate stays in view
        } else if (p >= l1) H.position.copy(path([[l1, pouch(gp)], [1, Hr]]));
        return done();
      }
      // one round at a time, each pressed into its own chamber
      const start = 0.3, end = 0.84, w = (end - start) / N, i = Math.min(N - 1, Math.floor((p - start) / w)), t = cl((p - start - i * w) / w);
      R.rims.forEach((r, j) => { r.visible = p < 0.15 || p >= end || (p >= start && (j < i || (j === i && t > 0.85))); });
      if (p >= start && p < end) {
        const tgt = rimP[i], rnd = R.rnd; rnd.visible = t < 0.88;
        const a = tgt.clone().add(new V(-1, -5, 4)), b = tgt.clone().add(new V(0, 0, R.rndL * 1.05)), c = tgt.clone().add(new V(0, 0, 0.05));
        rnd.position.copy(t < 0.55 ? a.lerp(b, sm(t / 0.55)) : b.lerp(c, sm((t - 0.55) / 0.33))); rnd.rotation.set(-0.3 * (1 - sm(t / 0.55)), 0, 0);
        H.position.copy(rnd.position).add(new V(0, -0.5, R.rndL * 0.6 + 0.6));
      } else H.position.copy(path([[0, Hr], [0.12, cylHold], [0.2, cylHold], [start, pouch(R.cylC)], [end, pouch(R.cylC)], [0.9, cylHold], [1, Hr]]));
      if (k === 'gl' && p >= 0.2 && p < 0.3) { refresh(); H.position.copy(toG(P.drum[0]).add(new V(-2.4, 0, 0))); } // the hand turning the cylinder
      return done();
    }
    if (k === 'shells' && !ud.ejBottom) {
      // tube shotguns: the action is opened and held open, every shell is pushed in through the ejection port the same
      // way, then the action is closed on the last one
      const sh = R.shell, Ej = R.eject, m = Math.max(1, Math.min(8, st.n)), start = 0.1, end = 0.86, w = (end - start) / m;
      const back = sm(seg(0.02, 0.08)) * (1 - sm(seg(0.88, 0.94))), d = new V(0, 0, (ud.pumpTravel || 0) * back);
      (P.pump || []).forEach(o => place(o, d));
      const a = Ej.clone().add(new V(-1.5, 4, 2)), b = Ej.clone().add(new V(0.3, 1.2, 0.4)), c = Ej.clone().add(new V(0, 0, -0.6));
      if (p >= start && p < end) {
        const i = Math.min(m - 1, Math.floor((p - start) / w)), t = cl((p - start - i * w) / w);
        sh.visible = t > 0.12 && t < 0.92;
        sh.position.copy(t < 0.3 ? pouch(Ej).lerp(a, sm(t / 0.3)) : t < 0.65 ? a.clone().lerp(b, sm((t - 0.3) / 0.35)) : b.clone().lerp(c, sm((t - 0.65) / 0.27)));
        H.position.copy(sh.position).add(new V(-0.8, 0.6, 1.2));
      } else if (p < start) H.position.copy(P.pump ? Hr.clone().add(d) : path([[0, Hr], [start, pouch(Ej)]]));
      else H.position.copy(P.pump ? path([[end, pouch(Ej)], [0.88, Hr.clone().add(d)], [0.94, Hr.clone().add(d)], [1, Hr]]) : path([[end, pouch(Ej)], [1, Hr]]));
      if (P.pump && p >= 0.88) H.position.copy(Hr.clone().add(d));
      return done();
    }
    if (k === 'shells') {
      // an empty gun: open the action, drop a shell into the ejection port (the KSG's bottom port), close it; then
      // shells one at a time pushed up through the loading port under the receiver into the magazine tube
      const pump = R.manual === 'pump' || (P.pump && !R.manual);
      const sh = R.shell, Pp = R.port, Ej = R.eject;
      let start = 0.06;
      if (st.empty) {
        start = 0.28;
        const back = P.pump ? sm(seg(0.02, 0.08)) * (1 - sm(seg(0.2, 0.25))) : 0, d = new V(0, 0, (ud.pumpTravel || 0) * back);
        (P.pump || []).forEach(o => place(o, d));
        if (p < 0.2 && p >= 0.08) {
          const t = seg(0.08, 0.2); sh.visible = t < 0.9;
          const a = ud.ejBottom ? Ej.clone().add(new V(-1, -5, 2)) : Ej.clone().add(new V(-1.5, 4, 2)), b = ud.ejBottom ? Ej.clone().add(new V(0, -0.8, 0.8)) : Ej.clone().add(new V(0.3, 1.2, 0.4)), c = Ej.clone().add(new V(0, 0, -0.6));
          sh.position.copy(t < 0.6 ? a.lerp(b, sm(t / 0.6)) : b.lerp(c, sm((t - 0.6) / 0.3)));
          H.position.copy(sh.position).add(new V(-0.8, 0.6, 1.2));
        } else if (pump) H.position.copy(p < 0.08 ? Hr.clone().add(d) : path([[0.2, sh.position.clone().add(new V(-0.8, 0.6, 1.2))], [0.22, Hr.clone().add(new V(0, 0, ud.pumpTravel || 0))], [0.25, Hr], [start, pouch(Pp)]]));
        else H.position.copy(path([[0, Hr], [0.08, pouch(Ej)], [0.2, Ej], [start, pouch(Pp)]]));
      }
      const end = 0.92, m = Math.max(1, Math.min(8, st.n - (st.empty ? 1 : 0))), w = (end - start) / m, i = Math.min(m - 1, Math.floor((p - start) / w)), t = cl((p - start - i * w) / w);
      if (p >= start && p < end) {
        sh.visible = t < 0.86;
        const a = Pp.clone().add(new V(-1.2, -5, 3)), b = Pp.clone().add(new V(0, -0.6, 1.6)), c = Pp.clone().add(new V(0, 0.1, -0.9));
        sh.position.copy(t < 0.5 ? a.lerp(b, sm(t / 0.5)) : b.lerp(c, sm((t - 0.5) / 0.35)));
        sh.rotation.set(t < 0.5 ? -0.35 * (1 - sm(t / 0.5)) : 0, 0, 0);
        H.position.copy(sh.position).add(ud.ejBottom ? new V(-0.4, -0.9, 2.6) : new V(0, -0.8, 1.2)); // the thumb behind the shell
      } else if (p >= end) H.position.copy(path([[end, pouch(Pp)], [1, Hr]]));
      else if (!st.empty) H.position.copy(path([[0, Hr], [start, pouch(Pp)]]));
      return done();
    }
    if (k === 'stripper' || k === 'enbloc' || k === 'single') {
      // the firing hand does it all: bolt open, the clip (or rounds) in over the action, bolt closed
      const enb = k === 'enbloc', o = seg(0.02, 0.1), c = enb ? seg(0.62, 0.68) : seg(0.86, 0.95);
      const lift = sm(o * 2) * (1 - sm(c * 2 - 1)), back = (ud.boltLift ? sm(o * 2 - 1) : sm(o)) * (1 - (ud.boltLift ? sm(c * 2) : sm(c)));
      setBolt(lift, back); const kn = knobAt(), Pp = R.port;
      let hp = null;
      if (k === 'single') {
        const start = 0.16, end = 0.84, m = Math.max(1, Math.min(10, st.n)), w = (end - start) / m, i = Math.min(m - 1, Math.floor((p - start) / w)), t = cl((p - start - i * w) / w);
        if (p >= start && p < end) {
          const r = R.rnd; r.visible = t < 0.85;
          const a = Pp.clone().add(new V(3, 4, 2)), b = Pp.clone().add(new V(0, 1.2, 0.6)), c = Pp.clone().add(new V(0, -0.4, 0.4));
          r.position.copy(t < 0.5 ? a.lerp(b, sm(t / 0.5)) : b.lerp(c, sm((t - 0.5) / 0.35)));
          hp = r.position.clone().add(new V(1.6, 0.4, 0.4));
        }
      } else {
        // clips one after another (two for the 10-round Enfield and SVT-40): into the guide, rounds thumbed down,
        // the empty clip pulled out; the Garand's whole clip goes in
        const nClips = enb ? 1 : Math.max(1, Math.min(2, Math.ceil(st.n / 5))), start = 0.14, end = enb ? 0.6 : 0.84, w = (end - start) / nClips;
        const i = Math.min(nClips - 1, Math.floor((p - start) / w)), t = cl((p - start - i * w) / w);
        if (p >= start && p < end) {
          const cl0 = R.clip, a = sm(t / 0.3), down = sm((t - 0.36) / 0.4), fly = cl((t - 0.8) / 0.2);
          cl0.visible = enb ? t < 0.95 : true; R.clipRounds.visible = enb || t < 0.8;
          R.clipRounds.children.forEach((r, j) => { r.visible = enb || j < Math.min(5, st.n - i * 5) || st.n <= 0; });
          const guide = Pp.clone().add(new V(0, 0.25, 1.3)), lift = guide.clone().add(new V(1.2, 2.6, 1.2));
          cl0.position.copy(t < 0.18 ? pouchR(Pp).lerp(lift, sm(t / 0.18)) : lift.lerp(guide, sm((t - 0.18) / 0.12)));
          cl0.rotation.set(0.5 * (1 - a), 0, 0);
          if (enb) cl0.position.y -= R.clipH * down;
          else { R.clipRounds.position.y = -R.clipH * down; if (fly > 0) cl0.position.add(new V(2.5 * fly, 3 * fly - 6 * fly * fly, 0.6 * fly)); cl0.rotation.set(0, 0, -fly * 3); }
          hp = cl0.position.clone().add(new V(1.7, R.clipH - (enb ? 0 : R.clipH * down) + 0.2, -0.4)); // thumb on the rounds, the hand beyond the action

        }
      }
      const cEnd = enb ? 0.62 : 0.86;
      Gp.position.copy(p < 0.1 ? Gr.clone().lerp(kn, sm(p / 0.03)) : hp ? hp : p < cEnd ? pouchR(Pp) : p < (enb ? 0.7 : 0.96) ? kn : kn.clone().lerp(Gr, sm((p - (enb ? 0.7 : 0.96)) / 0.04)));
      if (p >= cEnd - 0.04 && p < cEnd) Gp.position.copy(pouchR(Pp).lerp(kn, sm((p - cEnd + 0.04) / 0.04)));
      if (H) H.position.copy(Hr);
      return done();
    }
    if (k === 'rocket') {
      // the tube is empty after the shot; a new rocket is brought up in front of the muzzle and slid in from the front
      const rk = P.rocket[0], L = R.rocketLen, a = sm(seg(0.3, 0.58)), ins = sm(seg(0.6, 0.82));
      rk.visible = p >= 0.3;
      const off = new V(-1.5 * (1 - a), -7 * (1 - a), -(L * 1.05 + 3 * (1 - a)) * (1 - ins));
      place(rk, off, 0.4 * (1 - a));
      const hold = R.rocketFront.clone().add(off).add(new V(0, -2.2, L * 0.25));
      H.position.copy(path([[0, Hr], [0.3, pouch(Hr)], [0.58, hold], [0.82, hold], [0.97, Hr]]));
      if (p >= 0.3 && p < 0.82) H.position.copy(hold);
      return done();
    }
    if (k === 'igniter') {
      // the spent igniter cartridges pulled out of the nozzle one by one and fresh ones pushed in
      const n = R.ign.length, w = 0.8 / n, start = 0.08, ig = P.igniter[0];
      R.ign.forEach((c, i) => {
        const t = cl((p - start - i * w) / w), sp = R.ignOld[i];
        c.visible = p < start + i * w || t > 0.45;
        if (t > 0 && t < 0.45) { const f = t / 0.45; sp.visible = true; sp.position.copy(toG(ig).add(c.userData.p0)).add(new V(0, -10 * f * f, 1.5 * f)); }
        if (t >= 0.45 && t < 1) c.position.copy(c.userData.p0).add(new V(0, -4 * (1 - sm((t - 0.45) / 0.4)), 0));
      });
      const i = Math.min(n - 1, Math.floor((p - start) / w)), cur = R.ign[Math.max(0, i)];
      H.position.copy(p < start || p > start + n * w ? path([[0, Hr], [start, toG(ig)], [start + n * w, toG(ig)], [1, Hr]]) : toG(cur).add(new V(0, -1.2, 0.8)));
      return done();
    }
    return done();
  }
  // each sleeve runs from its hand back to its shoulder, wherever the hand is
  aimArms(R) {
    if (R.grip) R.grip.getObjectByName('vmArm').visible = !(R.kind === 'shells' && R.ud.ejBottom && this.vm.rl > 0.3); // the gun is upside down: the firing arm runs out of view
    for (const hg of [R.hand, R.grip]) {
      if (!hg || !hg.visible) continue;
      const arm = hg.getObjectByName('vmArm'); if (!arm) continue;
      // the firing arm swings its elbow out to the right when the hand leaves the grip (to a bolt, a clip, a pouch)
      let sh = hg === R.hand && R.supShoulder ? R.supShoulder : hg.userData.shoulder;
      if (hg === R.grip) { const f = Math.min(1, hg.position.distanceTo(hg.userData.rest) / 2.5); sh = sh.clone().lerp(hg.userData.rest.clone().add(new THREE.Vector3(7, -6, 6)), f); }
      const away = hg === R.grip ? Math.min(1, hg.position.distanceTo(hg.userData.rest) / 2.5) : 0, th = 1 - 0.3 * away; // a forearm seen from the side is slimmer
      const d = sh.clone().sub(hg.position), L = Math.max(4, Math.min(14 - 5 * away, d.length())); d.normalize();
      arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d); arm.position.copy(d).multiplyScalar(L / 2); arm.scale.set(th, th, L / 10);
    }
  }

  // ---------------------------------------------------------------- lights at night
  updateLights(cam, me) {
    const G = this.g, night = G.night;
    const lights = G.lights || [];
    // pooled point lights for the strongest nearby sources
    const cand = [];
    for (const l of lights) if (!l.cone && l.r > 55) cand.push({ l, d: Math.hypot(l.x - cam.x, l.y - cam.z) - l.r });
    for (const p of G.particles) if (p.type === 'flash' && !night) cand.push({ l: { x: p.x, y: p.y, r: 140 * p.size }, d: Math.hypot(p.x - cam.x, p.y - cam.z) });
    cand.sort((a, b) => a.d - b.d);
    this.points.forEach((pl, i) => {
      const c = cand[i]; if (!c) { pl.intensity = 0; return; }
      const big = c.l.r > 300; pl.position.set(c.l.x, big ? 200 : (c.l.z || 0) + 34, c.l.y); pl.distance = c.l.r * (big ? 1.4 : 1.7); pl.intensity = big ? 1.8 : night ? 2.2 : 1.2;
      pl.color.set(big ? 0xfff2e0 : 0xffb060);
    });
    // weapon lights: real spot lights for the closest, visible beams for everyone
    const lit = G.units.filter(u => u.alive && u.light && night).sort((a, b) => Math.hypot(a.x - cam.x, a.y - cam.z) - Math.hypot(b.x - cam.x, b.y - cam.z));
    this.spots.forEach((s, i) => { const u = lit[i]; if (!u) { s.intensity = 0; return; } s.intensity = 1.5; s.position.set(u.x + Math.cos(u.angle) * 10, eyeZ(u) - 8, u.y + Math.sin(u.angle) * 10); s.target.position.set(u.x + Math.cos(u.angle) * 200, eyeZ(u) - 8 + Math.tan(u.pitch || 0) * 200 - 26, u.y + Math.sin(u.angle) * 200); s.target.updateMatrixWorld(); });
    while (this.beams.length < lit.length) { const b = new THREE.Mesh(this.beamGeo, this.beamMat); this.scene.add(b); this.beams.push(b); }
    this.beams.forEach((b, i) => { const u = lit[i]; b.visible = !!u && u !== me; if (u) { b.position.set(u.x + Math.cos(u.angle) * 12, eyeZ(u) - 8, u.y + Math.sin(u.angle) * 12); b.rotation.set(0, -u.angle, (u.pitch || 0) - 0.08); } });
    // how lit the local player is (for the weapon model brightness)
    this.localLit = me && night ? Math.min(0.6, cand.filter(c => c.d < -40).length * 0.2) : 0;
  }

  // ---------------------------------------------------------------- laser sights (IR lasers only show through night vision)
  updateLasers(me, nv, night) {
    const G = this.g, m = G.map;
    if (!this.laserPool) {
      this.laserGeo = new THREE.CylinderGeometry(0.45, 0.45, 1, 5, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2); // unit length along +z
      this.laserMats = { red: new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }), ir: new THREE.MeshBasicMaterial({ color: 0xc0ffc0, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }) };
      this.laserPool = [];
    }
    let n = 0;
    const beam = (u, kind) => {
      if (kind === 'ir' && !nv) return;
      const yaw = u === me ? G.input.yaw : u.angle, pitch = u === me ? G.input.pitch : (u.pitch || 0);
      const dx = Math.cos(yaw) * Math.cos(pitch), dy = Math.sin(yaw) * Math.cos(pitch), dz = Math.sin(pitch);
      let x = u.x + Math.cos(yaw + 0.5) * 7, y = u.y + Math.sin(yaw + 0.5) * 7, z = eyeZ(u) - (u === me ? 7 : 10);
      if (u === me) { x += dx * 26; y += dy * 26; z += dz * 26; }
      const sx = x, sy = y, sz = z; let k = 0;
      for (; k < 160; k++) {
        x += dx * 12; y += dy * 12; z += dz * 12;
        const tx = Math.floor(x / T), ty = Math.floor(y / T); if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) break;
        if (z < groundAt(m, x, y) || G.bulletSolid(ty * m.w + tx, x, y, z, z)) break;
      }
      let mesh = this.laserPool[n]; if (!mesh) { mesh = new THREE.Mesh(this.laserGeo, this.laserMats.red); mesh.frustumCulled = false; this.scene.add(mesh); this.laserPool.push(mesh); }
      n++; mesh.visible = true; mesh.material = this.laserMats[kind === 'ir' ? 'ir' : 'red']; mesh.material.opacity = night ? 0.65 : 0.3;
      mesh.position.set(sx, sz, sy); mesh.lookAt(x, z, y); mesh.scale.set(1, 1, Math.hypot(x - sx, y - sy, z - sz));
      this.pushP(this.addP, x - dx * 3, z - dz * 3, y - dy * 3, 7, kind === 'ir' ? 0.8 : 1, kind === 'ir' ? 1 : 0.1, kind === 'ir' ? 0.8 : 0.1, 1);
    };
    for (const [u, v] of this.unitViews) {
      if (!u.alive || n >= 60) continue;
      if (u === me) { const w = G.wstat(me); if (w && w.laser) beam(u, w.laser); continue; }
      if (v.laser && v.grp.visible) beam(u, v.laser);
    }
    for (let i = n; i < this.laserPool.length; i++) this.laserPool[i].visible = false;
    const A = this.addP; A.geo.setDrawRange(0, A.i); A.geo.attributes.position.needsUpdate = A.geo.attributes.col.needsUpdate = A.geo.attributes.size.needsUpdate = true;
  }

  // ---------------------------------------------------------------- frame
  render(dt) {
    dt = Math.max(0, Math.min(0.1, dt || 0)); this.fdt = Math.max(1 / 240, dt);
    const G = this.g, me = G.byId[G.localId], target = me && me.alive ? me : (G.byId[G.spectate] || me);
    G.camTarget = target && target.alive ? target : null;
    const cam = this.camera, viewer = me && me.alive ? me : target;
    // camera at the eyes of the player (or whoever we spectate)
    if (target) {
      const yaw = target === me ? G.input.yaw : target.angle, pitch = target === me ? G.input.pitch : 0;
      const bob = target.moving ? Math.sin((target.walk || 0) * 2) * 1.1 : 0;
      const eye = target.alive ? STANCES[target.stance || 'stand'].eye : 14;
      this.eyeOff = this.eyeOff === undefined ? eye : this.eyeOff + (eye - this.eyeOff) * Math.min(1, dt * 12);
      cam.position.set(target.x + (Math.random() - 0.5) * G.shake * 0.4, (target.z || 0) + this.eyeOff + bob * (target.stance === 'stand' ? 1 : 0.4) + (Math.random() - 0.5) * G.shake * 0.4, target.y);
      cam.rotation.set(pitch + (G.recoilPitch || 0), -yaw - Math.PI / 2, 0);
    }
    if (this.shadows) {
      // the shadow map covers the area in front of the camera (where shadows are seen), and its centre is snapped to
      // whole shadow-map texels along the light's axes so shadow edges don't crawl or shimmer as you move
      const fw = new THREE.Vector3(); cam.getWorldDirection(fw); fw.y = 0; if (fw.lengthSq() > 1e-6) fw.normalize();
      const c = cam.position.clone().addScaledVector(fw, 480), S = this.sunShadow;
      const along = c.dot(S.right), up = c.dot(S.up), depth = c.dot(S.dir);
      const sa = Math.round(along / S.texel) * S.texel, su = Math.round(up / S.texel) * S.texel;
      const center = S.right.clone().multiplyScalar(sa).addScaledVector(S.up, su).addScaledVector(S.dir, depth);
      this.sun.target.position.copy(center); this.sun.position.copy(center).addScaledVector(S.dir, -1600);
    }
    // vision: night darkness, goggles, thermal
    const thermal = viewer && G.thermal(viewer), nv = viewer && viewer.gearOn && (viewer.gear.vision === 'nv' || viewer.gear.vision === 'fused') && G.night;
    const night = G.night, sr = viewer && viewer.gearOn && viewer.gear.vision ? viewer.gear.range : 0;
    if (night) {
      this.hemi.intensity = nv || thermal ? 0.95 : 0.05; this.sun.intensity = nv || thermal ? 0.25 : 0.07;
      this.eyeLight.intensity = nv || thermal ? 0 : 0.5; this.eyeLight.position.set(cam.position.x, 60, cam.position.z);
      if (sr) { if (!this.scene.fog) this.scene.fog = new THREE.Fog(0x000000, 1, 2); this.scene.fog.near = sr * 0.45; this.scene.fog.far = sr * 1.08; } else this.scene.fog = null;
    }
    // night vision: a monochrome phosphor image (green on Gen 2/3 tubes, white on the GPNVG), with automatic gain:
    // bright light sources in view (fires, weapon lights shining at you, muzzle flashes) make the tube dim the
    // whole picture and bloom around the light, like real image intensifiers
    let gain = 1; this.nvHalos = [];
    if (nv) {
      const halo = (x, y, h, r, k) => { const p = this.project(x, h, y); if (!p || p.x < -200 || p.y < -200 || p.x > this.cssW + 200 || p.y > this.cssH + 200) return; const d = Math.hypot(x - cam.position.x, y - cam.position.z); const a = Math.min(1, k * 400 / Math.max(60, d)); this.nvHalos.push({ x: p.x, y: p.y, r: r * 300 / Math.max(80, d), a }); const centre = 1 - Math.min(1, Math.hypot(p.x - this.cssW / 2, p.y - this.cssH / 2) / (this.cssH * 0.6)); gain -= a * centre * 0.35; };
      for (const l of G.lights || []) if (!l.cone && l.r > 40) halo(l.x, l.y, (l.z || 0) + 30, Math.min(260, l.r * 0.9), l.r > 300 ? 0.6 : 0.35);
      for (const p of G.particles) if (p.type === 'flash') halo(p.x, p.y, p.z || MUZZLE_H, 120, 0.5);
      for (const u of G.units) if (u.alive && u.light && u !== viewer) { const toMe = Math.atan2(cam.position.z - u.y, cam.position.x - u.x); let da = Math.abs(Math.atan2(Math.sin(toMe - u.angle), Math.cos(toMe - u.angle))); if (da < 0.5 && G.los(u.x, u.y, cam.position.x, cam.position.z, true)) halo(u.x + Math.cos(u.angle) * 10, u.y + Math.sin(u.angle) * 10, eyeZ(u) - 8, 340, 1.4 * (1 - da / 0.5)); }
      gain = Math.max(0.4, gain); this.nvGain = (this.nvGain === undefined ? 1 : this.nvGain) + (gain - (this.nvGain === undefined ? 1 : this.nvGain)) * Math.min(1, dt * (gain < (this.nvGain || 1) ? 12 : 1.5)); // the tube reacts fast to glare, recovers slowly
      gain = this.nvGain;
    } else this.nvGain = 1;
    const white = nv && viewer.gear && viewer.gear.phosphor === 'white';
    const filter = thermal ? 'grayscale(1) contrast(1.35) brightness(0.85)' : nv ? (white ? `grayscale(1) sepia(0.25) hue-rotate(160deg) brightness(${(1.2 * gain).toFixed(2)}) contrast(1.25)` : `grayscale(1) sepia(1) hue-rotate(62deg) saturate(2.6) brightness(${(1.12 * gain).toFixed(2)}) contrast(1.22)`) + ' blur(0.35px)' : '';
    if (this.canvas.style.filter !== filter) this.canvas.style.filter = filter;
    // FOV: scopes zoom, aiming down sights zooms a little
    const it = me && me.alive ? ITEMS[me.slots[me.slot]] : null, scoped = me && me.alive && me.scoped && it && it.scope;
    const cws = me && me.alive ? G.wstat(me) : null, fov = me && me.alive && me.scoped && cws && cws.cat !== 'melee' ? (cws.adsFov || (cws.scope ? 18 : 60)) : 75;
    if (Math.abs(cam.fov - fov) > 0.1) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 14); cam.updateProjectionMatrix(); }
    this.addP.pts.material.uniforms.scale.value = this.normP.pts.material.uniforms.scale.value = this.cssH * this.renderer.getPixelRatio() / (2 * Math.tan(cam.fov * Math.PI / 360));
    // zone colour
    if (this.zoneMat) { const col = G.zone.holder < 0 ? 0xffd34a : G.zone.contested ? 0xff9800 : me && G.zone.holder === me.team ? 0x4caf50 : 0xe53935; this.zoneMat.color.set(col); this.zoneRing.material.color.set(col); this.zoneMat.opacity = 0.12 + Math.sin(G.time * 3) * 0.05; }
    this.updateUnits(viewer, thermal); this.updateBases(me); this.updateProjectiles(); this.updateParticles(night && !nv && !thermal ? 0.25 : 1); this.updateCasings3D(dt, night && !nv && !thermal ? 0.3 : 1);
    this.updateLights(cam.position, me); this.updateLasers(me, nv, night); this.flushGround();
    const R = this.renderer; R.clear(); R.render(this.scene, cam);
    // weapon model in its own pass so it never clips into walls
    this.updateViewmodel(me, dt, !!(me && me.alive && !scoped && target === me), me && me.light);
    // first-person gun: held exactly where the classic models were; anything reaching back past where the classic
    // stocks ended (long stocks, scopes' eyepieces) is clipped, so you see the same part of the gun: grip to muzzle
    R.clearDepth(); R.clippingPlanes = this.vmClip || (this.vmClip = [new THREE.Plane(new THREE.Vector3(0, 0, -1), -3.2)]);
    // the cut is fixed to the gun (where on the gun it falls), not to the screen: walking bob, recoil and sway move the
    // whole gun, cut and all, so the cut edge never slides into view and shows the inside of the stock
    { const vm = this.vm, rest = -8.5 - ((vm.model && vm.model.userData.vmPush) || 0), cut = -3.2 + 2.7 * Math.max(vm.ads || 0, vm.rl || 0) - rest;
      this.vmRoot.updateMatrixWorld(true); this.vmClip[0].set(new THREE.Vector3(0, 0, -1), cut).applyMatrix4(this.vmRoot.matrixWorld); } // aiming: the stock comes up to the cheek, so keep it all in view
    R.render(this.vmScene, this.vmCam); R.clippingPlanes = [];
  }
  // world position -> CSS pixel on screen (null when behind the camera)
  project(x, h, y) {
    const v = new THREE.Vector3(x, h, y).project(this.camera);
    if (v.z > 1 || v.z < -1) return null;
    return { x: (v.x + 1) / 2 * this.cssW, y: (1 - v.y) / 2 * this.cssH };
  }
}
// minimal BufferGeometry merge (position/normal/uv, indexed) for the crossed wheat planes
function mergeGeos(list) {
  const pos = [], nor = [], uv = [], idx = []; let off = 0;
  list.forEach(g => { const p = g.attributes.position.array, n = g.attributes.normal.array, u = g.attributes.uv.array; pos.push(...p); nor.push(...n); uv.push(...u); g.index.array.forEach(i => idx.push(i + off)); off += p.length / 3; });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g;
}
