// ============================================================================
// Procedural maps: themed generators used by the in-game map generator, the
// massive-battle maps and some hand-tuned maps. Deterministic from the seed.
// ============================================================================
const MAPGEN_THEMES = {
  town:       { name: 'City', desc: 'Street grid of brick and concrete blocks, plazas, parks and parked cars.', terrain: { amp: 22, wave: 34 } },
  village:    { name: 'Countryside', desc: 'Farmsteads, wheat fields, hedgerows, dirt roads and a river.', terrain: { amp: 70, wave: 28 } },
  forest:     { name: 'Forest', desc: 'Dense woods with clearings, cabins, a river and rocky hills.', terrain: { amp: 90, wave: 24 } },
  desert:     { name: 'Desert', desc: 'Mud-brick compounds, a market, palm oases and rocky dunes.', terrain: { amp: 56, wave: 18 } },
  snow:       { name: 'Arctic', desc: 'Snowfields, frozen lakes, pine woods and concrete bunkers under mountains.', terrain: { amp: 60, wave: 24, edge: 220 } },
  industrial: { name: 'Industrial', desc: 'Warehouses, container stacks, rail sidings and chain-link yards.', terrain: { amp: 14, wave: 40 } },
  coast:      { name: 'Coast', desc: 'A harbour town on the sea with piers, beaches and warehouses.', terrain: { custom: 'coast' } },
  suburb:     { name: 'Suburbs', desc: 'Houses with fenced yards, quiet streets, a school and a park.', terrain: { amp: 26, wave: 30 } },
  novel:      { name: '✨ Something New', desc: 'A brand-new kind of place every time, unlike the themes above.', terrain: null },
  described:  { name: 'Described', desc: 'Built from your own description.', terrain: null, hidden: true },
  canyon:     { name: 'Canyon', desc: 'A winding valley between high mesas, with a mining camp and a rail line.', terrain: { custom: 'canyon' } },
};
const MAPGEN_SIZES = { medium: { name: 'Medium', wh: [92, 70] }, large: { name: 'Large', wh: [116, 88] }, xl: { name: 'Extra Large', wh: [148, 112] }, massive: { name: 'Massive', wh: [196, 150] } };

// toolkit shared by the generators: occupancy grid, roads, rivers, plots
function genKit(m, B, rng) {
  const W = m.w, H = m.h, occ = new Uint8Array(W * H); // 1 road, 2 building, 3 water, 4 reserved, 5 field
  const ri = (a, b) => a + Math.floor(rng() * (b - a + 1));
  const K = {
    W, H, occ, ri,
    inb: (x, y, pad) => x >= (pad || 0) && y >= (pad || 0) && x < W - (pad || 0) && y < H - (pad || 0),
    free(x, y, w, h, pad, ok) { pad = pad || 0; for (let j = y - pad; j < y + h + pad; j++) for (let i = x - pad; i < x + w + pad; i++) { if (!K.inb(i, j, 2)) return false; const o = occ[j * W + i]; if (o && !(ok && ok.includes(o))) return false; } return true; },
    mark(x, y, w, h, v) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (K.inb(i, j)) occ[j * W + i] = v; },
    // thick polyline road; over water it becomes a bridge
    road(pts, width, floor, line) {
      for (let k = 0; k < pts.length - 1; k++) {
        const [x0, y0] = pts[k], [x1, y1] = pts[k + 1], n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
        for (let s = 0; s <= n; s++) {
          const cx = x0 + (x1 - x0) * s / n, cy = y0 + (y1 - y0) * s / n;
          for (let dy = -width / 2; dy < width / 2; dy++) for (let dx = -width / 2; dx < width / 2; dx++) {
            const x = Math.floor(cx + dx + 0.5), y = Math.floor(cy + dy + 0.5); if (!K.inb(x, y)) continue;
            const i = y * W + x;
            if (m.floor[i] === F.WATER || m.floor[i] === F.BRIDGE) { m.floor[i] = F.BRIDGE; occ[i] = 1; m.obj[i] = 0; continue; }
            m.floor[i] = floor; occ[i] = 1; m.obj[i] = 0;
          }
          if (line && s % 4 < 2) { const x = Math.floor(cx + 0.5), y = Math.floor(cy + 0.5); if (K.inb(x, y) && m.floor[y * W + x] === floor) m.floor[y * W + x] = F.LINE; }
        }
      }
    },
    // a wandering line across the map (for roads and rivers)
    meander(horizontal, at, amp, freq, seed) {
      const pts = [], n = horizontal ? W : H;
      for (let t = -2; t <= n + 2; t += 3) { const o = at + Math.sin(t / n * Math.PI * freq + seed) * amp + Math.sin(t / n * Math.PI * freq * 2.7 + seed * 2) * amp * 0.35; pts.push(horizontal ? [t, o] : [o, t]); }
      return pts;
    },
    river(horizontal, at, width, amp) {
      const pts = K.meander(horizontal, at, amp, 2 + rng() * 2, rng() * 6);
      for (let k = 0; k < pts.length - 1; k++) {
        const [x0, y0] = pts[k], [x1, y1] = pts[k + 1];
        for (let s = 0; s <= 6; s++) { const cx = x0 + (x1 - x0) * s / 6, cy = y0 + (y1 - y0) * s / 6;
          for (let dy = -width; dy <= width; dy++) for (let dx = -width; dx <= width; dx++) { const x = Math.round(cx + dx), y = Math.round(cy + dy); if (!K.inb(x, y)) continue; const d = Math.hypot(dx, dy) + (hash2(x, y, 9) - 0.5) * 1.2; if (d < width) { m.floor[y * W + x] = F.WATER; occ[y * W + x] = 3; } else if (d < width + 1.4 && m.floor[y * W + x] !== F.WATER && occ[y * W + x] !== 3) m.floor[y * W + x] = F.MUD; } }
      }
      return pts;
    },
    // keep the spawn areas on the left and right edges open
    reserveSpawns(n) { const h = Math.max(14, n * 2.4 + 4); K.mark(0, Math.floor(H / 2 - h / 2), 7, Math.ceil(h), 4); K.mark(W - 7, Math.floor(H / 2 - h / 2), 7, Math.ceil(h), 4); },
    house(x, y, w, h, wall, floor, opts) { B.building(x, y, w, h, wall, floor, opts || {}); K.mark(x - 1, y - 1, w + 2, h + 2, 2); },
    // buildings packed into a rectangular plot with alleys between them
    fillPlot(x, y, w, h, pick) {
      const placed = [];
      for (let tries = 0; tries < 40; tries++) {
        const bw = ri(8, Math.min(18, w)), bh = ri(7, Math.min(15, h)); if (bw > w || bh > h) continue;
        const bx = x + ri(0, w - bw), by = y + ri(0, h - bh);
        if (!K.free(bx, by, bw, bh, 1)) continue;
        const sp = pick(bw, bh, bx, by); if (!sp) continue;
        K.house(bx, by, bw, bh, sp.wall, sp.floor, sp.opts); placed.push([bx, by, bw, bh]);
      }
      return placed;
    },
    // a city block cut into lots: one or two rows of buildings along the streets, alleys between them
    lots(x, y, w, h, pick) {
      const placed = [], rowsN = h >= 17 ? 2 : 1, depth = rowsN === 2 ? Math.floor((h - 2) / 2) : h;
      for (let r = 0; r < rowsN; r++) {
        const ry = r === 0 ? y : y + h - depth;
        for (let lx = x; lx < x + w - 6;) {
          let bw = ri(8, 13); if (x + w - (lx + bw) < 8) bw = x + w - lx; // last lot takes the rest
          if (bw < 7) break;
          const bh = Math.max(6, depth - ri(0, 2)), by = r === 0 ? ry : ry + depth - bh;
          if (K.free(lx, by, bw, bh, 0)) { const sp = pick(bw, bh, lx, by); if (sp) { B.building(lx, by, bw, bh, sp.wall, sp.floor, sp.opts); K.mark(lx, by, bw, bh, 2); placed.push([lx, by, bw, bh]); } }
          lx += bw + ri(1, 2);
        }
      }
      return placed;
    },
    // sprinkle objects on free tiles matching cond
    sprinkle(o, n, cond, x0, y0, x1, y1) { B.scatter(o, n, x0 || 0, y0 || 0, x1 || W, y1 || H, (x, y) => !occ[y * W + x] && (!cond || cond(x, y))); },
    forest(n, o, cx, cy, r, density) { // a wood: noise-shaped patch of trees
      for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        if (!K.inb(x, y, 1) || occ[y * W + x] || m.obj[y * W + x]) continue;
        const d = Math.hypot(x - cx, y - cy) / r + (valueNoise(x / 5, y / 5, n) - 0.5) * 0.7;
        if (d < 1 && hash2(x, y, n + 3) < density * (1.1 - d)) { B.obj(x, y, o); }
      }
    },
    sandbagNest(x, y) { if (!K.free(x - 1, y - 1, 5, 3, 0, [5])) return; B.rectO(x, y, 4, 1, O.SANDBAG); B.obj(x, y + 1, O.SANDBAG); B.obj(x + 3, y + 1, O.SANDBAG); K.mark(x, y, 4, 2, 4); },
    finish(nSpawn) {
      B.spawnsLR(2, nSpawn); B.ffaRing(nSpawn * 2, W * 0.36, H * 0.34);
      // zone: the most open spot near the middle
      let best = null, bs = -1;
      for (let k = 0; k < 60; k++) { const x = Math.round(W / 2 + (rng() - 0.5) * W * 0.3), y = Math.round(H / 2 + (rng() - 0.5) * H * 0.3); let sc = 0;
        for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const i = (y + dy) * W + x + dx; if (K.inb(x + dx, y + dy) && !m.obj[i] && m.floor[i] !== F.WATER) sc++; }
        if (sc > bs) { bs = sc; best = [x, y]; } }
      m.zone = { x: best[0] * T, y: best[1] * T, r: Math.max(5, Math.min(9, W / 18)) * T };
    },
  };
  return K;
}

