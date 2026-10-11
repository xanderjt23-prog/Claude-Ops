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

// a generated map: m.genOpts = { theme, spawn }
function genRandom(m, B, rng) {
  const o = Object.assign({ theme: 'town', spawn: m.w * m.h > 20000 ? 18 : 6 }, m.genOpts || {});
  const K = genKit(m, B, rng);
  (GENT[o.theme] || GENT.town)(m, B, rng, K, o);
  m.terrainProf = (MAPGEN_THEMES[o.theme] || MAPGEN_THEMES.town).terrain;
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
// a short, readable name for a generated map
function genMapName(theme, seed) {
  const A = { town: ['Old', 'North', 'Grand', 'Iron', 'King\'s', 'East'], village: ['Mill', 'Oak', 'Hollow', 'Barley', 'Willow', 'Ashby'], forest: ['Black', 'Deep', 'Elk', 'Fern', 'Wolf', 'Misty'], desert: ['Sun', 'Red', 'Dune', 'Salt', 'Amber', 'Dry'],
    snow: ['Frost', 'White', 'Glacier', 'Polar', 'Ice', 'Storm'], industrial: ['Rust', 'Steel', 'Coal', 'Dock', 'Smoke', 'Rail'], coast: ['Gull', 'Tide', 'Anchor', 'Shell', 'Harbour', 'Cliff'], suburb: ['Maple', 'Elm', 'Birch', 'Cedar', 'Pine', 'Rose'], canyon: ['Copper', 'Dust', 'Eagle', 'Mesa', 'Bone', 'Rattler'] };
  const Bn = { town: ['Town', 'Square', 'Quarter', 'Heights', 'Market', 'Borough'], village: ['Farm', 'Fields', 'Valley', 'Green', 'Crossing', 'Meadows'], forest: ['Woods', 'Pines', 'Ridge', 'Hollow', 'Glade', 'Timber'], desert: ['Village', 'Oasis', 'Wells', 'Flats', 'Bazaar', 'Basin'],
    snow: ['Outpost', 'Station', 'Pass', 'Base', 'Fields', 'Peak'], industrial: ['Yard', 'Works', 'Depot', 'Terminal', 'Foundry', 'Sidings'], coast: ['Harbour', 'Bay', 'Point', 'Cove', 'Quay', 'Haven'], suburb: ['Street', 'Drive', 'Lane', 'Park', 'Court', 'Grove'], canyon: ['Canyon', 'Gulch', 'Gorge', 'Mesa', 'Bluffs', 'Pass'] };
  const a = A[theme] || A.town, b = Bn[theme] || Bn.town;
  return `${a[seed % a.length]} ${b[Math.floor(seed / 7) % b.length]}`;
}
