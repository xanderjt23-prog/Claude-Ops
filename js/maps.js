// ============================================================================
// Maps: materials, deterministic generators, tile textures and map renderer.
// ============================================================================
const T = 32; // tile size in px

// Seeded RNG (identical on every client for the same seed)
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(x, y, s) { let h = (x * 374761393 + y * 668265263 + (s || 0) * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

// ---- floors ---------------------------------------------------------------
const F = { GRASS:0, DIRT:1, ASPHALT:2, CONCRETE:3, SAND:4, WOOD:5, TILE:6, WATER:7, FIELD:8, COBBLE:9, METAL:10, FOREST:11, BRIDGE:12, GRAVEL:13, LINE:14, CARPET:15, SNOW:16, ICE:17, MUD:18, MARBLE:19 };
const FLOOR_INFO = {
  0:{ name:'grass', base:'#5d7a3a', mm:'#5d7a3a' }, 1:{ name:'dirt', base:'#7a6145', mm:'#7a6145' },
  2:{ name:'asphalt', base:'#3c3e40', mm:'#3c3e40' }, 3:{ name:'concrete', base:'#8f8d88', mm:'#8f8d88' },
  4:{ name:'sand', base:'#c9b07c', mm:'#c9b07c' }, 5:{ name:'wood', base:'#8a6238', mm:'#8a6238' },
  6:{ name:'tile', base:'#b8b2a6', mm:'#b8b2a6' }, 7:{ name:'water', base:'#2f5f78', mm:'#2f5f78', water:true },
  8:{ name:'field', base:'#6e5a36', mm:'#8f7a3a' }, 9:{ name:'cobble', base:'#77736b', mm:'#77736b' },
  10:{ name:'metal', base:'#5d6266', mm:'#5d6266' }, 11:{ name:'forest', base:'#4a5a30', mm:'#4a5a30' },
  12:{ name:'bridge', base:'#7a5530', mm:'#7a5530' }, 13:{ name:'gravel', base:'#8a8378', mm:'#8a8378' },
  14:{ name:'roadline', base:'#3c3e40', mm:'#3c3e40' }, 15:{ name:'carpet', base:'#6b2e2e', mm:'#6b2e2e' },
  16:{ name:'snow', base:'#dfe5ea', mm:'#dfe5ea' }, 17:{ name:'ice', base:'#a9c8d8', mm:'#a9c8d8' },
  18:{ name:'mud', base:'#5a4632', mm:'#5a4632' }, 19:{ name:'marble', base:'#d9d6cf', mm:'#d9d6cf' },
};

// ---- objects / materials --------------------------------------------------
// hard = penetration hardness (bullet pen >= hard passes through). 99 = indestructible
// solid = blocks movement. see = does not block line-of-sight. cover = concealment
const O = { NONE:0, BUSH:1, WHEAT:2, TREE:3, ROCK:4, FENCE:5, CRATE:6, HAY:7, WOODWALL:8, PLYWOOD:9, BRICK:10,
  CONCRETE:11, SANDBAG:12, WINDOW:13, CONTAINER:14, CAR:15, MUDBRICK:16, PALM:17, BARREL:19, CHAINLINK:20,
  LOG:21, TABLE:22, BARNWALL:23, WHITEWOOD:24, STONE:25, BROKENWIN:26, PINE:27, METALWALL:28, RUIN:29, HAYPILE:30, HEDGE:31, WIRE:32, HEDGEHOG:33, STUCCO:34, FIELDSTONE:35 };
const MAT = {
  1:{ name:'Bush', solid:false, hard:0, hp:25, see:true, cover:true, conceal:140, fire:true, top:true },
  2:{ name:'Wheat', solid:false, hard:0, hp:10, see:true, cover:true, conceal:120, fire:true, top:true, slow:0.85 },
  3:{ name:'Tree', solid:true, hard:3, hp:420, see:false, fire:true, canopy:true, round:12, conceal:170 },
  4:{ name:'Rock', solid:true, hard:99, hp:1e9, see:false, round:15 },
  5:{ name:'Wood Fence', solid:true, hard:1, hp:70, see:true, fire:true, low:true },
  6:{ name:'Crate', solid:true, hard:1, hp:130, see:false, fire:true },
  7:{ name:'Hay Bale', solid:true, hard:1, hp:110, see:false, fire:true, conceal:150 },
  8:{ name:'Wood Wall', solid:true, hard:2, hp:240, see:false, fire:true, wall:true },
  9:{ name:'Plywood Wall', solid:true, hard:1.2, hp:130, see:false, fire:true, wall:true },
  10:{ name:'Brick Wall', solid:true, hard:4, hp:700, see:false, wall:true },
  11:{ name:'Concrete Wall', solid:true, hard:5, hp:1200, see:false, wall:true },
  12:{ name:'Sandbags', solid:true, hard:3.5, hp:480, see:true, low:true },
  13:{ name:'Window', solid:true, hard:0, hp:8, see:true, wall:true, glass:true },
  14:{ name:'Shipping Container', solid:true, hard:3.5, hp:950, see:false },
  15:{ name:'Car', solid:true, hard:2.8, hp:520, see:false, explode:{ dmg:120, r:130 } },
  16:{ name:'Mud Brick Wall', solid:true, hard:3, hp:420, see:false, wall:true },
  17:{ name:'Palm', solid:true, hard:2.5, hp:260, see:false, fire:true, canopy:true, round:9, conceal:180 },
  19:{ name:'Explosive Barrel', solid:true, hard:1, hp:45, see:true, round:12, explode:{ dmg:110, r:110 } },
  20:{ name:'Chain-link Fence', solid:true, hard:0, hp:200, see:true, low:true, mesh:true },
  21:{ name:'Fallen Log', solid:true, hard:2.5, hp:320, see:true, fire:true, low:true },
  22:{ name:'Table', solid:true, hard:1, hp:60, see:true, fire:true, low:true },
  23:{ name:'Barn Wall', solid:true, hard:2, hp:240, see:false, fire:true, wall:true },
  24:{ name:'Clapboard Wall', solid:true, hard:2, hp:220, see:false, fire:true, wall:true },
  25:{ name:'Stone', solid:true, hard:99, hp:1e9, see:true, low:true, round:14 },
  26:{ name:'Broken Window', solid:false, hard:0, hp:1e9, see:true, frame:true },
  27:{ name:'Pine', solid:true, hard:3, hp:420, see:false, fire:true, canopy:true, round:11, conceal:170 },
  28:{ name:'Corrugated Metal Wall', solid:true, hard:2.2, hp:380, see:false, wall:true },
  29:{ name:'Ancient Stone Wall', solid:true, hard:4.5, hp:900, see:false, wall:true },
  30:{ name:'Loose Hay', solid:false, hard:0, hp:20, see:true, cover:true, conceal:110, fire:true, top:true, slow:0.8 },
  31:{ name:'Hedge', solid:true, hard:1, hp:140, see:false, fire:true, conceal:150 },
  32:{ name:'Barbed Wire', solid:true, hard:0, hp:160, see:true, low:true, mesh:true },
  33:{ name:'Czech Hedgehog', solid:true, hard:99, hp:1e9, see:true, round:13 },
  34:{ name:'Stucco Wall', solid:true, hard:3.5, hp:650, see:false, wall:true },
  35:{ name:'Fieldstone Wall', solid:true, hard:4.5, hp:900, see:false, wall:true },
};
// concealing blocks hide units touching them (hay bales, tree trunks) or standing in them (bushes, wheat, loose hay)
const CONCEAL_TOUCH = 20;

// ---- map generation ---------------------------------------------------------
const MAP_SIZES = { killhouse:[44,34], oldtown:[92,70], farm:[112,84], forest:[104,88], desert:[86,80], rustyard:[92,66], snowbase:[90,72], airfield:[120,80], ruins:[96,76],
  mansion:[140,110], omaha:[120,84], highland:[120,90], harbor:[148,112], canyon:[148,112], suburbs:[116,88],
  oldtown_xl:[184,140], farm_xl:[224,168], desert_xl:[172,160] };
// custom = { gen: true, theme, size } for a generated map (the seed picks the layout)
function makeMap(id, seed, custom) {
  const sizes = MAP_SIZES, gen = custom && custom.gen;
  const [w, h] = gen ? MAPGEN_SIZES[custom.size || 'medium'].wh : custom ? [custom.w, custom.h] : sizes[id];
  const m = { id, seed, w, h, floor:new Uint8Array(w*h), obj:new Uint8Array(w*h), hp:new Float32Array(w*h),
              tint:new Uint8Array(w*h), spawns:[[],[]], ffa:[], zone:null, buildings:[] };
  const rng = mulberry32(seed);
  const B = builder(m, rng);
  if (gen) { m.genOpts = { theme: custom.theme, spawn: w * h > 20000 ? 18 : 6 }; GEN.gen(m, B, rng); }
  else if (custom) buildCustom(m, B, rng, custom); else GEN[id](m, B, rng);
  // clear around spawns
  [...m.spawns[0], ...m.spawns[1], ...m.ffa].forEach(s => B.clear(Math.floor(s.x/T)-1, Math.floor(s.y/T)-1, 3, 3));
  computeVertical(m);
  genTerrain(m);
  for (let i = 0; i < w*h; i++) if (m.obj[i]) m.hp[i] = MAT[m.obj[i]].hp;
  return m;
}

// ---- vertical structure (3D): storeys, floors, stairs, ladders, roofs ------------
// Heights in px (32 = one tile = ~1 m). A storey is 96 high.
const SH = 96, WALL_LOW = 84, STEP = 14;
// height of solid non-wall objects (what you can jump onto / shoot over)
const OBJ_HT = { [O.HEDGE]: 70, [O.WIRE]: 30, [O.HEDGEHOG]: 40, [O.CRATE]: 30, [O.HAY]: 28, [O.SANDBAG]: 32, [O.TABLE]: 24, [O.FENCE]: 26, [O.CHAINLINK]: 60, [O.LOG]: 18, [O.BARREL]: 36,
  [O.ROCK]: 30, [O.STONE]: 12, [O.CAR]: 37, [O.CONTAINER]: 80, [O.TREE]: 400, [O.PINE]: 400, [O.PALM]: 400 };
const isWallObj = o => o && MAT[o].wall && o !== O.WINDOW && o !== O.BROKENWIN;

// how a building looks in 3D, decided from its wall material and size (deterministic)
function buildingStyle(m, b) {
  const r = hash2(b.x, b.y, 17), big = b.w >= 8 && b.h >= 7, o = b.opts || {};
  switch (b.wall) {
    case O.PLYWOOD: return { roof: 'none', stories: 1 };
    case O.MUDBRICK: return { roof: 'flat', stories: 1, ladder: r < 0.8 };
    case O.BRICK: case O.CONCRETE:
      if ((o.doorWidth || 0) >= 4 && b.w >= 18) return { roof: 'flat', stories: 1, tall: 150 };
      if (big && (r < 0.6 || b.w * b.h >= 150)) return { roof: 'flat', stories: 2, ladder: r < 0.35 };
      return { roof: 'flat', stories: 1, ladder: r < 0.6 };
    case O.WHITEWOOD: return { roof: 'peaked', stories: b.w >= 12 && b.h >= 10 ? 2 : 1 };
    case O.WOODWALL: return { roof: 'peaked', stories: 1 };
    case O.BARNWALL: return { roof: 'peaked', stories: 1, tall: 140, loft: true };
    case O.METALWALL: return { roof: 'arched', stories: 1, tall: 150 };
    case O.STUCCO: return { roof: 'peaked', stories: 2 };
    case O.FIELDSTONE: return b.w * b.h >= 140 ? { roof: 'peaked', stories: 2 } : big ? { roof: 'peaked', stories: r < 0.5 ? 2 : 1 } : { roof: 'flat', stories: 1, ladder: r < 0.5 };
    default: return { roof: 'flat', stories: 1 };
  }
}

function computeVertical(m) {
  const n = m.w * m.h;
  // slabs: bitmask of upper floors in a tile (bit k = a floor at k storeys up); stairAt: the ramps in a tile
  Object.assign(m, { wallTop: new Uint16Array(n), slabs: new Uint8Array(n), roof: new Uint16Array(n), roofKind: new Uint8Array(n), lintel: new Uint16Array(n),
    upWin: new Uint8Array(n), bld: new Int16Array(n).fill(-1), stair: new Int16Array(n).fill(-1), ladder: new Int16Array(n).fill(-1), stairs: [], ladders: [], stairAt: new Map() });
  const at = (x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h ? y * m.w + x : -1;
  (m.buildings || []).forEach((b, bi) => {
    // skip buildings that later generation mostly erased
    let per = 0, wallsLeft = 0;
    for (let x = b.x; x < b.x + b.w; x++) for (const y of [b.y, b.y + b.h - 1]) { per++; const i = at(x, y); if (i >= 0 && (isWallObj(m.obj[i]) || m.obj[i] === O.WINDOW)) wallsLeft++; }
    for (let y = b.y + 1; y < b.y + b.h - 1; y++) for (const x of [b.x, b.x + b.w - 1]) { per++; const i = at(x, y); if (i >= 0 && (isWallObj(m.obj[i]) || m.obj[i] === O.WINDOW)) wallsLeft++; }
    if (wallsLeft < per * 0.55) return;
    const st = buildingStyle(m, b); b.style = st;
    if (st.roof === 'none') return;
    let stories = Math.min(4, (b.opts && b.opts.stories) || st.stories);
    const interior = (x, y) => x > b.x && y > b.y && x < b.x + b.w - 1 && y < b.y + b.h - 1;
    const free = (x, y) => interior(x, y) && !isWallObj(m.obj[at(x, y)]) && m.obj[at(x, y)] !== O.WINDOW && m.stair[at(x, y)] < 0 && !m.stairAt.has(at(x, y));
    // stairwells: a 4-tile ramp along an inside wall; taller buildings get a second lane beside it for a switchback
    // (ramp 0 goes up the wall lane, ramp 1 comes back along the inner lane, ramp 2 up the wall lane again...)
    const wells = [];
    const findWell = () => {
      const cands = [];
      for (const [row, dy] of [[b.y + 1, -1], [b.y + b.h - 2, 1]]) for (const d of [1, -1]) for (let sx = b.x + 1; sx < b.x + b.w - 1; sx++) cands.push({ sx, sy: row, dx: d, dy: 0, side: [0, dy] });
      for (const [col, dx] of [[b.x + 1, -1], [b.x + b.w - 2, 1]]) for (const d of [1, -1]) for (let sy = b.y + 1; sy < b.y + b.h - 1; sy++) cands.push({ sx: col, sy, dx: 0, dy: d, side: [dx, 0] });
      cands.sort((a, c) => hash2(a.sx, a.sy, 3 + a.dx + wells.length * 7) - hash2(c.sx, c.sy, 3 + c.dx + wells.length * 7));
      for (const c of cands) {
        const lane = (o) => { const pts = []; for (let k = -1; k <= 4; k++) pts.push([c.sx + c.dx * k - c.side[0] * o, c.sy + c.dy * k - c.side[1] * o]); return pts; };
        const l1 = lane(0), l2 = lane(1), l3 = lane(2);
        if (!l1.every(([x, y]) => free(x, y))) continue;
        if (stories > 2 && !l2.every(([x, y]) => free(x, y))) continue;
        // the outer wall beside the ramp must be wall (not a doorway), and the room side of the approach/landing open
        if (!l1.slice(1, 5).every(([x, y]) => { const o = m.obj[at(x + c.side[0], y + c.side[1])]; return isWallObj(o) || o === O.WINDOW; })) continue;
        const inner = stories > 2 ? l3 : l2;
        if (!inner.every(([x, y]) => { const i = at(x, y); return i >= 0 && !isWallObj(m.obj[i]); }) && stories > 2) continue;
        if (stories <= 2 && isWallObj(m.obj[at(l2[0][0], l2[0][1])]) && isWallObj(m.obj[at(l2[5][0], l2[5][1])])) continue;
        // keep wells apart
        if (wells.some(w => Math.abs(w.sx - c.sx) + Math.abs(w.sy - c.sy) < 8)) continue;
        (stories > 2 ? [...l1, ...l2] : l1).forEach(([x, y]) => { m.obj[at(x, y)] = 0; });
        return c;
      }
      return null;
    };
    if (stories >= 2) {
      const want = (b.opts && b.opts.wells) || 1;
      for (let k = 0; k < want; k++) { const c = findWell(); if (c) wells.push(c); else break; }
      if (!wells.length) stories = stories > 2 ? 2 : 1;
      if (!wells.length && stories === 2) { const c = findWell(); if (c) wells.push(c); else stories = 1; }
    }
    b.stories = stories;
    const roofH = st.tall || stories * SH, flat = st.roof === 'flat';
    const wallTop = flat ? roofH + 10 : roofH;
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
      const i = at(x, y); if (i < 0) continue;
      m.bld[i] = bi; m.roof[i] = roofH; m.roofKind[i] = st.roof === 'flat' ? 1 : st.roof === 'peaked' ? 2 : 3;
      const edge = !interior(x, y), o = m.obj[i];
      if (edge) {
        if (isWallObj(o) || o === O.WINDOW || o === O.BROKENWIN) { m.wallTop[i] = wallTop; if (o === O.WINDOW && stories >= 2) m.upWin[i] = stories; }
        else { m.lintel[i] = 76; m.wallTop[i] = wallTop; } // doorway: wall continues above it
      } else {
        if (isWallObj(o)) m.wallTop[i] = roofH; // inside partitions go up to the roof
        for (let k = 1; k < stories; k++) m.slabs[i] |= 1 << k;
      }
    }
    wells.forEach(c => {
      for (let r = 0; r < stories - 1; r++) {
        const o = r % 2, d = o ? -1 : 1; // lane and direction of this flight
        const tile = k => at(c.sx + c.dx * k - c.side[0] * o, c.sy + c.dy * k - c.side[1] * o);
        const ks = o ? [3, 2, 1, 0] : [0, 1, 2, 3], tiles = ks.map(tile), idx = m.stairs.length;
        tiles.forEach(i => { if (!m.stairAt.has(i)) m.stairAt.set(i, []); m.stairAt.get(i).push(idx); m.slabs[i] &= ~(1 << (r + 1)); if (r === 0) m.stair[i] = idx; });
        const sx = c.sx + c.dx * ks[0] - c.side[0] * o, sy = c.sy + c.dy * ks[0] - c.side[1] * o;
        m.stairs.push({ tiles, dx: c.dx * d, dy: c.dy * d, sx, sy, h0: r * SH, h1: (r + 1) * SH, level: r, bld: bi,
          approach: tile(o ? 4 : -1), landing: tile(o ? -1 : 4) });
      }
    });
    // barn hay loft with a ladder up to it
    if (st.loft) {
      const lw = Math.max(2, Math.floor((b.w - 2) * 0.4)), lx = b.x + 1 + lw, my = b.y + Math.floor(b.h / 2);
      for (let y = b.y + 1; y < b.y + b.h - 1; y++) for (let x = b.x + 1; x < lx; x++) m.slabs[at(x, y)] |= 2;
      const li = at(lx, my); m.obj[li] = 0; m.ladder[li] = m.ladders.length;
      m.ladders.push({ x: lx, y: my, dx: -1, dy: 0, top: SH, bottom: 0 });
    }
    // outside ladder to a flat roof
    if (flat && st.ladder) {
      const cands = [];
      for (let x = b.x + 1; x < b.x + b.w - 1; x++) { cands.push([x, b.y, 0, -1]); cands.push([x, b.y + b.h - 1, 0, 1]); }
      for (let y = b.y + 1; y < b.y + b.h - 1; y++) { cands.push([b.x, y, -1, 0]); cands.push([b.x + b.w - 1, y, 1, 0]); }
      cands.sort((a, c) => hash2(a[0], a[1], 9) - hash2(c[0], c[1], 9));
      for (const [wx, wy, ox, oy] of cands) {
        const wi = at(wx, wy), oi = at(wx + ox, wy + oy);
        if (oi < 0 || !isWallObj(m.obj[wi]) || m.floor[oi] === F.WATER || m.bld[oi] >= 0 || m.ladder[oi] >= 0) continue;
        if (m.obj[oi] && (isWallObj(m.obj[oi]) || m.obj[oi] === O.WINDOW)) continue;
        m.obj[oi] = 0; m.wallTop[wi] = roofH; // gap in the parapet where the ladder arrives
        m.ladder[oi] = m.ladders.length; m.ladders.push({ x: wx + ox, y: wy + oy, dx: -ox, dy: -oy, top: roofH, bottom: 0 });
        break;
      }
    }
  });
}
// height of a stair ramp at a point (0 at the bottom end, SH at the top)
function stairHeight(m, s, px, py) {
  const T2 = T, along = s.dx ? (px - (s.sx * T2 + (s.dx > 0 ? 0 : T2))) * s.dx : (py - (s.sy * T2 + (s.dy > 0 ? 0 : T2))) * s.dy;
  return Math.max(s.h0, Math.min(s.h1, s.h0 + (s.h1 - s.h0) * along / (4 * T2)));
}
// solid vertical spans [bottom, top, kind] occupying a tile (kind: 'obj','glass','slab','roof','stair','lintel')
function tileSolids(m, i, px, py, out) {
  out.length = 0;
  const o = m.obj[i];
  if (o && MAT[o].solid || o === O.BROKENWIN) {
    const top = m.wallTop ? m.wallTop[i] : 0;
    if (o === O.WINDOW || o === O.BROKENWIN) {
      const t = top || WALL_LOW;
      out.push([0, 22, 'obj']); if (o === O.WINDOW) out.push([22, 78, 'glass']);
      // open window holes on every upper storey
      let lo = 78; for (let k = 1; m.upWin && k < m.upWin[i]; k++) { out.push([lo, k * SH + 22, 'obj']); lo = k * SH + 78; }
      out.push([lo, t, 'obj']);
    } else if (MAT[o].wall) {
      const t = top || WALL_LOW;
      out.push([0, t, 'obj']);
    } else out.push([0, OBJ_HT[o] || 40, 'obj']);
  }
  if (!m.wallTop) { const b0 = m.base ? m.base[i] : 0; if (b0) for (const sp of out) { sp[0] += b0; sp[1] += b0; } return out; }
  if (m.lintel[i]) out.push([m.lintel[i], m.wallTop[i], 'lintel']);
  if (m.slabs[i]) for (let k = 1; k < 8; k++) if (m.slabs[i] & (1 << k)) out.push([k * SH - 8, k * SH, 'slab']);
  if (m.roof[i]) out.push([m.roof[i] - 8, m.roofKind[i] === 1 ? m.roof[i] : m.roof[i] + 60, 'roof']);
  const sa = px !== undefined && m.stairAt && m.stairAt.get(i);
  if (sa) for (const si of sa) { const s = m.stairs[si]; out.push([s.h0 ? s.h0 - 8 : 0, stairHeight(m, s, px, py), 'stair']); }
  const b0 = m.base ? m.base[i] : 0;
  if (b0) for (const sp of out) { sp[0] += b0; sp[1] += b0; }
  return out;
}

function builder(m, rng) {
  const ok = (x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h;
  const B = {
    ok,
    floor(x, y, f) { if (ok(x, y)) m.floor[y*m.w+x] = f; },
    obj(x, y, o, tint) { if (ok(x, y)) { m.obj[y*m.w+x] = o; if (tint !== undefined) m.tint[y*m.w+x] = tint; } },
    get(x, y) { return ok(x, y) ? m.obj[y*m.w+x] : 4; },
    getF(x, y) { return ok(x, y) ? m.floor[y*m.w+x] : 7; },
    fill(f) { m.floor.fill(f); },
    rectF(x, y, w, h, f) { for (let j = y; j < y+h; j++) for (let i = x; i < x+w; i++) B.floor(i, j, f); },
    rectO(x, y, w, h, o, tint) { for (let j = y; j < y+h; j++) for (let i = x; i < x+w; i++) B.obj(i, j, o, tint); },
    clear(x, y, w, h) { for (let j = y; j < y+h; j++) for (let i = x; i < x+w; i++) if (ok(i, j)) m.obj[j*m.w+i] = 0; },
    // building with perimeter walls, door gaps and windows
    building(x, y, w, h, wall, fl, opts = {}) {
      m.buildings.push({ x, y, w, h, wall, opts });
      B.rectF(x, y, w, h, fl); B.clear(x, y, w, h);
      for (let i = x; i < x+w; i++) { B.obj(i, y, wall); B.obj(i, y+h-1, wall); }
      for (let j = y; j < y+h; j++) { B.obj(x, j, wall); B.obj(x+w-1, j, wall); }
      const win = opts.windows !== false && wall !== O.PLYWOOD;
      if (win) {
        for (let i = x+2; i < x+w-2; i += 3) { if (rng() < 0.7) B.obj(i, y, O.WINDOW); if (rng() < 0.7) B.obj(i, y+h-1, O.WINDOW); }
        for (let j = y+2; j < y+h-2; j += 3) { if (rng() < 0.7) B.obj(x, j, O.WINDOW); if (rng() < 0.7) B.obj(x+w-1, j, O.WINDOW); }
      }
      const doors = opts.doors || ['s', 'n'];
      const dw = opts.doorWidth || 2;
      doors.forEach(d => {
        if (d === 'n' || d === 's') { const dx = x + Math.floor(w/2 - dw/2 + (rng()-0.5)*(w-6)*0.5); B.clear(Math.max(x+1, dx), d === 'n' ? y : y+h-1, dw, 1); }
        else { const dy = y + Math.floor(h/2 - dw/2 + (rng()-0.5)*(h-6)*0.5); B.clear(d === 'w' ? x : x+w-1, Math.max(y+1, dy), 1, dw); }
      });
      if (opts.split && w > 9 && h > 7) { // interior partition
        if (w >= h) { const sx = x + Math.floor(w/2); for (let j = y+1; j < y+h-1; j++) B.obj(sx, j, opts.inner || wall); B.clear(sx, y + 1 + Math.floor(rng()*(h-4)), 1, 2); }
        else { const sy = y + Math.floor(h/2); for (let i = x+1; i < x+w-1; i++) B.obj(i, sy, opts.inner || wall); B.clear(x + 1 + Math.floor(rng()*(w-4)), sy, 2, 1); }
      }
      if (opts.furnish) B.furnish(x + 1, y + 1, w - 2, h - 2, typeof opts.furnish === 'string' ? opts.furnish : wall === O.METALWALL || (opts.doorWidth || 0) >= 4 ? 'warehouse' : 'home');
    },
    // is (x, y) inside a building footprint (grown by margin tiles)?
    inBuilding(x, y, margin) { const g = margin || 0; return m.buildings.some(b => x >= b.x - g && y >= b.y - g && x < b.x + b.w + g && y < b.y + b.h + g); },
    // furniture that looks placed: tables and cabinets against walls in homes, crate rows with aisles in warehouses
    furnish(x, y, w, h, kind) {
      const free = (i, j) => B.ok(i, j) && B.get(i, j) === 0 && i >= x && j >= y && i < x + w && j < y + h;
      // never block a doorway: keep tiles next to an opening in the walls clear
      const nearOpening = (i, j) => { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + dx, b2 = j + dy; if (a < x || b2 < y || a >= x + w || b2 >= y + h) { if (B.get(a, b2) === 0) return true; } } return false; };
      const againstWall = (i, j) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isWallObj(B.get(i + dx, j + dy)));
      if (kind === 'warehouse' || kind === 'storage') {
        // rows of crate stacks along the long axis with wide aisles between them
        const along = w >= h;
        for (let r = 2; r < (along ? h : w) - 2; r += 4) for (let k = 2; k < (along ? w : h) - 2; k++) {
          if ((k % 6) >= 4) continue; // gaps to cut through
          const i = along ? x + k : x + r, j = along ? y + r : y + k;
          if (free(i, j) && !nearOpening(i, j)) B.obj(i, j, hash2(i, j, 31) < 0.12 ? O.BARREL : O.CRATE);
        }
        return;
      }
      if (kind === 'garage') { // a car and a workbench along the back wall
        const cxp = x + Math.floor(w / 2) - 1, cyp = y + Math.floor(h / 2);
        if (free(cxp, cyp) && free(cxp + 1, cyp)) B.rectO(cxp, cyp, 2, 1, O.CAR, Math.floor(rng() * 256));
        for (let i = x + 1; i < x + w - 1; i += 3) if (free(i, y) && !nearOpening(i, y)) B.obj(i, y, i % 2 ? O.TABLE : O.BARREL);
        return;
      }
      // homes and offices: a few tables against walls, spaced out, and maybe one crate in a corner
      const cells = [];
      for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (free(i, j) && againstWall(i, j) && !nearOpening(i, j)) cells.push([i, j]);
      cells.sort((a, c) => hash2(a[0], a[1], 41) - hash2(c[0], c[1], 41));
      const placed = [], want = Math.max(1, Math.round(w * h / 28));
      for (const [i, j] of cells) {
        if (placed.length >= want) break;
        if (placed.some(([a, c]) => Math.abs(a - i) + Math.abs(c - j) < 4)) continue;
        B.obj(i, j, placed.length === 0 || hash2(i, j, 43) > 0.2 ? O.TABLE : O.CRATE); placed.push([i, j]);
      }
      // a dining table in the middle of a big room
      if (w >= 8 && h >= 6 && hash2(x, y, 47) < 0.6) { const i = x + Math.floor(w / 2) - 1, j = y + Math.floor(h / 2); if (free(i, j) && free(i + 1, j)) B.rectO(i, j, 2, 1, O.TABLE); }
    },
    // random placement (never inside buildings). Crates and barrels come in small stacks against
    // walls or each other, not as lone blocks dotted around
    scatter(o, n, x0, y0, x1, y1, cond, tint) {
      const grouped = o === O.CRATE || o === O.BARREL;
      if (grouped) n = Math.max(1, Math.round(n * 0.6));
      for (let k = 0, tries = 0; k < n && tries < n*30; tries++) {
        const x = x0 + Math.floor(rng()*(x1-x0)), y = y0 + Math.floor(rng()*(y1-y0));
        if (B.get(x, y) !== 0) continue;
        if (cond && !cond(x, y)) continue;
        if (B.inBuilding(x, y, grouped ? 1 : 0)) continue;
        if (!grouped) { B.obj(x, y, o, tint !== undefined ? tint : Math.floor(rng()*256)); k++; continue; }
        // a stack of 2-4 against something solid (a wall, fence, container...) when possible
        const solidNear = [[1,0],[-1,0],[0,1],[0,-1]].some(([dx, dy]) => { const q = B.get(x+dx, y+dy); return q && MAT[q].solid && q !== o; });
        if (!solidNear && rng() < 0.7) continue;
        const size = 2 + Math.floor(rng() * 3), dirs = rng() < 0.5 ? [[1,0],[0,1]] : [[0,1],[1,0]];
        const tiles = [[x, y]];
        for (let s2 = 1; s2 < size; s2++) { const [px, py] = tiles[s2 - 1], [dx, dy] = dirs[s2 === 2 ? 1 : 0]; tiles.push([px + dx, py + dy]); }
        if (!tiles.every(([a, c]) => a >= x0 && c >= y0 && a < x1 && c < y1 && B.get(a, c) === 0 && !B.inBuilding(a, c, 1) && (!cond || cond(a, c)))) { B.obj(x, y, o, Math.floor(rng()*256)); k += 1; continue; }
        tiles.forEach(([a, c]) => B.obj(a, c, o, Math.floor(rng()*256))); k += tiles.length;
      }
    },
    spawnsLR(margin, count) {
      const midY = m.h / 2;
      for (let i = 0; i < count; i++) {
        const oy = (i - (count-1)/2) * 2.2;
        m.spawns[0].push({ x:(margin + (i % 2)) * T + T/2, y:(midY + oy) * T });
        m.spawns[1].push({ x:(m.w - margin - 1 - (i % 2)) * T + T/2, y:(midY + oy) * T });
      }
    },
    ffaRing(n, rx, ry) {
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + 0.3; m.ffa.push({ x:(m.w/2 + Math.cos(a)*rx) * T, y:(m.h/2 + Math.sin(a)*ry) * T }); }
    },
    blob(cx, cy, r, f, rough) { // irregular area of floor
      for (let j = Math.floor(cy-r-2); j <= cy+r+2; j++) for (let i = Math.floor(cx-r-2); i <= cx+r+2; i++) {
        const d = Math.hypot(i-cx, j-cy) + (hash2(i, j, 7)-0.5) * (rough || 2);
        if (d < r) B.floor(i, j, f);
      }
    },
  };
  return B;
}

