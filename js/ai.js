// ============================================================================
// AI bots: perception, A* pathfinding, combat behaviour, utilities.
// ============================================================================
const BOT_NAMES = ['Viper', 'Ghost', 'Hawk', 'Reaper', 'Nomad', 'Bishop', 'Raven', 'Saber', 'Havoc', 'Atlas', 'Cobra', 'Duke',
  'Echo', 'Fang', 'Grizzly', 'Hunter', 'Jackal', 'Kodiak', 'Lynx', 'Maverick', 'Onyx', 'Phantom', 'Rook', 'Spectre', 'Talon', 'Wolf'];

// Pick bot gear "around the same quality" as the reference tier (avg unlock level).
function botLoadout(tier, rnd) {
  rnd = rnd || Math.random;
  const pick = (cat, filter) => {
    let pool = Object.values(ITEMS).filter(it => it.cat === cat && (!filter || filter(it)));
    let near = pool.filter(it => it.level >= tier - 6 && it.level <= tier + 3);
    if (!near.length) { pool.sort((a, b) => Math.abs(a.level - tier) - Math.abs(b.level - tier)); near = pool.slice(0, 3); }
    return near[Math.floor(rnd() * near.length)].id;
  };
  const lo = {
    primary: pick('primary', it => it.type !== 'Heavy Machine Gun' || tier >= 38),
    sidearm1: pick('sidearm'), sidearm2: rnd() < 0.4 ? pick('sidearm') : null,
    melee: pick('melee'), armor: tier < 2 ? 'noarmor' : pick('armor', it => it.id !== 'eod' || rnd() < 0.15),
    utils: [],
  };
  const utilPool = Object.values(ITEMS).filter(it => it.cat === 'utility' && it.level <= tier + 3);
  for (let k = 0; k < 3; k++) { if (k === 2 && rnd() < 0.3) { lo.utils.push(null); continue; } lo.utils.push(utilPool[Math.floor(rnd() * utilPool.length)].id); }
  // night gear and special rounds of a comparable level
  const gearPool = Object.values(ITEMS).filter(it => it.cat === 'gear' && it.vision && it.level <= tier + 2);
  lo.gear = gearPool.length && rnd() < 0.55 ? gearPool[Math.floor(rnd() * gearPool.length)].id : 'nogear';
  lo.ammo = {}; lo.att = {};
  // attachments of a comparable level
  [lo.primary, lo.sidearm1, lo.sidearm2].forEach(g => {
    if (!g) return; const fit = {};
    attachmentsFor(g).filter(a => a.level <= tier + 2).forEach(a => { if (!fit[a.slot] && rnd() < 0.35) fit[a.slot] = a.id; });
    if (Object.keys(fit).length) lo.att[g] = fit;
  });
  [lo.primary, lo.sidearm1, lo.sidearm2].forEach(g => {
    if (!g || rnd() < 0.55) return;
    const pool = ammoForGun(g).filter(a => a.level <= tier + 2 && !['illum', 'smoke40'].includes(a.kind));
    if (pool.length) lo.ammo[g] = pool[Math.floor(rnd() * pool.length)].id;
  });
  return lo;
}