// ---- themes ----------------------------------------------------------------
const GENT = {
  town(m, B, rng, K, o) {
    const { W, H, ri } = K;
    B.fill(F.GRASS);
    K.reserveSpawns(o.spawn);
    if (o.river !== false && rng() < 0.6) K.river(false, W * (0.35 + rng() * 0.3), 2.6, W * 0.06);
    // street grid: avenues with lines, side streets without
    const bw = ri(20, 26), xs = [], ys = [];
    for (let x = 8 + ri(0, 6); x < W - 8; x += bw + ri(-3, 3)) xs.push(x);
    for (let y = 6 + ri(0, 5); y < H - 6; y += bw + ri(-2, 3)) ys.push(y);
    // one street runs through the middle (the spawns face each other along it)
    let ci = 0; ys.forEach((y, k) => { if (Math.abs(y - H / 2) < Math.abs(ys[ci] - H / 2)) ci = k; }); ys[ci] = Math.round(H / 2);
    xs.forEach((x, k) => K.road([[x, 0], [x, H]], k % 2 ? 4 : 5, F.ASPHALT, !(k % 2)));
    ys.forEach((y, k) => K.road([[0, y], [W, y]], y === Math.round(H / 2) ? 6 : 4, F.ASPHALT, y === Math.round(H / 2)));
    // pavements along every road
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (K.occ[i]) continue; if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => K.occ[(y + dy) * W + x + dx] === 1 && m.floor[(y + dy) * W + x + dx] !== F.BRIDGE)) m.floor[i] = F.CONCRETE; }
    // blocks: buildings, the odd park, plaza or car park
    const cols = [0, ...xs, W], rows = [0, ...ys, H];
    for (let r = 0; r < rows.length - 1; r++) for (let c = 0; c < cols.length - 1; c++) {
      const x0 = cols[c] + (c ? 4 : 2), y0 = rows[r] + (r ? 4 : 2), x1 = cols[c + 1] - (c < cols.length - 2 ? 3 : 2), y1 = rows[r + 1] - (r < rows.length - 2 ? 3 : 2), w = x1 - x0, h = y1 - y0;
      if (w < 7 || h < 6) continue;
      const kind = hash2(c, r, m.seed % 1000);
      if (kind < 0.12) { // park
        B.rectF(x0, y0, w, h, F.GRASS); K.forest(c * 13 + r, O.TREE, x0 + w / 2, y0 + h / 2, Math.min(w, h) / 2, 0.22);
        K.sprinkle(O.BUSH, Math.round(w * h / 20), null, x0, y0, x1, y1); K.mark(x0, y0, w, h, 4);
      } else if (kind < 0.2) { // plaza with a fountain and market stalls
        B.rectF(x0, y0, w, h, F.COBBLE); B.blob(x0 + w / 2, y0 + h / 2, 1.8, F.WATER, 0.3);
        for (let k = 0; k < 4; k++) { const sx = x0 + 2 + ri(0, Math.max(0, w - 6)), sy = y0 + 2 + ri(0, Math.max(0, h - 4)); if (B.get(sx, sy) === 0 && B.get(sx + 1, sy) === 0) B.rectO(sx, sy, 2, 1, O.TABLE); }
        K.mark(x0, y0, w, h, 4);
      } else if (kind < 0.27) { // car park
        B.rectF(x0, y0, w, h, F.ASPHALT);
        for (let y = y0 + 1; y < y1 - 1; y += 3) for (let x = x0 + 1; x < x1 - 2; x += 3) if (hash2(x, y, 5) < 0.55) B.rectO(x, y, 2, 1, O.CAR, Math.floor(rng() * 256));
        K.mark(x0, y0, w, h, 4);
      } else {
        K.lots(x0, y0, w, h, (bw2, bh2) => {
          const big = bw2 * bh2 >= 140, apt = big && rng() < 0.45;
          return { wall: apt ? O.CONCRETE : rng() < 0.65 ? O.BRICK : rng() < 0.5 ? O.CONCRETE : O.STUCCO, floor: rng() < 0.5 ? F.TILE : F.WOOD,
            opts: { doors: ['n', 's', 'e', 'w'].filter(() => rng() < 0.6).concat(['s', 'n']), split: big, furnish: true, stories: apt ? ri(3, 4) : undefined } };
        });
      }
    }
    // cars along the streets, barricades at a few crossings, bins
    for (let k = 0; k < W * H / 220; k++) { const x = ri(2, W - 4), y = ri(2, H - 3); if (K.occ[y * W + x] === 1 && K.occ[y * W + x + 1] === 1 && m.floor[y * W + x] === F.ASPHALT && !B.get(x, y) && !B.get(x + 1, y)) B.rectO(x, y, 2, 1, O.CAR, Math.floor(rng() * 256)); }
    xs.slice(0, 3).forEach((x, k) => { const y = ys[(k * 2 + 1) % ys.length]; K.sandbagNest(x - 2, y + 3); });
    K.sprinkle(O.BARREL, Math.round(W * H / 700), (x, y) => m.floor[y * W + x] === F.CONCRETE);
    K.sprinkle(O.TREE, Math.round(W * H / 400), (x, y) => m.floor[y * W + x] === F.CONCRETE && (x + y) % 5 === 0);
  },
  suburb(m, B, rng, K, o) {
    const { W, H, ri } = K;
    B.fill(F.GRASS); K.reserveSpawns(o.spawn);
    // a few streets with houses either side: fenced yards, driveways, trees
    const ys = []; for (let y = 14 + ri(0, 4); y < H - 12; y += ri(27, 31)) ys.push(y);
    let ci = 0; ys.forEach((y, k) => { if (Math.abs(y - H / 2) < Math.abs(ys[ci] - H / 2)) ci = k; }); ys[ci] = Math.round(H / 2);
    ys.forEach(y => K.road(K.meander(true, y, 1.5, 1, rng() * 6), 4, F.ASPHALT, false));
    const xs = []; for (let x = 18 + ri(0, 8); x < W - 14; x += ri(28, 36)) xs.push(x);
    xs.forEach(x => K.road([[x, ys[0]], [x, ys[ys.length - 1]]], 4, F.ASPHALT, false));
    // school: a big three-storey block with a sports field
    const sx = Math.round(W / 2 - 13), sy = Math.round(H / 2 + 5);
    if (K.free(sx, sy, 26, 14, 1)) { K.house(sx, sy, 26, 14, O.BRICK, F.TILE, { doors: ['n', 'w', 'e'], split: true, furnish: 'home', stories: 3 }); B.rectF(sx, sy + 16, 26, 10, F.DIRT); K.mark(sx, sy + 16, 26, 10, 4); }
    ys.forEach(ry => { for (const side of [-1, 1]) for (let x = 6; x < W - 16; x += ri(14, 18)) {
      const hw = ri(9, 12), hh = ri(8, 10), hy = side < 0 ? ry - 4 - hh : ry + 4;
      if (!K.free(x, hy, hw, hh, 1)) continue;
      K.house(x, hy, hw, hh, rng() < 0.7 ? O.WHITEWOOD : O.BRICK, F.WOOD, { doors: [side < 0 ? 's' : 'n', rng() < 0.5 ? 'e' : 'w'], furnish: true });
      // fenced back yard
      const fy = side < 0 ? hy - 4 : hy + hh + 3;
      if (K.free(x - 1, Math.min(fy, side < 0 ? fy : hy + hh), hw + 2, 3, 0, [2])) for (let i = x - 1; i <= x + hw; i++) if (B.get(i, fy) === 0 && !K.occ[fy * W + i]) B.obj(i, fy, i === x + 3 ? 0 : O.FENCE);
      B.rectF(x + hw + 1, side < 0 ? hy + hh - 1 : hy, 2, 2, F.CONCRETE);
      if (rng() < 0.5) B.rectO(x + hw + 1, side < 0 ? hy + hh + 1 : hy - 2, 2, 1, O.CAR, Math.floor(rng() * 256));
    } });
    K.sprinkle(O.TREE, Math.round(W * H / 120)); K.sprinkle(O.BUSH, Math.round(W * H / 90));
  },
  village(m, B, rng, K, o) {
    const { W, H, ri } = K;
    B.fill(F.GRASS); K.reserveSpawns(o.spawn);
    K.river(false, W * (0.3 + rng() * 0.4), 2.2, W * 0.08);
    K.road(K.meander(true, H / 2, H * 0.08, 1.5, rng() * 6), 3, F.DIRT);
    K.road(K.meander(false, W * (0.25 + rng() * 0.5), W * 0.06, 1.3, rng() * 6), 3, F.DIRT);
    // farmsteads: a house and a barn in a yard
    const n = Math.round(W * H / 1700);
    // a hamlet: a few cottages and a chapel around the middle
    for (let k = 0, tries = 0; k < Math.round(W * H / 1500) && tries < 200; tries++) {
      const w = ri(8, 11), h = ri(7, 9), x = Math.round(W / 2 + (rng() - 0.5) * W * 0.4), y = Math.round(H / 2 + (rng() - 0.5) * H * 0.45);
      if (!K.free(x, y, w, h, 2)) continue; K.house(x, y, w, h, rng() < 0.5 ? O.FIELDSTONE : O.WHITEWOOD, F.WOOD, { doors: ['n', 's', 'e'].filter(() => rng() < 0.7).concat(['w']), furnish: true }); k++;
    }
    for (let k = 0, tries = 0; k < n && tries < 600; tries++) {
      const x = ri(6, W - 34), y = ri(5, H - 26); if (!K.free(x, y, 30, 22, 0)) continue;
      B.rectF(x, y, 30, 22, F.DIRT);
      K.house(x + 2, y + 2, ri(10, 13), ri(8, 10), rng() < 0.5 ? O.WHITEWOOD : O.FIELDSTONE, F.WOOD, { doors: ['s', 'e'], furnish: true });
      K.house(x + 16, y + 3, ri(11, 13), ri(12, 15), O.BARNWALL, F.WOOD, { doors: ['s', 'w'], doorWidth: 3 });
      for (let i = x; i < x + 30; i++) { if (i % 9) { B.obj(i, y, O.FENCE); B.obj(i, y + 21, O.FENCE); } }
      B.rectO(x + 3, y + 15, 1, 2, O.HAY); B.rectO(x + 4, y + 15, 1, 1, O.HAY); B.obj(x + 12, y + 18, O.HAYPILE);
      K.mark(x, y, 30, 22, 2); k++;
    }
    // fields of wheat inside hedgerows
    for (let k = 0, tries = 0; k < W * H / 1100 && tries < 300; tries++) {
      const fw = ri(12, 22), fh = ri(9, 16), x = ri(4, W - fw - 4), y = ri(4, H - fh - 4); if (!K.free(x, y, fw, fh, 1)) continue;
      B.rectF(x, y, fw, fh, F.FIELD);
      for (let j = y; j < y + fh; j++) for (let i = x; i < x + fw; i++) { const edge = i === x || j === y || i === x + fw - 1 || j === y + fh - 1; if (edge) { if (hash2(i, j, 3) < 0.75) B.obj(i, j, rng() < 0.6 ? O.HEDGE : O.FENCE); } else if ((j - y) % 3 !== 0) B.obj(i, j, O.WHEAT); }
      K.mark(x, y, fw, fh, 5); k++;
    }
    for (let k = 0; k < W * H / 1800; k++) K.forest(k + 20, O.TREE, ri(4, W - 4), ri(4, H - 4), ri(4, 8), 0.35);
    K.sprinkle(O.BUSH, Math.round(W * H / 70)); K.sprinkle(O.HAY, Math.round(W * H / 900)); K.sprinkle(O.LOG, Math.round(W * H / 1500));
  },
  forest(m, B, rng, K, o) {
    const { W, H, ri } = K;
    B.fill(F.FOREST); for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (valueNoise(i / 9, j / 9, m.seed % 97) < 0.32) B.floor(i, j, F.GRASS);
    K.reserveSpawns(o.spawn);
    K.river(rng() < 0.5, (rng() < 0.5 ? H : W) * (0.4 + rng() * 0.2), 2.4, 8);
    K.road(K.meander(true, H / 2, H * 0.1, 1.6, rng() * 6), 3, F.DIRT);
    // clearings with cabins and a ranger station
    for (let k = 0, tries = 0; k < W * H / 1600 && tries < 200; tries++) {
      const x = ri(8, W - 20), y = ri(6, H - 16); if (!K.free(x - 3, y - 3, 18, 15, 0)) continue;
      B.blob(x + 6, y + 5, 7, F.GRASS, 2); K.house(x, y, ri(9, 11), ri(7, 9), O.WOODWALL, F.WOOD, { doors: ['s', 'n'], furnish: true });
      B.rectO(x + 12, y + 2, 1, 3, O.LOG); k++;
    }
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
      const i = y * W + x; if (K.occ[i] || m.obj[i] || m.floor[i] === F.WATER || m.floor[i] === F.MUD) continue;
      const v = valueNoise(x / 7, y / 7, m.seed % 89 + 3), r = hash2(x, y, 12);
      if (v > 0.42 && r < 0.2) B.obj(x, y, rng() < 0.6 ? O.PINE : O.TREE); else if (r < 0.025) B.obj(x, y, O.BUSH); else if (r < 0.03) B.obj(x, y, O.ROCK); else if (r < 0.034) B.obj(x, y, O.LOG);
    }
  },
  desert(m, B, rng, K, o) {
    const { W, H, ri } = K;
    B.fill(F.SAND); for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (valueNoise(i / 6, j / 6, m.seed % 83) < 0.3) B.floor(i, j, F.GRAVEL);
    K.reserveSpawns(o.spawn);
    K.road(K.meander(true, H / 2, H * 0.06, 1.2, rng() * 6), 4, F.DIRT);
    K.road(K.meander(false, W / 2, W * 0.05, 1.2, rng() * 6), 4, F.DIRT);
    // a market square in the middle and an oasis
    const mx = Math.round(W / 2 - 9), my = Math.round(H / 2 - 7); B.rectF(mx, my, 18, 14, F.COBBLE); K.mark(mx, my, 18, 14, 4);
    for (let k = 0; k < 6; k++) { const x = mx + 2 + ri(0, 13), y = my + 2 + ri(0, 9); if (B.get(x, y) === 0 && B.get(x + 1, y) === 0) B.rectO(x, y, 2, 1, O.TABLE); }
    const ox = ri(12, W - 12), oy = rng() < 0.5 ? ri(6, 16) : ri(H - 16, H - 6); B.blob(ox, oy, 4, F.WATER, 2);
    for (let a = 0; a < 10; a++) { const x = Math.round(ox + Math.cos(a) * 7), y = Math.round(oy + Math.sin(a) * 6); if (B.ok(x, y) && !K.occ[y * W + x]) B.obj(x, y, O.PALM); }
    K.mark(ox - 5, oy - 5, 10, 10, 3);
    // compounds: houses with a courtyard wall
    for (let k = 0, tries = 0; k < W * H / 300 && tries < 600; tries++) {
      const w = ri(8, 13), h = ri(7, 11), x = ri(4, W - w - 4), y = ri(4, H - h - 4); if (!K.free(x - 2, y - 2, w + 4, h + 4, 0)) continue;
      K.house(x, y, w, h, O.MUDBRICK, F.SAND, { doors: [['n', 's', 'e', 'w'][ri(0, 3)], ['n', 's', 'e', 'w'][ri(0, 3)]], furnish: true, split: rng() < 0.3 });
      if (rng() < 0.5) { const wy = rng() < 0.5 ? y - 2 : y + h + 1; for (let i = x - 1; i <= x + w; i++) if (hash2(i, wy, 5) < 0.85 && !K.occ[wy * W + i]) B.obj(i, wy, O.MUDBRICK); }
      k++;
    }
    K.sprinkle(O.PALM, Math.round(W * H / 200)); K.sprinkle(O.ROCK, Math.round(W * H / 260), (x, y) => m.floor[y * W + x] === F.GRAVEL);
    K.sprinkle(O.BUSH, Math.round(W * H / 300));
    [[0.3, 0.42], [0.7, 0.58], [0.5, 0.3], [0.5, 0.7]].forEach(([fx, fy]) => K.sandbagNest(Math.round(W * fx), Math.round(H * fy)));
  },
  snow(m, B, rng, K, o) {
    const { W, H, ri } = K;
    B.fill(F.SNOW); K.reserveSpawns(o.spawn);
    for (let k = 0; k < 2; k++) { const x = ri(14, W - 14), y = ri(12, H - 12); if (K.free(x - 7, y - 6, 14, 12, 0)) { B.blob(x, y, ri(4, 6), F.ICE, 2); K.mark(x - 6, y - 5, 12, 10, 4); } }
    K.road(K.meander(true, H / 2, 4, 1, rng() * 6), 3, F.GRAVEL);
    // the outpost: bunkers, a hangar and a radar building behind a fence
    const bx = Math.round(W / 2 - 18), by = Math.round(H / 2 - 14);
    for (let i = bx - 2; i < bx + 38; i++) for (const j of [by - 2, by + 30]) if (!K.occ[j * W + i] && i % 10) B.obj(i, j, O.CHAINLINK);
    K.house(bx, by, 16, 10, O.CONCRETE, F.CONCRETE, { doors: ['s', 'e'], furnish: true, stories: 2 });
    K.house(bx + 20, by, 16, 12, O.METALWALL, F.CONCRETE, { doors: ['s'], doorWidth: 6, windows: false, furnish: 'warehouse' });
    K.house(bx + 4, by + 18, 12, 9, O.CONCRETE, F.TILE, { doors: ['n', 'w'], furnish: true });
    for (let k = 0, tries = 0; k < W * H / 1600 && tries < 200; tries++) { const x = ri(6, W - 14), y = ri(6, H - 12); if (!K.free(x, y, 9, 7, 1)) continue; K.house(x, y, 9, 7, rng() < 0.5 ? O.CONCRETE : O.WOODWALL, F.CONCRETE, { doors: ['s', 'n'] }); k++; }
    for (let k = 0; k < W * H / 1200; k++) K.forest(k + 40, O.PINE, ri(3, W - 3), ri(3, H - 3), ri(5, 10), 0.4);
    K.sprinkle(O.ROCK, Math.round(W * H / 300)); K.sprinkle(O.CRATE, Math.round(W * H / 500)); K.sprinkle(O.BARREL, Math.round(W * H / 900));
    for (let k = 0; k < 4; k++) K.sandbagNest(ri(10, W - 14), ri(8, H - 8));
  },
  industrial(m, B, rng, K, o) {
    const { W, H, ri } = K;
    B.fill(F.CONCRETE); for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (valueNoise(i / 8, j / 8, m.seed % 71) < 0.3) B.floor(i, j, F.GRAVEL);
    K.reserveSpawns(o.spawn);
    // rail sidings and a main road
    for (const y of [Math.round(H * 0.3), Math.round(H * 0.72)]) { B.rectF(0, y, W, 2, F.GRAVEL); for (let x = 0; x < W; x += 2) { B.obj(x, y - 1, 0); } K.mark(0, y, W, 2, 1); }
    K.road([[0, H / 2], [W, H / 2]], 6, F.ASPHALT, true); K.road([[W / 2, 0], [W / 2, H]], 5, F.ASPHALT, true);
    // warehouses and container yards fenced in chain-link
    for (let k = 0, tries = 0; k < W * H / 700 && tries < 300; tries++) {
      const w = ri(16, 24), h = ri(11, 15), x = ri(4, W - w - 4), y = ri(4, H - h - 4); if (!K.free(x, y, w, h, 2)) continue;
      K.house(x, y, w, h, rng() < 0.6 ? O.METALWALL : O.CONCRETE, F.METAL, { doors: ['s', 'n'].filter(() => rng() < 0.8).concat(['e']), doorWidth: ri(3, 5), windows: false, furnish: 'warehouse' }); k++;
    }
    for (let k = 0, tries = 0; k < W * H / 1400 && tries < 300; tries++) {
      const w = ri(12, 18), h = ri(8, 12), x = ri(4, W - w - 4), y = ri(4, H - h - 4); if (!K.free(x - 1, y - 1, w + 2, h + 2, 0)) continue;
      for (let j = y; j < y + h; j += 3) for (let i = x; i < x + w - 2; i += 4) if (hash2(i, j, 21) < 0.7) B.rectO(i, j, 3, 1, O.CONTAINER, Math.floor(rng() * 256));
      for (let i = x - 1; i <= x + w; i++) { if (i % 7) { B.obj(i, y - 1, O.CHAINLINK); B.obj(i, y + h, O.CHAINLINK); } }
      K.mark(x - 1, y - 1, w + 2, h + 2, 4); k++;
    }
    K.sprinkle(O.CRATE, Math.round(W * H / 220)); K.sprinkle(O.BARREL, Math.round(W * H / 400));
    for (let k = 0; k < 6; k++) K.sandbagNest(ri(8, W - 12), ri(6, H - 8));
  },
  coast(m, B, rng, K, o) {
    const { W, H, ri } = K, sea = Math.round(H * 0.24);
    B.fill(F.GRASS);
    // the sea along the top, a beach, then the harbour town
    for (let x = 0; x < W; x++) { const s = sea + Math.round(Math.sin(x / 11) * 2 + Math.sin(x / 4.3) * 0.8); for (let y = 0; y < s; y++) { B.floor(x, y, F.WATER); K.occ[y * W + x] = 3; } for (let y = s; y < s + 4; y++) B.floor(x, y, F.SAND); }
    m.seaLine = sea;
    K.reserveSpawns(o.spawn);
    // piers out into the water with warehouses on the quay
    for (let x = 10; x < W - 12; x += ri(18, 26)) { B.rectF(x, 3, 4, sea, F.BRIDGE); K.mark(x, 3, 4, sea, 1); for (let y = 6; y < sea - 2; y += 6) if (rng() < 0.6) { B.obj(x + (rng() < 0.5 ? 0 : 3), y, O.CRATE); } }
    K.road([[0, sea + 5], [W, sea + 5]], 4, F.CONCRETE);
    for (let k = 0, tries = 0; k < W / 22 && tries < 100; tries++) { const w = ri(16, 22), x = ri(4, W - w - 4), y = sea + 8; if (!K.free(x, y, w, 12, 1)) continue; K.house(x, y, w, 12, O.BRICK, F.CONCRETE, { doors: ['n', 's'], doorWidth: 4, windows: false, furnish: 'warehouse' }); k++; }
    // the old town behind the harbour
    const ox0 = 8, oy0 = sea + 24;
    K.road([[0, H / 2 + 6], [W, H / 2 + 6]], 5, F.ASPHALT, true);
    for (let x = 22 + ri(0, 6); x < W - 10; x += ri(22, 28)) K.road([[x, sea + 5], [x, H]], 4, F.COBBLE);
    for (let y = oy0; y < H - 10; y += 20) K.lots(ox0, y, W - 16, Math.min(17, H - 4 - y), (bw, bh) => ({ wall: rng() < 0.5 ? O.STUCCO : O.BRICK, floor: F.TILE, opts: { doors: ['n', 's', 'e'].filter(() => rng() < 0.7).concat(['w']), furnish: true, split: bw * bh > 140, stories: bw * bh > 150 && rng() < 0.5 ? 3 : undefined } }));
    // lighthouse on the point
    const lx = W - 10, ly = sea + 1; if (K.free(lx - 3, ly - 3, 6, 6, 0, [3])) K.house(lx - 3, ly - 3, 6, 6, O.CONCRETE, F.CONCRETE, { doors: ['s'], stories: 4, windows: true });
    K.sprinkle(O.BARREL, Math.round(W * H / 500), (x, y) => y < sea + 22);
    K.sprinkle(O.TREE, Math.round(W * H / 250), (x, y) => y > sea + 20); K.sprinkle(O.BUSH, Math.round(W * H / 200), (x, y) => y > sea + 6);
    for (let k = 0; k < W * H / 400; k++) { const x = ri(2, W - 4), y = ri(sea + 4, H - 3); if (K.occ[y * W + x] === 1 && K.occ[y * W + x + 1] === 1 && !B.get(x, y) && !B.get(x + 1, y)) B.rectO(x, y, 2, 1, O.CAR, Math.floor(rng() * 256)); }
  },
  canyon(m, B, rng, K, o) {
    const { W, H, ri } = K;
    B.fill(F.SAND); for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (valueNoise(i / 5, j / 5, m.seed % 61) < 0.35) B.floor(i, j, F.GRAVEL);
    // the valley floor wanders across the map; mesas rise either side (heights come from the terrain pass)
    const vy = x => H / 2 + Math.sin(x / W * Math.PI * 2.2 + 1) * H * 0.14, half = Math.max(9, H * 0.13);
    m.canyon = { vy: x => vy(x), half };
    K.reserveSpawns(o.spawn);
    K.road(Array.from({ length: Math.ceil(W / 3) + 2 }, (_, k) => [k * 3, vy(k * 3) + 2]), 3, F.DIRT);
    // a rail line along the valley with a train of containers
    const ry = x => vy(x) - 4; for (let x = 0; x < W; x++) { const y = Math.round(ry(x)); B.floor(x, y, F.GRAVEL); B.floor(x, y + 1, F.GRAVEL); }
    for (let k = 0; k < 6; k++) { const x = Math.round(W * 0.35) + k * 4; B.rectO(x, Math.round(ry(x)), 3, 1, O.CONTAINER, 30 + k * 20); }
    // mining camp in the middle of the valley and ranches on the mesas
    const cx = Math.round(W / 2), cy = Math.round(vy(W / 2));
    for (const [dx, dy, w, h, wall, op] of [[-14, -2, 12, 9, O.WOODWALL, true], [2, 4, 14, 10, O.METALWALL, 'warehouse'], [-12, 9, 10, 8, O.WOODWALL, true]])
      if (K.free(cx + dx, cy + dy, w, h, 1)) K.house(cx + dx, cy + dy, w, h, wall, F.WOOD, { doors: ['n', 's'], furnish: op, doorWidth: wall === O.METALWALL ? 4 : 2 });
    for (let k = 0, tries = 0; k < W * H / 1500 && tries < 300; tries++) { const x = ri(6, W - 16), y = rng() < 0.5 ? ri(4, Math.max(5, Math.round(vy(x) - half - 12))) : ri(Math.min(H - 14, Math.round(vy(x) + half + 4)), H - 12); if (!K.free(x, y, 11, 9, 2)) continue; K.house(x, y, 11, 9, O.MUDBRICK, F.WOOD, { doors: ['s', 'e'], furnish: true }); k++; }
    K.sprinkle(O.ROCK, Math.round(W * H / 120)); K.sprinkle(O.BUSH, Math.round(W * H / 260)); K.sprinkle(O.CRATE, Math.round(W * H / 700), (x, y) => Math.abs(y - vy(x)) < half);
    K.sprinkle(O.BARREL, Math.round(W * H / 900), (x, y) => Math.abs(y - vy(x)) < half);
  },
};