// ---- terrain: smooth hills, valleys and mountain edges ------------------------------
// Heights live on tile corners (m.hc, (w+1)*(h+1)); groundAt() interpolates. Buildings, roads and
// spawns are flattened, water sits in hollows. m.base[i] is the ground height at a tile's centre,
// which every object/wall/floor in that tile stands on.
const TERRAIN = {
  oldtown: { amp: 26, wave: 30 }, farm: { amp: 72, wave: 26 }, forest: { amp: 84, wave: 24 }, desert: { amp: 54, wave: 18 },
  snowbase: { amp: 50, wave: 24, edge: 230 }, airfield: { amp: 34, wave: 30, edge: 130 }, ruins: { amp: 62, wave: 22 },
  mansion: { amp: 30, wave: 32 }, omaha: { custom: 'omaha' }, highland: { custom: 'highland' },
  oldtown_xl: { amp: 40, wave: 40 }, farm_xl: { amp: 90, wave: 34, edge: 160 }, desert_xl: { amp: 70, wave: 24, edge: 120 },
};
function valueNoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
function fbm(x, y, seed) { return valueNoise(x, y, seed) * 0.6 + valueNoise(x * 2.1, y * 2.1, seed + 7) * 0.28 + valueNoise(x * 4.3, y * 4.3, seed + 13) * 0.12; }
const smooth01 = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const PAVED = new Set([F.ASPHALT, F.LINE, F.CONCRETE, F.COBBLE, F.TILE, F.WOOD, F.METAL, F.BRIDGE, F.CARPET]);
function genTerrain(m) {
  const prof = m.terrainProf || TERRAIN[m.id], W = m.w + 1, H = m.h + 1, hc = new Float32Array(W * H), sd = (m.seed % 997) + 3;
  m.hc = hc; m.base = new Float32Array(m.w * m.h);
  if (prof) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let h = 0;
      if (prof.custom === 'omaha') {
        // sea and beach on the left, steep bluffs, a plateau with the village on the right; a gully (draw) leads up
        const gully = Math.exp(-((y - m.h * 0.5) ** 2) / 30);
        const bluff = smooth01((x - 40) / (18 + gully * 22)) * (150 - gully * 40);
        h = Math.max(0, (x - 10) * 0.25) * (x < 40 ? 1 : 0) + bluff + (x > 60 ? fbm(x / 18, y / 18, sd) * 22 : 0);
      } else if (prof.custom === 'coast') {
        // land rises gently from the sea (top) into low hills
        const sea = m.seaLine || m.h * 0.24;
        h = smooth01((y - sea) / 26) * 42 + fbm(x / 22, y / 22, sd) * 26 * smooth01((y - sea - 6) / 14);
      } else if (prof.custom === 'canyon') {
        // high mesas with steep cliffs either side of a winding valley; a few ramps lead up
        const c = m.canyon, d = Math.abs(y - c.vy(x)), ramp = Math.abs(((x + 9) % 34) - 17) < 3;
        h = 230 * smooth01((d - c.half) / (ramp ? 20 : 4.5)) + fbm(x / 9, y / 9, sd) * 26 + fbm(x / 30, y / 30, sd + 3) * 30;
      } else if (prof.custom === 'highland') {
        const vy = m.h / 2 + Math.sin(x / 14) * 5, d = Math.abs(y - vy);
        h = 280 * smooth01((d - 10) / 32) + fbm(x / 20, y / 20, sd) * 46 + fbm(x / 7, y / 7, sd + 5) * 16 * smooth01((d - 14) / 20);
      } else {
        h = fbm(x / prof.wave, y / prof.wave, sd) * prof.amp;
        if (prof.edge) { const dy = Math.min(y, m.h - y); h += prof.edge * smooth01(1 - dy / 11) * (0.7 + 0.3 * valueNoise(x / 9, 0, sd)); }
      }
      hc[y * W + x] = h;
    }
    const tileF = (x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h ? m.floor[y * m.w + x] : -1;
    const around = (x, y) => [tileF(x - 1, y - 1), tileF(x, y - 1), tileF(x - 1, y), tileF(x, y)];
    // hollows for water (but bridges stay at bank level)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const a = around(x, y); if (a.includes(F.WATER) && !a.includes(F.BRIDGE)) hc[y * W + x] -= a.every(f => f === F.WATER || f < 0) ? 26 : 14;
    }
    // roads and paved ground follow the land gently
    const paved = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (around(x, y).some(f => PAVED.has(f))) paved[y * W + x] = 1;
    for (let pass = 0; pass < 6; pass++) for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x; if (!paved[i]) continue;
      hc[i] = (hc[i] * 2 + hc[i - 1] + hc[i + 1] + hc[i - W] + hc[i + W]) / 6;
    }
    // flatten each building footprint (plus a margin) to one height, then blend the surroundings
    (m.buildings || []).forEach(b => {
      let sum = 0, n = 0;
      for (let y = b.y; y <= b.y + b.h; y++) for (let x = b.x; x <= b.x + b.w; x++) if (x >= 0 && y >= 0 && x < W && y < H) { sum += hc[y * W + x]; n++; }
      const t = n ? sum / n : 0; b.ground = t;
      for (let y = b.y - 5; y <= b.y + b.h + 5; y++) for (let x = b.x - 5; x <= b.x + b.w + 5; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const d = Math.max(b.x - 1 - x, x - (b.x + b.w + 1), b.y - 1 - y, y - (b.y + b.h + 1), 0);
        const k = d <= 0 ? 1 : 1 - d / 5;
        hc[y * W + x] = hc[y * W + x] * (1 - k) + t * k;
      }
    });
    // flat ground at the spawns and around the zone
    const flatAt = (px, py, r) => { const cx = px / T, cy = py / T; let t = 0, n = 0;
      for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if (x >= 0 && y >= 0 && x < W && y < H) { t += hc[y * W + x]; n++; }
      t /= Math.max(1, n);
      for (let y = Math.floor(cy - r * 2); y <= cy + r * 2; y++) for (let x = Math.floor(cx - r * 2); x <= cx + r * 2; x++) if (x >= 0 && y >= 0 && x < W && y < H) { const d = Math.hypot(x - cx, y - cy), k = d < r ? 0.85 : Math.max(0, 0.85 * (1 - (d - r) / r)); hc[y * W + x] = hc[y * W + x] * (1 - k) + t * k; } };
    [...m.spawns[0], ...m.spawns[1]].forEach(s => flatAt(s.x, s.y, 3));
    if (prof.custom === 'omaha') (m.trenches || []).forEach(([x, y]) => { for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) hc[(y + dy) * W + x + dx] -= 34; });
  }
  for (let i = 0; i < m.w * m.h; i++) m.base[i] = groundAt(m, (i % m.w) * T + T / 2, ((i / m.w) | 0) * T + T / 2);
  // buildings: every tile of a building stands exactly on its floor height
  (m.buildings || []).forEach(b => { if (b.ground === undefined) return; for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) if (x >= 0 && y >= 0 && x < m.w && y < m.h) m.base[y * m.w + x] = b.ground; });
  (m.ladders || []).forEach(L => { L.base = m.base[L.y * m.w + L.x]; const bi = m.bld && m.bld[(L.y + L.dy) * m.w + L.x + L.dx]; if (bi >= 0 && m.buildings[bi].ground !== undefined) L.base = m.buildings[bi].ground; });
  if (prof && prof.post) prof.post(m);
  // snow caps on the highland peaks
  if (m.id === 'highland') for (let i = 0; i < m.w * m.h; i++) if (m.base[i] > 190 && !PAVED.has(m.floor[i]) && m.floor[i] !== F.WATER) m.floor[i] = F.SNOW;
}
function groundAt(m, x, y) {
  if (!m.hc) return 0;
  const W = m.w + 1, fx = Math.max(0, Math.min(m.w - 0.001, x / T)), fy = Math.max(0, Math.min(m.h - 0.001, y / T));
  const xi = Math.floor(fx), yi = Math.floor(fy), tx = fx - xi, ty = fy - yi, i = yi * W + xi, hc = m.hc;
  return hc[i] * (1 - tx) * (1 - ty) + hc[i + 1] * tx * (1 - ty) + hc[i + W] * (1 - tx) * ty + hc[i + W + 1] * tx * ty;
}