class Heap {
  constructor() { this.a = []; }
  push(n, f) { const a = this.a; a.push([f, n]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top[1]; }
  get size() { return this.a.length; }
}

// storey a point is on (0 = ground, 1 = first floor...), measured from the ground under it
function floorLevel(m, x, y, z) {
  const tx = Math.max(0, Math.min(m.w - 1, Math.floor(x / T))), ty = Math.max(0, Math.min(m.h - 1, Math.floor(y / T)));
  return Math.max(0, Math.min(4, Math.round(((z || 0) - (m.base ? m.base[ty * m.w + tx] : 0)) / SH)));
}
// path between two points, possibly on different floors: walk to a staircase, climb (or descend) it one storey at a time
function planPath(g, u, goal) {
  const m = g.map, c = i => ({ x: (i % m.w) * T + T / 2, y: ((i / m.w) | 0) * T + T / 2 });
  let lu = floorLevel(m, u.x, u.y, u.z), lg = floorLevel(m, goal.x, goal.y, goal.z);
  if (lu === lg || !m.stairs.length) return findPath(g, u.x, u.y, goal.x, goal.y, 7000, lu);
  const out = []; let cx = u.x, cy = u.y;
  for (let guard = 0; lu !== lg && guard < 5; guard++) {
    const up = lg > lu, lvl = up ? lu : lu - 1;
    let best = null, bd = 1e9;
    for (const s of m.stairs) {
      if ((s.level || 0) !== lvl) continue;
      const from = c(up ? s.approach : s.landing), to = c(up ? s.landing : s.approach);
      const d = Math.hypot(from.x - cx, from.y - cy) + Math.hypot(to.x - goal.x, to.y - goal.y);
      if (d < bd) { bd = d; best = s; }
    }
    if (!best) break;
    const from = c(up ? best.approach : best.landing), to = c(up ? best.landing : best.approach), steps = best.tiles.map(c);
    out.push(...(findPath(g, cx, cy, from.x, from.y, 7000, lu) || []), from, ...(up ? steps : steps.slice().reverse()), to);
    cx = to.x; cy = to.y; lu += up ? 1 : -1;
  }
  out.push(...(findPath(g, cx, cy, goal.x, goal.y, 7000, lu) || []));
  return out;
}

// level 0 = ground, 1+ = upper floors of buildings
function findPath(game, sx, sy, gx, gy, maxNodes, level) {
  const m = game.map, W = m.w, H = m.h;
  const s = Math.floor(sy / T) * W + Math.floor(sx / T);
  let goal = Math.floor(gy / T) * W + Math.floor(gx / T);
  // upper floors: a floor slab, no wall, and not the bottom of a flight of stairs that starts on this floor
  const rampHere = i => { const sa = m.stairAt && m.stairAt.get(i); return sa && sa.some(si => (m.stairs[si].level || 0) === level); };
  const walk = level >= 1 ? (i => { const o = m.obj[i]; return (m.slabs[i] >> level & 1) && !(o && (MAT[o].wall || o === O.WINDOW)) && !rampHere(i); })
    : (i => !game.solidTile(i % W, (i / W) | 0) && !game.steepTile(i % W, (i / W) | 0));
  if (!walk(goal)) { // nearest walkable tile to goal
    const gx0 = goal % W, gy0 = (goal / W) | 0; let found = -1;
    for (let r = 1; r < 6 && found < 0; r++) for (let dy = -r; dy <= r && found < 0; dy++) for (let dx = -r; dx <= r; dx++) { const x = gx0 + dx, y = gy0 + dy; if (x >= 0 && y >= 0 && x < W && y < H && walk(y * W + x)) { found = y * W + x; break; } }
    if (found < 0) return null; goal = found;
  }
  if (!game._pf || game._pf.n !== W * H) game._pf = { n: W * H, g: new Float32Array(W * H), came: new Int32Array(W * H), closed: new Uint8Array(W * H) };
  const { g, came, closed } = game._pf; g.fill(1e9); came.fill(-1); closed.fill(0);
  const heap = new Heap(); g[s] = 0; heap.push(s, 0);
  const gxT = goal % W, gyT = (goal / W) | 0;
  let n = 0;
  maxNodes = Math.max(maxNodes || 6000, (W * H * 0.35) | 0);
  while (heap.size && n++ < maxNodes) {
    const c = heap.pop(); if (c === goal) break; if (closed[c]) continue; closed[c] = 1;
    const cx = c % W, cy = (c / W) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx; if (closed[ni] || !walk(ni)) continue;
      if (dx && dy && (!walk(cy * W + nx) || !walk(ny * W + cx))) continue; // no corner cutting
      let cost = dx && dy ? 1.414 : 1;
      const o = m.obj[ni]; if (o && MAT[o].slow) cost *= 1.2; if (o === O.BROKENWIN) cost *= 4; // climbing through a window is slow: prefer doors
      const ng = g[c] + cost;
      if (ng < g[ni]) { g[ni] = ng; came[ni] = c; heap.push(ni, ng + Math.hypot(nx - gxT, ny - gyT)); }
    }
  }
  if (came[goal] < 0 && goal !== s) return null;
  const path = []; let c = goal; while (c !== s && c >= 0) { path.push({ x: (c % W) * T + T / 2, y: ((c / W) | 0) * T + T / 2 }); c = came[c]; }
  return path.reverse();
}