// ---- "something new": a one-off theme invented from the seed. It mixes a biome (ground, plants, colours),
// a landform (island, crater, plateau, rolling hills, river delta), a settlement layout (ring fort, strip town,
// scattered hamlets, grid camp, citadel) and a landmark, so every roll is a different kind of place.
const NOVEL = {
  biomes: [
    { id: 'volcanic', adj: ['Ashen', 'Cinder', 'Ember', 'Obsidian', 'Sulphur'], ground: F.GRAVEL, alt: F.MUD, accent: F.DIRT, walls: [O.CONCRETE, O.RUIN, O.FIELDSTONE], plants: [O.ROCK, O.ROCK, O.BUSH], trees: O.PINE, water: false, tint: 'black rock, ash fields and lava-scarred stone' },
    { id: 'swamp', adj: ['Bog', 'Mire', 'Fen', 'Moss', 'Murk'], ground: F.MUD, alt: F.FOREST, accent: F.GRASS, walls: [O.WOODWALL, O.BARNWALL, O.PLYWOOD], plants: [O.BUSH, O.BUSH, O.LOG, O.WHEAT], trees: O.TREE, water: true, tint: 'reed beds, stilted shacks and black water' },
    { id: 'tundra', adj: ['Frozen', 'Pale', 'Rime', 'Boreal', 'Hoarfrost'], ground: F.SNOW, alt: F.ICE, accent: F.GRAVEL, walls: [O.WOODWALL, O.CONCRETE, O.METALWALL], plants: [O.ROCK, O.PINE, O.BUSH], trees: O.PINE, water: true, tint: 'snowfields, frozen ponds and timber cabins' },
    { id: 'savanna', adj: ['Golden', 'Lion', 'Dry', 'Acacia', 'Sun'], ground: F.FIELD, alt: F.SAND, accent: F.DIRT, walls: [O.MUDBRICK, O.WOODWALL, O.FIELDSTONE], plants: [O.BUSH, O.WHEAT, O.ROCK], trees: O.PALM, water: false, tint: 'tall dry grass, lone trees and mud-walled kraals' },
    { id: 'quarry', adj: ['Slate', 'Granite', 'Chalk', 'Flint', 'Iron'], ground: F.GRAVEL, alt: F.CONCRETE, accent: F.DIRT, walls: [O.METALWALL, O.CONCRETE, O.BRICK], plants: [O.ROCK, O.ROCK, O.CRATE, O.BARREL], trees: O.PINE, water: true, tint: 'cut stone terraces, conveyor sheds and spoil heaps' },
    { id: 'orchard', adj: ['Apple', 'Cherry', 'Orchard', 'Blossom', 'Bramble'], ground: F.GRASS, alt: F.FIELD, accent: F.DIRT, walls: [O.WHITEWOOD, O.BARNWALL, O.STUCCO], plants: [O.HEDGE, O.HAY, O.FENCE], trees: O.TREE, water: true, tint: 'rows of fruit trees, hedges and farmhouses' },
    { id: 'ruins', adj: ['Lost', 'Fallen', 'Ancient', 'Sunken', 'Old'], ground: F.GRASS, alt: F.COBBLE, accent: F.FOREST, walls: [O.RUIN, O.FIELDSTONE, O.RUIN], plants: [O.BUSH, O.STONE, O.TREE], trees: O.TREE, water: true, tint: 'overgrown ruins, broken walls and courtyards' },
    { id: 'oasis', adj: ['Mirage', 'Palm', 'Saffron', 'Dune', 'Spring'], ground: F.SAND, alt: F.GRAVEL, accent: F.GRASS, walls: [O.MUDBRICK, O.STUCCO, O.MUDBRICK], plants: [O.PALM, O.ROCK, O.BUSH], trees: O.PALM, water: true, tint: 'dunes around green water, palms and white walls' },
    { id: 'military', adj: ['Iron', 'Steel', 'Bunker', 'Rampart', 'Garrison'], ground: F.DIRT, alt: F.CONCRETE, accent: F.GRAVEL, walls: [O.CONCRETE, O.METALWALL, O.CONCRETE], plants: [O.SANDBAG, O.WIRE, O.HEDGEHOG, O.CRATE], trees: O.PINE, water: false, tint: 'bunkers, trenches, wire and hardened shelters' },
  ],
  landforms: [
    { id: 'island', name: 'Isle', desc: 'an island ringed by water' }, { id: 'crater', name: 'Crater', desc: 'a deep bowl with steep rims' },
    { id: 'plateau', name: 'Heights', desc: 'a raised plateau with cliffs and ramps' }, { id: 'rolling', name: 'Downs', desc: 'rolling hills' },
    { id: 'delta', name: 'Delta', desc: 'a river splitting into channels' }, { id: 'ridge', name: 'Ridge', desc: 'a long ridge down the middle' },
  ],
  layouts: ['ring', 'strip', 'hamlets', 'grid', 'citadel'],
  landmarks: ['tower', 'monument', 'crashsite', 'craters', 'bridgefort'],
};
function novelSpec(seed) {
  const r = mulberry32((Math.imul(seed | 0, 2654435761) ^ 0x9e3779b9) >>> 0); r(); r(); const pick = a => a[Math.floor(r() * a.length)];
  const biome = pick(NOVEL.biomes), land = pick(NOVEL.landforms), layout = pick(NOVEL.layouts), mark = pick(NOVEL.landmarks);
  const name = pick(biome.adj) + ' ' + land.name;
  const L = { ring: 'a ring-walled settlement', strip: 'a strip of buildings along one road', hamlets: 'scattered hamlets', grid: 'a grid-built camp', citadel: 'a tall citadel at its heart' }[layout];
  const M = { tower: 'a tall watchtower', monument: 'a stone monument', crashsite: 'a crashed transport', craters: 'a field of shell craters', bridgefort: 'a fortified crossing' }[mark];
  return { biome, land, layout, mark, name, desc: `A one-off place: ${biome.tint}, on ${land.desc}, with ${L} and ${M}.` };
}
GENT.novel = function (m, B, rng, K, o) {
  const { W, H, ri } = K, sp = novelSpec(m.seed), bi = sp.biome;
  m.novel = { name: sp.name, desc: sp.desc };
  B.fill(bi.ground);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const v = valueNoise(i / 7, j / 7, m.seed % 89); if (v < 0.28) B.floor(i, j, bi.alt); else if (v > 0.8) B.floor(i, j, bi.accent); }
  // landform water
  if (sp.land.id === 'island') for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const d = Math.hypot((i - W / 2) / (W * 0.5), (j - H / 2) / (H * 0.5)) + (valueNoise(i / 9, j / 9, 7) - 0.5) * 0.18; if (d > 0.92 && i > 8 && i < W - 9) { B.floor(i, j, F.WATER); K.occ[j * W + i] = 3; } else if (d > 0.86) B.floor(i, j, F.SAND); }
  if (sp.land.id === 'delta') { K.river(false, W * 0.42, 2.2, W * 0.05); K.river(false, W * 0.6, 1.8, W * 0.07); K.river(true, H * 0.5, 1.6, 3); }
  if (sp.land.id === 'crater') { const r = Math.min(W, H) * 0.12; if (bi.water) B.blob(W / 2, H / 2, r * 0.5, F.WATER, 2); K.mark(Math.round(W / 2 - r * 0.6), Math.round(H / 2 - r * 0.6), Math.round(r * 1.2), Math.round(r * 1.2), 3); }
  if (bi.water && (sp.land.id === 'rolling' || sp.land.id === 'ridge')) for (let k = 0; k < 3; k++) { const x = ri(14, W - 14), y = ri(10, H - 10); if (K.free(x - 6, y - 5, 12, 10, 0)) { B.blob(x, y, ri(3, 5), bi.id === 'tundra' ? F.ICE : F.WATER, 2); K.mark(x - 5, y - 4, 10, 8, 3); } }
  K.reserveSpawns(o.spawn);
  // roads
  K.road(K.meander(true, H / 2, H * 0.05, 1.3, rng() * 6), 3, bi.alt === F.CONCRETE ? F.ASPHALT : F.DIRT);
  const wall = () => bi.walls[Math.floor(rng() * bi.walls.length)], fl = bi.id === 'tundra' || bi.id === 'swamp' ? F.WOOD : bi.walls[0] === O.MUDBRICK ? F.SAND : F.CONCRETE;
  const house = (x, y, w, h, extra) => { if (!K.free(x, y, w, h, 1)) return false; K.house(x, y, w, h, wall(), fl, Object.assign({ doors: ['n', 's', 'e', 'w'].filter(() => rng() < 0.5).concat(['s']), furnish: bi.id === 'quarry' || bi.id === 'military' ? (rng() < 0.4 ? 'warehouse' : true) : true }, extra || {})); return true; };
  const cx = Math.round(W / 2), cy = Math.round(H / 2);
  // settlement
  if (sp.layout === 'ring') {
    const R = Math.min(W, H) * 0.3;
    for (let a = 0; a < Math.PI * 2; a += 0.012) { const x = Math.round(cx + Math.cos(a) * R * 1.3), y = Math.round(cy + Math.sin(a) * R); if (B.ok(x, y) && !K.occ[y * W + x] && Math.abs(Math.sin(a * 4)) > 0.12) B.obj(x, y, wall()); }
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 5) house(Math.round(cx + Math.cos(a) * R * 0.85) - 5, Math.round(cy + Math.sin(a) * R * 0.65) - 4, ri(9, 12), ri(7, 9));
  } else if (sp.layout === 'strip') {
    for (let x = 10; x < W - 16; x += ri(13, 17)) { house(x, cy - 4 - ri(8, 10), ri(9, 12), ri(7, 9)); house(x + ri(0, 4), cy + 4, ri(9, 12), ri(7, 9)); }
  } else if (sp.layout === 'hamlets') {
    for (let k = 0; k < Math.round(W * H / 1800); k++) { const hx = ri(14, W - 26), hy = ri(8, H - 20); for (let n = 0; n < 3; n++) house(hx + ri(-6, 10), hy + ri(-5, 8), ri(8, 11), ri(7, 9)); }
  } else if (sp.layout === 'grid') {
    for (let y = 8; y < H - 14; y += 16) for (let x = 14; x < W - 20; x += 18) if (rng() < 0.75) house(x, y, ri(10, 14), ri(8, 10), { windows: bi.id !== 'military' });
  } else { // citadel: a tall keep inside a square wall, with outer buildings
    const s2 = 16; for (let i = cx - s2; i <= cx + s2; i++) for (const j of [cy - s2 + 4, cy + s2 - 4]) if (B.ok(i, j) && !K.occ[j * W + i] && Math.abs(i - cx) > 2) B.obj(i, j, O.FIELDSTONE);
    for (let j = cy - s2 + 4; j <= cy + s2 - 4; j++) for (const i of [cx - s2, cx + s2]) if (B.ok(i, j) && !K.occ[j * W + i] && Math.abs(j - cy) > 2) B.obj(i, j, O.FIELDSTONE);
    house(cx - 7, cy - 6, 14, 12, { stories: 4, split: true });
    for (let k = 0; k < 10; k++) house(ri(8, W - 20), ri(6, H - 16), ri(9, 12), ri(7, 9));
  }
  // fill out the settlement so there is always enough cover and interiors to fight through
  for (let tries = 0; m.buildings.length < W * H / 850 && tries < 400; tries++) { const x = ri(8, W - 20), y = ri(6, H - 16); if (sp.layout === 'ring' && Math.hypot((x - cx) / 1.3, y - cy) > Math.min(W, H) * 0.32) continue; house(x, y, ri(8, 12), ri(7, 9)); }
  // landmark
  if (sp.mark === 'tower') { const x = ri(W * 0.25, W * 0.75) | 0, y = ri(8, H - 16); K.house(x, y, 6, 6, O.CONCRETE, F.CONCRETE, { doors: ['s'], stories: 4 }); }
  else if (sp.mark === 'monument') { const x = cx + ri(-20, 20), y = cy + ri(-12, 12); if (K.free(x - 4, y - 4, 9, 9, 0)) { B.rectF(x - 4, y - 4, 9, 9, F.COBBLE); B.rectO(x - 1, y - 1, 3, 3, O.STONE); for (const [dx, dy] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) B.obj(x + dx, y + dy, O.ROCK); K.mark(x - 4, y - 4, 9, 9, 4); } }
  else if (sp.mark === 'crashsite') { const x = ri(16, W - 24), y = ri(10, H - 14); if (K.free(x, y, 12, 5, 1)) { B.rectO(x, y + 1, 9, 2, O.CONTAINER, 120); B.rectO(x + 3, y - 1, 2, 6, O.CONTAINER, 120); for (let k = 0; k < 8; k++) B.obj(x + ri(-3, 13), y + ri(-3, 6), O.BARREL); K.mark(x, y, 12, 5, 4); } }
  else if (sp.mark === 'craters') { for (let k = 0; k < 14; k++) { const x = ri(10, W - 10), y = ri(8, H - 8); if (!K.occ[y * W + x]) { B.blob(x, y, 2.4, F.MUD, 1.5); for (let a = 0; a < 6; a++) { const px = Math.round(x + Math.cos(a) * 3.2), py = Math.round(y + Math.sin(a) * 3.2); if (B.ok(px, py) && !B.get(px, py) && !K.occ[py * W + px]) B.obj(px, py, rng() < 0.5 ? O.SANDBAG : O.STONE); } } } }
  else { for (let k = 0; k < 4; k++) K.sandbagNest(cx - 12 + k * 7, cy - 2 + (k % 2) * 5); }
  // plants, trees and cover
  for (let k = 0; k < W * H / 1600; k++) K.forest(k + 70, bi.trees, ri(4, W - 4), ri(4, H - 4), ri(4, 9), bi.id === 'savanna' || bi.id === 'oasis' ? 0.12 : 0.3);
  bi.plants.forEach((p, i) => K.sprinkle(p, Math.round(W * H / (p === O.WHEAT || p === O.BUSH ? 110 : 320))));
  if (bi.id === 'orchard') for (let y = 6; y < H - 6; y += 4) for (let x = 6; x < W - 6; x += 4) if (!K.occ[y * W + x] && !B.get(x, y) && valueNoise(x / 20, y / 20, 5) > 0.55) B.obj(x, y, O.TREE);
  if (bi.id === 'military') for (let k = 0; k < 6; k++) K.sandbagNest(ri(10, W - 14), ri(6, H - 8));
  m.terrainProf = { custom: 'novel', land: sp.land.id, amp: 30 + rng() * 60, wave: 18 + rng() * 18 };
};
// a generated map: m.genOpts = { theme, spawn }
function genRandom(m, B, rng) {
  const o = Object.assign({ theme: 'town', spawn: m.w * m.h > 20000 ? 18 : 6 }, m.genOpts || {});
  const K = genKit(m, B, rng);
  (GENT[o.theme] || GENT.town)(m, B, rng, K, o);
  if (o.theme !== 'novel' && o.theme !== 'described') m.terrainProf = (MAPGEN_THEMES[o.theme] || MAPGEN_THEMES.town).terrain;
  K.finish(o.spawn);
  if (m.canyon) { // spawn along the valley floor at both ends
    m.spawns = [[], []]; const n = o.spawn, cols = n > 6 ? 3 : 2;
    for (let i = 0; i < n; i++) { const c = i % cols, r = Math.floor(i / cols) - (Math.ceil(n / cols) - 1) / 2;
      const xl = 2 + c, xr = m.w - 3 - c; m.spawns[0].push({ x: xl * T + T / 2, y: (m.canyon.vy(xl) + r * 2) * T }); m.spawns[1].push({ x: xr * T + T / 2, y: (m.canyon.vy(xr) + r * 2) * T }); }
  }
  // water in the spawn rows? clear it to ground
  [...m.spawns[0], ...m.spawns[1]].forEach(s => { const tx = Math.floor(s.x / T), ty = Math.floor(s.y / T); for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) if (B.ok(x, y) && m.floor[y * m.w + x] === F.WATER) B.floor(x, y, F.GRASS); });
}
GEN.gen = genRandom;
// massive battle maps: one large themed map each (not stitched copies of smaller maps)
GEN.oldtown_xl = (m, B, rng) => { m.genOpts = { theme: 'town', spawn: 18 }; genRandom(m, B, rng); };
GEN.farm_xl = (m, B, rng) => { m.genOpts = { theme: 'village', spawn: 18 }; genRandom(m, B, rng); };
GEN.desert_xl = (m, B, rng) => { m.genOpts = { theme: 'desert', spawn: 18 }; genRandom(m, B, rng); };
// new hand-picked maps built on the themed generators
GEN.harbor = (m, B, rng) => { m.genOpts = { theme: 'coast', spawn: 6 }; genRandom(m, B, rng); };
GEN.canyon = (m, B, rng) => { m.genOpts = { theme: 'canyon', spawn: 6 }; genRandom(m, B, rng); };
GEN.suburbs = (m, B, rng) => { m.genOpts = { theme: 'suburb', spawn: 6 }; genRandom(m, B, rng); };
// ---- hand-made maps -----------------------------------------------------------------------------------------
// St. Aldric's Monastery: a fortified monastery on a mountain top, terraced gardens and a road winding up
GEN.monastery = (m, B, rng) => {
  const K = genKit(m, B, rng), { W, H, ri } = K, cx = W >> 1, cy = H >> 1;
  B.fill(F.GRASS); for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (valueNoise(i / 8, j / 8, 31) < 0.3) B.floor(i, j, F.FOREST);
  K.reserveSpawns(6);
  // the summit (heights come from the 'peak' terrain profile): cloister of fieldstone buildings round a square
  B.rectF(cx - 22, cy - 16, 44, 32, F.COBBLE);
  B.rectF(cx - 7, cy - 6, 14, 12, F.GRASS); B.blob(cx, cy, 1.6, F.WATER, 0.3); for (const [dx, dy] of [[-5, -4], [5, -4], [-5, 4], [5, 4]]) B.obj(cx + dx, cy + dy, O.TREE); // cloister garth
  K.house(cx - 21, cy - 15, 42, 8, O.FIELDSTONE, F.WOOD, { doors: ['s', 'n'], split: true, furnish: true, stories: 2 }); // dormitory
  K.house(cx - 21, cy + 8, 26, 7, O.FIELDSTONE, F.TILE, { doors: ['n', 'w'], furnish: true, stories: 2 }); // refectory and kitchens
  K.house(cx + 7, cy + 7, 14, 9, O.FIELDSTONE, F.MARBLE, { doors: ['n', 'w'] }); // chapel
  K.house(cx + 13, cy - 5, 8, 8, O.FIELDSTONE, F.COBBLE, { doors: ['w', 's'], stories: 4 }); // bell tower
  K.house(cx - 21, cy - 5, 8, 10, O.FIELDSTONE, F.WOOD, { doors: ['e'], furnish: 'storage' }); // granary
  // outer wall with two gates, terraced gardens of hedges below it
  for (let i = cx - 27; i <= cx + 27; i++) for (const j of [cy - 20, cy + 20]) if (Math.abs(i - cx) > 2) B.obj(i, j, O.FIELDSTONE);
  for (let j = cy - 20; j <= cy + 20; j++) for (const i of [cx - 27, cx + 27]) if (Math.abs(j - cy) > 2) B.obj(i, j, O.FIELDSTONE);
  for (let r = 0; r < 3; r++) for (let i = cx - 34 - r * 4; i <= cx + 34 + r * 4; i++) for (const j of [cy - 24 - r * 3, cy + 24 + r * 3]) if (B.ok(i, j) && !B.get(i, j) && hash2(i, j, 3) < 0.75 && Math.abs(i - cx) > 3) B.obj(i, j, O.HEDGE);
  // a road winding up from both sides, with shrines and hermit huts on the way
  K.road([[0, cy], [cx - 50, cy + 14], [cx - 38, cy - 10], [cx - 27, cy]], 3, F.DIRT);
  K.road([[W, cy], [cx + 50, cy - 14], [cx + 38, cy + 10], [cx + 27, cy]], 3, F.DIRT);
  for (const [x, y] of [[cx - 46, cy - 24], [cx + 40, cy + 22], [cx - 30, cy + 34], [cx + 30, cy - 34]]) K.house(x, y, 8, 7, O.WOODWALL, F.WOOD, { doors: ['s'], furnish: true });
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, x = Math.round(cx + Math.cos(a) * 42), y = Math.round(cy + Math.sin(a) * 30); if (K.free(x - 1, y - 1, 3, 3, 0)) { B.rectO(x, y, 1, 1, O.STONE); K.mark(x - 1, y - 1, 3, 3, 4); } }
  // pine forest and rocks on the slopes
  for (let k = 0; k < 14; k++) K.forest(k + 90, O.PINE, ri(4, W - 4), ri(4, H - 4), ri(5, 9), 0.4);
  K.sprinkle(O.ROCK, 70); K.sprinkle(O.BUSH, 90); K.sprinkle(O.LOG, 14);
  K.finish(6); m.zone = { x: cx * T, y: cy * T, r: 6 * T };
};
// Hollow Creek Dam: a concrete dam holds back a reservoir; a power station and a workers' town below
GEN.dam = (m, B, rng) => {
  const K = genKit(m, B, rng), { W, H, ri } = K, cx = W >> 1, damY = Math.round(H * 0.4), half = 20;
  m.damSpec = { damY, half };
  B.fill(F.GRASS); for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (valueNoise(i / 9, j / 9, 37) < 0.3) B.floor(i, j, F.FOREST);
  // reservoir above the dam, river below it, the dam crest across the valley
  for (let j = 0; j < damY; j++) for (let i = cx - half + 2; i <= cx + half - 2; i++) { B.floor(i, j, F.WATER); K.occ[j * W + i] = 3; }
  K.river(false, cx, 2.2, 3);
  for (let j = damY; j < damY + 4; j++) for (let i = cx - half - 8; i <= cx + half + 8; i++) { B.floor(i, j, F.CONCRETE); B.obj(i, j, 0); K.occ[j * W + i] = 1; }
  for (let i = cx - half - 8; i <= cx + half + 8; i++) { if (i % 4) { B.obj(i, damY, O.CONCRETE); B.obj(i, damY + 3, O.CONCRETE); } } // parapets with gaps
  K.reserveSpawns(6);
  // roads: from each plateau down into the valley, along the crest
  K.road([[0, damY + 1.5], [W, damY + 1.5]], 2, F.ASPHALT);
  K.road([[cx - half - 10, damY + 6], [cx - half - 2, damY + 18], [cx - 6, damY + 26], [cx - 4, H]], 3, F.ASPHALT);
  K.road([[cx + half + 10, damY + 6], [cx + half + 2, damY + 18], [cx + 8, damY + 26]], 3, F.ASPHALT);
  // control buildings at the crest ends, the power station at the foot, a transformer yard and the workers' town
  K.house(cx - half - 14, damY - 9, 10, 8, O.CONCRETE, F.TILE, { doors: ['s', 'e'], furnish: true, stories: 2 });
  K.house(cx + half + 4, damY - 9, 10, 8, O.CONCRETE, F.TILE, { doors: ['s', 'w'], furnish: true });
  K.house(cx - 14, damY + 6, 28, 12, O.CONCRETE, F.METAL, { doors: ['s', 'e', 'w'], doorWidth: 3, furnish: 'warehouse', stories: 2, split: true });
  const yx = cx + 12, yy = damY + 22;
  if (K.free(yx, yy, 16, 12, 0)) { for (let i = yx; i < yx + 16; i++) for (const j of [yy, yy + 11]) if (i !== yx + 7 && i !== yx + 8) B.obj(i, j, O.CHAINLINK); for (let j = yy; j < yy + 12; j++) for (const i of [yx, yx + 15]) B.obj(i, j, O.CHAINLINK); B.rectF(yx + 1, yy + 1, 14, 10, F.GRAVEL); for (let k = 0; k < 4; k++) B.rectO(yx + 2 + k * 3, yy + 3, 2, 2, O.CONTAINER, 160); for (let k = 0; k < 5; k++) B.obj(yx + 2 + k * 3, yy + 8, O.BARREL); K.mark(yx, yy, 16, 12, 4); }
  K.lots(cx - 34, damY + 30, 26, H - damY - 34, () => ({ wall: rng() < 0.6 ? O.WHITEWOOD : O.BRICK, floor: F.WOOD, opts: { doors: ['n', 's'], furnish: true } }));
  K.lots(cx + 12, damY + 38, 26, H - damY - 42, () => ({ wall: rng() < 0.6 ? O.WHITEWOOD : O.BRICK, floor: F.WOOD, opts: { doors: ['n', 's'], furnish: true } }));
  // forest on the valley sides, boats on the reservoir shore, cars on the crest road
  for (let k = 0; k < 16; k++) K.forest(k + 120, O.PINE, ri(3, W - 3), ri(3, H - 3), ri(5, 10), 0.45);
  K.sprinkle(O.ROCK, 60); K.sprinkle(O.BUSH, 60);
  B.rectO(cx - half - 6, damY + 1, 2, 1, O.CAR, 30); B.rectO(cx + half + 3, damY + 2, 2, 1, O.CAR, 200);
  K.finish(6); m.zone = { x: cx * T, y: (damY + 2) * T, r: 6 * T };
};
// Kessel Junction: a railway station with platforms, parked freight trains, sheds and a signal box
GEN.station = (m, B, rng) => {
  const K = genKit(m, B, rng), { W, H, ri } = K, ty0 = Math.round(H * 0.42);
  B.fill(F.GRAVEL); for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (valueNoise(i / 7, j / 7, 41) < 0.35) B.floor(i, j, F.DIRT);
  // four tracks with platforms between them (rails are steel strips on ballast)
  const tracks = [ty0, ty0 + 6, ty0 + 12, ty0 + 18];
  tracks.forEach(y => { B.rectF(0, y - 1, W, 3, F.GRAVEL); B.rectF(0, y - 1, W, 1, F.METAL); B.rectF(0, y + 1, W, 1, F.METAL); K.mark(0, y - 1, W, 3, 1); });
  for (const y of [ty0 + 3, ty0 + 15]) { B.rectF(10, y - 1, W - 20, 2, F.CONCRETE); K.mark(10, y - 1, W - 20, 2, 4); for (let x = 16; x < W - 16; x += 10) B.obj(x, y, O.TABLE); } // platforms with benches
  K.reserveSpawns(6);
  // the station hall straddling the platforms' west end, the signal box, freight sheds
  const hx = Math.round(W / 2) - 13; K.house(hx, ty0 - 16, 26, 12, O.BRICK, F.TILE, { doors: ['s', 'n', 'e', 'w'], doorWidth: 3, split: true, furnish: true, stories: 2 });
  B.rectF(hx, ty0 - 4, 26, 3, F.CONCRETE);
  K.house(hx + 34, ty0 - 9, 6, 6, O.BRICK, F.WOOD, { doors: ['s'], stories: 3 }); // signal box
  K.house(10, ty0 + 24, 24, 12, O.METALWALL, F.CONCRETE, { doors: ['n', 'e'], doorWidth: 5, windows: false, furnish: 'warehouse' });
  K.house(W - 36, ty0 + 24, 24, 12, O.METALWALL, F.CONCRETE, { doors: ['n', 'w'], doorWidth: 5, windows: false, furnish: 'warehouse' });
  // freight trains standing on two tracks: wagons are containers in a line, with gaps to slip through
  for (const [y, x0, n] of [[tracks[1], 8, 7], [tracks[3], W - 70, 8]]) for (let k = 0; k < n; k++) { const x = x0 + k * 8; if (k === 3) continue; B.rectO(x, y, 6, 1, O.CONTAINER, Math.floor(rng() * 256)); }
  // the town north of the station, a car park, a goods yard south
  K.road([[0, ty0 - 22], [W, ty0 - 22]], 4, F.ASPHALT, true); K.road([[W / 2, 0], [W / 2, ty0 - 16]], 4, F.ASPHALT);
  K.lots(4, 2, W / 2 - 8, ty0 - 27, () => ({ wall: rng() < 0.5 ? O.BRICK : O.STUCCO, floor: F.WOOD, opts: { doors: ['s', 'n'], furnish: true } }));
  K.lots(W / 2 + 4, 2, W / 2 - 8, ty0 - 27, () => ({ wall: rng() < 0.5 ? O.BRICK : O.STUCCO, floor: F.WOOD, opts: { doors: ['s', 'n'], furnish: true } }));
  B.rectF(hx - 18, ty0 - 18, 14, 12, F.ASPHALT); for (let y = ty0 - 17; y < ty0 - 7; y += 3) for (let x = hx - 17; x < hx - 6; x += 3) if (rng() < 0.6) B.rectO(x, y, 2, 1, O.CAR, Math.floor(rng() * 256));
  K.sprinkle(O.CRATE, 40, (x, y) => y > ty0 + 20); K.sprinkle(O.BARREL, 20, (x, y) => y > ty0 + 20); K.sprinkle(O.BUSH, 50); K.sprinkle(O.TREE, 20, (x, y) => y < ty0 - 24);
  K.finish(6); m.zone = { x: (W / 2) * T, y: (ty0 + 9) * T, r: 6 * T };
};
// Al-Rashid Refinery: a desert oil refinery - tank farm, pipe racks, a cracking tower block and a walled compound
GEN.refinery = (m, B, rng) => {
  const K = genKit(m, B, rng), { W, H, ri } = K, cx = W >> 1, cy = H >> 1;
  B.fill(F.SAND); for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (valueNoise(i / 6, j / 6, 51) < 0.35) B.floor(i, j, F.GRAVEL);
  K.reserveSpawns(6);
  B.rectF(cx - 40, cy - 28, 80, 56, F.CONCRETE);
  for (let i = cx - 42; i <= cx + 42; i++) for (const j of [cy - 30, cy + 30]) if (Math.abs(i - cx) > 3 && i % 9) B.obj(i, j, O.CHAINLINK);
  for (let j = cy - 30; j <= cy + 30; j++) for (const i of [cx - 42, cx + 42]) if (Math.abs(j - cy) > 3 && j % 9) B.obj(i, j, O.CHAINLINK);
  K.road([[0, cy], [W, cy]], 5, F.ASPHALT, true); K.road([[cx, cy - 30], [cx, cy + 30]], 4, F.ASPHALT);
  // tank farm: round storage tanks (rings of corrugated wall you can fight around and inside) behind sandbag berms
  for (const [tx, ty] of [[cx - 30, cy - 17], [cx - 17, cy - 17], [cx + 17, cy - 17], [cx + 30, cy - 17]]) {
    for (let a = 0; a < Math.PI * 2; a += 0.12) { const x = Math.round(tx + Math.cos(a) * 4.6), y = Math.round(ty + Math.sin(a) * 4.6); if (B.ok(x, y) && Math.abs(a - Math.PI / 2) > 0.3) B.obj(x, y, O.METALWALL); }
    K.mark(tx - 6, ty - 6, 12, 12, 4);
  }
  // the cracking unit: a tall concrete block with a pipe rack, control room and warehouses
  K.house(cx - 7, cy + 6, 14, 12, O.CONCRETE, F.METAL, { doors: ['n', 's', 'e', 'w'], stories: 4, furnish: 'storage' });
  K.house(cx - 34, cy + 8, 18, 10, O.METALWALL, F.CONCRETE, { doors: ['n', 'e'], doorWidth: 4, windows: false, furnish: 'warehouse' });
  K.house(cx + 16, cy + 8, 16, 10, O.CONCRETE, F.TILE, { doors: ['n', 'w'], furnish: true, stories: 2 });
  for (let x = cx - 26; x < cx + 26; x += 2) if (Math.abs(x - cx) > 8) { B.obj(x, cy + 3, O.FENCE); }
  K.sprinkle(O.BARREL, 60, (x, y) => Math.abs(x - cx) < 40 && Math.abs(y - cy) < 28); K.sprinkle(O.CRATE, 30, (x, y) => Math.abs(x - cx) < 40 && Math.abs(y - cy) < 28);
  for (let k = 0; k < 6; k++) K.sandbagNest(ri(cx - 36, cx + 32), ri(cy - 26, cy + 24));
  // workers' camp and dunes outside
  for (let k = 0; k < 10; k++) { const x = ri(6, W - 16), y = rng() < 0.5 ? ri(4, cy - 34) : ri(cy + 34, H - 12); if (K.free(x, y, 10, 8, 1)) K.house(x, y, 10, 8, O.MUDBRICK, F.SAND, { doors: ['n', 's'], furnish: true }); }
  K.sprinkle(O.PALM, 40); K.sprinkle(O.ROCK, 40); K.sprinkle(O.BUSH, 30);
  B.rectO(cx + 8, cy - 4, 2, 1, O.CAR, 30); B.rectO(cx - 12, cy + 1, 2, 1, O.CAR, 200);
  K.finish(6); m.zone = { x: cx * T, y: (cy - 4) * T, r: 6 * T };
};
// Whitepeak Ski Resort: a mountain lodge, chalets, ski lift towers and pine slopes in deep snow
GEN.resort = (m, B, rng) => {
  const K = genKit(m, B, rng), { W, H, ri } = K, cx = W >> 1, cy = H >> 1;
  B.fill(F.SNOW); for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (valueNoise(i / 8, j / 8, 61) < 0.25) B.floor(i, j, F.ICE);
  K.reserveSpawns(6);
  K.road(K.meander(true, cy + 10, 4, 1, 2), 3, F.GRAVEL);
  // the lodge: a big three-storey timber hotel with a restaurant and a car park
  K.house(cx - 15, cy - 6, 30, 14, O.WOODWALL, F.WOOD, { doors: ['s', 'e', 'w', 'n'], doorWidth: 3, split: true, furnish: true, stories: 3 });
  B.rectF(cx - 15, cy + 12, 30, 8, F.ASPHALT); for (let x = cx - 14; x < cx + 14; x += 4) if (rng() < 0.6) B.rectO(x, cy + 14, 2, 1, O.CAR, Math.floor(rng() * 256));
  // chalets around it
  for (let k = 0, t = 0; k < 10 && t < 200; t++) { const x = ri(8, W - 18), y = ri(6, H - 14); if (Math.abs(x - cx) < 22 && Math.abs(y - cy) < 16) continue; if (K.free(x, y, 10, 8, 2)) { K.house(x, y, 10, 8, O.WOODWALL, F.WOOD, { doors: ['s', 'n'], furnish: true, stories: rng() < 0.4 ? 2 : 1 }); k++; } }
  // ski lift: a line of steel towers up the slope, with the top and bottom stations
  for (let k = 0; k < 9; k++) { const x = Math.round(cx + 22 + k * 5), y = Math.round(cy - 4 - k * 3.4); if (B.ok(x, y) && !K.occ[y * W + x]) { B.obj(x, y, O.HEDGEHOG); } }
  K.house(cx + 18, cy - 4, 7, 6, O.CONCRETE, F.CONCRETE, { doors: ['w', 's'] });
  // pines on the slopes, rocks and snowbanks
  for (let k = 0; k < 16; k++) K.forest(k + 140, O.PINE, ri(3, W - 3), ri(3, H - 3), ri(5, 9), 0.4);
  K.sprinkle(O.ROCK, 50); K.sprinkle(O.HAY, 14); K.sprinkle(O.FENCE, 30);
  K.finish(6); m.zone = { x: cx * T, y: (cy + 16) * T, r: 6 * T };
};
// Coral Bay: a tropical island village - beach huts on stilts by a lagoon, a jungle interior and an old fort
GEN.coral = (m, B, rng) => {
  const K = genKit(m, B, rng), { W, H, ri } = K, cx = W >> 1, cy = H >> 1;
  B.fill(F.FOREST); for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (valueNoise(i / 7, j / 7, 71) < 0.35) B.floor(i, j, F.GRASS);
  // sea along the bottom and a lagoon, white beaches
  for (let i = 0; i < W; i++) { const s = H - 14 + Math.round(Math.sin(i / 9) * 2); for (let j = s; j < H; j++) { B.floor(i, j, F.WATER); K.occ[j * W + i] = 3; } for (let j = s - 4; j < s; j++) B.floor(i, j, F.SAND); }
  B.blob(cx + 24, cy + 6, 7, F.WATER, 2); for (let j = cy - 3; j < cy + 16; j++) for (let i = cx + 14; i < cx + 34; i++) if (m.floor[j * W + i] === F.WATER) K.occ[j * W + i] = 3;
  K.reserveSpawns(6);
  K.road(K.meander(true, cy - 4, 6, 1.4, 1), 3, F.DIRT);
  // village of huts along the beach, a pier into the sea
  for (let x = 8; x < W - 14; x += ri(12, 16)) { const y = H - 26 + ri(-2, 2); if (K.free(x, y, 8, 7, 1)) K.house(x, y, 8, 7, O.WOODWALL, F.WOOD, { doors: ['s', 'n'], furnish: true }); }
  B.rectF(cx - 2, H - 16, 4, 15, F.BRIDGE); K.mark(cx - 2, H - 16, 4, 15, 1);
  // the old colonial fort on the hill: fieldstone walls round a courtyard, a two-storey barracks
  const fx = cx - 32, fy = cy - 26;
  for (let i = fx; i <= fx + 26; i++) for (const j of [fy, fy + 20]) if (Math.abs(i - fx - 13) > 2) B.obj(i, j, O.FIELDSTONE);
  for (let j = fy; j <= fy + 20; j++) for (const i of [fx, fx + 26]) if (Math.abs(j - fy - 10) > 2) B.obj(i, j, O.FIELDSTONE);
  K.mark(fx, fy, 27, 21, 4); B.rectF(fx + 1, fy + 1, 25, 19, F.COBBLE);
  for (let j = fy + 2; j < fy + 13; j++) for (let i = fx + 2; i < fx + 25; i++) K.occ[j * W + i] = 0; K.house(fx + 3, fy + 3, 20, 8, O.FIELDSTONE, F.WOOD, { doors: ['s'], stories: 2, furnish: true });
  // jungle
  for (let k = 0; k < 40; k++) K.forest(k + 160, rng() < 0.5 ? O.PALM : O.TREE, ri(4, W - 4), ri(4, H - 22), ri(6, 12), 0.6);
  K.sprinkle(O.BUSH, 140, (x, y) => y < H - 18); K.sprinkle(O.PALM, 30, (x, y) => m.floor[y * W + x] === F.SAND); K.sprinkle(O.LOG, 16); K.sprinkle(O.ROCK, 20);
  K.finish(6); m.zone = { x: (fx + 13) * T, y: (fy + 14) * T, r: 6 * T };
};
// a short, readable name for a generated map
function genMapName(theme, seed) {
  if (theme === 'novel') return novelSpec(seed).name;
  const A = { town: ['Old', 'North', 'Grand', 'Iron', 'King\'s', 'East'], village: ['Mill', 'Oak', 'Hollow', 'Barley', 'Willow', 'Ashby'], forest: ['Black', 'Deep', 'Elk', 'Fern', 'Wolf', 'Misty'], desert: ['Sun', 'Red', 'Dune', 'Salt', 'Amber', 'Dry'],
    snow: ['Frost', 'White', 'Glacier', 'Polar', 'Ice', 'Storm'], industrial: ['Rust', 'Steel', 'Coal', 'Dock', 'Smoke', 'Rail'], coast: ['Gull', 'Tide', 'Anchor', 'Shell', 'Harbour', 'Cliff'], suburb: ['Maple', 'Elm', 'Birch', 'Cedar', 'Pine', 'Rose'], canyon: ['Copper', 'Dust', 'Eagle', 'Mesa', 'Bone', 'Rattler'] };
  const Bn = { town: ['Town', 'Square', 'Quarter', 'Heights', 'Market', 'Borough'], village: ['Farm', 'Fields', 'Valley', 'Green', 'Crossing', 'Meadows'], forest: ['Woods', 'Pines', 'Ridge', 'Hollow', 'Glade', 'Timber'], desert: ['Village', 'Oasis', 'Wells', 'Flats', 'Bazaar', 'Basin'],
    snow: ['Outpost', 'Station', 'Pass', 'Base', 'Fields', 'Peak'], industrial: ['Yard', 'Works', 'Depot', 'Terminal', 'Foundry', 'Sidings'], coast: ['Harbour', 'Bay', 'Point', 'Cove', 'Quay', 'Haven'], suburb: ['Street', 'Drive', 'Lane', 'Park', 'Court', 'Grove'], canyon: ['Canyon', 'Gulch', 'Gorge', 'Mesa', 'Bluffs', 'Pass'] };
  const a = A[theme] || A.town, b = Bn[theme] || Bn.town;
  return `${a[seed % a.length]} ${b[Math.floor(seed / 7) % b.length]}`;
}