const GEN = {
  killhouse(m, B, rng) {
    B.fill(F.CONCRETE);
    B.rectO(0, 0, m.w, 1, O.CONCRETE); B.rectO(0, m.h-1, m.w, 1, O.CONCRETE); B.rectO(0, 0, 1, m.h, O.CONCRETE); B.rectO(m.w-1, 0, 1, m.h, O.CONCRETE);
    // grid of plywood rooms
    const cols = [6, 14, 22, 30, 38], rows = [1, 9, 17, 25, 33];
    for (let c = 0; c < cols.length - 1; c++) for (let r = 0; r < rows.length - 1; r++) {
      const x = cols[c], y = rows[r], w = cols[c+1] - x + 1, h = rows[r+1] - y + 1;
      if (c === 1 && r === 1 || c === 2 && r === 2 || c === 1 && r === 2 || c === 2 && r === 1) continue; // open center hall
      for (let i = x; i < x+w; i++) { if (y > 1) B.obj(i, y, O.PLYWOOD); }
      for (let j = y; j < y+h; j++) { B.obj(x, j, O.PLYWOOD); }
      // doors
      B.clear(x, y + 2 + Math.floor(rng()*(h-5)), 1, 2);
      if (y > 1) B.clear(x + 2 + Math.floor(rng()*(w-5)), y, 2, 1);
    }
    for (let j = 1; j < m.h-1; j++) B.obj(38, j, O.PLYWOOD);
    for (let j = 1; j < m.h-1; j += 7) B.clear(38, j+2, 1, 2);
    for (let j = 1; j < m.h-1; j += 7) B.clear(6, j+2, 1, 2);
    B.rectF(15, 10, 15, 15, F.TILE);
    B.scatter(O.CRATE, 26, 2, 2, m.w-2, m.h-2, (x, y) => x > 7 && x < 37);
    B.scatter(O.TABLE, 10, 8, 2, 36, m.h-2);
    B.scatter(O.SANDBAG, 6, 1, 3, 5, m.h-3); B.scatter(O.SANDBAG, 6, 39, 3, 43, m.h-3);
    B.rectO(20, 15, 2, 1, O.SANDBAG); B.rectO(24, 19, 2, 1, O.SANDBAG);
    B.spawnsLR(2, 6); B.ffaRing(12, 16, 12);
    m.zone = { x:22.5*T, y:17*T, r:4.5*T };
  },

  oldtown(m, B, rng) {
    B.fill(F.ASPHALT);
    const xs = [8, 30, 52, 74], ys = [6, 26, 46]; // block origins
    const bw = 16, bh = 14;
    for (const bx of xs) for (const by of ys) {
      const plaza = (bx === 30 || bx === 52) && by === 26;
      B.rectF(bx-1, by-1, bw+2, bh+2, F.CONCRETE);
      if (plaza) continue;
      const r = rng();
      if (r < 0.45) {
        B.building(bx, by, bw, bh, rng() < 0.6 ? O.BRICK : O.CONCRETE, rng() < 0.5 ? F.TILE : F.WOOD, { doors:['n','s','e'], split:true, furnish:true });
      } else {
        const w1 = 7 + Math.floor(rng()*2);
        B.building(bx, by, w1, bh, O.BRICK, F.WOOD, { doors:['e','s'], furnish:true });
        B.building(bx + w1 + 1, by, bw - w1 - 1, bh - 4, O.CONCRETE, F.TILE, { doors:['w','n'], furnish:true });
        B.rectO(bx + w1 + 1, by + bh - 2, bw - w1 - 1, 1, O.FENCE);
        B.scatter(O.BUSH, 3, bx + w1 + 2, by + bh - 4, bx + bw, by + bh - 2);
      }
    }
    // central plaza
    B.rectF(30, 26, 38, 14, F.COBBLE);
    B.rectO(47, 31, 4, 4, O.STONE); B.clear(48, 32, 2, 2); B.rectF(48, 32, 2, 2, F.WATER);
    B.scatter(O.TREE, 6, 31, 27, 67, 39, (x, y) => Math.abs(x-49) > 4);
    B.scatter(O.BUSH, 12, 31, 27, 67, 39);
    B.scatter(O.SANDBAG, 8, 33, 28, 65, 38);
    // road markings
    for (let x = 0; x < m.w; x += 3) { B.floor(x, 23, F.LINE); B.floor(x, 43, F.LINE); }
    for (let y = 0; y < m.h; y += 3) { B.floor(27, y, F.LINE); B.floor(49, y, F.LINE); B.floor(71, y, F.LINE); }
    // cars and clutter on roads
    B.scatter(O.CAR, 22, 0, 0, m.w, m.h, (x, y) => B.getF(x, y) === F.ASPHALT && B.get(x+1, y) === 0 && B.getF(x+1, y) === F.ASPHALT);
    const cars = []; for (let i = 0; i < m.w*m.h; i++) if (m.obj[i] === O.CAR) cars.push(i);
    cars.forEach(i => { const x = i % m.w, y = (i / m.w) | 0; B.obj(x+1, y, O.CAR, m.tint[i]); });
    B.scatter(O.BARREL, 10, 0, 0, m.w, m.h, (x, y) => B.getF(x, y) === F.CONCRETE);
    B.scatter(O.CRATE, 14, 0, 0, m.w, m.h, (x, y) => B.getF(x, y) === F.CONCRETE);
    B.spawnsLR(2, 6); B.ffaRing(12, 36, 26);
    m.zone = { x:49*T, y:33*T, r:6*T };
  },

  farm(m, B, rng) {
    B.fill(F.GRASS);
    // dirt roads
    B.rectF(0, 40, m.w, 4, F.DIRT); B.rectF(54, 0, 4, m.h, F.DIRT);
    // wheat fields
    const fields = [[6, 4, 40, 30], [66, 50, 40, 28], [6, 52, 36, 26], [70, 6, 36, 26]];
    fields.forEach(([x, y, w, h]) => {
      B.rectF(x, y, w, h, F.FIELD);
      for (let j = y; j < y+h; j++) for (let i = x; i < x+w; i++) if (rng() < 0.82) B.obj(i, j, O.WHEAT, Math.floor(rng()*256));
      for (let i = x-1; i <= x+w; i++) { if (rng() < 0.85) B.obj(i, y-1, O.FENCE); if (rng() < 0.85) B.obj(i, y+h, O.FENCE); }
      for (let j = y-1; j <= y+h; j++) { if (rng() < 0.85) B.obj(x-1, j, O.FENCE); if (rng() < 0.85) B.obj(x+w, j, O.FENCE); }
    });
    // barn
    B.building(60, 26, 16, 12, O.BARNWALL, F.WOOD, { doors:['w','e'], doorWidth:4, windows:false });
    B.scatter(O.HAY, 14, 61, 27, 75, 37); B.clear(60, 31, 16, 2);
    B.scatter(O.HAYPILE, 8, 61, 27, 75, 37);
    // farmhouse
    B.building(36, 45, 14, 10, O.WHITEWOOD, F.WOOD, { doors:['n','e'], split:true, furnish:true });
    // silo
    B.rectO(78, 22, 3, 3, O.CONCRETE);
    // pond
    B.blob(90, 42, 6, F.WATER, 3);
    B.scatter(O.BUSH, 20, 82, 34, 99, 50, (x, y) => B.getF(x, y) !== F.WATER);
    // trees & bushes
    B.scatter(O.TREE, 60, 0, 0, m.w, m.h, (x, y) => B.getF(x, y) === F.GRASS);
    B.scatter(O.BUSH, 70, 0, 0, m.w, m.h, (x, y) => B.getF(x, y) === F.GRASS);
    B.scatter(O.HAY, 16, 0, 0, m.w, m.h, (x, y) => B.getF(x, y) === F.GRASS);
    B.scatter(O.HAYPILE, 18, 0, 0, m.w, m.h, (x, y) => B.getF(x, y) === F.GRASS || B.getF(x, y) === F.FIELD);
    B.scatter(O.ROCK, 10, 0, 0, m.w, m.h, (x, y) => B.getF(x, y) === F.GRASS);
    B.rectO(52, 38, 1, 1, O.CAR, 40); B.rectO(53, 38, 1, 1, O.CAR, 40);
    B.spawnsLR(2, 6); B.ffaRing(12, 44, 32);
    m.zone = { x:56*T, y:42*T, r:7*T };
  },

  forest(m, B, rng) {
    B.fill(F.FOREST);
    for (let j = 0; j < m.h; j++) for (let i = 0; i < m.w; i++) if (hash2(i>>2, j>>2, 3) < 0.3) B.floor(i, j, F.GRASS); else if (hash2(i>>1, j>>1, 9) < 0.12) B.floor(i, j, F.DIRT);
    // river meandering north->south
    for (let j = 0; j < m.h; j++) { const cx = 50 + Math.sin(j / 9) * 5; for (let i = Math.floor(cx-3); i <= cx+3; i++) B.floor(i, j, F.WATER); }
    // bridges
    [12, 44, 74].forEach(by => { for (let i = 40; i < 62; i++) if (B.getF(i, by) === F.WATER || B.getF(i, by+1) === F.WATER || B.getF(i, by+2) === F.WATER) B.rectF(i, by, 1, 3, F.BRIDGE); });
    // trail
    for (let i = 0; i < m.w; i++) { const y = 45 + Math.round(Math.sin(i/7)*2); if (B.getF(i, y) !== F.WATER && B.getF(i, y) !== F.BRIDGE) B.rectF(i, y, 1, 2, F.DIRT); }
    // cabins
    B.building(66, 24, 11, 9, O.WOODWALL, F.WOOD, { doors:['s','w'], furnish:true });
    B.building(22, 58, 10, 8, O.WOODWALL, F.WOOD, { doors:['n','e'], furnish:true });
    // dense pines
    B.scatter(O.PINE, 420, 0, 0, m.w, m.h, (x, y) => { const f = B.getF(x, y); return f !== F.WATER && f !== F.BRIDGE && f !== F.WOOD && f !== F.DIRT && B.get(x+1, y) === 0 && B.get(x, y+1) === 0; });
    B.scatter(O.TREE, 60, 0, 0, m.w, m.h, (x, y) => { const f = B.getF(x, y); return f === F.GRASS; });
    B.scatter(O.BUSH, 260, 0, 0, m.w, m.h, (x, y) => { const f = B.getF(x, y); return f !== F.WATER && f !== F.BRIDGE && f !== F.WOOD; });
    B.scatter(O.ROCK, 40, 0, 0, m.w, m.h, (x, y) => { const f = B.getF(x, y); return f !== F.WATER && f !== F.BRIDGE && f !== F.WOOD; });
    B.scatter(O.LOG, 30, 0, 0, m.w, m.h, (x, y) => { const f = B.getF(x, y); return f !== F.WATER && f !== F.BRIDGE && f !== F.WOOD && B.get(x+1, y) === 0; });
    const logs = []; for (let i = 0; i < m.w*m.h; i++) if (m.obj[i] === O.LOG) logs.push(i);
    logs.forEach(i => { const x = i % m.w, y = (i/m.w)|0; if (B.get(x+1, y) === 0 && B.getF(x+1, y) !== F.WATER) B.obj(x+1, y, O.LOG, 1); });
    // zone clearing at central bridge
    B.clear(42, 38, 18, 14);
    B.scatter(O.SANDBAG, 6, 42, 38, 60, 52, (x, y) => B.getF(x, y) !== F.WATER && B.getF(x, y) !== F.BRIDGE);
    B.spawnsLR(2, 6); B.ffaRing(12, 40, 32);
    m.zone = { x:51*T, y:45.5*T, r:6.5*T };
  },

  desert(m, B, rng) {
    B.fill(F.SAND);
    for (let j = 0; j < m.h; j++) for (let i = 0; i < m.w; i++) if (hash2(i>>2, j>>2, 5) < 0.18) B.floor(i, j, F.GRAVEL);
    B.rectF(0, 38, m.w, 4, F.DIRT); B.rectF(41, 0, 4, m.h, F.DIRT);
    // market square
    B.rectF(33, 30, 20, 20, F.COBBLE);
    // houses on a jittered grid
    for (let gy = 0; gy < 4; gy++) for (let gx = 0; gx < 4; gx++) {
      const cx = 6 + gx * 21, cy = 4 + gy * 19;
      if ((gx === 1 || gx === 2) && (gy === 1 || gy === 2)) continue;
      const w = 9 + Math.floor(rng()*5), h = 8 + Math.floor(rng()*4);
      const x = cx + Math.floor(rng()*3), y = cy + Math.floor(rng()*3);
      B.building(x, y, w, h, O.MUDBRICK, F.SAND, { doors:[['n','s','e','w'][Math.floor(rng()*4)], ['n','s','e','w'][Math.floor(rng()*4)]], furnish:true, split: rng() < 0.4 });
      // compound wall
      if (rng() < 0.5) { for (let i = x-2; i < x+w+2; i++) if (rng() < 0.8) B.obj(i, y+h+1, O.MUDBRICK); }
    }
    B.scatter(O.PALM, 40, 0, 0, m.w, m.h, (x, y) => B.getF(x, y) === F.SAND || B.getF(x, y) === F.GRAVEL);
    B.scatter(O.BUSH, 30, 0, 0, m.w, m.h, (x, y) => B.getF(x, y) === F.SAND);
    B.scatter(O.ROCK, 20, 0, 0, m.w, m.h, (x, y) => B.getF(x, y) === F.GRAVEL);
    B.scatter(O.CRATE, 18, 33, 30, 53, 50); B.scatter(O.TABLE, 10, 33, 30, 53, 50);
    // sandbag positions
    [[14, 36], [70, 36], [42, 18], [42, 60], [36, 33], [49, 46]].forEach(([x, y]) => { B.rectO(x, y, 4, 1, O.SANDBAG); B.obj(x, y+1, O.SANDBAG); B.obj(x+3, y+1, O.SANDBAG); });
    B.scatter(O.BARREL, 8, 0, 0, m.w, m.h);
    B.rectO(28, 39, 2, 1, O.CAR, 30); B.rectO(56, 40, 2, 1, O.CAR, 200);
    B.spawnsLR(2, 6); B.ffaRing(12, 34, 30);
    m.zone = { x:43*T, y:40*T, r:6*T };
  },

  rustyard(m, B, rng) {
    B.fill(F.ASPHALT);
    for (let j = 0; j < m.h; j++) for (let i = 0; i < m.w; i++) if (hash2(i>>3, j>>3, 11) < 0.35) B.floor(i, j, F.CONCRETE);
    // dock water to the south
    B.rectF(0, m.h-6, m.w, 6, F.WATER); B.rectF(0, m.h-7, m.w, 1, F.CONCRETE);
    for (let i = 4; i < m.w; i += 9) B.obj(i, m.h-7, O.STONE);
    // warehouses
    B.building(6, 6, 22, 16, O.CONCRETE, F.METAL, { doors:['s','e'], doorWidth:4, furnish:true });
    B.building(64, 6, 22, 16, O.CONCRETE, F.METAL, { doors:['s','w'], doorWidth:4, furnish:true });
    B.building(36, 4, 20, 10, O.BRICK, F.CONCRETE, { doors:['s','w','e'], split:true, furnish:true });
    // container rows
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
      if (rng() < 0.18) continue;
      const x = 20 + c * 9, y = 27 + r * 7, col = Math.floor(rng()*256);
      B.rectO(x, y, 6, 2, O.CONTAINER, col);
    }
    // fences
    for (let j = 24; j < m.h-9; j++) { if (j % 9 !== 0) { B.obj(4, j, O.CHAINLINK); B.obj(m.w-5, j, O.CHAINLINK); } }
    B.scatter(O.CRATE, 40, 0, 0, m.w, m.h-8, (x, y) => B.getF(x, y) !== F.METAL);
    B.scatter(O.BARREL, 18, 0, 0, m.w, m.h-8);
    B.rectO(30, 18, 2, 1, O.CAR, 120); B.rectO(58, 22, 2, 1, O.CAR, 10);
    B.spawnsLR(2, 6); B.ffaRing(12, 38, 22);
    m.spawns.forEach(list => list.forEach(s => { s.y = Math.min(s.y, (m.h - 12) * T); }));
    m.zone = { x:46*T, y:37*T, r:6*T };
    B.clear(42, 34, 9, 7);
  },

  snowbase(m, B, rng) {
    B.fill(F.SNOW);
    for (let j = 0; j < m.h; j++) for (let i = 0; i < m.w; i++) if (hash2(i>>2, j>>2, 21) < 0.12) B.floor(i, j, F.GRAVEL);
    // frozen lakes and the ploughed road
    B.blob(22, 13, 7, F.ICE, 3); B.blob(68, 59, 7, F.ICE, 3);
    B.rectF(0, 34, m.w, 4, F.GRAVEL);
    // radar station compound
    B.rectF(32, 24, 26, 24, F.CONCRETE);
    B.building(36, 27, 18, 12, O.CONCRETE, F.TILE, { doors:['s','w','e'], split:true, furnish:true });
    B.rectO(43, 42, 3, 3, O.CONCRETE); // radar mast base
    for (let i = 32; i < 58; i++) { if (i % 7) { B.obj(i, 24, O.CHAINLINK); B.obj(i, 47, O.CHAINLINK); } }
    for (let j = 24; j < 48; j++) { if (j % 6 && (j < 33 || j > 38)) { B.obj(32, j, O.CHAINLINK); B.obj(57, j, O.CHAINLINK); } }
    // bunkers on each side and at the flanks
    [[8, 20], [8, 46], [75, 20], [75, 46], [42, 6], [42, 60]].forEach(([x, y]) => B.building(x, y, 8, 6, O.CONCRETE, F.CONCRETE, { doors:[x < 30 ? 'e' : x > 60 ? 'w' : 's', y < 36 ? 's' : 'n'], windows:true }));
    // pine woods north and south
    B.scatter(O.PINE, 150, 0, 0, m.w, m.h, (x, y) => (y < 18 || y > 54) && B.getF(x, y) === F.SNOW && B.get(x+1, y) === 0 && B.get(x, y+1) === 0);
    B.scatter(O.PINE, 30, 0, 18, m.w, 54, (x, y) => B.getF(x, y) === F.SNOW && (x < 28 || x > 62));
    B.scatter(O.ROCK, 26, 0, 0, m.w, m.h, (x, y) => B.getF(x, y) === F.SNOW);
    B.scatter(O.BUSH, 40, 0, 0, m.w, m.h, (x, y) => B.getF(x, y) === F.SNOW);
    B.scatter(O.CRATE, 22, 30, 22, 60, 50, (x, y) => B.getF(x, y) === F.CONCRETE);
    B.scatter(O.BARREL, 10, 30, 22, 60, 50);
    [[20, 32], [66, 32], [20, 38], [66, 38], [44, 18], [44, 52]].forEach(([x, y]) => { B.rectO(x, y, 4, 1, O.SANDBAG); });
    B.rectO(26, 35, 2, 1, O.CAR, 60); B.rectO(62, 36, 2, 1, O.CAR, 61);
    B.rectO(14, 28, 6, 2, O.CONTAINER, 1); B.rectO(70, 42, 6, 2, O.CONTAINER, 0);
    B.spawnsLR(2, 6); B.ffaRing(12, 36, 26);
    m.zone = { x:45*T, y:41*T, r:5.5*T };
  },

  airfield(m, B, rng) {
    B.fill(F.GRASS);
    for (let j = 0; j < m.h; j++) for (let i = 0; i < m.w; i++) if (hash2(i>>3, j>>3, 31) < 0.2) B.floor(i, j, F.DIRT);
    // runway with centre line and threshold stripes, taxiway to the hangars
    B.rectF(4, 36, m.w-8, 9, F.ASPHALT);
    for (let x = 10; x < m.w-10; x += 4) B.floor(x, 40, F.LINE);
    B.rectF(56, 16, 7, 20, F.ASPHALT); B.rectF(12, 22, 98, 4, F.ASPHALT);
    // hangars (wide doors facing the apron)
    B.building(14, 5, 22, 16, O.METALWALL, F.CONCRETE, { doors:['s'], doorWidth:8, windows:false, furnish:true });
    B.building(84, 5, 22, 16, O.METALWALL, F.CONCRETE, { doors:['s'], doorWidth:8, windows:false, furnish:true });
    // control tower and operations building
    B.building(54, 3, 11, 11, O.CONCRETE, F.TILE, { doors:['s', 'e'], split:true, furnish:true });
    // barracks and fuel depot in the south
    [[16, 54], [34, 54], [76, 54], [94, 54]].forEach(([x, y]) => B.building(x, y, 12, 8, O.WHITEWOOD, F.WOOD, { doors:['n', 's'], furnish:true }));
    B.rectF(52, 56, 16, 14, F.CONCRETE);
    for (let i = 52; i < 68; i++) { if (i % 5) { B.obj(i, 56, O.CHAINLINK); B.obj(i, 69, O.CHAINLINK); } }
    for (let j = 56; j < 70; j++) { if (j % 4) { B.obj(52, j, O.CHAINLINK); B.obj(67, j, O.CHAINLINK); } }
    B.scatter(O.BARREL, 22, 54, 58, 66, 68);
    // revetments and clutter along the runway
    [[24, 32], [44, 32], [74, 32], [94, 32], [24, 47], [44, 47], [74, 47], [94, 47]].forEach(([x, y]) => { B.rectO(x, y, 5, 1, O.SANDBAG); });
    B.rectO(30, 27, 6, 2, O.CONTAINER, 2); B.rectO(84, 27, 6, 2, O.CONTAINER, 3); B.rectO(56, 48, 6, 2, O.CONTAINER, 4);
    B.rectO(42, 23, 2, 1, O.CAR, 70); B.rectO(76, 23, 2, 1, O.CAR, 71); B.rectO(60, 30, 2, 1, O.CAR, 72);
    B.scatter(O.CRATE, 30, 0, 0, m.w, m.h, (x, y) => B.getF(x, y) === F.CONCRETE || B.getF(x, y) === F.ASPHALT && (y < 34 || y > 46));
    B.scatter(O.TREE, 40, 0, 0, m.w, m.h, (x, y) => B.getF(x, y) !== F.ASPHALT && (y < 3 || y > 50 || x < 10 || x > 110));
    B.scatter(O.BUSH, 70, 0, 0, m.w, m.h, (x, y) => B.getF(x, y) === F.GRASS || B.getF(x, y) === F.DIRT);
    B.scatter(O.HAY, 10, 0, 46, m.w, m.h, (x, y) => B.getF(x, y) === F.GRASS);
    B.scatter(O.HAYPILE, 14, 0, 46, m.w, m.h, (x, y) => B.getF(x, y) === F.GRASS);
    B.spawnsLR(2, 6); B.ffaRing(12, 46, 28);
    m.zone = { x:60*T, y:40.5*T, r:7*T };
  },

  mansion(m, B, rng) {
    B.fill(F.GRASS);
    const W = m.w, H = m.h, cx = W >> 1, cy = H >> 1;
    // estate wall with gates on all four sides, a few breaches
    for (let x = 6; x < W - 6; x++) { B.obj(x, 6, O.FIELDSTONE); B.obj(x, H - 7, O.FIELDSTONE); }
    for (let y = 6; y < H - 6; y++) { B.obj(6, y, O.FIELDSTONE); B.obj(W - 7, y, O.FIELDSTONE); }
    B.clear(6, cy - 3, 1, 6); B.clear(W - 7, cy - 3, 1, 6); B.clear(cx - 3, 6, 6, 1); B.clear(cx - 3, H - 7, 6, 1);
    for (let k = 0; k < 8; k++) B.clear(10 + Math.floor(rng() * (W - 22)), rng() < 0.5 ? 6 : H - 7, 2, 1);
    // gravel drives from the gates to the forecourt, and a ring around the house
    B.rectF(0, cy - 3, W, 6, F.GRAVEL); B.rectF(cx - 3, 0, 6, H, F.GRAVEL);
    // the manor: 50 x 38, four storeys of stucco, two stairwells, marble halls and carpeted wings
    const mx = cx - 25, my = cy - 19, mw = 50, mh = 38;
    B.rectF(mx - 3, my - 3, mw + 6, mh + 6, F.GRAVEL);
    B.building(mx, my, mw, mh, O.STUCCO, F.MARBLE, { doors: ['w', 'e', 's', 'n'], doorWidth: 3, stories: 4, wells: 2 });
    // interior walls (they rise through every floor): two wings either side of a central hall
    const wall = (x0, y0, x1, y1, gaps) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) B.obj(x, y, O.STUCCO); gaps.forEach(([x, y, w, h]) => B.clear(x, y, w, h)); };
    wall(mx + 14, my + 1, mx + 14, my + mh - 2, [[mx + 14, my + 7, 1, 3], [mx + 14, my + 27, 1, 3]]);
    wall(mx + 35, my + 1, mx + 35, my + mh - 2, [[mx + 35, my + 7, 1, 3], [mx + 35, my + 27, 1, 3]]);
    wall(mx + 1, my + 19, mx + 13, my + 19, [[mx + 6, my + 19, 3, 1]]);
    wall(mx + 36, my + 19, mx + mw - 2, my + 19, [[mx + 41, my + 19, 3, 1]]);
    B.rectF(mx + 1, my + 1, 13, mh - 2, F.CARPET); B.rectF(mx + 36, my + 1, 13, mh - 2, F.WOOD);
    B.furnish(mx + 1, my + 1, 13, 18, 'home'); B.furnish(mx + 1, my + 20, 13, 17, 'home');
    B.furnish(mx + 36, my + 1, 13, 18, 'home'); B.furnish(mx + 36, my + 20, 13, 17, 'home');
    // garages, a greenhouse, the groundskeeper's cottage and a chapel
    B.building(cx + 36, cy - 30, 18, 11, O.BRICK, F.CONCRETE, { doors: ['s'], doorWidth: 4, windows: false });
    B.furnish(cx + 37, cy - 29, 16, 9, 'garage');
    B.building(cx - 54, cy + 26, 16, 10, O.WHITEWOOD, F.TILE, { doors: ['e', 'n'] });
    B.building(cx + 38, cy + 26, 12, 9, O.WOODWALL, F.WOOD, { doors: ['w'] }); B.furnish(cx + 39, cy + 27, 10, 7, 'home');
    B.building(cx - 52, cy - 34, 10, 14, O.FIELDSTONE, F.COBBLE, { doors: ['s'] });
    // fountain court in front of the house
    B.blob(cx, my - 9, 2.6, F.WATER, 0.5); for (let a = 0; a < 14; a++) B.obj(Math.round(cx + Math.cos(a / 14 * 6.28) * 3.8), Math.round(my - 9 + Math.sin(a / 14 * 6.28) * 3.8), O.STONE);
    // hedge maze behind the house, formal hedges along the drives
    const mzY = my + mh + 5;
    for (let y = mzY; y < H - 10; y += 3) for (let x = cx - 22; x < cx + 22; x++) if (hash2(x, y, 4) > 0.22 && x % 7) B.obj(x, y, O.HEDGE);
    for (let x = cx - 24; x < cx + 24; x += 4) for (let y = mzY + 1; y < H - 10; y++) if (hash2(x, y, 6) < 0.35) B.obj(x, y, O.HEDGE);
    for (let x = 10; x < mx - 6; x++) if (x % 6) { B.obj(x, cy - 5, O.HEDGE); B.obj(x, cy + 4, O.HEDGE); }
    for (let x = mx + mw + 6; x < W - 10; x++) if (x % 6) { B.obj(x, cy - 5, O.HEDGE); B.obj(x, cy + 4, O.HEDGE); }
    // park: old trees, statues, a pond and a summer house
    B.blob(W - 26, 20, 5, F.WATER, 2); B.blob(24, H - 24, 4, F.WATER, 2);
    [[22, 16], [27, 16], [22, 21], [27, 21], [W - 30, H - 22], [W - 24, H - 22]].forEach(([x, y]) => B.obj(x, y, O.STONE));
    const outsideHouse = (x, y) => m.floor[y * W + x] === F.GRASS && !B.inBuilding(x, y, 2);
    B.scatter(O.TREE, 90, 8, 8, W - 8, H - 8, (x, y) => outsideHouse(x, y) && (Math.abs(x - cx) > 30 || Math.abs(y - cy) > 26));
    B.scatter(O.BUSH, 120, 8, 8, W - 8, H - 8, outsideHouse);
    B.rectO(cx + 40, cy - 17, 2, 1, O.CAR, 30); B.rectO(cx + 46, cy - 17, 2, 1, O.CAR, 2); B.rectO(cx - 6, my - 15, 2, 1, O.CAR, 200);
    // outside the walls: woods
    B.scatter(O.PINE, 90, 0, 0, W, H, (x, y) => (x < 6 || x > W - 7 || y < 6 || y > H - 7) && m.floor[y * W + x] === F.GRASS);
    B.spawnsLR(2, 6); B.ffaRing(12, 50, 40);
    m.zone = { x: cx * T, y: cy * T, r: 7 * T };
  },

  omaha(m, B, rng) {
    B.fill(F.GRASS);
    // sea, beach and shingle
    B.rectF(0, 0, 11, m.h, F.WATER); B.rectF(11, 0, 29, m.h, F.SAND); B.rectF(38, 0, 4, m.h, F.GRAVEL);
    // Czech hedgehogs and barbed wire on the beach
    B.scatter(O.HEDGEHOG, 46, 14, 2, 34, m.h - 2);
    for (let y = 1; y < m.h - 1; y++) { if (hash2(y, 1, 3) > 0.18) B.obj(33, y, O.WIRE); if (hash2(y, 2, 3) > 0.3) B.obj(39, y, O.WIRE); }
    // dirt road up the draw (gully) in the middle of the bluffs, and on to the village
    B.rectF(38, m.h / 2 - 2 | 0, 82, 4, F.DIRT);
    // bunkers on the bluff edge and a zig-zag trench line behind them
    [[60, 14], [60, 30], [61, 52], [60, 68]].forEach(([x, y]) => B.building(x, y, 7, 6, O.CONCRETE, F.CONCRETE, { doors: ['e'], windows: true }));
    m.trenches = [];
    for (let y = 4; y < m.h - 4; y++) { const x = 66 + (Math.floor(y / 5) % 2 ? 1 : 0); m.trenches.push([x, y]); B.floor(x, y, F.DIRT); B.clear(x, y, 1, 1);
      if (y % 3) { B.obj(x - 1, y, O.SANDBAG); } }
    for (let y = 6; y < m.h - 6; y += 12) for (let x = 67; x < 72; x++) { m.trenches.push([x, y]); B.floor(x, y, F.DIRT); B.clear(x, y, 1, 1); }
    B.clear(65, m.h / 2 - 2 | 0, 3, 4); // road crosses the trench
    B.scatter(O.WIRE, 30, 52, 2, 64, m.h - 2);
    // bocage: fields divided by thick hedgerows
    for (let fx = 74; fx < m.w - 2; fx += 14) for (let y = 1; y < m.h - 1; y++) if (hash2(fx, y, 8) > 0.12 && Math.abs(y - m.h / 2) > 3) B.obj(fx, y, O.HEDGE);
    for (let fy = 10; fy < m.h - 2; fy += 18) for (let x = 74; x < m.w - 1; x++) if (hash2(x, fy, 9) > 0.15) B.obj(x, fy, O.HEDGE);
    // Normandy village: stone farmhouses and a church
    [[80, 30], [80, 48], [96, 34], [96, 50], [108, 22], [108, 58]].forEach(([x, y]) => B.building(x, y, 9 + Math.floor(rng() * 3), 8, O.FIELDSTONE, F.WOOD, { doors: ['n', 's'], furnish: true }));
    B.building(92, 8, 10, 16, O.FIELDSTONE, F.COBBLE, { doors: ['s', 'w'], split: true });
    B.scatter(O.TREE, 30, 70, 0, m.w, m.h, (x, y) => m.floor[y * m.w + x] === F.GRASS);
    B.scatter(O.HAY, 14, 74, 0, m.w, m.h, (x, y) => m.floor[y * m.w + x] === F.GRASS);
    B.scatter(O.BUSH, 50, 44, 0, m.w, m.h, (x, y) => m.floor[y * m.w + x] === F.GRASS);
    B.scatter(O.CRATE, 12, 60, 0, 72, m.h);
    // landing craft wreck on the beach (containers stand in for the hulls)
    B.rectO(14, 20, 3, 2, O.CONTAINER, 4); B.rectO(16, 62, 3, 2, O.CONTAINER, 4);
    for (let i = 0; i < 6; i++) { const y = 6 + i * 12; m.spawns[0].push({ x: 22 * T, y: y * T }); m.spawns[1].push({ x: (m.w - 4) * T, y: (24 + i * 7) * T }); }
    B.ffaRing(12, 38, 30);
    m.zone = { x: 70 * T, y: (m.h / 2) * T, r: 6 * T };
  },

  highland(m, B, rng) {
    B.fill(F.GRASS);
    const vy = x => m.h / 2 + Math.sin(x / 14) * 5;
    // river in the valley floor with two stone bridges, a road beside it
    for (let x = 0; x < m.w; x++) { const c = vy(x) + 4; for (let y = Math.floor(c - 2); y <= c + 1; y++) B.floor(x, y, F.WATER); B.rectF(x, Math.floor(vy(x) - 3), 1, 3, F.GRAVEL); }
    [36, 84].forEach(bx => { for (let x = bx; x < bx + 4; x++) for (let y = 0; y < m.h; y++) if (m.floor[y * m.w + x] === F.WATER) B.floor(x, y, F.BRIDGE); });
    // alpine village of chalets around a square
    B.rectF(52, Math.floor(vy(60)) - 12, 18, 8, F.COBBLE);
    [[50, -22], [62, -22], [74, -20], [46, 10], [60, 10], [72, 12]].forEach(([x, dy]) => { const y = Math.floor(vy(x) + dy); B.building(x, y, 9, 7, O.WOODWALL, F.WOOD, { doors: [dy < 0 ? 's' : 'n'], furnish: true }); });
    B.building(24, Math.floor(vy(24)) - 20, 8, 12, O.FIELDSTONE, F.COBBLE, { doors: ['s'] }); // chapel
    B.building(96, Math.floor(vy(96)) + 9, 12, 9, O.WOODWALL, F.WOOD, { doors: ['n'], furnish: true }); // lodge
    // pine forest on the slopes, rocks higher up
    B.scatter(O.PINE, 340, 0, 0, m.w, m.h, (x, y) => { const d = Math.abs(y - vy(x)); return d > 9 && d < 34 && m.floor[y * m.w + x] === F.GRASS; });
    B.scatter(O.ROCK, 90, 0, 0, m.w, m.h, (x, y) => Math.abs(y - vy(x)) > 22 && m.floor[y * m.w + x] === F.GRASS);
    B.scatter(O.BUSH, 80, 0, 0, m.w, m.h, (x, y) => m.floor[y * m.w + x] === F.GRASS);
    B.scatter(O.FENCE, 40, 40, 0, 90, m.h, (x, y) => Math.abs(y - vy(x)) < 18 && m.floor[y * m.w + x] === F.GRASS);
    B.scatter(O.HAY, 10, 40, 0, 90, m.h, (x, y) => Math.abs(y - vy(x)) < 16 && m.floor[y * m.w + x] === F.GRASS);
    B.scatter(O.LOG, 20, 0, 0, m.w, m.h, (x, y) => Math.abs(y - vy(x)) > 10 && m.floor[y * m.w + x] === F.GRASS);
    const sy = Math.floor(vy(2)) - 6, ey = Math.floor(vy(m.w - 3)) - 6;
    for (let i = 0; i < 6; i++) { m.spawns[0].push({ x: (2 + (i % 2)) * T + T / 2, y: (sy + i) * T }); m.spawns[1].push({ x: (m.w - 3 - (i % 2)) * T + T / 2, y: (ey + i) * T }); }
    B.ffaRing(12, 42, 14);
    m.zone = { x: 61 * T, y: (vy(61) - 8) * T, r: 6 * T };
  },

  ruins(m, B, rng) {
    B.fill(F.FOREST);
    for (let j = 0; j < m.h; j++) for (let i = 0; i < m.w; i++) if (hash2(i>>2, j>>2, 41) < 0.22) B.floor(i, j, F.MUD); else if (hash2(i>>2, j>>2, 43) < 0.2) B.floor(i, j, F.GRASS);
    // muddy river across the south with two stone causeways
    for (let i = 0; i < m.w; i++) { const cy = 63 + Math.sin(i / 8) * 2.5; for (let j = Math.floor(cy-2); j <= cy+2; j++) B.floor(i, j, F.WATER); }
    [22, 72].forEach(bx => { for (let j = 55; j < 72; j++) if ([0,1,2,3].some(k => B.getF(bx+k, j) === F.WATER)) B.rectF(bx, j, 4, 1, F.COBBLE); });
    // temple: outer wall, inner sanctum, pillared courtyard
    B.rectF(30, 18, 36, 32, F.COBBLE);
    const wall = (x, y, w, h) => { for (let i = x; i < x+w; i++) { B.obj(i, y, O.RUIN); B.obj(i, y+h-1, O.RUIN); } for (let j = y; j < y+h; j++) { B.obj(x, j, O.RUIN); B.obj(x+w-1, j, O.RUIN); } };
    wall(30, 18, 36, 32); wall(40, 26, 16, 16);
    B.clear(46, 18, 4, 1); B.clear(46, 49, 4, 1); B.clear(30, 32, 1, 4); B.clear(65, 32, 1, 4);
    B.clear(47, 26, 2, 1); B.clear(47, 41, 2, 1); B.clear(40, 33, 1, 2); B.clear(55, 33, 1, 2);
    for (const [x, y] of [[34, 22], [34, 45], [61, 22], [61, 45], [36, 30], [36, 38], [59, 30], [59, 38]]) B.obj(x, y, O.STONE);
    // crumbled sections
    for (let i = 0; i < m.w*m.h; i++) if (m.obj[i] === O.RUIN && rng() < 0.16) m.obj[i] = 0;
    // scattered ruin fragments in the jungle
    for (let k = 0; k < 16; k++) {
      const x = 4 + Math.floor(rng()*(m.w-12)), y = 4 + Math.floor(rng()*50);
      if (x > 26 && x < 68 && y > 14 && y < 52) continue;
      const len = 3 + Math.floor(rng()*4);
      for (let i = 0; i < len; i++) B.obj(x + i, y, O.RUIN); for (let j = 1; j < len - 1; j++) if (rng() < 0.7) B.obj(x, y + j, O.RUIN);
    }
    // mud trails from each side to the temple gates
    for (let i = 0; i < 31; i++) B.rectF(i, 33 + Math.round(Math.sin(i / 5)), 1, 3, F.MUD);
    for (let i = 65; i < m.w; i++) B.rectF(i, 33 + Math.round(Math.sin(i / 5)), 1, 3, F.MUD);
    const jungle = (x, y) => { const f = B.getF(x, y); return f !== F.WATER && f !== F.COBBLE; };
    B.scatter(O.TREE, 70, 0, 0, m.w, m.h, (x, y) => jungle(x, y) && B.get(x+1, y) === 0);
    B.scatter(O.PALM, 60, 0, 0, m.w, m.h, jungle);
    B.scatter(O.BUSH, 380, 0, 0, m.w, m.h, jungle);
    B.scatter(O.BUSH, 20, 31, 19, 65, 49, (x, y) => B.getF(x, y) === F.COBBLE && (x < 40 || x > 55 || y < 26 || y > 41));
    B.scatter(O.ROCK, 24, 0, 0, m.w, m.h, jungle);
    B.scatter(O.LOG, 18, 0, 0, m.w, m.h, (x, y) => jungle(x, y) && B.get(x+1, y) === 0 && jungle(x+1, y));
    const logs = []; for (let i = 0; i < m.w*m.h; i++) if (m.obj[i] === O.LOG) logs.push(i);
    logs.forEach(i => { const x = i % m.w, y = (i/m.w)|0; if (B.get(x+1, y) === 0) B.obj(x+1, y, O.LOG, 1); });
    B.scatter(O.CRATE, 8, 41, 27, 55, 41);
    B.spawnsLR(2, 6); B.ffaRing(12, 38, 22);
    m.spawns.forEach(list => list.forEach(s => { s.y = Math.min(s.y, 54 * T); }));
    m.zone = { x:48*T, y:34*T, r:5*T };
  },
};