class BotBrain {
  constructor(game, u) {
    this.g = game; this.u = u; this.skill = 0.7 + Math.random() * 0.3;
    // search & destroy: about a quarter of each team stays home to defend the castle
    const mates = game.units.filter(o => o.team === u.team && o.isBot);
    this.role = mates.indexOf(u) % 4 === 3 ? 'defend' : 'attack';
    this.reset();
  }
  reset() {
    this.target = null; this.lastSeen = null; this.path = null; this.pathT = 0; this.goal = null;
    this.strafe = Math.random() < 0.5 ? 1 : -1; this.strafeT = 0; this.react = 0; this.perceiveT = 0;
    this.aimOff = 0; this.nadeCd = 3 + Math.random() * 4; this.stuckT = 0; this.lastPos = { x: this.u.x, y: this.u.y }; this.detour = null;
    this.burstT = 0; this.pauseT = 0; this.stance = 'stand'; this.stanceT = 0; this.jumpT = 0;
  }
  weapon() { return ITEMS[this.u.slots[this.u.slot]]; }
  prefRange(it) {
    if (!it || it.cat === 'melee') return 30;
    if (it.flame) return 130; if (it.pellets) return 170; if (it.cat === 'sidearm') return it.type === 'Submachine Gun' ? 240 : 300;
    if (it.scope) return 650; if (it.explosive) return 420; return 380;
  }
  canSee(o) {
    const u = this.u, g = this.g, d = Math.hypot(o.x - u.x, o.y - u.y);
    if (d > 1100) return false;
    if (u.flashT > 0.5) return false;
    if (!g.visibleTo(u, o)) return false; // darkness, night gear, concealment in hay / bushes
    const th = g.thermal(u), ez = eyeZ(u);
    return g.los(u.x, u.y, o.x, o.y, th, false, ez, midZ(o)) || g.los(u.x, u.y, o.x, o.y, th, false, ez, o.z + STANCES[o.stance || 'stand'].h - 4);
  }
  perceive() {
    const g = this.g, u = this.u;
    let best = null, bd = 1e9;
    for (const o of g.units) {
      if (!o.alive || o === u || !g.enemies(u, o)) continue;
      const d = Math.hypot(o.x - u.x, o.y - u.y);
      // hear gunfire nearby (and see muzzle flashes from further away at night)
      if (g.time - o.lastShotT < 0.6 && d < (g.night ? 950 : 700) && (!this.lastSeen || g.time - this.lastSeen.t > 2)) this.lastSeen = { x: o.x, y: o.y, z: o.z, t: g.time - 1 };
      if (d < bd && this.canSee(o)) { bd = d; best = o; }
    }
    if (best && best !== this.target) this.react = (0.5 + Math.random() * 0.45) / this.skill;
    this.target = best;
    if (best) this.lastSeen = { x: best.x, y: best.y, z: best.z, t: g.time };
  }
  think(dt) {
    const g = this.g, u = this.u;
    const inp = { mx: 0, my: 0, ax: u.x + Math.cos(u.angle) * 100, ay: u.y + Math.sin(u.angle) * 100, fire: false, slot: null, reload: false, utils: [], melee: false, scope: false, pitch: 0, stance: 'stand', jump: false };
    this.perceiveT -= dt; if (this.perceiveT <= 0) { this.perceiveT = g.units.length > 14 ? 0.3 : 0.15; this.perceive(); }
    this.react -= dt; this.nadeCd -= dt; this.strafeT -= dt; this.pathT -= dt;
    let it = this.weapon();
    const t = this.target && this.target.alive ? this.target : null;
    // stuck detection
    this.stuckT += dt;
    if (this.stuckT > 1) {
      const moved = Math.hypot(u.x - this.lastPos.x, u.y - this.lastPos.y);
      if (moved < 12 && this.wantMove) {
        this.jumpT = 0.25; this.stuckN = (this.stuckN || 0) + 1;
        if (Math.random() < 0.5) { this.path = null; this.detour = { a: Math.random() * 6.28, t: 0.6 }; }
        if (this.stuckN >= 3) { this.goal = null; this.lastSeen = null; this.stuckN = 0; } // stuck for a while: pick somewhere else to go
      } else this.stuckN = 0;
      this.lastPos = { x: u.x, y: u.y }; this.stuckT = 0;
    }

    // heal when safe
    if (!t && u.hp < 55 && u.healT <= 0) { const s = u.utils.findIndex(x => x && ITEMS[x].kind === 'heal'); if (s >= 0) inp.utils.push(s); }
    // reload when no target
    if (!t && it && it.mag && u.mag[u.slot] < it.mag * 0.5) inp.reload = true;
    // switch back to primary when calm
    if (!t && u.slot !== 0 && u.slots[0] && u.mag[0] > 0) inp.slot = 0;

    let moveTo = null;
    this.wantMove = true;
    // search & destroy: when no enemy is in sight, attack the enemy castle if it is in reach
    // the closest enemy castle this team has found (any enemy castle if none found yet)
    let eb = null;
    if (g.bases.length) { const cand = g.bases.filter(b => b.team !== u.team && b.hp > 0); const seen = cand.filter(b => b.seen[u.team]); eb = (seen.length ? seen : cand).sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))[0] || null; }
    if (eb && eb.seen[u.team] && this.role === 'attack' && (!t || Math.hypot(t.x - u.x, t.y - u.y) > 380)) {
      const d = Math.hypot(eb.x - u.x, eb.y - u.y);
      if (d < 520 && g.los(u.x, u.y, eb.x, eb.y, false, eb)) {
        if (it && it.cat === 'melee' && d > 80) { const s = [0, 1, 2].find(s => u.slots[s] && u.mag[s] > 0); if (s !== undefined) inp.slot = s; }
        if (it && it.mag && u.mag[u.slot] === 0) inp.reload = true;
        const ang = Math.atan2(eb.y - u.y, eb.x - u.x); inp.ax = eb.x; inp.ay = eb.y; inp.pitch = Math.atan2(35 - eyeZ(u), d);
        let da = ang - u.angle; da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) < 0.3 && it && (it.cat === 'melee' ? d < it.reach + 40 : d < (it.range || 600) * 0.9) && !(it.explosive && d < 140)) inp.fire = it.auto ? true : Math.random() < 0.5;
        const nade = u.utils.findIndex(x => x && ['frag', 'c4', 'satchel'].includes(ITEMS[x].kind));
        if (nade >= 0 && this.nadeCd <= 0 && d > 100 && d < 260) { inp.utils.push(nade); this.nadeCd = 5 + Math.random() * 4; }
        if (u.c4Live.some(Boolean) && d > 160) inp.utils.push(u.c4Live.findIndex(Boolean));
        if (d > 300) moveTo = { x: eb.x, y: eb.y }; else { const a = ang + Math.PI / 2; inp.mx = Math.cos(a) * this.strafe * 0.6; inp.my = Math.sin(a) * this.strafe * 0.6; if (this.strafeT <= 0) { this.strafe = -this.strafe; this.strafeT = 1 + Math.random(); } }
        if (moveTo === null) { this.wantMove = false; return this.finishMove(inp, null, t, dt); }
      }
    }
    if (t) {
      const d = Math.hypot(t.x - u.x, t.y - u.y);
      // weapon choice
      if (it && it.mag && u.mag[u.slot] === 0) {
        const alt = [1, 2].find(s => u.slots[s] && u.mag[s] > 0);
        if (alt !== undefined && d < 450) inp.slot = alt; else if (d < 70 && u.slots[3]) inp.slot = 3; else inp.reload = true;
      }
      if (it && it.explosive && d < 140 && u.slots[1]) inp.slot = 1;
      if (it && it.cat === 'melee' && d > 120) { const s = [0, 1, 2].find(s => u.slots[s] && u.mag[s] > 0); if (s !== undefined) inp.slot = s; }
      // aim with lead + error
      const bs = it && it.speed ? it.speed : 2000;
      const lead = Math.min(0.6, d / bs);
      const tvx = t.velX || 0, tvy = t.velY || 0;
      let ax = t.x + tvx * lead * 0.8, ay = t.y + tvy * lead * 0.8;
      this.aimOff += (Math.random() - 0.5) * dt * 4; this.aimOff *= 0.96;
      const err = (0.1 + (u.moving ? 0.05 : 0) + (t.moving ? 0.03 : 0)) / this.skill;
      const ang = Math.atan2(ay - u.y, ax - u.x) + this.aimOff * err * 2;
      inp.ax = u.x + Math.cos(ang) * d; inp.ay = u.y + Math.sin(ang) * d;
      if (it && it.lob) { inp.ax = t.x; inp.ay = t.y; }
      // vertical aim at the chest (good shots sometimes go for the head)
      const aimZ = t.z + STANCES[t.stance || 'stand'].h * (Math.random() < 0.15 * this.skill ? 0.9 : 0.62);
      inp.pitch = Math.atan2(aimZ - eyeZ(u), d) + this.aimOff * err;
      // fire control
      let da = ang - u.angle; da = Math.atan2(Math.sin(da), Math.cos(da));
      const inRange = it && (it.cat === 'melee' ? d < it.reach + 14 : d < (it.range || 600) * 0.95);
      let friendlyInWay = false;
      if (g.cfg.friendlyFire || it.explosive) for (const o of g.units) if (o !== u && o.alive && !g.enemies(u, o)) { const od = Math.hypot(o.x - u.x, o.y - u.y); if (od < d && segCircle(u.x, u.y, t.x, t.y, o.x, o.y, 18)) friendlyInWay = true; }
      if (it && it.explosive && d < 130) friendlyInWay = true;
      // only pull the trigger with a clear line of fire from the gun (not just the eyes seeing through a window gap)
      if (this.clearT === undefined || g.time - this.clearT > 0.2) { this.clearT = g.time; this.clear = it && (it.cat === 'melee' || it.lob || g.los(u.x, u.y, t.x, t.y, true, false, eyeZ(u) - 6, aimZ) || g.los(u.x, u.y, t.x, t.y, true, false, eyeZ(u) - 6, t.z + STANCES[t.stance || 'stand'].h - 6)); }
      if (this.react <= 0 && inRange && Math.abs(da) < 0.25 && !friendlyInWay && this.clear) {
        if (it.auto) { // bursts
          this.burstT -= dt;
          if (this.burstT > 0) inp.fire = true; else if (this.burstT < -0.18 / this.skill) this.burstT = 0.25 + Math.random() * 0.5;
          if (it.spinup || it.flame || d < 200) inp.fire = true;
        } else inp.fire = Math.random() < 0.5; // semi-auto: alternate press/release
      }
      if (it && it.scope && d > 300) inp.scope = true;
      // grenades
      const frag = u.utils.findIndex(x => x && ['frag', 'molotov', 'flash', 'thermite', 'gas'].includes(ITEMS[x].kind));
      if (frag >= 0 && this.nadeCd <= 0 && d > 140 && d < 450 && Math.random() < 0.02) {
        let safe = true; if (!g.ffa) for (const o of g.units) if (o !== u && o.alive && !g.enemies(u, o) && Math.hypot(o.x - t.x, o.y - t.y) < 130) safe = false;
        if (safe) { inp.utils.push(frag); inp.ax = t.x; inp.ay = t.y; this.nadeCd = 6 + Math.random() * 6; }
      }
      // movement: keep preferred range, strafe
      const pr = this.prefRange(it);
      const dir = Math.atan2(t.y - u.y, t.x - u.x);
      let fwd = d > pr * 1.25 ? 1 : d < pr * 0.6 ? -0.8 : 0;
      if (it && it.cat === 'melee') fwd = 1;
      if (this.strafeT <= 0) { this.strafe = -this.strafe; this.strafeT = 0.5 + Math.random() * 1.2; if (Math.random() < 0.25) this.strafe = 0; }
      inp.mx = Math.cos(dir) * fwd + Math.cos(dir + Math.PI / 2) * this.strafe * 0.8;
      inp.my = Math.sin(dir) * fwd + Math.sin(dir + Math.PI / 2) * this.strafe * 0.8;
      // don't strafe into a wall: turn around when the way to the side is blocked
      if (this.strafe) { const sa = dir + Math.PI / 2 * Math.sign(this.strafe); if (g.collides(u.x + Math.cos(sa) * 20, u.y + Math.sin(sa) * 20, UNIT_R, u.z, 40)) { this.strafe = -this.strafe; inp.mx = Math.cos(dir) * fwd + Math.cos(dir + Math.PI / 2) * this.strafe * 0.8; inp.my = Math.sin(dir) * fwd + Math.sin(dir + Math.PI / 2) * this.strafe * 0.8; } }
      // crouch or go prone to steady longer shots; stand to move in
      this.stanceT -= dt;
      if (this.stanceT <= 0) {
        this.stanceT = 1.5 + Math.random() * 2.5;
        const steady = it && !it.pellets && !it.flame && it.cat !== 'melee' && !it.explosive && d > 260 && Math.abs((t.z || 0) - u.z) < 60;
        this.stance = steady && Math.random() < 0.55 ? (it.scope && d > 450 && Math.random() < 0.5 ? 'prone' : 'crouch') : 'stand';
      }
      if (fwd > 0 && d > pr * 1.6) this.stance = 'stand';
      inp.stance = this.stance;
      if (this.stance !== 'stand') { inp.mx *= 0.25; inp.my *= 0.25; }
      // if path blocked toward target when we want to close distance, use pathfinding
      if (fwd > 0 && d > 160 || Math.abs((t.z || 0) - u.z) > 60 || !this.clear) moveTo = { x: t.x, y: t.y, z: t.z, combat: true };
      this.path = this.path && this.pathFor === 'combat' ? this.path : null;
    } else {
      // no target: investigate, go to objective or hunt
      if (this.lastSeen && g.time - this.lastSeen.t < 8) moveTo = this.lastSeen;
      else if (g.cfg.mode === 'zone') {
        const z = g.map.zone;
        if (!this.goal || this.goalT < g.time) { const a = Math.random() * 6.28, r = Math.random() * z.r * 0.7; this.goal = { x: z.x + Math.cos(a) * r, y: z.y + Math.sin(a) * r }; this.goalT = g.time + 4 + Math.random() * 4; }
        moveTo = this.goal;
      } else if (g.bases.length) {
        // search & destroy: defenders patrol around their castle, attackers go to the enemy castle or search the enemy half
        const own = g.bases.find(b => b.team === u.team), m = g.map;
        if (!this.goal || this.goalT < g.time) {
          if (this.role === 'defend' && own && own.hp > 0) { const a = Math.random() * 6.28, r = 90 + Math.random() * 220; this.goal = { x: own.x + Math.cos(a) * r, y: own.y + Math.sin(a) * r }; }
          else if (eb && eb.seen[u.team]) { const a = Math.random() * 6.28; this.goal = { x: eb.x + Math.cos(a) * 200, y: eb.y + Math.sin(a) * 200 }; }
          else if (eb && g.teamAnchors && g.teamAnchors[eb.team]) { const A = g.teamAnchors[eb.team], a = Math.random() * 6.28, r = Math.random() * Math.min(m.w, m.h) * T * 0.3; this.goal = { x: Math.max(T, Math.min((m.w - 1) * T, A.x + Math.cos(a) * r)), y: Math.max(T, Math.min((m.h - 1) * T, A.y + Math.sin(a) * r)) }; }
          this.goalT = g.time + 6 + Math.random() * 6;
        }
        moveTo = this.goal;
      } else moveTo = this.explore();
      if (moveTo) { const a = Math.atan2(moveTo.y - u.y, moveTo.x - u.x); inp.ax = u.x + Math.cos(a) * 100; inp.ay = u.y + Math.sin(a) * 100; }
    }
    return this.finishMove(inp, moveTo, t, dt);
  }
  // no enemy in sight and nothing heard: search the map like a player would - sweep likely areas (enemy side,
  // buildings, the middle) instead of homing in on enemies through walls. Now and then a rough hint (as if
  // from footsteps or a radio report) of where someone is, a few rooms off, so matches don't stall.
  explore() {
    const g = this.g, u = this.u, m = g.map;
    if (!this.hintT) this.hintT = g.time + 25 + Math.random() * 20;
    if (g.time > this.hintT) {
      this.hintT = g.time + 25 + Math.random() * 20;
      let best = null, bd = 1e9; for (const o of g.units) if (o.alive && g.enemies(u, o)) { const d = Math.hypot(o.x - u.x, o.y - u.y); if (d < bd) { bd = d; best = o; } }
      if (best) { const a = Math.random() * 6.28, r = 120 + Math.random() * 260; this.goal = { x: Math.max(T, Math.min((m.w - 1) * T, best.x + Math.cos(a) * r)), y: Math.max(T, Math.min((m.h - 1) * T, best.y + Math.sin(a) * r)) }; this.goalT = g.time + 12; }
    }
    if (!this.goal || this.goalT < g.time || Math.hypot(this.goal.x - u.x, this.goal.y - u.y) < 40) {
      const r = Math.random(); let x, y;
      const enemies = g.ffa ? null : (g.teamAnchors || []).filter((a, t) => t !== u.team);
      if (enemies && enemies.length && r < 0.4) { const A = enemies[Math.floor(Math.random() * enemies.length)]; x = A.x / T + (Math.random() - 0.5) * m.w * 0.4; y = A.y / T + (Math.random() - 0.5) * m.h * 0.4; }
      else if (m.buildings.length && r < 0.75) { const b = m.buildings[Math.floor(Math.random() * m.buildings.length)]; x = b.x + 1 + Math.random() * (b.w - 2); y = b.y + 1 + Math.random() * (b.h - 2); }
      else { x = m.w * (0.15 + Math.random() * 0.7); y = m.h * (0.15 + Math.random() * 0.7); }
      x = Math.max(1, Math.min(m.w - 2, x)); y = Math.max(1, Math.min(m.h - 2, y));
      this.goal = { x: x * T, y: y * T }; this.goalT = g.time + 14 + Math.random() * 10;
    }
    return this.goal;
  }
  // path following, detours and hazard avoidance shared by all behaviours
  finishMove(inp, moveTo, t, dt) {
    const g = this.g, u = this.u;
    if (moveTo) {
      if (!this.path || this.pathT <= 0 || (this.pathGoal && this.pathT < 0.9 && Math.hypot(this.pathGoal.x - moveTo.x, this.pathGoal.y - moveTo.y) > 200)) {
        this.path = planPath(g, u, moveTo) || []; this.pathT = (this.path.length ? 1.2 : 2.5) + Math.random() * 0.6; this.pathGoal = { x: moveTo.x, y: moveTo.y }; this.pathFor = moveTo.combat ? 'combat' : 'move';
        // unreachable: give up on that spot rather than walking into the wall in front of it
        if (!this.path.length && Math.hypot(moveTo.x - u.x, moveTo.y - u.y) > 60 && !g.los(u.x, u.y, moveTo.x, moveTo.y, true, false, eyeZ(u), eyeZ(u))) {
          if (moveTo === this.goal) this.goal = null;
          if (moveTo === this.lastSeen) this.lastSeen = null;
          this.noPath = true;
        } else this.noPath = false;
      }
      if (this.path && this.path.length) {
        // advance waypoint
        while (this.path.length && Math.hypot(this.path[0].x - u.x, this.path[0].y - u.y) < 18) this.path.shift();
        if (this.path.length > 1 && Math.hypot(this.path[1].x - u.x, this.path[1].y - u.y) < 40) this.path.shift();
        const wp = this.path[0];
        // jump over window sills on the way
        if (wp && Math.hypot(wp.x - u.x, wp.y - u.y) < 46) { const wi = g.tileAt(wp.x, wp.y); if (wi >= 0 && g.map.obj[wi] === O.BROKENWIN && u.grounded) { this.jumpT = 0.2; this.windowT = 0.7; } }
        if (wp) {
          const a = Math.atan2(wp.y - u.y, wp.x - u.x);
          if (moveTo.combat) { inp.mx = inp.mx * 0.4 + Math.cos(a); inp.my = inp.my * 0.4 + Math.sin(a); }
          else { inp.mx = Math.cos(a); inp.my = Math.sin(a); }
          if (!t) { inp.ax = u.x + Math.cos(a) * 120; inp.ay = u.y + Math.sin(a) * 120; }
        }
      } else if (!t && !this.noPath) { const a = Math.atan2(moveTo.y - u.y, moveTo.x - u.x); inp.mx = Math.cos(a); inp.my = Math.sin(a); }
      if (!t && Math.hypot(moveTo.x - u.x, moveTo.y - u.y) < 30) { if (this.lastSeen === moveTo) this.lastSeen = null; this.wantMove = false; }
    }
    if (this.detour) { this.detour.t -= dt; inp.mx = Math.cos(this.detour.a); inp.my = Math.sin(this.detour.a); if (this.detour.t <= 0) this.detour = null; }
    if (!t) { this.stance = 'stand'; inp.stance = 'stand'; }
    if (this.windowT > 0) { this.windowT -= dt; inp.stance = 'crouch'; } // duck through window openings
    if (this.jumpT > 0) { this.jumpT -= dt; inp.jump = true; if (!(this.windowT > 0)) inp.stance = 'stand'; }
    // avoid standing in fire
    for (const f of g.fires) { const d = Math.hypot(u.x - f.x, u.y - f.y); if (d < f.r + 20) { const a = Math.atan2(u.y - f.y, u.x - f.x); inp.mx = Math.cos(a); inp.my = Math.sin(a); } }
    // flee from grenades
    for (const n of g.nades) { if (n.kind !== 'frag' && n.kind !== 'c4' && n.kind !== 'satchel') continue; if (n.kind === 'c4' && n.team === u.team) continue; const d = Math.hypot(u.x - n.x, u.y - n.y); if (d < 160) { const a = Math.atan2(u.y - n.y, u.x - n.x); inp.mx = Math.cos(a); inp.my = Math.sin(a); } }
    return inp;
  }
}