// ---- custom maps (map maker) ----------------------------------------------------
// Floors/objects are stored run-length encoded as base64 so maps fit in localStorage and lobby messages.
const MapCodec = {
  encode(arr) {
    const out = [];
    for (let i = 0; i < arr.length;) { const v = arr[i]; let n = 1; while (i + n < arr.length && arr[i + n] === v && n < 255) n++; out.push(n, v); i += n; }
    let s = ''; for (let i = 0; i < out.length; i += 8192) s += String.fromCharCode.apply(null, out.slice(i, i + 8192));
    return btoa(s);
  },
  decode(str, len) {
    const bin = atob(str), arr = new Uint8Array(len); let p = 0;
    for (let i = 0; i + 1 < bin.length && p < len; i += 2) { const n = bin.charCodeAt(i), v = bin.charCodeAt(i + 1); arr.fill(v, p, Math.min(len, p + n)); p += n; }
    return arr;
  },
};
function buildCustom(m, B, rng, c) {
  m.floor.set(MapCodec.decode(c.floor, m.w * m.h));
  m.obj.set(MapCodec.decode(c.obj, m.w * m.h));
  for (let i = 0; i < m.w * m.h; i++) { if (!MAT[m.obj[i]]) m.obj[i] = 0; if (!FLOOR_INFO[m.floor[i]]) m.floor[i] = F.GRASS; m.tint[i] = Math.floor(rng() * 256); }
  const walk = (tx, ty) => B.ok(tx, ty) && m.floor[ty * m.w + tx] !== F.WATER;
  const sp = c.spawns || [[], []];
  if (sp[0] && sp[0].length && sp[1] && sp[1].length) [0, 1].forEach(t => sp[t].forEach(s => m.spawns[t].push({ x:s.x * T + T/2, y:s.y * T + T/2 })));
  else B.spawnsLR(2, 6);
  B.ffaRing(12, m.w * 0.36, m.h * 0.34);
  // move spawn points that landed in water to the nearest dry tile
  [...m.spawns[0], ...m.spawns[1], ...m.ffa].forEach(s => {
    const tx = Math.floor(s.x / T), ty = Math.floor(s.y / T); if (walk(tx, ty)) return;
    for (let r = 1; r < 20; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (walk(tx + dx, ty + dy)) { s.x = (tx + dx) * T + T/2; s.y = (ty + dy) * T + T/2; return; }
  });
  m.zone = c.zone ? { x:c.zone.x * T + T/2, y:c.zone.y * T + T/2, r:(c.zone.r || 6) * T } : { x:m.w * T / 2, y:m.h * T / 2, r:Math.min(6, m.w / 8) * T };
}

// ---- textures -----------------------------------------------------------------
const Tex = (() => {
  const cache = {};
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function shade(hex, f) {
    if (hex.length === 4) hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    r = Math.max(0, Math.min(255, r * f)); g = Math.max(0, Math.min(255, g * f)); b = Math.max(0, Math.min(255, b * f));
    return `rgb(${r|0},${g|0},${b|0})`;
  }
  function speckle(g, base, n, var_, size, rnd) {
    for (let i = 0; i < n; i++) { g.fillStyle = shade(base, 1 + (rnd() - 0.5) * var_); g.fillRect(rnd()*T, rnd()*T, size, size); }
  }
  function floorTex(f, v) {
    const key = f + ':' + v; if (cache[key]) return cache[key];
    const c = cv(T, T), g = c.getContext('2d'), rnd = mulberry32(f * 97 + v * 13 + 1);
    const base = FLOOR_INFO[f].base;
    g.fillStyle = base; g.fillRect(0, 0, T, T);
    switch (f) {
      case F.GRASS: case F.FOREST:
        speckle(g, base, 70, 0.35, 2, rnd);
        for (let i = 0; i < 26; i++) { g.strokeStyle = shade(base, 0.75 + rnd()*0.6); g.lineWidth = 1; const x = rnd()*T, y = rnd()*T; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd()-0.5)*3, y - 2 - rnd()*3); g.stroke(); }
        if (f === F.FOREST) for (let i = 0; i < 6; i++) { g.fillStyle = shade('#5a4a2a', 0.8 + rnd()*0.4); g.fillRect(rnd()*T, rnd()*T, 3, 1.5); }
        break;
      case F.DIRT: speckle(g, base, 90, 0.3, 2, rnd); for (let i = 0; i < 5; i++) { g.fillStyle = shade('#8a8378', 0.9 + rnd()*0.3); g.beginPath(); g.arc(rnd()*T, rnd()*T, 1 + rnd()*1.5, 0, 7); g.fill(); } break;
      case F.ASPHALT: case F.LINE:
        speckle(g, base, 140, 0.4, 1, rnd);
        if (rnd() < 0.12) { g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 0.8; g.beginPath(); let cx = rnd()*T, cy = rnd()*T; g.moveTo(cx, cy); for (let k = 0; k < 4; k++) { cx += (rnd()-0.5)*10; cy += (rnd()-0.5)*10; g.lineTo(cx, cy); } g.stroke(); }
        if (f === F.LINE) { g.fillStyle = '#c9a63a'; g.fillRect(T/2 - 2, 4, 4, T - 8); }
        break;
      case F.CONCRETE: speckle(g, base, 80, 0.15, 2, rnd); g.strokeStyle = 'rgba(0,0,0,0.18)'; g.strokeRect(0.5, 0.5, T-1, T-1); break;
      case F.SAND: speckle(g, base, 110, 0.12, 1.5, rnd); g.strokeStyle = 'rgba(150,120,70,0.25)'; g.beginPath(); g.moveTo(0, rnd()*T); g.quadraticCurveTo(T/2, rnd()*T, T, rnd()*T); g.stroke(); break;
      case F.GRAVEL: for (let i = 0; i < 60; i++) { g.fillStyle = shade(base, 0.7 + rnd()*0.6); g.beginPath(); g.arc(rnd()*T, rnd()*T, 0.8 + rnd()*1.6, 0, 7); g.fill(); } break;
      case F.WOOD: case F.BRIDGE:
        for (let y = 0; y < T; y += 8) { g.fillStyle = shade(base, 0.85 + rnd()*0.3); g.fillRect(0, y, T, 8); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, y + 7, T, 1); const jx = rnd()*T; g.fillRect(jx, y, 1, 7);
          for (let k = 0; k < 3; k++) { g.fillStyle = 'rgba(60,35,10,0.25)'; g.fillRect(0, y + 1 + rnd()*6, T, 0.6); } }
        if (f === F.BRIDGE) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, 0, 2, T); g.fillRect(T-2, 0, 2, T); }
        break;
      case F.TILE: g.fillStyle = shade(base, 0.95 + rnd()*0.1); g.fillRect(0, 0, 16, 16); g.fillRect(16, 16, 16, 16); g.strokeStyle = 'rgba(70,60,50,0.4)'; g.strokeRect(0.5, 0.5, 15, 15); g.strokeRect(16.5, 0.5, 15, 15); g.strokeRect(0.5, 16.5, 15, 15); g.strokeRect(16.5, 16.5, 15, 15); break;
      case F.CARPET: speckle(g, base, 120, 0.2, 1, rnd); break;
      case F.SNOW:
        speckle(g, base, 90, 0.08, 2, rnd);
        for (let i = 0; i < 3; i++) { g.strokeStyle = 'rgba(150,170,195,0.18)'; g.beginPath(); g.moveTo(0, rnd()*T); g.quadraticCurveTo(T/2, rnd()*T, T, rnd()*T); g.stroke(); }
        for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(rnd()*T, rnd()*T, 1, 1); }
        break;
      case F.ICE: {
        const grd = g.createLinearGradient(0, 0, T, T); grd.addColorStop(0, '#b9d6e4'); grd.addColorStop(1, '#94b9cc'); g.fillStyle = grd; g.fillRect(0, 0, T, T);
        g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 0.7; g.beginPath(); let cx = rnd()*T, cy = rnd()*T; g.moveTo(cx, cy); for (let k = 0; k < 4; k++) { cx += (rnd()-0.5)*16; cy += (rnd()-0.5)*16; g.lineTo(cx, cy); } g.stroke();
        break; }
      case F.MARBLE: g.fillStyle = shade(base, 0.97); g.fillRect(0, 0, T, T); for (let i = 0; i < 4; i++) { g.strokeStyle = `rgba(120,115,110,${0.12 + rnd() * 0.12})`; g.beginPath(); let cx = rnd() * T, cy = rnd() * T; g.moveTo(cx, cy); for (let k = 0; k < 4; k++) { cx += (rnd() - 0.5) * 14; cy += (rnd() - 0.5) * 14; g.lineTo(cx, cy); } g.stroke(); } g.strokeStyle = 'rgba(0,0,0,0.12)'; g.strokeRect(0.5, 0.5, T - 1, T - 1); break;
      case F.MUD: speckle(g, base, 70, 0.35, 3, rnd); for (let i = 0; i < 3; i++) { g.fillStyle = 'rgba(40,30,20,0.35)'; g.beginPath(); g.ellipse(rnd()*T, rnd()*T, 3 + rnd()*4, 1.5 + rnd()*2, rnd()*3, 0, 7); g.fill(); } break;
      case F.WATER: {
        const grd = g.createLinearGradient(0, 0, T, T); grd.addColorStop(0, '#2f6580'); grd.addColorStop(1, '#264f66'); g.fillStyle = grd; g.fillRect(0, 0, T, T);
        g.strokeStyle = 'rgba(200,230,255,0.15)'; for (let i = 0; i < 3; i++) { const y = rnd()*T; g.beginPath(); g.moveTo(rnd()*10, y); g.quadraticCurveTo(16, y - 2, 22 + rnd()*10, y); g.stroke(); }
        break; }
      case F.FIELD: for (let y = 0; y < T; y += 4) { g.fillStyle = shade(base, y % 8 ? 0.85 : 1.1); g.fillRect(0, y, T, 4); } speckle(g, base, 40, 0.3, 1.5, rnd); break;
      case F.COBBLE:
        for (let y = 0; y < T; y += 8) for (let x = ((y/8)%2) * -4; x < T; x += 8) { g.fillStyle = shade('#88837a', 0.75 + rnd()*0.4); g.beginPath(); g.roundRect ? g.roundRect(x+0.8, y+0.8, 6.4, 6.4, 2) : g.rect(x+0.8, y+0.8, 6.4, 6.4); g.fill(); }
        break;
      case F.METAL:
        g.fillStyle = shade(base, 1.05); g.fillRect(0, 0, T, T); g.strokeStyle = 'rgba(0,0,0,0.3)'; g.strokeRect(0.5, 0.5, T-1, T-1);
        for (let y = 2; y < T; y += 6) for (let x = 2 + (y % 12 ? 3 : 0); x < T; x += 6) { g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x, y, 3, 1); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x, y+1, 3, 1); }
        break;
    }
    cache[key] = c; return c;
  }
  return { floorTex, shade, cv };
})();

// ---- static map rendering (ground + objects) -----------------------------------
class MapRenderer {
  constructor(map, opts) {
    this.m = map;
    this.gs = map.w * map.h > 15000 ? 0.5 : 1;
    this.ground = Tex.cv(Math.ceil(map.w*T*this.gs), Math.ceil(map.h*T*this.gs));
    this.gctx = this.ground.getContext('2d');
    this.gctx.setTransform(this.gs, 0, 0, this.gs, 0, 0);
    this.canopies = []; // dynamic overlay entries
    this.drawGround();
    // the 3D game only needs the ground; objects are separate meshes there
    if (opts && opts.groundOnly) return;
    this.objs = Tex.cv(map.w*T, map.h*T);
    this.octx = this.objs.getContext('2d');
    this.redrawObjects(0, 0, map.w, map.h);
  }
  drawGround() {
    const g = this.gctx, m = this.m;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const f = m.floor[y*m.w+x]; g.drawImage(Tex.floorTex(f, Math.floor(hash2(x, y, 1) * 4)), x*T, y*T);
    }
    // large-scale colour variation so tiles don't look repetitive
    const rnd = mulberry32(m.seed + 5);
    for (let i = 0; i < m.w*m.h/6; i++) {
      const x = rnd()*m.w*T, y = rnd()*m.h*T, tx = Math.floor(x/T), ty = Math.floor(y/T);
      const f = m.floor[ty*m.w+tx]; if (f === F.WATER || f === F.WOOD || f === F.TILE || f === F.METAL) continue;
      g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,230,0.04)';
      g.beginPath(); g.arc(x, y, 20 + rnd()*50, 0, 7); g.fill();
    }
    // water edges
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      if (m.floor[y*m.w+x] !== F.WATER) continue;
      [[0,-1],[0,1],[-1,0],[1,0]].forEach(([dx, dy]) => {
        const nx = x+dx, ny = y+dy; if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) return;
        const nf = m.floor[ny*m.w+nx]; if (nf === F.WATER || nf === F.BRIDGE) return;
        g.fillStyle = 'rgba(210,200,160,0.55)';
        if (dy) g.fillRect(x*T, y*T + (dy > 0 ? T-3 : 0), T, 3); else g.fillRect(x*T + (dx > 0 ? T-3 : 0), y*T, 3, T);
      });
    }
    // hill shading (light from the north-west)
    if (m.hc) for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const W = m.w + 1, h = m.hc, dzdx = (h[y*W+x+1] + h[(y+1)*W+x+1] - h[y*W+x] - h[(y+1)*W+x]) / 2, dzdy = (h[(y+1)*W+x] + h[(y+1)*W+x+1] - h[y*W+x] - h[y*W+x+1]) / 2;
      const sh = Math.max(-0.35, Math.min(0.35, (dzdx + dzdy) / 90));
      if (Math.abs(sh) > 0.02) { g.fillStyle = sh > 0 ? `rgba(0,0,0,${sh})` : `rgba(255,250,230,${-sh * 0.6})`; g.fillRect(x*T, y*T, T, T); }
    }
  }
  // decals (scorch, blood, rubble) get burned permanently into the ground canvas
  decal(type, x, y, r, ang) {
    const g = this.gctx; g.save();
    if (type === 'scorch') {
      const grd = g.createRadialGradient(x, y, 0, x, y, r); grd.addColorStop(0, 'rgba(10,8,5,0.75)'); grd.addColorStop(0.6, 'rgba(25,20,15,0.4)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    } else if (type === 'blood') {
      g.fillStyle = 'rgba(110,10,10,0.55)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(x + (Math.random()-0.5)*r, y + (Math.random()-0.5)*r, 2 + Math.random()*r*0.35, 0, 7); g.fill(); }
    } else if (type === 'hole') {
      g.fillStyle = 'rgba(20,20,20,0.6)'; g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill();
    } else if (type === 'rubble') {
      for (let i = 0; i < 14; i++) { g.fillStyle = Tex.shade(r, 0.6 + Math.random()*0.6); const s = 2 + Math.random()*5; g.fillRect(x + Math.random()*T - s/2, y + Math.random()*T - s/2, s, s); }
    } else if (type === 'burn') {
      g.fillStyle = 'rgba(20,15,10,0.5)'; g.fillRect(x, y, T, T);
    }
    g.restore();
  }
  objColor(o, tint) {
    switch (o) {
      case O.BRICK: return '#8b4a35'; case O.CONCRETE: return '#9a9893'; case O.WOODWALL: return '#6e4b2a';
      case O.PLYWOOD: return '#c7a26b'; case O.MUDBRICK: return '#a8875c'; case O.BARNWALL: return '#8e2b22';
      case O.WHITEWOOD: return '#d9d4c7'; case O.CRATE: return '#9a7240'; case O.HAY: return '#d0b04a';
      case O.SANDBAG: return '#a89a6e'; case O.CONTAINER: return ['#8a3324','#2d5a7a','#4f6b2e','#a0742a','#6a6e72'][tint % 5];
      case O.CAR: return ['#7a1a1a','#203a6a','#c8c8c8','#2a2a2a','#5a6a3a'][tint % 5];
      case O.BUSH: return '#3f6a2a'; case O.WHEAT: return '#c8ac56'; case O.TREE: case O.PINE: return '#4a3520'; case O.PALM: return '#7a6040';
      case O.FENCE: case O.LOG: case O.TABLE: return '#7a5a36'; case O.WINDOW: return '#9fc3d8'; case O.BARREL: return '#8a2a1a'; case O.CHAINLINK: return '#8a9096';
      case O.METALWALL: return '#7d8489'; case O.RUIN: return '#7f8370'; case O.HAYPILE: return '#c9a845';
      case O.HEDGE: return '#2f5a24'; case O.WIRE: return '#6b6e70'; case O.HEDGEHOG: return '#4a4844'; case O.STUCCO: return '#e3d9c2'; case O.FIELDSTONE: return '#8f877a';
      default: return '#777777';
    }
  }
  redrawObjects(x0, y0, w, h) {
    if (!this.octx) return;
    const m = this.m, g = this.octx;
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); const x1 = Math.min(m.w, x0 + w), y1 = Math.min(m.h, y0 + h);
    g.save(); g.beginPath(); g.rect(x0*T, y0*T, (x1-x0)*T, (y1-y0)*T); g.clip();
    g.clearRect(x0*T, y0*T, (x1-x0)*T, (y1-y0)*T);
    // shadows first (cast to the south-east)
    for (let y = y0 - 1; y < y1; y++) for (let x = x0 - 1; x < x1; x++) {
      if (x < 0 || y < 0) continue; const o = m.obj[y*m.w+x]; if (!o) continue; const mt = MAT[o]; if (mt.top || mt.frame || mt.mesh) continue;
      g.fillStyle = 'rgba(0,0,0,0.28)';
      const off = mt.low ? 3 : mt.canopy ? 0 : 6;
      if (mt.round) { g.beginPath(); g.arc(x*T + T/2 + off, y*T + T/2 + off, mt.round, 0, 7); g.fill(); }
      else g.fillRect(x*T + off, y*T + off, T, T);
    }
    for (let y = y0 - 1; y < y1 + 1; y++) for (let x = x0 - 1; x < x1 + 1; x++) {
      if (x < 0 || y < 0 || x >= m.w || y >= m.h) continue;
      const i = y*m.w+x, o = m.obj[i]; if (!o) continue;
      this.drawObj(g, o, x, y, m.tint[i], m.hp[i] / MAT[o].hp);
    }
    g.restore();
  }
  same(x, y, o) { const m = this.m; if (x < 0 || y < 0 || x >= m.w || y >= m.h) return false; const n = m.obj[y*m.w+x]; return n === o || (MAT[o] && MAT[o].wall && MAT[n] && MAT[n].wall); }
  drawObj(g, o, x, y, tint, hpf) {
    const px = x*T, py = y*T, mt = MAT[o], r = hash2(x, y, 2);
    g.save();
    switch (o) {
      case O.BUSH: case O.HAYPILE: break; // drawn in the overlay pass (above soldiers)
      case O.WHEAT:
        for (let k = 0; k < 9; k++) { const wx = px + hash2(x*3+k, y, tint)*T, wy = py + hash2(x, y*3+k, tint)*T; g.strokeStyle = Tex.shade('#c8ac56', 0.75 + hash2(k, x, y)*0.5); g.lineWidth = 2; g.beginPath(); g.moveTo(wx, wy+5); g.lineTo(wx+2, wy-4); g.stroke(); g.fillStyle = '#dcc070'; g.beginPath(); g.ellipse(wx+2, wy-5, 1.5, 3, 0.3, 0, 7); g.fill(); }
        break;
      case O.TREE: case O.PINE: case O.PALM: // trunk only; canopy in overlay
        g.fillStyle = o === O.PALM ? '#7a6040' : '#4a3520'; g.beginPath(); g.arc(px+T/2, py+T/2, o === O.PALM ? 6 : 8, 0, 7); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.arc(px+T/2-2, py+T/2-2, 3, 0, 7); g.fill();
        break;
      case O.ROCK: case O.STONE: {
        const rr = mt.round; const grd = g.createRadialGradient(px+T/2-4, py+T/2-5, 2, px+T/2, py+T/2, rr+2);
        grd.addColorStop(0, '#a8a59e'); grd.addColorStop(1, '#5e5b55'); g.fillStyle = grd;
        g.beginPath(); for (let k = 0; k < 9; k++) { const a = k/9*Math.PI*2, d = rr * (0.8 + hash2(x*9+k, y, 4)*0.35); g.lineTo(px+T/2+Math.cos(a)*d, py+T/2+Math.sin(a)*d); } g.closePath(); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.3)'; g.stroke();
        break; }
      case O.FENCE: {
        g.fillStyle = '#7a5a36'; const hor = this.same(x-1, y, o) || this.same(x+1, y, o) || !(this.same(x, y-1, o) || this.same(x, y+1, o));
        if (hor) { g.fillRect(px, py+T/2-2, T, 4); g.fillStyle = '#5a3f22'; g.fillRect(px+2, py+T/2-4, 4, 8); g.fillRect(px+T-6, py+T/2-4, 4, 8); }
        else { g.fillRect(px+T/2-2, py, 4, T); g.fillStyle = '#5a3f22'; g.fillRect(px+T/2-4, py+2, 8, 4); g.fillRect(px+T/2-4, py+T-6, 8, 4); }
        break; }
      case O.CHAINLINK: {
        const hor = !(this.same(x, y-1, o) || this.same(x, y+1, o));
        g.strokeStyle = 'rgba(190,195,200,0.7)'; g.lineWidth = 1;
        if (hor) { for (let k = 0; k < T; k += 4) { g.beginPath(); g.moveTo(px+k, py+T/2-3); g.lineTo(px+k+4, py+T/2+3); g.moveTo(px+k+4, py+T/2-3); g.lineTo(px+k, py+T/2+3); g.stroke(); } g.fillStyle = '#8a9096'; g.fillRect(px, py+T/2-1, 3, 3); }
        else { for (let k = 0; k < T; k += 4) { g.beginPath(); g.moveTo(px+T/2-3, py+k); g.lineTo(px+T/2+3, py+k+4); g.moveTo(px+T/2-3, py+k+4); g.lineTo(px+T/2+3, py+k); g.stroke(); } g.fillStyle = '#8a9096'; g.fillRect(px+T/2-1, py, 3, 3); }
        break; }
      case O.CRATE: {
        g.fillStyle = '#9a7240'; g.fillRect(px+2, py+2, T-4, T-4); g.strokeStyle = '#5e4322'; g.lineWidth = 2; g.strokeRect(px+3, py+3, T-6, T-6);
        g.beginPath(); g.moveTo(px+3, py+3); g.lineTo(px+T-3, py+T-3); g.moveTo(px+T-3, py+3); g.lineTo(px+3, py+T-3); g.stroke();
        g.fillStyle = 'rgba(255,240,200,0.12)'; g.fillRect(px+3, py+3, T-6, 3);
        break; }
      case O.HAY: {
        g.fillStyle = '#c9a845'; g.fillRect(px+1, py+3, T-2, T-6);
        g.strokeStyle = 'rgba(120,90,20,0.6)'; for (let k = 0; k < 10; k++) { g.beginPath(); const yy = py+4+k*2.4; g.moveTo(px+2, yy); g.lineTo(px+T-2, yy + (hash2(x+k, y, 8)-0.5)*2); g.stroke(); }
        g.fillStyle = '#7a5a2a'; g.fillRect(px+8, py+3, 2, T-6); g.fillRect(px+T-10, py+3, 2, T-6);
        break; }
      case O.SANDBAG: {
        g.fillStyle = '#9e9068';
        for (let k = 0; k < 3; k++) for (let l = 0; l < 2; l++) { g.beginPath(); g.ellipse(px + 6 + l*12 + (k%2)*6 - 2, py + 6 + k*10, 7, 5, 0, 0, 7); g.fillStyle = Tex.shade('#a89a6e', 0.85 + hash2(x*3+k, y*5+l, 1)*0.3); g.fill(); g.strokeStyle = 'rgba(60,50,30,0.5)'; g.stroke(); }
        break; }
      case O.WINDOW: {
        g.fillStyle = '#5e5a55'; g.fillRect(px, py, T, T);
        g.fillStyle = 'rgba(160,200,230,0.75)'; const hor = this.same(x-1, y, O.BRICK) || this.same(x+1, y, o) || this.same(x-1, y, o);
        if (hor) g.fillRect(px, py+T/2-4, T, 8); else g.fillRect(px+T/2-4, py, 8, T);
        g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(px+4, py+T/2-3, 6, 2);
        break; }
      case O.BROKENWIN: {
        g.fillStyle = '#4e4a45'; g.fillRect(px, py, 4, T); g.fillRect(px+T-4, py, 4, T); g.fillRect(px, py, T, 4); g.fillRect(px, py+T-4, T, 4);
        g.fillStyle = 'rgba(180,215,240,0.6)'; for (let k = 0; k < 5; k++) g.fillRect(px + hash2(x, y, k)*T, py + hash2(y, x, k)*T, 2, 2);
        break; }
      case O.CONTAINER: {
        const c = this.objColor(o, tint); g.fillStyle = c; g.fillRect(px, py, T, T);
        g.fillStyle = 'rgba(0,0,0,0.22)'; for (let k = 2; k < T; k += 5) g.fillRect(px + k, py, 2, T);
        if (!this.same(x, y-1, o)) { g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(px, py, T, 2); }
        if (!this.same(x, y+1, o)) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(px, py+T-2, T, 2); }
        if (!this.same(x-1, y, o)) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(px, py, 3, T); }
        if (!this.same(x+1, y, o)) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(px+T-3, py, 3, T); }
        break; }
      case O.CAR: {
        const c = this.objColor(o, tint), left = this.same(x+1, y, o) && !this.same(x-1, y, o);
        const cx = left ? px + T : px; // car spans two tiles: draw once from left tile
        if (!left && this.same(x-1, y, o)) break;
        g.fillStyle = '#111'; [[-24, -14], [16, -14], [-24, 11], [16, 11]].forEach(([dx, dy]) => g.fillRect(cx+dx, py+T/2+dy, 9, 4));
        g.fillStyle = c; g.beginPath(); g.roundRect ? g.roundRect(cx-29, py+T/2-12, 58, 24, 7) : g.rect(cx-29, py+T/2-12, 58, 24); g.fill();
        g.fillStyle = 'rgba(30,45,60,0.85)'; g.fillRect(cx-10, py+T/2-10, 8, 20); g.fillRect(cx+10, py+T/2-10, 5, 20);
        g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(cx-27, py+T/2-10, 54, 4);
        g.fillStyle = '#f3e7a0'; g.fillRect(cx+26, py+T/2-10, 3, 5); g.fillRect(cx+26, py+T/2+5, 3, 5);
        if (hpf < 0.5) { g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.arc(cx, py+T/2, 10, 0, 7); g.fill(); }
        break; }
      case O.BARREL: {
        const grd = g.createRadialGradient(px+T/2-3, py+T/2-3, 1, px+T/2, py+T/2, 12); grd.addColorStop(0, '#d0402a'); grd.addColorStop(1, '#7a1a10');
        g.fillStyle = grd; g.beginPath(); g.arc(px+T/2, py+T/2, 11, 0, 7); g.fill();
        g.strokeStyle = '#4a0a05'; g.lineWidth = 1.5; g.beginPath(); g.arc(px+T/2, py+T/2, 7, 0, 7); g.stroke();
        g.fillStyle = '#e8c33a'; g.fillRect(px+T/2-1, py+T/2-5, 2, 4);
        break; }
      case O.LOG: {
        const left = !this.same(x-1, y, o);
        g.fillStyle = '#5a4128'; g.fillRect(px, py+T/2-8, T, 16);
        g.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 0; k < 4; k++) g.fillRect(px, py+T/2-6+k*4, T, 1);
        if (left) { g.fillStyle = '#b08a5a'; g.beginPath(); g.ellipse(px+2, py+T/2, 3, 8, 0, 0, 7); g.fill(); }
        break; }
      case O.HEDGE: for (let k = 0; k < 10; k++) { g.fillStyle = Tex.shade('#2f5a24', 0.8 + hash2(x * 3 + k, y, 4) * 0.5); g.beginPath(); g.arc(px + hash2(x, y, k) * T, py + hash2(y, x, k) * T, 6 + hash2(k, x, y) * 5, 0, 7); g.fill(); } break;
      case O.WIRE: g.strokeStyle = 'rgba(120,120,120,0.9)'; g.lineWidth = 1; for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(px + 4 + k * 8, py + T / 2, 5, 9, 0, 0, 7); g.stroke(); } break;
      case O.HEDGEHOG: g.strokeStyle = '#3e3c38'; g.lineWidth = 4; g.beginPath(); g.moveTo(px + 4, py + 4); g.lineTo(px + T - 4, py + T - 4); g.moveTo(px + T - 4, py + 4); g.lineTo(px + 4, py + T - 4); g.moveTo(px + T / 2, py + 2); g.lineTo(px + T / 2, py + T - 2); g.stroke(); break;
      case O.TABLE: g.fillStyle = '#6a4a2a'; g.fillRect(px+3, py+5, T-6, T-10); g.fillStyle = 'rgba(255,230,190,0.15)'; g.fillRect(px+3, py+5, T-6, 3); break;
      default: { // walls
        const c = this.objColor(o, tint);
        g.fillStyle = c; g.fillRect(px, py, T, T);
        if (o === O.BRICK) { g.fillStyle = 'rgba(30,15,10,0.35)'; for (let row = 0; row < 4; row++) { g.fillRect(px, py + row*8 + 7, T, 1); for (let k = (row % 2) * 8; k < T; k += 16) g.fillRect(px + k, py + row*8, 1, 8); }
          for (let k = 0; k < 12; k++) { g.fillStyle = `rgba(${hash2(x,k,y)<0.5?'0,0,0':'255,200,170'},0.07)`; g.fillRect(px + hash2(x, y, k)*28, py + Math.floor(hash2(y, x, k)*4)*8, 15, 7); } }
        else if (o === O.CONCRETE) { for (let k = 0; k < 30; k++) { g.fillStyle = `rgba(0,0,0,${0.03 + hash2(x*5+k, y, 3)*0.05})`; g.fillRect(px + hash2(x, k, y)*T, py + hash2(k, y, x)*T, 2, 2); } }
        else if (o === O.METALWALL) { const vert = this.same(x, y-1, o) || this.same(x, y+1, o); for (let k = 0; k < T; k += 4) { g.fillStyle = k % 8 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.22)'; vert ? g.fillRect(px, py + k, T, 2) : g.fillRect(px + k, py, 2, T); } g.fillStyle = 'rgba(120,70,40,0.15)'; g.fillRect(px + hash2(x, y, 9)*20, py + hash2(y, x, 9)*20, 10, 8); }
        else if (o === O.RUIN) { g.fillStyle = 'rgba(30,30,20,0.35)'; for (let row = 0; row < 3; row++) { g.fillRect(px, py + row*11 + 10, T, 1); for (let k = (row % 2) * 9; k < T; k += 18) g.fillRect(px + k, py + row*11, 1, 10); }
          for (let k = 0; k < 7; k++) { g.fillStyle = `rgba(70,${100 + hash2(x, k, y)*40 | 0},40,0.35)`; g.beginPath(); g.arc(px + hash2(x, y, k+40)*T, py + hash2(y, x, k+40)*T, 2 + hash2(k, x, y)*4, 0, 7); g.fill(); } }
        else if (o === O.MUDBRICK) { g.fillStyle = 'rgba(80,60,30,0.25)'; for (let row = 0; row < 3; row++) g.fillRect(px, py + row*11 + 10, T, 1); for (let k = 0; k < 20; k++) { g.fillStyle = 'rgba(255,240,200,0.08)'; g.fillRect(px + hash2(x, y, k)*T, py + hash2(y, k, x)*T, 3, 2); } }
        else { const vert = this.same(x, y-1, o) || this.same(x, y+1, o); g.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 6; k < T; k += 7) vert ? g.fillRect(px + k, py, 1, T) : g.fillRect(px, py + k, T, 1); }
        // bevels: lighter top edge, darker bottom edge where the wall ends
        if (!this.same(x, y-1, o)) { g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(px, py, T, 3); }
        if (!this.same(x, y+1, o)) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(px, py+T-3, T, 3); }
        if (!this.same(x-1, y, o)) { g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(px, py, 2, T); }
        if (!this.same(x+1, y, o)) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(px+T-2, py, 2, T); }
      }
    }
    // damage cracks
    if (hpf < 0.75 && !mt.top && !mt.frame && mt.hp < 1e8) {
      g.strokeStyle = `rgba(0,0,0,${0.6 - hpf*0.5})`; g.lineWidth = 1;
      const n = Math.floor((1 - hpf) * 6);
      for (let k = 0; k < n; k++) { g.beginPath(); let cx = px + hash2(x, y, k+20)*T, cy = py + hash2(y, x, k+30)*T; g.moveTo(cx, cy); for (let s = 0; s < 3; s++) { cx += (hash2(k, s, x)-0.5)*14; cy += (hash2(s, k, y)-0.5)*14; g.lineTo(cx, cy); } g.stroke(); }
    }
    g.restore();
  }
  // minimap preview
  static preview(map, canvas) {
    const g = canvas.getContext('2d'), sx = canvas.width / map.w, sy = canvas.height / map.h;
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      const o = map.obj[y*map.w+x];
      let col = FLOOR_INFO[map.floor[y*map.w+x]].mm;
      if (o) { const mt = MAT[o]; if (o === O.BUSH) col = '#3e5a26'; else if (o === O.WHEAT || o === O.HAYPILE) col = '#b39a4a'; else if (mt.canopy) col = '#2c4a1e'; else if (mt.wall) col = '#222'; else if (o === O.ROCK || o === O.STONE) col = '#777'; else col = '#444'; }
      g.fillStyle = col; g.fillRect(Math.floor(x*sx), Math.floor(y*sy), Math.ceil(sx), Math.ceil(sy));
      if (map.hc) { const W = map.w + 1, h = map.hc, sl = ((h[y*W+x+1] - h[y*W+x]) + (h[(y+1)*W+x] - h[y*W+x])) / 60, el = Math.min(0.25, (map.base[y*map.w+x] || 0) / 1200);
        if (sl > 0.02) { g.fillStyle = `rgba(0,0,0,${Math.min(0.4, sl)})`; g.fillRect(Math.floor(x*sx), Math.floor(y*sy), Math.ceil(sx), Math.ceil(sy)); }
        if (el > 0.02) { g.fillStyle = `rgba(255,255,255,${el})`; g.fillRect(Math.floor(x*sx), Math.floor(y*sy), Math.ceil(sx), Math.ceil(sy)); } }
    }
    if (map.zone) { g.strokeStyle = '#ffd34a'; g.lineWidth = 2; g.beginPath(); g.arc(map.zone.x/T*sx, map.zone.y/T*sy, map.zone.r/T*sx, 0, 7); g.stroke(); }
    g.fillStyle = '#4caf50'; map.spawns[0].forEach(s => g.fillRect(s.x/T*sx-2, s.y/T*sy-2, 4, 4));
    g.fillStyle = '#e53935'; map.spawns[1].forEach(s => g.fillRect(s.x/T*sx-2, s.y/T*sy-2, 4, 4));
  }
}
