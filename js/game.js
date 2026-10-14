// ============================================================================
// Game engine. role: 'local' (single player), 'host' (authoritative, online),
// 'client' (renders host snapshots, predicts own movement).
// ============================================================================
const UNIT_R = 12, BASE_SPEED = 200, RESPAWN_TIME = 4;
const BASE_HALF = 30; // Search & Destroy castle: 2x2 tiles
// stances: body height h, eye height, speed multiplier, accuracy multiplier
// heights match the 3D poses: standing, kneeling on one knee, lying on the belly
const STANCES = { stand: { h: 60, eye: 52, speed: 1, acc: 1 }, crouch: { h: 47, eye: 40, speed: 0.55, acc: 0.72 }, prone: { h: 17, eye: 11, speed: 0.28, acc: 0.5 } };
const STANCE_CODE = ['stand', 'crouch', 'prone'];
const JUMP_V = 280, GRAV = 900, CLIMB = 115, HEADSHOT_MUL = 2;
const eyeZ = u => u.z + STANCES[u.stance || 'stand'].eye;
// length (world px) of a gun's spent case: shotgun hulls, .50 BMG, full-power rifle, pistol/SMG, intermediate rifle
const casingLen = it => it.pellets ? 3.1 : it.cal === '50bmg' ? 5 : /54|3006|792x57|338|303|762x51/.test(it.cal || '') ? 2.8 : it.type === 'Pistol' || it.type === 'Submachine Gun' ? 1.3 : 2.3;
// ---- real exterior ballistics (32 px = 1 m) ----------------------------------------------------------------
// Each calibre has its real muzzle velocity (m/s) and a drag factor k (per metre): the bullet slows as
// v(x) = v0 * e^(-k x), while real gravity (9.81 m/s^2) bends its path down. Slow, blunt pistol and buckshot
// rounds lose speed fast and drop the most; fast, sleek rifle and sniper rounds keep their speed.
// Damage and penetration follow the energy the bullet still carries.
const GRAVITY_PX = 9.81 * 32, SLOW_BULLETS = 0.12;
// felt recoil per shot (radians of muzzle climb), from the weapon class; attachments, stance and bipods reduce it
const RECOIL = { 'Pistol': 0.024, 'Revolver': 0.04, 'Submachine Gun': 0.009, 'Assault Rifle': 0.012, 'Battle Rifle': 0.02, 'Marksman Rifle': 0.026,
  'Light Machine Gun': 0.011, 'Sniper Rifle': 0.05, 'Anti-Materiel Rifle': 0.075, 'Shotgun': 0.055, 'Heavy Machine Gun': 0.008 };
function recoilFor(it, u) {
  let r = (RECOIL[it.type] || 0.015) * (it.recoilMul || 1);
  if (it.cal === '50ae' || it.cal === '44mag') r *= 1.4;
  if (u.stance === 'crouch') r *= 0.8; else if (u.stance === 'prone') r *= 0.6;
  if (it.bipod && u.stance !== 'stand') r *= 0.5;
  return r;
}
// the spread cone (radians) a shot leaves in right now: weapon, aiming, movement, stance, sustained-fire bloom
function aimSpread(u, it, t) {
  let spread = it.spread * Math.PI / 180;
  if (u.moving) spread *= u.scoped ? 1.35 : 1.6;
  if (u.scoped) spread *= 0.5 * (it.adsSpread || 1); else spread *= it.hipSpread || 1;
  if (it.bipod && u.stance !== 'stand') spread *= it.bipod;
  if (u.flashT > 0) spread *= 3;
  if (!u.grounded && !u.onLadder) spread *= 2.2;
  spread *= STANCES[u.stance || 'stand'].acc;
  // bloom: sustained fire opens the cone, it closes again quickly when you stop or tap-fire
  const bloom = (u.bloom || 0) * Math.exp(-((t || 0) - (u.bloomT || 0)) * 4);
  return spread * (1 + bloom);
}
const BALLISTICS = {
  '556': [910, 0.0013], '545x39': [880, 0.0012], '762x39': [715, 0.0016], '762x51': [840, 0.00095], '762x54': [830, 0.001],
  '338': [905, 0.00045], '50bmg': [890, 0.00035], '792x33': [685, 0.0018], '792x57': [760, 0.0011], '3006': [840, 0.001], '303': [745, 0.0011],
  '12ga': [400, 0.009], '9mm': [370, 0.0018], '10mm': [380, 0.0016], '9x18': [315, 0.002], '45acp': [255, 0.0014], '50ae': [470, 0.0013],
  '762x38r': [270, 0.0022], '357': [440, 0.0016], '44mag': [450, 0.0014], '46x30': [720, 0.002], '57x28': [715, 0.0019],
};
// muzzle velocity (px/s) and drag (per px) for a weapon with its loaded round
function ballistics(it) {
  let [v, k] = BALLISTICS[it.cal] || [it.speed / 32, 0.0015];
  if (it.ammoKind === 'slug' || it.ammoKind === 'breach') { v = 440; k = 0.0035; }
  if (it.ammoKind === 'buck40') { v = 250; k = 0.01; }
  if (it.ammoKind === 'birdshot') k *= 1.6;
  if (it.ammoKind === 'flechette') { v = 500; k = 0.004; }
  if (it.cat === 'sidearm' && it.type === 'Submachine Gun' && ['9mm', '45acp', '10mm'].includes(it.cal)) v *= 1.08; // longer barrel than a pistol
  if ((it.type === 'Sniper Rifle' || it.type === 'Anti-Materiel Rifle') && it.cal !== '50bmg') v *= 1.03;
  if (it.ammoKind === 'ap' || it.ammoKind === 'apit' || it.ammoKind === 'match') v *= 1.03;
  return { v: v * 32, k: k / 32 };
}
const midZ = u => u.z + STANCES[u.stance || 'stand'].h * 0.6;

// Effective weapon stats with a given round loaded (null = the calibre's default round).
const _wsCache = {};
// att: { optic, muzzle, under, mag, laser } attachment ids fitted to this gun
function weaponStats(it, ammoId, att) {
  if (!it) return it;
  const ammo = ammoId && ITEMS[ammoId] && ITEMS[ammoId].cal === it.cal ? ITEMS[ammoId] : null;
  const atts = att ? Object.values(att).filter(a => a && attachFits(a, it.id)).sort() : [];
  if (!ammo && !atts.length) return it;
  const key = it.id + '|' + (ammo ? ammo.id : '') + '|' + atts.join(','); if (_wsCache[key]) return _wsCache[key];
  const w = ammo ? ammoStats(it, ammo) : Object.assign({}, it);
  if (atts.length) {
    w.atts = atts;
    for (const id of atts) {
      const a = ITEMS[id];
      if (a.dmgMul) w.dmg *= a.dmgMul;
      if (a.rangeMul) w.range *= a.rangeMul;
      if (a.spreadMul) w.spread *= a.spreadMul;
      if (a.magMul && w.mag) w.mag = Math.max(w.mag + 1, Math.round(w.mag * a.magMul));
      if (a.reloadMul) w.reload *= a.reloadMul;
      for (const f of ['suppressed', 'noFlash', 'bipod', 'laser', 'thermalSight']) if (a[f]) w[f] = a[f];
      for (const f of ['recoilMul', 'adsSpread', 'hipSpread', 'adsSpeed']) if (a[f]) w[f] = (w[f] || 1) * a[f];
      if (a.slot === 'optic') { w.optic = a; w.adsFov = a.adsFov; if (a.scopeKind === 'sniper') w.scope = true; }
    }
  }
  return (_wsCache[key] = w);
}
function ammoStats(it, ammo) {
  const k = AMMO_KINDS[ammo.kind], w = Object.assign({}, it, { ammo: ammo.id, ammoKind: ammo.kind });
  if (k.dmgMul) w.dmg = it.dmg * k.dmgMul;
  if (k.spreadMul) w.spread = it.spread * k.spreadMul;
  if (k.rangeMul) w.range = it.range * k.rangeMul;
  if (k.penMul) w.pen = it.pen * k.penMul;
  if (k.penAdd) w.pen = it.pen + k.penAdd;
  if (k.penSet !== undefined) w.pen = k.penSet;
  if (k.pelletsMul) w.pellets = Math.round((it.pellets || 1) * k.pelletsMul);
  ['armorMul', 'structMul', 'tracer', 'incendiary', 'blast', 'blastDmg', 'burnMul', 'fire'].forEach(f => { if (k[f] !== undefined) w[f === 'blast' ? 'impactBlast' : f] = k[f]; });
  if (k.blastMul) w.blast = it.blast * k.blastMul;
  if (k.slug) Object.assign(w, { pellets: 0, dmg: it.dmg * it.pellets * 0.72, spread: it.spread * 0.18, range: it.range * 1.7, pen: 1.6, speed: it.speed * 1.1 });
  if (k.breach) Object.assign(w, { pellets: 0, dmg: it.dmg * it.pellets * 0.5, spread: it.spread * 0.2, range: 110, pen: 0, structMul: 6 });
  if (k.dragon) Object.assign(w, { dragon: true, pen: 0, speed: it.speed * 0.55 });
  if (k.frag12) Object.assign(w, { pellets: 0, explosive: true, direct: true, dmg: 70, blast: 55, speed: 900, range: it.range * 1.3, spread: it.spread * 0.15 });
  if (k.buck40) Object.assign(w, { explosive: false, lob: false, pellets: 20, dmg: 22, range: 330, spread: 18, speed: 1200, pen: 0.5 });
  if (k.illum) Object.assign(w, { illum: true, dmg: 0 });
  if (k.smoke40) Object.assign(w, { smoke40: true, dmg: 0 });
  if (!w.pellets) delete w.pellets;
  return w;
}
// attachments fitted to a gun in a loadout (only real, compatible ones)
function unitAtt(lo, id) {
  const a = lo.att && lo.att[id]; if (!a || !ITEMS[id]) return null;
  const out = {}; let n = 0;
  for (const [slot] of ATT_SLOTS) if (a[slot] && attachFits(a[slot], id) && ITEMS[a[slot]].slot === slot) { out[slot] = a[slot]; n++; }
  return n ? out : null;
}
function unitAmmo(lo, id) { const a = lo.ammo && lo.ammo[id]; return a && ITEMS[a] && ITEMS[id] && ITEMS[a].cal === ITEMS[id].cal ? a : null; }

// Mouse look via pointer lock: yaw/pitch accumulate from raw mouse movement.
// ---- rebindable controls (Settings → Controls). Keys are stored as physical key codes (KeyW, ShiftLeft, ...)
const Keybinds = (() => {
  const ACTIONS = [
    ['forward', 'Move forward', 'KeyW'], ['back', 'Move back', 'KeyS'], ['left', 'Move left', 'KeyA'], ['right', 'Move right', 'KeyD'],
    ['sprint', 'Sprint', 'ShiftLeft'], ['jump', 'Jump / stand up', 'Space'], ['crouch', 'Crouch (hold: prone)', 'KeyC'],
    ['reload', 'Reload', 'KeyR'], ['melee', 'Melee', 'KeyF'], ['w1', 'Primary weapon', 'Digit1'], ['w2', 'Sidearm 1', 'Digit2'], ['w3', 'Sidearm 2', 'Digit3'], ['w4', 'Melee weapon', 'Digit4'],
    ['u1', 'Utility 1', 'Digit5'], ['u2', 'Utility 2', 'Digit6'], ['u3', 'Utility 3', 'Digit7'], ['unext', 'Select next utility', 'KeyQ'], ['uuse', 'Use selected utility', 'KeyG'],
    ['light', 'Weapon light', 'KeyL'], ['gear', 'Night vision / thermal', 'KeyN'], ['hold', 'Hold breath (scoped)', 'ShiftLeft'], ['scores', 'Scoreboard', 'Tab'],
  ];
  const SHARED = [['sprint', 'hold']]; // these may share a key (you can't sprint while scoped)
  let map = {};
  const load = () => { map = {}; ACTIONS.forEach(([id, , def]) => map[id] = def); try { Object.assign(map, JSON.parse(localStorage.getItem('fo3d-keys') || '{}')); } catch (e) {} };
  const save = () => { try { localStorage.setItem('fo3d-keys', JSON.stringify(map)); } catch (e) {} };
  const norm = c => ({ ShiftRight: 'ShiftLeft', ControlRight: 'ControlLeft', AltRight: 'AltLeft', MetaRight: 'MetaLeft' })[c] || c;
  const label = c => !c ? '—' : c.startsWith('Key') ? c.slice(3) : c.startsWith('Digit') ? c.slice(5) : c.startsWith('Numpad') ? 'Num ' + c.slice(6)
    : ({ ShiftLeft: 'Shift', ControlLeft: 'Ctrl', AltLeft: 'Alt', Space: 'Space', Tab: 'Tab', CapsLock: 'Caps Lock', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
        Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'Enter', Backspace: 'Backspace' })[c] || c;
  // bind an action; if another action already uses the key, that action takes this action's old key (a swap)
  function set(id, code) {
    code = norm(code); const old = map[id];
    for (const [o] of ACTIONS) if (o !== id && map[o] === code && !SHARED.some(p => p.includes(o) && p.includes(id))) map[o] = old;
    map[id] = code; save();
  }
  load();
  return { ACTIONS, get: id => map[id], set, label, norm, reset: () => { try { localStorage.removeItem('fo3d-keys'); } catch (e) {} load(); } };
})();
class Input {
  constructor(canvas) {
    this.keys = {}; this.lmb = false; this.rmb = false; this.wheel = 0; this.pressed = {}; this.codes = {}; this.pressedCodes = {};
    this.yaw = 0; this.pitch = 0; this.locked = false; this.unlockT = 0;
    let sens = 1; try { sens = parseFloat(localStorage.getItem('fo3d-sens')) || 1; } catch (e) {}
    this.sens = 0.0024 * sens;
    this.canvas = canvas;
    this.kd = e => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const k = e.key.toLowerCase(), c = Keybinds.norm(e.code);
      if (!this.keys[k]) this.pressed[k] = true;
      if (!this.codes[c]) this.pressedCodes[c] = true;
      this.keys[k] = true; this.codes[c] = true;
      if (['tab', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k) || c === 'Tab' || c === 'Space') e.preventDefault();
    };
    this.ku = e => { this.keys[e.key.toLowerCase()] = false; this.codes[Keybinds.norm(e.code)] = false; };
    this.mm = e => {
      if (!this.locked) return;
      this.yaw += e.movementX * this.sens * (this.zoomSens || 1);
      this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch - e.movementY * this.sens * (this.zoomSens || 1)));
    };
    this.md = e => {
      if (!this.locked) { this.lock(); return; } // first click only captures the mouse
      if (e.button === 0) this.lmb = true; if (e.button === 2) this.rmb = true; this.pressed['mouse' + e.button] = true;
    };
    this.mu = e => { if (e.button === 0) this.lmb = false; if (e.button === 2) this.rmb = false; };
    this.wh = e => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); };
    this.cm = e => e.preventDefault();
    this.blur = () => { this.keys = {}; this.codes = {}; this.lmb = this.rmb = false; };
    this.plc = () => {
      const was = this.locked; this.locked = document.pointerLockElement === canvas;
      if (was && !this.locked) { this.unlockT = performance.now(); this.lmb = this.rmb = false; this.keys = {}; this.codes = {}; if (this.onUnlock) this.onUnlock(); }
    };
    window.addEventListener('keydown', this.kd); window.addEventListener('keyup', this.ku);
    document.addEventListener('mousemove', this.mm); canvas.addEventListener('mousedown', this.md);
    window.addEventListener('mouseup', this.mu); canvas.addEventListener('wheel', this.wh, { passive: false });
    canvas.addEventListener('contextmenu', this.cm); window.addEventListener('blur', this.blur);
    document.addEventListener('pointerlockchange', this.plc);
  }
  lock() { try { const r = this.canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {} }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
  take(k) { const v = !!this.pressed[k]; this.pressed[k] = false; return v; }
  // bound actions: held down right now / pressed since last checked
  down(a) { return !!this.codes[Keybinds.get(a)]; }
  hit(a) { const c = Keybinds.get(a), v = !!this.pressedCodes[c]; this.pressedCodes[c] = false; return v; }
  destroy() {
    this.unlock();
    window.removeEventListener('keydown', this.kd); window.removeEventListener('keyup', this.ku);
    document.removeEventListener('mousemove', this.mm); this.canvas.removeEventListener('mousedown', this.md);
    window.removeEventListener('mouseup', this.mu); this.canvas.removeEventListener('wheel', this.wh);
    this.canvas.removeEventListener('contextmenu', this.cm); window.removeEventListener('blur', this.blur);
    document.removeEventListener('pointerlockchange', this.plc);
  }
}

class Game {
  constructor(cfg, canvas) {
    this.cfg = cfg; this.role = cfg.role || 'local'; this.auth = this.role !== 'client';
    this.canvas = canvas; this.g = canvas.getContext('2d');
    this.map = makeMap(cfg.mapId, cfg.seed, cfg.customMap);
    this.ffa = !!cfg.ffa;
    this.night = !!cfg.night;
    // match modifiers
    this.mods = new Set((cfg.mods || []).filter(id => MODIFIERS.some(m => m.id === id)));
    this.gravMul = this.mods.has('lowgrav') ? 0.4 : 1; this.grav = GRAV * this.gravMul;
    this.maxHp = this.mods.has('dhp') ? 200 : 100;
    this.respawnTime = this.mods.has('fastspawn') ? 1.5 : RESPAWN_TIME;
    if (cfg.mode === 'snd' && this.ffa) cfg.mode = 'deathmatch';
    this.nTeams = this.ffa ? 0 : Math.max(2, Math.min(6, cfg.teams || 2));
    if (!cfg.teamNames || cfg.teamNames.length < this.nTeams) cfg.teamNames = TEAM_NAMES.slice();
    this.teamSpawns = this.ffa ? [] : this.computeTeamSpawns(this.nTeams);
    this.bases = cfg.mode === 'snd' ? this.placeBases() : [];
    this.baseTiles = new Set(); this.bases.forEach(b => this.baseTileIdx(b).forEach(i => this.baseTiles.add(i)));
    this.flares = []; this.lights = [];
    this.mr = new MapRenderer(this.map, { groundOnly: true });
    // decals are painted into the ground canvas; tell the 3D view which ground chunks to re-upload
    const decal = this.mr.decal.bind(this.mr);
    this.mr.decal = (type, x, y, r, a) => { decal(type, x, y, r, a); if (this.view) { const tile = type === 'rubble' || type === 'burn'; this.view.groundDirty(x + (tile ? 16 : 0), y + (tile ? 16 : 0), typeof r === 'number' ? r : 32); } };
    this.units = []; this.byId = {};
    this.bullets = []; this.nades = []; this.claymores = []; this.fires = []; this.smokes = []; this.particles = []; this.casings = []; this.corpses = [];
    this.pendingBooms = [];
    this.killfeed = []; this.events = []; this.time = 0; this.ended = false; this.paused = false;
    this.zone = { prog: new Array(Math.max(2, this.nTeams)).fill(0), holder: -1, contested: false };
    if (cfg.mode === 'survival') cfg.mode = 'score';
    this.timeLimit = cfg.mode === 'zone' ? (this.ffa ? 300 : 900) : cfg.mode === 'snd' ? 900 : cfg.mode === 'score' ? Math.max(2, Math.min(15, cfg.minutes || 5)) * 60 : 600 + 60 * Math.min(10, (cfg.lives || 1) - 1);
    this.timeLeft = this.timeLimit;
    this.localId = cfg.localId;
    this.cam = { x: 0, y: 0, zoom: 1 }; this.shake = 0;
    this.hitMarkT = 0; this.dmgFlash = 0; this.msgs = []; this.spectate = null;
    this.input = new Input(canvas);
    this.remoteInputs = {};
    this.netT = 0; this.seq = 0;
    this.minimap = Tex.cv(Math.round(this.map.w * 1.6), Math.round(this.map.h * 1.6));
    MapRenderer.preview(this.map, this.minimap);
    cfg.participants.forEach((p, i) => this.addUnit(p, i));
    const me = this.byId[this.localId];
    if (me) { this.cam.x = me.x; this.cam.y = me.y; }
    this.view = new View3D(this, cfg.canvas3d || document.querySelector('#game3d'));
    this.hitDirs = []; this.recoilPitch = 0;
    if (me) this.input.yaw = me.angle;
    this.input.onUnlock = () => { if (this.onUnlock && !this.ended) this.onUnlock(); };
    this.resize(); this._resize = () => this.resize(); window.addEventListener('resize', this._resize);
    this.last = performance.now();
    this.loop = this.loop.bind(this);
    if (this.mods.size) this.msg('Modifiers: ' + MODIFIERS.filter(m => this.mods.has(m.id)).map(m => m.icon + ' ' + m.name).join(' · '), 6, '#ffd54f');
    if (this.night) this.msg(me && me.gear.vision ? 'Night operation - N toggles your night gear, L your weapon light' : 'Night operation - L toggles your weapon light (it gives you away)', 5, '#9fc3ff');
    if (cfg.mode === 'zone') this.msg(this.ffa ? 'Stay in the zone longer than anyone else!' : 'Capture the zone! Hold it for 30 seconds.', 4);
    else if (cfg.mode === 'snd') this.msg('Search & Destroy - find the enemy castle and destroy it. Defend yours!', 5);
    else if (cfg.mode === 'score') this.msg(`Battle Royale - ${Math.round(this.timeLimit / 60)} minutes. Kills +100, assists +50, deaths −50. Highest score wins!`, 5);
    else this.msg(`Deathmatch - ${(cfg.lives || 1) === 1 ? 'one life' : (cfg.lives || 1) + ' lives each'}. Last ${this.ffa ? 'player' : 'team'} standing wins!`, 4);
  }
  start() { this.running = true; requestAnimationFrame(this.loop); }
  stop() { this.running = false; this.input.destroy(); this.view.dispose(); window.removeEventListener('resize', this._resize); const h = document.querySelector('#lock-hint'); if (h) h.classList.add('hidden'); }
  resize() { const r = this.canvas.getBoundingClientRect(); this.canvas.width = r.width * (window.devicePixelRatio > 1 ? 1.5 : 1); this.canvas.height = r.height * (window.devicePixelRatio > 1 ? 1.5 : 1); this.dpr = this.canvas.width / Math.max(1, r.width); if (this.view) this.view.resize(); }

  // ------------------------------------------------------------- units
  addUnit(p, i) {
    const lo = p.loadout;
    const u = {
      id: p.id, name: p.name, team: p.team, isBot: !!p.isBot, isRemote: !!p.isRemote, lo, skins: p.skins || {}, uniform: p.uniform || 'multicam', face: typeof p.face === 'string' && p.face.startsWith('data:image/') && p.face.length < 40000 ? p.face : null,
      x: 0, y: 0, angle: 0, hp: 100, alive: false, slots: [this.mods.has('sidearms') ? null : lo.primary, lo.sidearm1, lo.sidearm2, lo.melee || 'fists'], slot: 0,
      mag: [0, 0, 0, 0], reloadT: 0, fireCd: 0, burst: 0, spin: 0, utils: lo.utils.slice(), c4Live: [null, null, null], utilSel: 0,
      healT: 0, healRate: 0, boostT: 0, flashT: 0, burnT: 0, burnBy: null, invulnT: 0,
      lives: this.cfg.mode === 'deathmatch' ? Math.max(1, Math.min(16, this.cfg.lives || 1)) - 1 : Infinity,
      respawnT: 0, out: false, kills: 0, deaths: 0, assists: 0, streak: 0, lastKillT: -99, multi: 0, dmgBy: {},
      swingT: 0, meleeCd: 0, walk: 0, zoneTime: 0, firePrev: false, lastShotT: -9, spawnId: 0, scoped: false,
      ms: { explosiveKills: 0, fireKills: 0, sniperKills: 0, meleeKills: 0, wallbangs: 0, destroyed: 0, bestMulti: 0, bestStreak: 0, headshots: 0, longShots: 0, proneKills: 0, quietKills: 0 },
      tx: 0, ty: 0, ta: 0, light: false, gearOn: false, conceal: 0, z: 0, vz: 0, stance: 'stand', grounded: true, onLadder: false, pitch: 0,
    };
    u.gear = ITEMS[lo.gear] && ITEMS[lo.gear].cat === 'gear' ? ITEMS[lo.gear] : ITEMS.nogear;
    u.ammo = u.slots.map(id => id ? unitAmmo(lo, id) : null);
    u.att = u.slots.map(id => id ? unitAtt(lo, id) : null);
    u.weight = Profile.loadoutWeight(lo);
    u.speedMul = speedFromWeight(u.weight);
    u.armor = ITEMS[lo.armor || 'noarmor'];
    this.units.push(u); this.byId[u.id] = u;
    if (u.isBot && this.auth) u.ai = new BotBrain(this, u);
    if (this.auth) this.spawn(u, true);
    return u;
  }
  // spawn groups for each team: the map's left/right spawns for two teams, otherwise groups spread around the map
  computeTeamSpawns(n) {
    const m = this.map;
    if (n <= 2) { this.teamAnchors = [0, 1].map(t => { const s = m.spawns[t]; return { x: s.reduce((a, p) => a + p.x, 0) / s.length, y: s.reduce((a, p) => a + p.y, 0) / s.length }; }); return [m.spawns[0], m.spawns[1]]; }
    const free = (tx, ty) => tx > 1 && ty > 1 && tx < m.w - 2 && ty < m.h - 2 && m.floor[ty * m.w + tx] !== F.WATER && m.bld[ty * m.w + tx] < 0 && !isWallObj(m.obj[ty * m.w + tx]);
    const out = [], anchors = [];
    for (let t = 0; t < n; t++) {
      const a = Math.PI + t / n * Math.PI * 2;
      let ax = Math.round(m.w / 2 + Math.cos(a) * m.w * 0.42), ay = Math.round(m.h / 2 + Math.sin(a) * m.h * 0.4);
      for (let r = 0; r < 20 && !free(ax, ay); r++) { ax += Math.sign(m.w / 2 - ax); ay += Math.sign(m.h / 2 - ay); }
      const pts = [];
      for (const [dx, dy] of [[0, 0], [2, 0], [0, 2], [2, 2], [-2, 0], [0, -2], [-2, -2], [2, -2], [-2, 2]]) {
        const tx = ax + dx, ty = ay + dy; if (!free(tx, ty) || pts.length >= 6) continue;
        for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) if (x >= 0 && y >= 0 && x < m.w && y < m.h && !isWallObj(m.obj[y * m.w + x])) m.obj[y * m.w + x] = 0;
        pts.push({ x: tx * T + T / 2, y: ty * T + T / 2 });
      }
      if (!pts.length) pts.push({ x: ax * T + T / 2, y: ay * T + T / 2 });
      out.push(pts); anchors.push({ x: ax * T + T / 2, y: ay * T + T / 2 });
    }
    this.teamAnchors = anchors;
    return out;
  }
  spawnPoint(u, initial) {
    const m = this.map;
    let pts = this.ffa ? m.ffa : this.teamSpawns[u.team % this.teamSpawns.length];
    if (initial) {
      const idx = this.units.filter(o => o.team === u.team).indexOf(u);
      if (this.ffa) return pts[this.units.indexOf(u) % pts.length];
      return pts[idx % pts.length];
    }
    let best = pts[0], bestD = -1;
    pts.forEach(p => {
      let d = 1e9; this.units.forEach(o => { if (o.alive && o.team !== u.team) d = Math.min(d, Math.hypot(o.x - p.x, o.y - p.y)); });
      d += Math.random() * 150;
      if (d > bestD) { bestD = d; best = p; }
    });
    return best;
  }
  spawn(u, initial) {
    const p = this.spawnPoint(u, initial);
    u.x = p.x + (initial ? 0 : (Math.random() - 0.5) * 20); u.y = p.y;
    if (this.collides(u.x, u.y)) { u.x = p.x; u.y = p.y; }
    u.angle = u.x < this.map.w * T / 2 ? 0 : Math.PI;
    u.hp = this.maxHp; u.alive = true; u.respawnT = 0; u.invulnT = initial ? 0 : 2;
    u.z = this.supportAt(u.x, u.y, 0); u.vz = 0; u.stance = 'stand'; u.grounded = true; u.onLadder = false;
    if (u.id === this.localId && this.input) this.input.stance = 'stand';
    u.mag = u.slots.map((id, k) => id && ITEMS[id].mag ? this.wstat(u, k).mag : 0);
    u.utils = u.lo.utils.slice(); u.c4Live = [null, null, null];
    u.reloadT = 0; u.burnT = 0; u.flashT = 0; u.healT = 0; u.boostT = 0; u.streak = 0; u.dmgBy = {};
    u.slot = u.slots[0] ? 0 : 1; u.spawnId++;
    // night: goggles down if you have them, otherwise the weapon light is on
    if (initial) { u.gearOn = this.night && !!u.gear.vision; u.light = this.night && !u.gear.vision; }
    u.tx = u.x; u.ty = u.y;
    if (u.id === this.localId && this.input) { this.input.yaw = u.angle; this.input.pitch = 0; }
    if (u.ai) u.ai.reset();
  }
  enemies(a, b) { return a.team !== b.team; }
  // stats of the weapon in a slot with its loaded ammunition
  wstat(u, slot) { const s = slot === undefined ? u.slot : slot; return weaponStats(ITEMS[u.slots[s]], u.ammo && u.ammo[s], u.att && u.att[s]); }
  groundAt(x, y) { const w = this.waterAt(x, y); return w ? w.surf - w.depth : groundAt(this.map, x, y); }
  // water at a point: its surface height and depth. Banks are shallow (wade), further out it's deep (swim)
  waterAt(x, y) {
    const m = this.map, i = this.tileAt(x, y); if (i < 0 || m.floor[i] !== F.WATER || (m.slabs && m.slabs[i])) return null;
    if (!this._wdepth) {
      const W = m.w, H = m.h, d = this._wdepth = new Uint8Array(W * H), wet = (x, y) => x < 0 || y < 0 || x >= W || y >= H || m.floor[y * W + x] === F.WATER;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (m.floor[y * W + x] !== F.WATER) continue; let r = 3; for (let k = 1; k <= 2 && r === 3; k++) for (let dy = -k; dy <= k; dy++) for (let dx = -k; dx <= k; dx++) if (!wet(x + dx, y + dy)) r = Math.min(r, k);
        d[y * W + x] = r === 1 ? 30 : r === 2 ? 58 : 84; }
    }
    return { surf: groundAt(m, x, y), depth: this._wdepth[i] };
  }
  splash(x, y, z, n) { for (let k = 0; k < (n || 8); k++) { const a = Math.random() * 6.28, s = 30 + Math.random() * 70; this.particles.push({ type: 'debris', x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5, max: 0.5, size: 2 + Math.random() * 2, color: '#d9edf5' }); } }

  // ------------------------------------------------------------- search & destroy bases
  // one castle per team, at random on that team's side (closer to its own spawn than to anyone else's)
  placeBases() {
    const m = this.map, rng = mulberry32((this.cfg.seed ^ 0x5eed5) >>> 0), out = [], n = this.nTeams, A = this.teamAnchors;
    const ok = (tx, ty) => { for (let y = ty - 1; y <= ty + 2; y++) for (let x = tx - 1; x <= tx + 2; x++) { if (x < 1 || y < 1 || x >= m.w - 1 || y >= m.h - 1) return false; const i = y * m.w + x; if (m.floor[i] === F.WATER || m.bld[i] >= 0 || m.stair[i] >= 0 || m.ladder[i] >= 0) return false; } return true; };
    const nearest = (x, y) => { let bt = 0, bd = 1e9; A.forEach((a, t) => { const d = Math.hypot(a.x / T - x, a.y / T - y); if (d < bd) { bd = d; bt = t; } }); return bt; };
    for (let t = 0; t < n; t++) {
      const sp = this.teamSpawns[t];
      let tx = Math.round(A[t].x / T), ty = Math.round(A[t].y / T);
      for (let k = 0; k < 800; k++) {
        const cx = 3 + Math.floor(rng() * (m.w - 7)), cy = 3 + Math.floor(rng() * (m.h - 7));
        if (nearest(cx, cy) !== t || !ok(cx, cy)) continue;
        if (n === 2 && Math.abs(cx - m.w / 2) < m.w * 0.1) continue;
        if (sp.some(p => Math.hypot(p.x / T - cx, p.y / T - cy) < 7) || out.some(b => Math.hypot(b.tx - cx, b.ty - cy) < 10)) continue;
        tx = cx; ty = cy; break;
      }
      for (let y = ty - 1; y <= ty + 2; y++) for (let x = tx - 1; x <= tx + 2; x++) if (x >= 0 && y >= 0 && x < m.w && y < m.h) { const i = y * m.w + x; m.obj[i] = 0; m.hp[i] = 0; }
      const b = { team: t, tx, ty, x: (tx + 1) * T, y: (ty + 1) * T, hp: BASE_HP, seen: new Array(n).fill(false), hitT: -9 };
      b.gz = groundAt(m, b.x, b.y); b.seen[t] = true; out.push(b);
    }
    return out;
  }
  baseTileIdx(b) { const m = this.map; return [[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) => (b.ty + dy) * m.w + b.tx + dx); }
  baseAt(x, y, pad) { pad = pad || 0; for (const b of this.bases) if (b.hp > 0 && Math.abs(x - b.x) < BASE_HALF + pad && Math.abs(y - b.y) < BASE_HALF + pad) return b; return null; }
  damageBase(b, amount, attacker) {
    if (!this.auth || this.ended || b.hp <= 0 || amount <= 0) return;
    if (attacker && attacker.team === b.team) return;
    b.hp = Math.max(0, b.hp - amount); b.hitT = this.time;
    if (attacker) b.seen[attacker.team] = true;
    if (b.hp <= 0) this.emit(['basedown', b.team, attacker ? attacker.id : '']);
  }
  baseDestroyedFx(b) {
    this.baseTileIdx(b).forEach(i => this.baseTiles.delete(i));
    this.mr.decal('scorch', b.x, b.y, 70);
    for (let k = 0; k < 4; k++) this.mr.decal('rubble', b.x - T + (k % 2) * T, b.y - T + (k >> 1) * T, '#8a8576');
    for (let k = 0; k < 30; k++) { const a = Math.random() * 6.28, s = Math.random() * 200; this.particles.push({ type: 'debris', x: b.x, y: b.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.8, max: 0.8, size: 3 + Math.random() * 4, color: '#8a8576', drag: 3 }); }
  }

  // ------------------------------------------------------------- night & concealment
  // light sources this frame: {x, y, r, a (cone direction), cone}
  collectLights() {
    const L = [];
    if (this.night) {
      this.units.forEach(u => { if (!u.alive) return; if (u.light) { L.push({ x: u.x, y: u.y, r: 400, a: u.angle, cone: true }); L.push({ x: u.x, y: u.y, z: u.z, r: 50 }); } if (u.burnT > 0) L.push({ x: u.x, y: u.y, z: u.z, r: 120 }); });
      this.fires.forEach(f => L.push({ x: f.x, y: f.y, z: f.z, r: f.r * 2.4 }));
      this.flares.forEach(f => L.push({ x: f.x, y: f.y, r: f.r * (0.92 + Math.random() * 0.08) }));
      this.particles.forEach(p => { if (p.type === 'flash') L.push({ x: p.x, y: p.y, z: (p.z || 44) - 34, r: 160 * p.size }); else if (p.type === 'glow' && p.life > p.max * 0.3) L.push({ x: p.x, y: p.y, z: p.z, r: p.size * 2.2 }); });
      this.bullets.forEach(b => { if (b.tracer || b.dragon) L.push({ x: b.x, y: b.y, r: b.dragon ? 60 : 46 }); else if (b.flame && Math.random() < 0.3) L.push({ x: b.x, y: b.y, r: 80 }); });
      this.nades.forEach(n => { if (n.kind === 'rocket') L.push({ x: n.x, y: n.y, r: 90 }); else if (n.kind === 'illum') L.push({ x: n.x, y: n.y, r: 60 }); });
    }
    return (this.lights = L);
  }
  litAt(x, y) {
    for (const l of this.lights) {
      const d = Math.hypot(x - l.x, y - l.y); if (d > l.r * 0.85) continue;
      if (l.cone) { let da = Math.atan2(y - l.y, x - l.x) - l.a; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) > 0.42) continue; }
      return true;
    }
    return false;
  }
  updateConceal() {
    const m = this.map;
    this.units.forEach(u => {
      u.conceal = 0; if (!u.alive) return;
      const cx = Math.floor(u.x / T), cy = Math.floor(u.y / T);
      for (let ty = cy - 1; ty <= cy + 1; ty++) for (let tx = cx - 1; tx <= cx + 1; tx++) {
        if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) continue;
        const o = m.obj[ty * m.w + tx]; if (!o) continue; const mt = MAT[o]; if (!mt.conceal) continue;
        let d;
        if (!mt.solid) d = tx === cx && ty === cy ? 0 : 99;
        else if (mt.round) d = Math.hypot(u.x - tx * T - T / 2, u.y - ty * T - T / 2) - mt.round - UNIT_R;
        else d = Math.hypot(u.x - Math.max(tx * T, Math.min(u.x, tx * T + T)), u.y - Math.max(ty * T, Math.min(u.y, ty * T + T))) - UNIT_R;
        if (d <= CONCEAL_TOUCH && (!u.conceal || mt.conceal < u.conceal)) u.conceal = mt.conceal;
      }
      // a ghillie suit hides you in plants even better, and still out in the open while you're down and not moving
      if (u.armor && u.armor.ghillie) { if (u.conceal) u.conceal *= 0.6; else if (u.stance !== 'stand' && !u.moving && this.time - u.lastShotT > 2) u.conceal = u.stance === 'prone' ? 200 : 320; }
    });
  }
  // how far a viewer can see in the dark with their eyes / goggles
  sightRange(v) { if (!this.night) return 1e9; if (v.gearOn && v.gear.vision) return v.gear.range; return 170; }
  thermal(v) { if (!v) return false; if (v.scoped && v.alive) { const w = this.wstat(v); if (w && w.thermalSight) return true; } return v.gearOn && (v.gear.vision === 'ir' || v.gear.vision === 'fused'); }
  // can viewer v see unit o? (darkness, goggles and concealment - callers check walls/smoke)
  visibleTo(v, o) {
    if (!v || v === o || !this.enemies(v, o)) return true;
    const d = Math.hypot(o.x - v.x, o.y - v.y), fired = this.time - o.lastShotT;
    const th = this.thermal(v); // thermal sees body heat: through darkness, foliage and ghillie suits alike
    if (!th && o.conceal && fired > 1 && !(this.night && o.light) && d > o.conceal * (o.stance === 'prone' ? 0.6 : 1)) return false;
    if (!this.night || th) return true;
    if (o.light || fired < 0.3 || o.burnT > 0) return true;
    if (d <= this.sightRange(v)) return true;
    return this.litAt(o.x, o.y);
  }

  // ------------------------------------------------------------- map queries
  tileAt(x, y) { const tx = Math.floor(x / T), ty = Math.floor(y / T); if (tx < 0 || ty < 0 || tx >= this.map.w || ty >= this.map.h) return -1; return ty * this.map.w + tx; }
  // blocked at ground level (pathfinding): solid objects, castles, water and stair ramps
  solidTile(tx, ty) {
    const m = this.map; if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return true;
    const i = ty * m.w + tx, o = m.obj[i];
    if (o && MAT[o].solid) return true;
    if (m.stair[i] >= 0) return true;
    if (this.baseTiles.size && this.baseTiles.has(i)) return true;
    return m.floor[i] === F.WATER;
  }
  // ground too steep to walk across (cliffs and mountain sides) - for pathfinding
  steepTile(tx, ty) {
    const m = this.map; if (!m.hc) return false;
    if (!this._steep) {
      const W = m.w + 1, h = m.hc; this._steep = new Uint8Array(m.w * m.h);
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
        const a = h[y * W + x], b = h[y * W + x + 1], c = h[(y + 1) * W + x], d = h[(y + 1) * W + x + 1];
        if (Math.max(a, b, c, d) - Math.min(a, b, c, d) > T * 1.15) this._steep[y * m.w + x] = 1;
      }
    }
    return !!this._steep[ty * m.w + tx];
  }
  // solid vertical spans of a tile: [bottom, top, kind]
  solidsAt(i, x, y) { return tileSolids(this.map, i, x, y, this._sb || (this._sb = [])); }
  // does a body of radius r occupying heights [z, z+h] overlap anything? (spans lower than z+STEP can be stepped onto)
  collides(x, y, r, z, h, noWater) {
    r = r || UNIT_R; z = z || 0; h = h === undefined ? 56 : h; const m = this.map;
    if (x < r || y < r || x > m.w * T - r || y > m.h * T - r) return true;
    if (this.bases.length) { const bb = this.baseAt(x, y, r - 2); if (bb && z < bb.gz + 70) return true; }
    if (m.hc && this.groundAt(x, y) > z + (this._wading ? 62 : STEP)) return true; // too steep / hillside in the way (wading out of water you can climb the bank)
    const x0 = Math.floor((x - r) / T), x1 = Math.floor((x + r) / T), y0 = Math.floor((y - r) / T), y1 = Math.floor((y + r) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return true;
      const i = ty * m.w + tx, cx = Math.max(tx * T, Math.min(x, tx * T + T)), cy = Math.max(ty * T, Math.min(y, ty * T + T));
      const rect = (x - cx) ** 2 + (y - cy) ** 2 < r * r;
      const sol = this.solidsAt(i, x, y); if (!sol.length) continue;
      const o = m.obj[i], mt = o ? MAT[o] : null;
      for (const s of sol) {
        if (!(s[1] > z + STEP && s[0] < z + h)) continue;
        if (s[2] === 'obj' && mt && mt.round) { if (Math.hypot(x - (tx * T + T / 2), y - (ty * T + T / 2)) < r + mt.round - 2) return true; continue; }
        // floors and roofs overhead only block when you are under them, so your shoulders can pass the edge of a stairwell
        if ((s[2] === 'slab' || s[2] === 'roof') && s[0] > z + STEP && !(x >= tx * T && x < tx * T + T && y >= ty * T && y < ty * T + T)) continue;
        if (rect) return true;
      }
    }
    return false;
  }
  // highest surface under a point that something at height z can stand on
  // a spent case thrown out of the ejection port (right of the gun) of whoever fired: it lands and lies there for
  // 15-30 s (purely visual; drawn as real cases by the 3D view). Revolvers keep theirs, launchers have none
  spawnCasing(ev, it, force) {
    if (!it || it.explosive || it.flame || it.cat === 'melee' || it.type === 'Revolver') return;
    const u = this.byId[ev[1]], a = ev[4], r = Math.random, side = a + 1.6 + (r() - 0.5) * 0.6, sp = 70 + r() * 50;
    // the local player's own cases come from the first-person gun (the 3D view hands each one over to the world)
    if (!force && u && u.id === this.localId && this.view && this.view.vmRoot && this.view.vmRoot.visible && this.view.vm && this.view.vm.rig && this.view.vm.rig.ej) return;
    const x = (u ? u.x : ev[2]) + Math.cos(a) * 8 + Math.cos(a + 1.57) * 4, y = (u ? u.y : ev[3]) + Math.sin(a) * 8 + Math.sin(a + 1.57) * 4;
    const len = casingLen(it);
    this.casings.push({ x, y, z: (u ? eyeZ(u) - 10 : (ev[7] || 44)), vx: Math.cos(side) * sp - Math.cos(a) * 15, vy: Math.sin(side) * sp - Math.sin(a) * 15, vz: 40 + r() * 40,
      len, hull: !!it.pellets, yaw: r() * 6.28, spin: (r() - 0.5) * 30, t: 0, life: 15 + r() * 15, landed: false, hide: 0 });
    if (this.casings.length > 400) this.casings.shift();
  }
  supportAt(x, y, z, r) {
    const m = this.map; r = r === undefined ? UNIT_R * 0.6 : r; let best = this.groundAt(x, y);
    const x0 = Math.floor((x - r) / T), x1 = Math.floor((x + r) / T), y0 = Math.floor((y - r) / T), y1 = Math.floor((y + r) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) continue;
      const i = ty * m.w + tx, o = m.obj[i], mt = o ? MAT[o] : null;
      for (const s of this.solidsAt(i, Math.max(tx * T, Math.min(x, tx * T + T - 0.01)), Math.max(ty * T, Math.min(y, ty * T + T - 0.01)))) {
        if (s[1] > z + STEP || s[1] <= best) continue;
        if (s[2] === 'obj' && mt && mt.round && Math.hypot(x - (tx * T + T / 2), y - (ty * T + T / 2)) > mt.round + r) continue;
        best = s[1];
      }
    }
    if (this.bases.length) { const bb = this.baseAt(x, y); if (bb && z >= bb.gz + 70 - STEP) best = Math.max(best, bb.gz + 70); }
    return best;
  }
  // lowest overhead surface (floor slab / roof) above height z at a point
  ceilingAt(x, y, z) {
    const i = this.tileAt(x, y); if (i < 0) return Infinity; let c = Infinity;
    for (const s of this.solidsAt(i, x, y)) if (s[0] >= z + 4 && s[0] < c && s[2] !== 'obj') c = s[0];
    return c;
  }
  // 3D line of sight (AI, flashbangs, tags). z defaults to chest height so old 2D callers still work.
  los(x1, y1, x2, y2, ignoreSmoke, ignoreBase, z1, z2) {
    if (z1 === undefined) z1 = 44; if (z2 === undefined) z2 = z1;
    const d = Math.hypot(x2 - x1, y2 - y1), steps = Math.max(1, Math.ceil(d / 8)), m = this.map;
    for (let s = 1; s < steps; s++) {
      const x = x1 + (x2 - x1) * s / steps, y = y1 + (y2 - y1) * s / steps, z = z1 + (z2 - z1) * s / steps;
      const i = this.tileAt(x, y); if (i < 0) return false;
      if (m.hc && z < groundAt(m, x, y) - 1) return false; // hills block sight
      if (this.baseTiles.size && this.baseTiles.has(i) && z < m.base[i] + 70 && (!ignoreBase || !this.baseTileIdx(ignoreBase).includes(i))) return false;
      const o = m.obj[i];
      for (const sp of this.solidsAt(i, x, y)) {
        if (z < sp[0] || z > sp[1] || sp[2] === 'glass') continue;
        if (sp[2] === 'obj' && o && (o === O.CHAINLINK || MAT[o].round && Math.hypot(x - (i % m.w) * T - T / 2, y - ((i / m.w) | 0) * T - T / 2) > MAT[o].round)) continue;
        return false;
      }
    }
    if (!ignoreSmoke) for (const s of this.smokes) { if (s.r < 30) continue; if (segCircle(x1, y1, x2, y2, s.x, s.y, s.r * 0.85)) return false; }
    return true;
  }
  // can stance change to s (room for the taller body)?
  setStance(u, s) {
    if (u.stance === s || u.onLadder) return;
    const h = STANCES[s].h;
    if (h > STANCES[u.stance].h && (u.z + h > this.ceilingAt(u.x, u.y, u.z) || this.collides(u.x, u.y, UNIT_R, u.z, h))) return;
    u.stance = s;
  }
  // movement shared by the host and client prediction: walking, ladders, jumping, gravity, stairs
  moveBody(u, inp, dt, sp) {
    if (inp.stance) this.setStance(u, inp.stance);
    const st = STANCES[u.stance], m = this.map;
    let mx = inp.mx || 0, my = inp.my || 0; const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
    sp *= st.speed;
    // ladders: push toward the wall to climb, back off to climb down, jump to let go
    const ti = this.tileAt(u.x, u.y), lad = ti >= 0 && !u.ai ? m.ladder[ti] : -1;
    if (lad >= 0) {
      const L = m.ladders[lad], push = mx * L.dx + my * L.dy, top = L.top + (L.base || 0);
      if (!u.onLadder && push > 0.4 && u.z < top - 4) { u.onLadder = true; u.stance = 'stand'; }
      if (u.onLadder) {
        u.vz = 0; u.grounded = false;
        u.z = Math.max(this.supportAt(u.x, u.y, u.z), Math.min(top + 1, u.z + push * CLIMB * dt));
        if (inp.jump) { u.onLadder = false; u.vz = 120; }
        else if (push < -0.4 && u.z <= this.supportAt(u.x, u.y, u.z) + 1) u.onLadder = false;
        // near the top you can step off forward; otherwise only slide sideways a little
        const k = u.z >= top - 2 ? 1 : 0.25;
        this.moveUnit(u, mx * sp * k * dt, my * sp * k * dt);
        if (u.z >= top - 2 && this.tileAt(u.x, u.y) !== ti) { u.onLadder = false; u.z = this.supportAt(u.x, u.y, u.z); u.grounded = true; }
        u.moving = l > 0.1; if (u.moving) u.walk += dt * 4;
        return;
      }
    } else u.onLadder = false;
    const wIn = this.waterAt(u.x, u.y); this._wading = !!(wIn && u.z < wIn.surf + 4);
    this.moveUnit(u, mx * sp * dt, my * sp * dt); this._wading = false;
    u.moving = l > 0.1;
    if (u.moving) u.walk += dt * sp * 0.06 * (u.stance === 'prone' ? 0.5 : 1);
    // water: a splash going in; deep water (deeper than your chest) you swim in, floating with your head out; shallow
    // water you wade through on the bottom, and it breaks a fall into it
    const w = this.waterAt(u.x, u.y), wetNow = !!w && u.z < w.surf;
    if (wetNow && !u.wasWet && (u.vz < -60 || u.moving)) this.splash(u.x, u.y, w.surf, u.vz < -200 ? 14 : 5);
    u.wasWet = wetNow; u.wade = wetNow; u.swim = false;
    if (w && u.z < w.surf + 2) {
      const bed = w.surf - w.depth, floatZ = w.surf - (STANCES.stand.eye - 10);
      if (u.stance === 'prone' || (u.stance === 'crouch' && w.depth > 20)) u.stance = 'stand';
      if (floatZ > bed + 1) {
        u.swim = true;
        u.vz = u.vz * Math.exp(-dt * 6) + (floatZ - u.z) * 25 * dt; // water drag, and buoyancy toward floating height
        u.z = Math.max(bed, u.z + u.vz * dt); u.grounded = true;
        return;
      }
      if (u.vz < 0) u.vz *= Math.exp(-dt * 5);
    }
    // vertical
    const sup = this.supportAt(u.x, u.y, u.z);
    if (inp.jump && u.grounded && u.stance !== 'prone') { u.vz = u.stance === 'crouch' ? JUMP_V * 0.85 : JUMP_V; u.grounded = false; }
    if (u.grounded && u.vz <= 0 && sup >= u.z - STEP) {
      // don't step up into something overhead (e.g. the floor beside a stairwell): stay low and slide instead of getting wedged
      if (!(sup > u.z + 0.01 && this.collides(u.x, u.y, UNIT_R, sup, st.h) && !this.collides(u.x, u.y, UNIT_R, u.z, st.h))) u.z = sup;
      u.vz = 0; return;
    }
    u.vz -= this.grav * dt; u.z += u.vz * dt;
    const ceil = this.ceilingAt(u.x, u.y, u.z - u.vz * dt);
    if (u.z + st.h > ceil) { u.z = Math.max(sup, ceil - st.h); if (u.vz > 0) u.vz = 0; }
    if (u.z <= sup) {
      if (u.vz < -600 && this.auth && !u.isRemote) this.damageUnit(u, (-u.vz - 600) * 0.22, null, { wid: 'fall', kind: 'fall' });
      u.z = sup; u.vz = 0; u.grounded = true;
    } else u.grounded = false;
  }
  inCover(u) { const i = this.tileAt(u.x, u.y); return i >= 0 && this.map.obj[i] && MAT[this.map.obj[i]].cover; }

  // ------------------------------------------------------------- input application
  localInput() {
    const I = this.input, me = this.byId[this.localId];
    const inp = { mx: 0, my: 0, ax: 0, ay: 0, fire: false, slot: null, reload: false, utils: [], melee: false, scope: false };
    if (!me) return inp;
    let f = 0, st = 0;
    if (I.down('forward') || I.keys['arrowup']) f += 1;
    if (I.down('back') || I.keys['arrowdown']) f -= 1;
    if (I.down('left') || I.keys['arrowleft']) st -= 1;
    if (I.down('right') || I.keys['arrowright']) st += 1;
    const yaw = I.yaw;
    inp.mx = Math.cos(yaw) * f + Math.cos(yaw + Math.PI / 2) * st; inp.my = Math.sin(yaw) * f + Math.sin(yaw + Math.PI / 2) * st;
    inp.sprint = I.down('sprint') && f > 0 && !me.scoped;
    // aim point straight ahead; its distance (from looking up/down) sets how far grenades and launcher rounds go
    const dist = Math.max(40, Math.min(1000, 320 + I.pitch * 700));
    inp.ax = me.x + Math.cos(yaw) * dist; inp.ay = me.y + Math.sin(yaw) * dist;
    inp.fire = I.lmb; inp.scope = I.rmb;
    for (let k = 1; k <= 4; k++) if (I.hit('w' + k)) inp.slot = k - 1;
    if (I.wheel) { let s = me.slot; for (let n = 0; n < 4; n++) { s = (s + Math.sign(I.wheel) + 4) % 4; if (me.slots[s]) break; } inp.slot = s; I.wheel = 0; }
    if (I.hit('reload')) inp.reload = true;
    if (I.hit('melee')) inp.melee = true;
    for (let k = 1; k <= 3; k++) if (I.hit('u' + k)) inp.utils.push(k - 1);
    if (I.hit('unext')) { for (let n = 1; n <= 3; n++) { const s = (me.utilSel + n) % 3; if (me.utils[s]) { me.utilSel = s; break; } } }
    if (I.hit('uuse')) inp.utils.push(me.utilSel);
    // jump / crouch (tap) / prone (hold)
    inp.jump = I.hit('jump');
    if (I.down('crouch')) { if (I.cDown === undefined) I.cDown = performance.now(); else if (!I.cProne && performance.now() - I.cDown > 350) { I.cProne = true; I.stance = 'prone'; } }
    else if (I.cDown !== undefined) { if (!I.cProne) I.stance = I.stance === 'crouch' || I.stance === 'prone' ? 'stand' : 'crouch'; I.cDown = undefined; I.cProne = false; }
    if (!I.stance) I.stance = 'stand';
    if (inp.jump && me.stance === 'prone') { I.stance = 'crouch'; inp.jump = false; } // space gets up from prone; crouch-jumps are allowed
    if (inp.sprint) I.stance = 'stand';
    inp.stance = I.stance; inp.pitch = I.pitch;
    if (I.hit('light')) inp.light = true;
    if (I.hit('gear')) inp.gear = true;
    return inp;
  }
  applyInput(u, inp, dt, skipMove) {
    if (!u.alive) return;
    if (inp.slot !== null && inp.slot !== undefined && u.slots[inp.slot] && inp.slot !== u.slot) {
      u.slot = inp.slot; u.reloadT = 0; u.burst = 0; u.fireCd = Math.max(u.fireCd, 0.25); u.spin = 0; u.firePrev = true;
    }
    if (inp.ax !== undefined && (inp.ax || inp.ay)) u.angle = Math.atan2(inp.ay - u.y, inp.ax - u.x);
    if (inp.light || inp.gear) this.toggleLightGear(u, inp);
    if (inp.pitch !== undefined) u.pitch = inp.pitch;
    const it = ITEMS[u.slots[u.slot]];
    u.scoped = !!inp.scope;
    if (!skipMove) this.moveBody(u, inp, dt, this.moveSpeed(u, inp, it));
    else if (inp.stance) u.stance = inp.stance;
    if (inp.reload) this.startReload(u);
    if (inp.melee) this.melee(u, ITEMS[u.slots[3] || 'fists']);
    this.tryFire(u, inp, dt);
    (inp.utils || []).forEach(s => this.useUtil(u, s, inp.ax, inp.ay));
  }
  toggleLightGear(u, inp) {
    u.toggleT = this.time;
    if (inp.light) { u.light = !u.light; if (u.id === this.localId) { this.msg(`Weapon light ${u.light ? 'ON' : 'OFF'}`, 1.2, '#ddd'); Sfx.light(); } }
    if (inp.gear) {
      const local = u.id === this.localId;
      if (!u.gear.vision) { if (local) this.msg('No night gear equipped (buy NVGs or thermals in the Shop)', 2, '#ef9a9a'); }
      else if (u.gear.vision === 'nv' && !this.night && !u.gearOn) { if (local) this.msg('Night vision only works at night', 1.6, '#ef9a9a'); }
      else { u.gearOn = !u.gearOn; if (local) { this.msg(`${u.gear.name} ${u.gearOn ? 'ON' : 'OFF'}`, 1.2, '#9fe0a0'); Sfx.gear(u.gearOn); } }
    }
  }
  moveSpeed(u, inp, it) {
    let sp = BASE_SPEED * u.speedMul;
    if (this.mods.has('speed')) sp *= 1.5;
    if (u.boostT > 0) sp *= 1.3;
    if (inp.sprint && !u.scoped && u.healT <= 0 && u.stance === 'stand') sp *= 1.35;
    if (u.scoped && it && it.scope) sp *= 0.55; else if (u.scoped) sp *= 0.8;
    if (u.healT > 0) sp *= 0.55;
    if (it && it.spinup && u.spin > 0) sp *= 0.7;
    const ti = this.tileAt(u.x, u.y); if (ti >= 0 && u.z < this.map.base[ti] + 8 && this.map.obj[ti] && MAT[this.map.obj[ti]].slow) sp *= MAT[this.map.obj[ti]].slow;
    if (u.gasT > 0) sp *= 0.65;
    if (u.swim) sp *= 0.42; else if (u.wade) sp *= 0.62; // swimming / wading
    // walking uphill is slower
    if (this.map.hc && (inp.mx || inp.my)) { const l = Math.hypot(inp.mx, inp.my) || 1, ahead = this.groundAt(u.x + inp.mx / l * 16, u.y + inp.my / l * 16) - this.groundAt(u.x, u.y); if (ahead > 2) sp *= Math.max(0.6, 1 - ahead / 40); }
    return sp;
  }
  moveUnit(u, dx, dy) {
    const z = u.z || 0, h = STANCES[u.stance || 'stand'].h;
    // slopes steeper than ~50 degrees can't be walked up
    const wet = this.waterAt(u.x, u.y), climbOut = wet && z < wet.surf + 4;
    const steep = (nx, ny, d) => this.map.hc && !(climbOut && this.groundAt(nx, ny) < z + 62) && this.groundAt(nx, ny) - this.groundAt(u.x, u.y) > Math.abs(d) * 1.2 + 0.5 && this.groundAt(nx, ny) > z + 1;
    // already overlapping something (e.g. after dropping off the side of a staircase)? Shrink the test radius to the
    // clearance we have, so moving away is always possible and you can never get wedged in place
    // (water never counts here: it must always block, it is not something you can be wedged in)
    let R = UNIT_R;
    if (this.collides(u.x, u.y, R, z, h, true)) { while (R > 3 && this.collides(u.x, u.y, R, z, h, true)) R -= 1.5; if (this.collides(u.x, u.y, R, z, h, true)) R = 0; }
    const inWater = this.collides(u.x, u.y, 2, z, h) && !this.collides(u.x, u.y, 2, z, h, true);
    const hit = (nx, ny) => (R > 0 && this.collides(nx, ny, R, z, h, true)) || (!inWater && this.collides(nx, ny, Math.max(R, 4), z, h) && !this.collides(nx, ny, Math.max(R, 4), z, h, true));
    if (dx) { if (!hit(u.x + dx, u.y) && !steep(u.x + dx, u.y, dx)) u.x += dx; else if (!hit(u.x + dx / 2, u.y) && !steep(u.x + dx / 2, u.y, dx / 2)) u.x += dx / 2; }
    if (dy) { if (!hit(u.x, u.y + dy) && !steep(u.x, u.y + dy, dy)) u.y += dy; else if (!hit(u.x, u.y + dy / 2) && !steep(u.x, u.y + dy / 2, dy / 2)) u.y += dy / 2; }
  }

  // ------------------------------------------------------------- weapons
  startReload(u) {
    const it = this.wstat(u); if (!it || !it.mag || u.reloadT > 0 || u.mag[u.slot] >= it.mag) return;
    u.reloadT = it.reload; u.burst = 0;
    Sfx.reload(u.x, u.y, it);
  }
  tryFire(u, inp, dt) {
    const it = this.wstat(u); if (!it) return;
    const held = inp.fire;
    if (it.cat === 'melee') { if (held) this.melee(u, it); return; }
    if (it.spinup) { u.spin = held && u.reloadT <= 0 ? Math.min(1, u.spin + dt / it.spinup) : Math.max(0, u.spin - dt * 0.8); }
    if (!held) { u.firePrev = false; u.fireCd = Math.max(0, u.fireCd); return; }
    if (u.swim && it.cat === 'primary') return; // treading water you can only use a sidearm
    if (u.reloadT > 0 || u.healT > 0) return;
    if (it.spinup && u.spin < 1) return;
    if ((!it.auto || it.burst) && u.firePrev) return;
    if (u.fireCd > 0 || u.burst > 0) return;
    if (u.mag[u.slot] <= 0) { if (!u.firePrev) { if (u.id === this.localId) Sfx.empty(u.x, u.y); } u.firePrev = true; this.startReload(u); return; }
    if (it.burst) { u.burst = it.burst; u.firePrev = true; return; }
    u.firePrev = true;
    // only this frame's time can be caught up: time the cooldown ran on while the gun couldn't fire (reloading,
    // healing, spinning up) must not come out as a burst of shots the moment it can
    u.fireCd = Math.max(u.fireCd, -dt);
    while (u.fireCd <= 0 && u.mag[u.slot] > 0) { this.shoot(u, it, inp.ax, inp.ay); u.fireCd += 60 / it.rpm; if (!it.auto) break; }
    if (u.mag[u.slot] <= 0) { u.fireCd = Math.max(u.fireCd, 0); this.startReload(u); }
  }
  shoot(u, it, ax, ay) {
    if (!this.mods.has('infammo')) u.mag[u.slot]--; if (it.suppressed) u.lastQuietT = this.time; else u.lastShotT = this.time;
    if (!it.explosive && !it.flame) u.ms.shots = (u.ms.shots || 0) + 1;
    const L = Art.weaponLen(it) + 10;
    const mx = u.x + Math.cos(u.angle) * L, my = u.y + Math.sin(u.angle) * L;
    let spread = aimSpread(u, it, this.time); if (u.isBot) spread *= 1.25;
    // this shot adds bloom for the next one (first shots and tap-fire stay accurate)
    const bl = (u.bloom || 0) * Math.exp(-(this.time - (u.bloomT || 0)) * 4);
    u.bloom = Math.min(it.pellets ? 0.6 : 1.6, bl + (it.auto ? 0.16 : 0.3) * (it.recoilMul || 1)); u.bloomT = this.time;
    // don't fire from inside a wall
    // bullets start on the line of sight from the eyes, so they land where the crosshair points at any angle
    const pitch = Math.max(-1.4, Math.min(1.4, u.pitch || 0)), ez = eyeZ(u) - 1;
    const blockedAt = (d) => this.collides(u.x + Math.cos(u.angle) * d, u.y + Math.sin(u.angle) * d, 2, ez + Math.tan(pitch) * d - 2, 4);
    const md = blockedAt(L) && !blockedAt(14) ? 14 : L, mz = ez + Math.tan(pitch) * md;
    const ox = u.x + Math.cos(u.angle) * md, oy = u.y + Math.sin(u.angle) * md;
    this.emit(['shot', u.id, Math.round(mx), Math.round(my), +u.angle.toFixed(3), it.id, it.ammoKind || '', Math.round(mz), (it.suppressed ? 1 : 0) | (it.noFlash ? 2 : 0)]);
    if (it.explosive || it.illum || it.smoke40) {
      const a = u.angle + (Math.random() - 0.5) * spread;
      const kind = it.illum ? 'illum' : it.smoke40 ? 'smoke40' : it.rocket ? 'rocket' : it.direct ? 'he12' : 'gl';
      // launcher grenades fly in an arc (bots work out the angle for the distance), rockets and FRAG-12 fly straight
      let p = pitch + (Math.random() - 0.5) * spread;
      const lob = kind === 'gl' || kind === 'illum' || kind === 'smoke40';
      if (lob && u.ai && ax !== undefined) p = 0.5 * Math.asin(Math.min(1, Math.hypot(ax - u.x, ay - u.y) * this.grav / (it.speed * it.speed)));
      else if (lob) p += 0.08;
      this.nades.push({ id: Math.random(), kind, x: ox, y: oy, z: mz, vx: Math.cos(a) * Math.cos(p) * it.speed, vy: Math.sin(a) * Math.cos(p) * it.speed, vz: Math.sin(p) * it.speed, lob,
        owner: u.id, team: u.team, item: it.id, dmg: it.dmg, blast: it.blast, travel: 0, maxTravel: it.rocket || it.direct ? it.range : 4000, t: 0, fuse: 99,
        structMul: it.structMul || 1, armorMul: it.armorMul, fire: it.fire });
      return;
    }
    const n = it.pellets || 1;
    for (let k = 0; k < n; k++) {
      const a = u.angle + (Math.random() - 0.5) * spread * (n > 1 ? 1 : 1.3);
      const dz = Math.tan(pitch + (Math.random() - 0.5) * spread * (n > 1 ? 1 : 1.3)) - (it.flame ? 0.02 : 0);
      const bal = it.flame || it.dragon ? null : ballistics(it);
      const slow = bal && this.mods.has('slowbullets') ? SLOW_BULLETS : 1;
      const sp = bal ? bal.v * slow * (0.99 + Math.random() * 0.02) : it.speed * (0.8 + Math.random() * 0.4);
      const b = { x: ox, y: oy, z: mz, dz, dx: Math.cos(a), dy: Math.sin(a), speed: sp, dmg: it.dmg, pen: it.pen, range: it.range * (it.flame || it.dragon ? 0.8 + Math.random() * 0.3 : 1), dist: 0,
        k: bal ? bal.k : 0, v0: sp, drop: bal ? GRAVITY_PX * this.gravMul * slow * slow : 0, // slow bullets keep the same arc
        ...(this.mods.has('explosive') && !it.flame && !it.impactBlast ? { modBlast: true } : {}),
        owner: u.id, team: u.team, wid: it.id, flame: !!it.flame, shotgun: !!it.pellets, lastIdx: -1, wall: false, hit: null, auth: true,
        tracer: !!it.tracer, inc: !!it.incendiary, dragon: !!it.dragon, armorMul: it.armorMul, structMul: it.structMul || 1, blast: it.impactBlast || 0, blastDmg: it.blastDmg || 0, burnMul: it.burnMul || 1 };
      if (b.modBlast) { b.blast = 26; b.blastDmg = 18; }
      this.bullets.push(b);
      if (this.role === 'host') this.emit(['b', Math.round(ox), Math.round(oy), +a.toFixed(3), sp | 0, b.range | 0, +it.pen.toFixed(2), it.flame ? 1 : 0, u.team, (b.tracer ? 1 : 0) | (b.dragon ? 2 : 0), Math.round(mz), +dz.toFixed(3), Math.round(b.drop), +(b.k * 1e6).toFixed(2)]);
    }
    if (u.id === this.localId) this.shake = Math.max(this.shake, (it.type.includes('Heavy') || it.type.includes('Anti') ? 5 : it.pellets ? 4 : 1.5) * (it.recoilMul || 1));
  }
  melee(u, it) {
    if (!it || u.meleeCd > 0 || u.healT > 0) return;
    u.meleeCd = 1 / it.rate; u.swingT = 0.28;
    this.emit(['swing', u.id]);
    if (!this.auth) return;
    let hitAny = false;
    this.units.forEach(o => {
      if (o === u || !o.alive) return;
      const d = Math.hypot(o.x - u.x, o.y - u.y); if (d > it.reach + UNIT_R || Math.abs(o.z - u.z) > 40) return;
      let da = Math.atan2(o.y - u.y, o.x - u.x) - u.angle; da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) > 1.0) return;
      this.damageUnit(o, it.dmg, u, { wid: it.id, kind: 'melee' }); hitAny = true;
    });
    if (!hitAny) {
      const fx = u.x + Math.cos(u.angle) * (it.reach * 0.8), fy = u.y + Math.sin(u.angle) * (it.reach * 0.8);
      const base = this.baseAt(fx, fy, 6); if (base) { this.damageBase(base, it.dmg * 0.25 * (it.breaker ? 2.5 : 1), u); return; }
      const i = this.tileAt(fx, fy);
      if (i >= 0 && this.map.obj[i]) { const mt = MAT[this.map.obj[i]]; if (mt.hard <= (it.breaker || 1.2)) this.damageTile(i, it.dmg * (it.breaker ? 2.5 : 1.2), u.id); }
    }
  }
  useUtil(u, s, ax, ay) {
    const id = u.utils[s]; if (!id || !u.alive) return;
    const it = ITEMS[id];
    if (it.kind === 'c4' && u.c4Live[s]) { // detonate
      const n = u.c4Live[s]; u.c4Live[s] = null; u.utils[s] = null;
      if (this.auth) { const idx = this.nades.indexOf(n); if (idx >= 0) { this.nades.splice(idx, 1); this.explode(n.x, n.y, it.dmg, it.blast, u.id, 'c4', it.id, undefined, { z: (n.z || 0) + 4 }); } }
      return;
    }
    if (!this.auth) return;
    if (it.kind === 'heal') {
      if (u.hp >= 100 && !it.boost) return;
      u.utils[s] = null; u.healT = it.useTime; u.healRate = it.heal / it.useTime; if (it.boost) u.boostT = it.boost;
      this.emit(['heal', u.id]);
      return;
    }
    if (it.kind === 'claymore') {
      u.utils[s] = null;
      this.claymores.push({ x: u.x + Math.cos(u.angle) * 18, y: u.y + Math.sin(u.angle) * 18, z: u.z, a: u.angle, owner: u.id, team: u.team, arm: 1.5, item: id });
      return;
    }
    if (it.kind === 'mine') {
      u.utils[s] = null;
      this.claymores.push({ x: u.x + Math.cos(u.angle) * 14, y: u.y + Math.sin(u.angle) * 14, z: u.z, a: u.angle, owner: u.id, team: u.team, arm: 2, item: id, mine: true });
      return;
    }
    // thrown: a real arc - look higher to throw further (bots work out the angle for the distance)
    const S = it.throwSpeed || (it.kind === 'c4' ? 430 : id === 'rgd5' ? 700 : 640);
    let p = Math.max(-0.6, Math.min(1.1, (u.pitch || 0) + 0.22));
    if (u.ai && ax !== undefined) p = 0.5 * Math.asin(Math.min(1, Math.max(40, Math.hypot(ax - u.x, ay - u.y)) * this.grav / (S * S)));
    const z0 = eyeZ(u) - 8;
    const n = { id: Math.random(), kind: it.kind, x: u.x + Math.cos(u.angle) * 16, y: u.y + Math.sin(u.angle) * 16, z: z0, vx: Math.cos(u.angle) * Math.cos(p) * S, vy: Math.sin(u.angle) * Math.cos(p) * S, vz: Math.sin(p) * S,
      owner: u.id, team: u.team, item: id, dmg: it.dmg, blast: it.blast, fuse: it.fuse || 99, t: 0, impact: !!it.impact };
    if (this.collides(n.x, n.y, 3, z0 - 3, 6)) { n.x = u.x; n.y = u.y; }
    this.nades.push(n);
    if (it.kind === 'c4') u.c4Live[s] = n; else u.utils[s] = null;
    this.emit(['throw', u.id]);
  }

  // ------------------------------------------------------------- damage
  damageUnit(u, dmg, attacker, info) {
    if (!u.alive || u.invulnT > 0 || this.ended) return;
    if (attacker && attacker !== u && !this.enemies(attacker, u) && !this.cfg.friendlyFire) return;
    if (this.mods.has('headonly') && info.kind === 'bullet' && !info.head) return;
    if (this.mods.has('ddmg') && info.kind !== 'fall') dmg *= 2;
    let red = info.kind === 'explosive' ? u.armor.blast : info.kind === 'fire' ? u.armor.reduce * 0.4 : info.kind === 'fall' ? 0 : u.armor.reduce;
    if (info.armorMul) red = Math.min(90, red * info.armorMul);
    if (info.head) { dmg *= HEADSHOT_MUL; red *= 0.5; } // body armour barely protects the head
    dmg *= 1 - red / 100;
    if (this.mods.has('oneshot') && attacker && attacker !== u && info.kind !== 'fall') dmg = Math.max(dmg, u.hp + 1);
    u.hp -= dmg;
    if (attacker && attacker !== u) { u.dmgBy[attacker.id] = this.time; if (this.enemies(attacker, u)) { attacker.ms.damage = (attacker.ms.damage || 0) + Math.min(dmg, dmg + u.hp); if (info.kind === 'bullet') attacker.ms.hits = (attacker.ms.hits || 0) + 1; } }
    u.ms.taken = (u.ms.taken || 0) + dmg; u.hurtT = this.time;
    if (info.kind !== 'fire' || Math.random() < 0.1) this.emit(['hit', u.id, Math.round(u.x), Math.round(u.y), attacker ? attacker.id : '', Math.round(dmg), info.head ? 1 : 0, Math.round(info.z || midZ(u))]);
    if (u.hp <= 0) this.killUnit(u, attacker, info);
  }
  killUnit(u, attacker, info) {
    u.alive = false; u.hp = 0; u.deaths++; u.healT = 0; u.burnT = 0;
    const it = ITEMS[info.wid] || {};
    let flags = '';
    if (attacker && attacker !== u) {
      if (this.enemies(attacker, u)) {
        attacker.kills++; attacker.streak++;
        attacker.multi = this.time - attacker.lastKillT < 4 ? attacker.multi + 1 : 1; attacker.lastKillT = this.time;
        const ms = attacker.ms;
        ms.bestMulti = Math.max(ms.bestMulti, attacker.multi); ms.bestStreak = Math.max(ms.bestStreak, attacker.streak);
        if (info.kind === 'explosive') ms.explosiveKills++;
        if (info.kind === 'fire') ms.fireKills++;
        if (info.kind === 'melee') ms.meleeKills++;
        if (Math.hypot(attacker.x - u.x, attacker.y - u.y) > 50 * T) ms.longShots = (ms.longShots || 0) + 1;
        if (attacker.stance === 'prone') ms.proneKills = (ms.proneKills || 0) + 1;
        if (info.kind !== 'melee' && info.kind !== 'explosive') { const aw = this.wstat(attacker); if (aw && aw.suppressed) ms.quietKills = (ms.quietKills || 0) + 1; }
        if (it.type && (it.type.includes('Sniper') || it.type.includes('Anti'))) ms.sniperKills++;
        if (info.wid) { ms.weaponKills = ms.weaponKills || {}; ms.weaponKills[info.wid] = (ms.weaponKills[info.wid] || 0) + 1; }
        if (info.wall) { ms.wallbangs++; flags += 'W'; }
        if (info.head) { ms.headshots = (ms.headshots || 0) + 1; flags += 'H'; }
        if (attacker.multi >= 2) flags += 'M' + attacker.multi;
      } else { attacker.kills = Math.max(0, attacker.kills - 1); flags += 'T'; }
    }
    for (const id in u.dmgBy) {
      const a = this.byId[id];
      if (a && a !== attacker && this.enemies(a, u) && this.time - u.dmgBy[id] < 10) a.assists++;
    }
    if (this.cfg.mode !== 'deathmatch') u.respawnT = this.respawnTime;
    else if (u.lives > 0) { u.lives--; u.respawnT = this.respawnTime; }
    if (this.mods.has('vampire') && attacker && attacker !== u && attacker.alive && this.enemies(attacker, u)) attacker.hp = Math.min(this.maxHp, attacker.hp + 50);
    else u.out = true;
    // detonate nothing; live C4 stays
    this.emit(['kill', attacker ? attacker.id : '', u.id, info.wid || '', flags, Math.round(u.x), Math.round(u.y), +u.angle.toFixed(2), Math.round(u.z || 0)]);
  }
  damageTile(i, amount, ownerId) {
    const m = this.map, o = m.obj[i]; if (!o) return;
    const mt = MAT[o]; if (mt.hp >= 1e8) return;
    const before = m.hp[i]; m.hp[i] -= amount;
    if (m.hp[i] <= 0) {
      const nobj = o === O.WINDOW ? O.BROKENWIN : 0;
      m.obj[i] = nobj; m.hp[i] = nobj ? MAT[nobj].hp : 0;
      const owner = this.byId[ownerId]; if (owner) owner.ms.destroyed++;
      this.emit(['tile', i, nobj, 1, o]);
      if (mt.explode) this.pendingBooms.push({ t: 0.12, x: (i % m.w) * T + T / 2, y: ((i / m.w) | 0) * T + T / 2, dmg: mt.explode.dmg, r: mt.explode.r, owner: ownerId });
    } else {
      const b0 = Math.floor(before / mt.hp * 5), b1 = Math.floor(m.hp[i] / mt.hp * 5);
      if (b0 !== b1) this.emit(['tile', i, o, +(m.hp[i] / mt.hp).toFixed(2), 0]);
    }
  }
  explode(x, y, dmg, r, ownerId, kind, wid, dir, opts) {
    const owner = this.byId[ownerId];
    opts = opts || {};
    const ez = opts.z !== undefined ? opts.z : this.supportAt(x, y, 20, 2) + 6;
    this.emit(['boom', Math.round(x), Math.round(y), r, kind, Math.round(ez)]);
    if (kind === 'flash') {
      this.units.forEach(u => { if (!u.alive) return; const d = Math.hypot(u.x - x, u.y - y, (eyeZ(u) - ez) * 1.2); if (d < r && this.los(x, y, u.x, u.y, true, false, ez, eyeZ(u))) { u.flashT = Math.max(u.flashT, 4 * (1 - d / r) + 0.5); this.emit(['flashed', u.id, +u.flashT.toFixed(2)]); } });
      return;
    }
    this.units.forEach(u => {
      if (!u.alive) return;
      const d = Math.hypot(u.x - x, u.y - y, (midZ(u) - ez) * 1.3); if (d > r) return;
      if (dir !== undefined) { let da = Math.atan2(u.y - y, u.x - x) - dir; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) > 0.9) return; }
      let f = 0.25 + 0.75 * (1 - d / r);
      if (!this.los(x, y, u.x, u.y, true, false, ez + 4, midZ(u))) f *= 0.35;
      if (u.stance === 'prone' && Math.abs(u.z - ez) < 20) f *= 0.7; // lying flat protects from fragments
      this.damageUnit(u, dmg * f, owner || null, { wid, kind: 'explosive', armorMul: opts.armorMul });
    });
    const sm = opts.structMul || 1;
    if (dir === undefined) this.bases.forEach(b => {
      const d = Math.max(0, Math.hypot(b.x - x, b.y - y) - BASE_HALF * 0.8); if (d > r || b.hp <= 0) return;
      this.damageBase(b, dmg * (0.3 + 0.7 * (1 - d / r)) * (kind === 'c4' ? 2.4 : 1.8) * sm, owner);
    });
    const m = this.map, tr = Math.ceil(r / T), cx = Math.floor(x / T), cy = Math.floor(y / T);
    const mult = (kind === 'c4' || kind === 'rocket' ? 9 : kind === 'barrel' ? 3 : 5) * sm;
    for (let ty = cy - tr; ty <= cy + tr; ty++) for (let tx = cx - tr; tx <= cx + tr; tx++) {
      if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) continue;
      const d = Math.hypot(tx * T + T / 2 - x, ty * T + T / 2 - y); if (d > r) continue;
      if (dir !== undefined) continue;
      const ti = ty * m.w + tx, o = m.obj[ti]; if (!o) continue;
      // things on another floor are sheltered by the floor in between (walls run the full height)
      if (!MAT[o].wall && ez > (OBJ_HT[o] || 40) + 40) continue;
      this.damageTile(ti, dmg * mult * (1 - d / r) + 10, ownerId);
    }
  }

  // ------------------------------------------------------------- events / fx
  emit(ev) { if (this.role === 'host') this.events.push(ev); this.fx(ev); }
  fx(ev) {
    const me = this.byId[this.localId];
    switch (ev[0]) {
      case 'shot': {
        const u = this.byId[ev[1]], it = ITEMS[ev[5]]; if (!it) break;
        const supp = ev[8] & 1, hideFlash = ev[8] & 3;
        // suppressed shots don't give the shooter away (no minimap ping, no flash)
        if (u && !supp) u.lastShotT = this.time; else if (u) u.lastQuietT = this.time;
        Sfx.shot(it, ev[2], ev[3], ev[1], ev[6], supp);
        if (ev[1] === this.localId && u) {
          // real recoil: the muzzle climbs and drifts sideways, moving your aim; it settles back when you stop firing
          const ws = this.wstat(u), r = recoilFor(ws, u), I = this.input;
          this.view.kick(); this.recoilPitch = Math.min(0.05, this.recoilPitch + r * 0.35); // a little camera shake on top
          const side = (Math.random() - 0.5) * r * 0.9 + (this.recoilDrift = (this.recoilDrift || 0) * 0.7 + (Math.random() - 0.45) * r * 0.25);
          I.pitch = Math.min(1.45, I.pitch + r); I.yaw += side;
          this.recoilAcc = (this.recoilAcc || 0) + r; this.lastLocalShot = this.time;
        }
        if (hideFlash) { this.spawnCasing(ev, it); break; }
        if (ev[6] === 'dragon') for (let k = 0; k < 8; k++) { const a = ev[4] + (Math.random() - 0.5) * 0.4, s = 300 + Math.random() * 300; this.particles.push({ type: 'fire', x: ev[2], y: ev[3], vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.35, max: 0.35, size: 7 + Math.random() * 6, drag: 4, top: true }); }
        if (!it.flame) {
          this.particles.push({ type: 'flash', x: ev[2], y: ev[3], z: ev[7], a: ev[4], life: 0.06, max: 0.06, size: (it.pellets || it.type.includes('Heavy') || it.type.includes('Anti') ? 1.6 : it.cat === 'sidearm' ? 0.8 : 1) * (ev[6] === 'dragon' ? 2 : 1) });
          this.spawnCasing(ev, it);
          if (it.explosive) for (let k = 0; k < 6; k++) this.particles.push({ type: 'smoke', x: ev[2], y: ev[3], vx: (Math.random() - 0.5) * 40 - Math.cos(ev[4]) * 60, vy: (Math.random() - 0.5) * 40 - Math.sin(ev[4]) * 60, life: 1.2, max: 1.2, size: 8, grow: 20, color: '200,200,200', drag: 1 });
        }
        break; }
      case 'b': if (!this.auth) this.bullets.push({ x: ev[1], y: ev[2], z: ev[10] || 44, dz: ev[11] || 0, dx: Math.cos(ev[3]), dy: Math.sin(ev[3]), speed: ev[4], range: ev[5], pen: ev[6], flame: !!ev[7], team: ev[8], tracer: !!(ev[9] & 1), dragon: !!(ev[9] & 2), dmg: 30, dist: 0, lastIdx: -1, auth: false, structMul: 1, drop: ev[12] || 0, k: (ev[13] || 0) / 1e6, v0: ev[4] }); break;
      case 'heal': { const u = this.byId[ev[1]]; if (u) Sfx.heal(u.x, u.y); break; }
      case 'basedown': {
        const b = this.bases.find(x => x.team === ev[1]); if (!b) break;
        b.hp = 0; this.baseDestroyedFx(b); Sfx.boom(b.x, b.y, true, 'c4');
        this.particles.push({ type: 'glow', x: b.x, y: b.y, life: 0.6, max: 0.6, size: 220, color: '255,200,120' });
        for (let k = 0; k < 30; k++) { const a = Math.random() * 6.28, s = Math.random() * 220; this.particles.push({ type: 'smoke', x: b.x, y: b.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 3, max: 3, size: 14, grow: 30, color: '60,55,50', drag: 2, top: true }); }
        if (me) this.msg(me.team === b.team ? 'YOUR BASE WAS DESTROYED' : 'ENEMY BASE DESTROYED!', 4, me.team === b.team ? '#ef5350' : '#7cd67c');
        break; }
      case 'spotted': if (me && me.team === ev[1] && !this.ffa) this.msg(ev[2] ? 'Intel update: the enemy base has been marked on your map.' : 'Enemy base located! It is now marked on your map.', 3, '#ffd34a'); break;
      case 'swing': { const u = this.byId[ev[1]]; if (u) { u.swingT = 0.28; Sfx.swing(u.x, u.y); } break; }
      case 'throw': { const u = this.byId[ev[1]]; if (u) Sfx.pin(u.x, u.y); break; }
      case 'hit': {
        const u = this.byId[ev[1]], hz = ev[7] || 36;
        for (let k = 0; k < (ev[6] ? 9 : 5); k++) this.particles.push({ type: 'blood', x: ev[2], y: ev[3], z: hz - 30, vx: (Math.random() - 0.5) * 140, vy: (Math.random() - 0.5) * 140, life: 0.4, max: 0.4, size: 2 + Math.random() * 2, drag: 5 });
        if (Math.random() < 0.4 && hz < 70) this.mr.decal('blood', ev[2], ev[3], 12);
        Sfx.hit(ev[2], ev[3]);
        if (ev[4] === this.localId && ev[1] !== this.localId) { this.hitMarkT = 0.15; if (ev[6]) this.headMarkUntil = this.time + 0.5; Sfx.hitmarker(); }
        if (ev[1] === this.localId) { this.dmgFlash = Math.min(0.6, this.dmgFlash + ev[5] / 60); this.shake = Math.max(this.shake, 3); const a = this.byId[ev[4]]; if (a && a.id !== this.localId) this.hitDirs.push({ a: Math.atan2(a.y - ev[3], a.x - ev[2]), t: this.time }); }
        break; }
      case 'kill': { if (ev[1] === this.localId && ev[2] !== this.localId) this.killMarkUntil = this.time + 0.6;
        const killer = this.byId[ev[1]], victim = this.byId[ev[2]];
        if (victim) {
          this.corpses.push({ x: ev[5], y: ev[6], z: ev[8] || 0, angle: ev[7], helmet: this.helmetFor(victim), uniform: victim.uniform, armor: victim.lo.armor, armorSkin: victim.skins[victim.lo.armor], face: victim.face || null, t: 0, born: this.time,
            // bodies fade after 30-60 s (the same on every client: seeded by who died and where)
            ttl: 30 + 30 * hash2(Math.round(ev[5]), Math.round(ev[6]), (victim.deaths || 0) + 7) });
          if (!(ev[8] > 20)) this.mr.decal('blood', ev[5], ev[6], 26);
          if (!this.auth) { victim.alive = false; }
        }
        this.killfeed.push({ k: killer ? killer.name : '', kt: killer ? killer.team : -1, v: victim ? victim.name : '?', vt: victim ? victim.team : -1, w: ITEMS[ev[3]] ? ITEMS[ev[3]].name : '', flags: ev[4], t: this.time });
        if (this.killfeed.length > 6) this.killfeed.shift();
        if (ev[1] === this.localId && ev[2] !== this.localId) {
          Sfx.kill();
          const mm = /M(\d)/.exec(ev[4] || ''); if (mm) this.msg(['', '', 'DOUBLE KILL!', 'TRIPLE KILL!', 'QUAD KILL!', 'PENTA KILL!'][Math.min(5, +mm[1])] || 'MULTI KILL!', 1.6, '#ffd34a');
          else if ((ev[4] || '').includes('H')) this.msg(`HEADSHOT! ${victim ? victim.name : ''}`, 1.4, '#ffd34a');
          else this.msg(`Killed ${victim ? victim.name : ''}${(ev[4] || '').includes('W') ? ' through cover!' : ''}`, 1.2, '#ff8a65');
        }
        if (ev[2] === this.localId) { Sfx.death(); this.spectate = ev[1] || null; this.msg(killer && killer !== victim ? `Killed by ${killer.name} (${ITEMS[ev[3]] ? ITEMS[ev[3]].name : ''})` : 'You died', 3, '#ef5350'); }
        break; }
      case 'tile': {
        const m = this.map, i = ev[1], x = i % m.w, y = (i / m.w) | 0;
        if (!this.auth) { m.obj[i] = ev[2]; if (ev[2]) m.hp[i] = MAT[ev[2]].hp * ev[3]; }
        if (ev[4]) { // destroyed
          const om = MAT[ev[4]];
          this.mr.decal('rubble', x * T, y * T, this.mr.objColor(ev[4], m.tint[i]));
          const col = this.mr.objColor(ev[4], m.tint[i]);
          for (let k = 0; k < 8; k++) this.particles.push({ type: 'debris', x: x * T + T / 2, y: y * T + T / 2, vx: (Math.random() - 0.5) * 220, vy: (Math.random() - 0.5) * 220, life: 0.6, max: 0.6, size: 2 + Math.random() * 3, color: ev[4] === O.BUSH || ev[4] === O.WHEAT ? '#4a6a2a' : col, drag: 4 });
          if (om.glass) Sfx.glass(x * T, y * T);
          // update minimap pixel
          const mg = this.minimap.getContext('2d'), sx = this.minimap.width / m.w, sy = this.minimap.height / m.h;
          mg.fillStyle = FLOOR_INFO[m.floor[i]].mm; mg.fillRect(Math.floor(x * sx), Math.floor(y * sy), Math.ceil(sx), Math.ceil(sy));
        }
        this.mr.redrawObjects(x - 2, y - 1, 4, 3);
        for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) if (xx >= 0 && yy >= 0 && xx < m.w && yy < m.h) this.view.tileChanged(yy * m.w + xx);
        break; }
      case 'boom': {
        const [, x, y, r, kind] = ev, z = (ev[5] || 6) - 6;
        if (kind === 'flash') {
          Sfx.boom(x, y); for (let k = 0; k < 4; k++) this.particles.push({ type: 'glow', x, y, z, life: 0.25, max: 0.25, size: r * 0.6, color: '255,255,255' });
          break;
        }
        Sfx.boom(x, y, r > 120, kind);
        if (z < 20) this.mr.decal('scorch', x, y, r * 0.6);
        this.particles.push({ type: 'glow', x, y, z, life: 0.35, max: 0.35, size: r * 1.3, color: '255,200,120' });
        for (let k = 0; k < 26; k++) { const a = Math.random() * 6.28, s = Math.random() * r * 3; this.particles.push({ type: 'fire', x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4 + Math.random() * 0.3, max: 0.7, size: 6 + Math.random() * 10, drag: 4, top: true }); }
        for (let k = 0; k < 18; k++) { const a = Math.random() * 6.28, s = Math.random() * r * 1.5; this.particles.push({ type: 'smoke', x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 2 + Math.random() * 1.5, max: 3.5, size: 10, grow: 26, color: '60,55,50', drag: 2, top: true }); }
        for (let k = 0; k < 16; k++) { const a = Math.random() * 6.28, s = 200 + Math.random() * 400; this.particles.push({ type: 'spark', x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.3 + Math.random() * 0.3, max: 0.6, drag: 3 }); }
        if (me) { const d = Math.hypot(me.x - x, me.y - y); this.shake = Math.max(this.shake, Math.max(0, 18 - d / 40)); }
        break; }
      case 'flashed': if (ev[1] === this.localId) { const u = this.byId[ev[1]]; if (u) u.flashT = ev[2]; Sfx.flash(); } break;
      case 'fire': if (!this.auth) this.fires.push({ x: ev[1], y: ev[2], r: ev[3], t: ev[4], z: ev[5] || 0 }); Sfx.ignite(ev[1], ev[2]); break;
      case 'smoke': if (!this.auth) this.smokes.push({ x: ev[1], y: ev[2], r: 10, maxR: ev[3], t: ev[4], z: ev[5] || 0, gas: !!ev[6] }); break;
      case 'impact': this.impactFx(ev[1], ev[2], ev[3], ev[4]); break;
      case 'end': if (!this.auth) this.finish(ev[1]); break;
    }
  }
  impactFx(x, y, hard, z) {
    z = z === undefined ? 30 : z;
    for (let k = 0; k < 3; k++) this.particles.push({ type: hard > 0 ? 'spark' : 'debris', x, y, z: z - 20, vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 160, life: 0.2, max: 0.2, size: 1.5, color: '#a89a7a', drag: 6 });
    this.particles.push({ type: 'smoke', x, y, z: z - 12, vx: 0, vy: 0, life: 0.5, max: 0.5, size: 3, grow: 14, color: '170,160,140', drag: 1 });
  }
  msg(text, dur, color) { this.msgs.push({ text, t: dur || 2, max: dur || 2, color: color || '#fff' }); if (this.msgs.length > 3) this.msgs.shift(); }
  helmetFor(u) { const me = this.byId[this.localId]; if (!me) return u.team === 0 ? 'green' : 'black'; return u.id === me.id || (!this.ffa && u.team === me.team) ? 'green' : 'black'; }

  // ------------------------------------------------------------- update
  loop(now) {
    if (!this.running) return;
    const frameDt = Math.max(0, Math.min(0.05, (now - this.last) / 1000)); this.last = now;
    let dt = frameDt;
    if (this.paused && this.role === 'local') dt = 0;
    if (this.ended) dt *= 0.35;
    try { this.update(dt); this.render(frameDt); } catch (e) { console.error(e); }
    requestAnimationFrame(this.loop);
  }
  update(dt) {
    if (this.input.take('escape') && this.onEscape && !this.input.locked && performance.now() - this.input.unlockT > 400) this.onEscape();
    if (dt <= 0) return;
    this.time += dt;
    const me = this.byId[this.localId];
    const inp = (this.paused || this.uiBlocked) ? { mx: 0, my: 0, utils: [], slot: null } : this.localInput();
    Sfx.setListener(this.cam.x, this.cam.y, this.cam.yaw || 0);

    if (this.role === 'client') { this.updateClient(dt, inp); return; }

    // local player
    if (me && me.alive) this.applyInput(me, inp, dt);
    else if (me && inp && this.input.take('mouse0')) this.cycleSpectate();
    // remote players (host)
    for (const id in this.remoteInputs) {
      const u = this.byId[id], ri = this.remoteInputs[id]; if (!u || !u.alive) { if (ri) ri.utils = []; continue; }
      if (ri.spawnId === u.spawnId && ri.x !== undefined) { const d = Math.hypot(ri.x - u.x, ri.y - u.y); const rz = ri.z || 0; if (d < 200 && Math.abs(rz - u.z) < 240 && !this.collides(ri.x, ri.y, UNIT_R - 3, rz, 10)) { u.moving = d > 0.5; if (u.moving) u.walk += d * 0.06; u.x = ri.x; u.y = ri.y; u.z = rz; u.grounded = !!ri.gr; u.onLadder = !!ri.lad; } }
      this.applyInput(u, ri, dt, true);
      ri.utils = []; ri.slot = null; ri.reload = false; ri.melee = false; ri.light = false; ri.gear = false;
    }
    // velocity estimates (used by bots to lead targets)
    this.units.forEach(u => { if (u.lastX !== undefined) { u.velX = u.velX * 0.7 + (u.x - u.lastX) / dt * 0.3; u.velY = u.velY * 0.7 + (u.y - u.lastY) / dt * 0.3; } else { u.velX = u.velY = 0; } u.lastX = u.x; u.lastY = u.y; });
    // bots
    this.units.forEach(u => { if (u.ai && u.alive) this.applyInput(u, u.ai.think(dt), dt); });
    this.updateUnits(dt);
    this.updateProjectiles(dt);
    this.updateWorld(dt);
    this.updateConceal();
    this.updateMode(dt);
    this.baseAlerts();
    if (this.role === 'host') { this.netT -= dt; if (this.netT <= 0) { this.netT = 0.05; this.sendSnapshot(); } }
    this.updateCamera(dt);
  }
  updateUnits(dt) {
    this.units.forEach(u => {
      if (!u.alive) {
        if (u.respawnT > 0 && !this.ended) { u.respawnT -= dt; if (u.respawnT <= 0) this.spawn(u, false); }
        return;
      }
      u.fireCd -= dt; u.meleeCd -= dt; u.swingT = Math.max(0, u.swingT - dt); u.invulnT -= dt; u.flashT = Math.max(0, u.flashT - dt); u.boostT -= dt;
      const it = this.wstat(u);
      if (u.burst > 0 && u.fireCd <= 0 && u.reloadT <= 0) {
        if (u.mag[u.slot] > 0) { this.shoot(u, it); u.burst--; u.fireCd = u.burst > 0 ? 60 / it.rpm : 0.32; if (u.mag[u.slot] <= 0) { u.burst = 0; this.startReload(u); } } else u.burst = 0;
      }
      if (u.reloadT > 0) { u.reloadT -= dt; if (u.reloadT <= 0) { u.mag[u.slot] = it.mag; u.reloadT = 0; } }
      if (u.healT > 0) { u.healT -= dt; u.hp = Math.min(this.maxHp, u.hp + u.healRate * dt); }
      if (this.mods.has('regen') && u.alive && this.time - (u.hurtT || -9) > 4 && u.hp < this.maxHp) u.hp = Math.min(this.maxHp, u.hp + this.maxHp * 0.12 * dt);
      if (u.burnT > 0) { u.burnT -= dt; this.damageUnit(u, 9 * dt, this.byId[u.burnBy], { wid: 'molotov', kind: 'fire' });
        if (Math.random() < 0.5) this.particles.push({ type: 'fire', x: u.x + (Math.random() - 0.5) * 14, y: u.y + (Math.random() - 0.5) * 14, vx: 0, vy: -20, life: 0.4, max: 0.4, size: 6, drag: 1, top: true }); }
    });
    // soft separation between units
    const alive = this.units.filter(u => u.alive);
    for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i], b = alive[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d > 0 && d < UNIT_R * 2 && Math.abs(a.z - b.z) < 40) { const p = (UNIT_R * 2 - d) / 2, nx = dx / d * p, ny = dy / d * p;
        if (!a.isRemote) this.moveUnit(a, -nx, -ny); if (!b.isRemote) this.moveUnit(b, nx, ny); }
    }
  }
  // what a bullet at height z is passing through in tile i: { mt (material), o (tile object or 0), kind } or null
  bulletSolid(i, x, y, z0, z1) {
    const m = this.map, lo = Math.min(z0, z1), hi = Math.max(z0, z1);
    for (const s of this.solidsAt(i, x, y)) {
      const thin = s[2] === 'slab' || s[2] === 'roof';
      if (thin ? (hi < s[0] || lo > s[1]) : (z1 < s[0] || z1 > s[1])) continue;
      const o = m.obj[i];
      if (s[2] === 'obj' || s[2] === 'glass') {
        if (!o) continue; const mt = MAT[o];
        if (mt.round && Math.hypot(x - (i % m.w) * T - T / 2, y - ((i / m.w) | 0) * T - T / 2) > mt.round) continue;
        return { mt: s[2] === 'glass' ? MAT[O.WINDOW] : o === O.WINDOW || o === O.BROKENWIN ? MAT[(m.buildings[m.bld[i]] || {}).wall || O.CONCRETE] : mt, o: s[2] === 'glass' || !(o === O.WINDOW || o === O.BROKENWIN) ? o : 0, kind: s[2] };
      }
      const wall = (m.buildings[m.bld[i]] || {}).wall || O.CONCRETE;
      return { mt: s[2] === 'lintel' ? MAT[wall] : { hard: s[2] === 'roof' ? 3.5 : 3, hp: 1e9 }, o: 0, kind: s[2] };
    }
    return null;
  }
  // Ricochet Rounds: bounce a stopped bullet off the face it hit (the side it crossed into the tile through, or the
  // top/bottom of a floor) - at most twice, losing speed and damage each time
  ricochet(b, step, pz) {
    if (!this.mods.has('ricochet') || b.flame || (b.bounces || 0) >= 2) return false;
    const px = b.x - b.dx * step, py = b.y - b.dy * step;
    if (Math.floor(px / T) !== Math.floor(b.x / T)) b.dx = -b.dx; else if (Math.floor(py / T) !== Math.floor(b.y / T)) b.dy = -b.dy; else b.dz = -b.dz;
    b.x = px; b.y = py; b.z = pz; b.bounces = (b.bounces || 0) + 1; b.dmg *= 0.7; if (b.k) b.speed *= 0.7; b.lastIdx = -1; b.wall = true;
    if (b.dx || b.dy) { const a = Math.atan2(b.dy, b.dx) + (Math.random() - 0.5) * 0.2; b.dx = Math.cos(a); b.dy = Math.sin(a); }
    return true;
  }
  // share of its muzzle energy a bullet still carries, as damage dealt (E ~ v^2, flattened a little for gameplay)
  energy(b) { return b.k && b.v0 ? Math.max(0.15, Math.pow(b.speed / b.v0, 1.6)) : 1; }
  updateBullet(b, dt) {
    const m = this.map;
    let rem = b.speed * dt;
    if (b.flame) { b.speed *= Math.pow(0.25, dt); }
    if (b.z === undefined) { b.z = 44; b.dz = 0; }
    // soldiers anywhere near this frame's flight path (so long-flying bullets stay cheap)
    const pad = UNIT_R + 16, ex = b.x + b.dx * rem, ey = b.y + b.dy * rem;
    const x0 = Math.min(b.x, ex) - pad, x1 = Math.max(b.x, ex) + pad, y0 = Math.min(b.y, ey) - pad, y1 = Math.max(b.y, ey) + pad;
    const near = this.units.filter(u => u.alive && u.x > x0 && u.x < x1 && u.y > y0 && u.y < y1);
    while (rem > 0) {
      const step = Math.min(rem, 6); rem -= step;
      const pz = b.z;
      b.x += b.dx * step; b.y += b.dy * step; b.dist += step; b.z += b.dz * step;
      const wa = this.waterAt(b.x, b.y), under = wa && b.z < wa.surf;
      if (under && !b.wet) { b.wet = true; if (this.onScreen(b.x, b.y)) this.splash(b.x, b.y, wa.surf, 4); if (b.flame || !b.k) return false; }
      if (b.k) { const v1 = b.speed * Math.exp(-b.k * (under ? 830 : 1) * step); rem *= v1 / b.speed; b.speed = v1; } // air (or water) drag slows the bullet (and how far it gets this frame)
      if (b.drop) b.dz -= b.drop * step / (b.speed * b.speed); // gravity: dvz = -g dt, dt = step / speed
      // flames burn out; bullets fly on until they hit something, the ground or the edge of the map (or are spent)
      if ((b.flame || b.dragon) && b.dist > b.range) return false;
      if (b.dist > 60000 || b.k && b.speed < 1300) return false;
      const i = this.tileAt(b.x, b.y); if (i < 0 || b.z > 3000) return false;
      const gz = this.groundAt(b.x, b.y);
      if (b.z <= gz) {
        if (this.onScreen(b.x, b.y) && !b.flame) this.impactFx(b.x, b.y, 0, gz + 2);
        if (this.mods.has('ricochet') && !b.flame && b.dz > -0.35 && (b.bounces || 0) < 2) { b.z = gz + 1; b.dz = Math.abs(b.dz) * 0.5; b.bounces = (b.bounces || 0) + 1; b.dmg *= 0.7; if (b.k) b.speed *= 0.7; b.wall = true; continue; }
        return false;
      }
      const hitS = this.bulletSolid(i, b.x, b.y, pz, b.z);
      const key = hitS ? i * 8 + ['obj', 'glass', 'slab', 'roof', 'stair', 'lintel'].indexOf(hitS.kind) : -1;
      if (key !== b.lastIdx) {
        b.lastIdx = key;
        if (hitS) {
          const mt = hitS.mt, o = hitS.o;
          if (b.flame) {
            if (mt.fire && b.auth && o) { this.damageTile(i, b.dmg * 1.5, b.owner); if (Math.random() < 0.004 * b.burnMul) this.addFire(b.x, b.y, 40, 5 * b.burnMul, b.owner, this.supportAt(b.x, b.y, b.z)); }
            if (!mt.mesh) return false;
          } else {
            const tile = o ? i : -1, dmgTile = (amt) => { if (b.auth && tile >= 0) this.damageTile(tile, amt, b.owner); };
            // tracers, incendiary rounds and dragon's breath can set flammable cover alight
            if (b.auth && mt.fire && (b.tracer && Math.random() < 0.03 || b.inc && Math.random() < 0.25 || b.dragon && Math.random() < 0.3)) this.addFire(b.x, b.y, 34, 4, b.owner, this.supportAt(b.x, b.y, b.z));
            if (mt.hard === 0) {
              dmgTile(b.dmg * 0.6 * b.structMul); b.dmg *= 0.96;
            } else if (mt.hard <= b.pen * this.energy(b)) {
              dmgTile(b.dmg * 1.2 * b.structMul * this.energy(b));
              // punching through slows the bullet down
              const pen = b.pen * this.energy(b); b.dmg *= 1 - 0.45 * mt.hard / (pen + 0.5); b.pen -= mt.hard * 0.6; b.wall = true; if (b.k) b.speed *= Math.max(0.5, 1 - 0.12 * mt.hard);
              if (this.onScreen(b.x, b.y)) { this.impactFx(b.x, b.y, mt.hard, b.z); Sfx.tileHit(b.x, b.y, mt.hard); }
            } else {
              dmgTile(b.dmg * (0.25 + 0.3 * b.pen / Math.min(mt.hard, 6)) * (b.structMul > 1 && mt.hard <= 2.5 ? b.structMul : 1));
              if (this.onScreen(b.x, b.y)) { this.impactFx(b.x - b.dx * 3, b.y - b.dy * 3, mt.hard, b.z); Sfx.tileHit(b.x, b.y, mt.hard); }
              if (b.blast && b.auth) this.explode(b.x - b.dx * 4, b.y - b.dy * 4, b.blastDmg, b.blast, b.owner, 'he', b.wid, undefined, { z: b.z });
              if (this.ricochet(b, step, pz)) continue;
              return false;
            }
          }
        }
      }
      if (this.bases.length) {
        const base = this.baseAt(b.x, b.y);
        if (base && b.z < base.gz + 70) {
          if (b.auth) {
            this.damageBase(base, b.dmg * (b.flame ? 0.15 : 0.3 * Math.max(0.5, Math.min(3, b.pen))) * b.structMul, this.byId[b.owner]);
            if (b.blast) this.explode(b.x - b.dx * 4, b.y - b.dy * 4, b.blastDmg, b.blast, b.owner, 'he', b.wid, undefined, { z: b.z });
          }
          if (!b.flame && this.onScreen(b.x, b.y)) { this.impactFx(b.x - b.dx * 3, b.y - b.dy * 3, 4); Sfx.tileHit(b.x, b.y, 5); }
          return false;
        }
      }
      for (const u of near) {
        if (!u.alive || u.id === b.owner || (b.hit && b.hit.has(u.id))) continue;
        if (!this.ffa && !this.cfg.friendlyFire && u.team === b.team) continue;
        if ((u.x - b.x) ** 2 + (u.y - b.y) ** 2 > (UNIT_R + 2) ** 2) continue;
        const top = u.z + STANCES[u.stance || 'stand'].h;
        if (b.z < u.z - (b.flame ? 14 : 2) || b.z > top + (b.flame ? 14 : 2)) continue;
        if (b.auth) {
          // damage follows the energy the bullet still carries after drag
          const fall = b.flame ? 1 : b.k ? this.energy(b) : 1 - 0.25 * Math.min(1, b.dist / Math.max(1, b.range));
          const owner = this.byId[b.owner];
          if (b.flame) { (b.hit = b.hit || new Set()).add(u.id); this.damageUnit(u, b.dmg, owner, { wid: b.wid, kind: 'fire' }); if (u.alive) { u.burnT = 2.5 * b.burnMul; u.burnBy = b.owner; } continue; }
          const head = b.z > top - (u.stance === 'prone' ? 7 : 11) * (this.mods.has('bigheads') ? 1.9 : 1);
          this.damageUnit(u, b.dmg * fall, owner, { wid: b.wid, kind: 'bullet', wall: b.wall, armorMul: b.armorMul, head, z: b.z });
          if (u.alive && (b.inc || b.dragon)) { u.burnT = Math.max(u.burnT, b.dragon ? 2 : 1.5); u.burnBy = b.owner; }
          if (b.blast) this.explode(b.x, b.y, b.blastDmg, b.blast, b.owner, 'he', b.wid, undefined, { z: b.z });
        }
        if (b.flame) { (b.hit = b.hit || new Set()).add(u.id); continue; }
        return false;
      }
    }
    return true;
  }
  addFire(x, y, r, t, owner, z) { z = z || 0; this.fires.push({ x, y, r, t, owner, tick: 0, z }); this.emit(['fire', Math.round(x), Math.round(y), r, t, Math.round(z)]); }
  addFlare(x, y, t, r) { this.flares.push({ x, y, t: t || 25, r: r || 640 }); }
  updateProjectiles(dt) {
    this.bullets = this.bullets.filter(b => this.updateBullet(b, dt));
    const keep = [];
    for (const n of this.nades) {
      n.t += dt;
      if (n.kind === 'rocket' || n.kind === 'gl' || n.kind === 'he12' || n.kind === 'illum' || n.kind === 'smoke40') {
        if (n.lob) n.vz -= this.grav * dt;
        const step = Math.hypot(n.vx, n.vy) * dt;
        const nx = n.x + n.vx * dt, ny = n.y + n.vy * dt, nz = n.z + n.vz * dt; n.travel += step;
        let hit = false;
        const i = this.tileAt(nx, ny);
        if (i < 0 || nz < this.supportAt(nx, ny, n.z, 2)) hit = true;
        else if (n.travel > 30 && this.collides(nx, ny, 2, nz - 2, 4)) hit = true;
        if (n.travel > 30) { const bb = this.baseAt(nx, ny, 2); if (bb && nz < bb.gz + 70) hit = true; }
        if (n.travel > 40 && n.kind !== 'illum') for (const u of this.units) if (u.alive && u.id !== n.owner && Math.hypot(u.x - nx, u.y - ny) < UNIT_R + 4 && nz > u.z - 4 && nz < u.z + STANCES[u.stance].h + 4 && (this.ffa || this.cfg.friendlyFire || u.team !== n.team)) hit = true;
        if (n.travel >= n.maxTravel) hit = true;
        // illumination flares pop at the top of their arc
        if (n.kind === 'illum' && n.vz < 0 && !hit) { this.addFlare(n.x, n.y); this.emit(['boom', Math.round(n.x), Math.round(n.y), 0, 'pop', Math.round(n.z)]); continue; }
        if (n.kind === 'rocket') this.particles.push({ type: 'smoke', x: n.x, y: n.y, z: n.z - 20, vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20, life: 1.2, max: 1.2, size: 5, grow: 18, color: '190,190,190', drag: 1 });
        if (!hit) { n.x = nx; n.y = ny; n.z = nz; }
        if (hit) {
          const gz = this.supportAt(n.x, n.y, n.z, 2);
          if (n.kind === 'illum') { this.addFlare(n.x, n.y); this.emit(['boom', Math.round(n.x), Math.round(n.y), 0, 'pop', Math.round(n.z)]); }
          else if (n.kind === 'smoke40') { this.smokes.push({ x: n.x, y: n.y, r: 10, maxR: 110, t: 12, z: gz }); this.emit(['smoke', Math.round(n.x), Math.round(n.y), 110, 12, Math.round(gz)]); this.emit(['boom', Math.round(n.x), Math.round(n.y), 0, 'pop', Math.round(n.z)]); }
          else { this.explode(n.x, n.y, n.dmg, n.blast, n.owner, n.kind === 'he12' ? 'he' : n.kind, n.item, undefined, { structMul: n.structMul, armorMul: n.armorMul, z: n.z }); if (n.fire) this.addFire(n.x, n.y, n.blast * 0.6, 6, n.owner, gz); }
          continue;
        }
        keep.push(n); continue;
      }
      // thrown items: fly in an arc, bounce off walls, floors and ceilings, then roll to a stop
      if (!n.stuck) {
        n.vz -= this.grav * dt;
        const nx = n.x + n.vx * dt, ny = n.y + n.vy * dt, nz = n.z + n.vz * dt;
        const blocked = (x, y) => this.collides(x, y, 3, n.z - 2, 4) || this.tileAt(x, y) < 0;
        let bounced = false;
        if (blocked(nx, n.y)) { n.vx *= -0.4; bounced = true; } else n.x = nx;
        if (blocked(n.x, ny)) { n.vy *= -0.4; bounced = true; } else n.y = ny;
        const sup = this.supportAt(n.x, n.y, n.z, 3), ceil = this.ceilingAt(n.x, n.y, n.z);
        n.z = nz;
        if (n.z + 3 > ceil && n.vz > 0) { n.z = ceil - 3; n.vz = -n.vz * 0.3; bounced = true; }
        if (n.z <= sup) {
          n.z = sup;
          if (n.vz < -140) { n.vz = -n.vz * 0.3; n.vx *= 0.6; n.vy *= 0.6; bounced = true; }
          else { n.vz = 0; const f = Math.pow(0.04, dt); n.vx *= f; n.vy *= f; }
        }
        if (bounced && (n.kind === 'molotov' || n.impact)) n.fuse = 0;
        if (bounced && n.kind === 'c4') { n.vx = n.vy = 0; if (n.z > sup + 2) n.stuck = true; }
        // glass windows break when hit by thrown objects
        const wi = this.tileAt(n.x + n.vx * 0.03, n.y + n.vy * 0.03); if (wi >= 0 && this.map.obj[wi] === O.WINDOW && n.z > 30 && n.z < 62) this.damageTile(wi, 50, n.owner);
      }
      if (n.kind !== 'c4') n.fuse -= dt;
      if (n.fuse <= 0) {
        if (n.kind === 'frag') this.explode(n.x, n.y, n.dmg, n.blast, n.owner, 'frag', n.item, undefined, { z: n.z + 4 });
        else if (n.kind === 'satchel') this.explode(n.x, n.y, n.dmg, n.blast, n.owner, 'c4', n.item, undefined, { z: n.z + 4, structMul: 1.6 });
        else if (n.kind === 'thermite') { this.addFire(n.x, n.y, n.blast, 16, n.owner, this.supportAt(n.x, n.y, n.z + 4, 3)); this.fires[this.fires.length - 1].hot = 2.2; this.emit(['boom', Math.round(n.x), Math.round(n.y), 0, 'pop', Math.round(n.z)]); }
        else if (n.kind === 'gas') { this.smokes.push({ x: n.x, y: n.y, r: 10, maxR: 120, t: 16, z: n.z, gas: true }); this.emit(['smoke', Math.round(n.x), Math.round(n.y), 120, 16, Math.round(n.z), 1]); this.emit(['boom', Math.round(n.x), Math.round(n.y), 0, 'pop', Math.round(n.z)]); }
        else if (n.kind === 'flash') this.explode(n.x, n.y, 0, n.blast, n.owner, 'flash', n.item, undefined, { z: n.z + 4 });
        else if (n.kind === 'smoke') { this.smokes.push({ x: n.x, y: n.y, r: 10, maxR: 130, t: 14, z: n.z }); this.emit(['smoke', Math.round(n.x), Math.round(n.y), 130, 14, Math.round(n.z)]); this.emit(['boom', Math.round(n.x), Math.round(n.y), 0, 'pop', Math.round(n.z)]); }
        else if (n.kind === 'flare') { this.addFlare(n.x, n.y, 35, 360); this.emit(['boom', Math.round(n.x), Math.round(n.y), 0, 'pop', Math.round(n.z)]); }
        else if (n.kind === 'molotov') { this.addFire(n.x, n.y, n.blast, 7, n.owner, this.supportAt(n.x, n.y, n.z + 4, 3)); Sfx.glass(n.x, n.y); }
        continue;
      }
      keep.push(n);
    }
    this.nades = keep;
    // claymores
    this.claymores = this.claymores.filter(c => {
      c.arm -= dt; if (c.arm > 0) return true;
      for (const u of this.units) {
        if (!u.alive || (!this.ffa && u.team === c.team) || u.id === c.owner) continue;
        const d = Math.hypot(u.x - c.x, u.y - c.y); if (d > (c.mine ? 46 : 110) || Math.abs(u.z - (c.z || 0)) > 40) continue;
        // bouncing mine: jumps to waist height and blows in every direction
        if (c.mine) { const it = ITEMS[c.item]; this.explode(c.x, c.y, it.dmg, it.blast, c.owner, 'frag', c.item, undefined, { z: (c.z || 0) + 30 }); return false; }
        let da = Math.atan2(u.y - c.y, u.x - c.x) - c.a; da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) < 0.9) { const it = ITEMS[c.item]; this.explode(c.x, c.y, it.dmg, it.blast, c.owner, 'claymore', c.item, c.a, { z: (c.z || 0) + 8 }); this.emit(['boom', Math.round(c.x), Math.round(c.y), 60, 'frag', Math.round((c.z || 0) + 8)]); return false; }
      }
      return true;
    });
    // chain explosions from barrels / cars
    this.pendingBooms = this.pendingBooms.filter(p => { p.t -= dt; if (p.t <= 0) { this.explode(p.x, p.y, p.dmg, p.r, p.owner, 'barrel', 'barrel'); return false; } return true; });
  }
  updateWorld(dt) {
    // fires
    this.fires = this.fires.filter(f => {
      f.t -= dt; f.tick = (f.tick || 0) - dt;
      if (this.onScreen(f.x, f.y) && Math.random() < 0.7) { const a = Math.random() * 6.28, r = Math.random() * f.r; this.particles.push({ type: 'fire', x: f.x + Math.cos(a) * r, y: f.y + Math.sin(a) * r, z: f.z || 0, vx: 0, vy: -25, life: 0.6, max: 0.6, size: 8 + Math.random() * 8, drag: 1, top: true }); }
      if (this.auth && f.tick <= 0) {
        f.tick = 0.25;
        this.units.forEach(u => { if (u.alive && Math.hypot(u.x - f.x, u.y - f.y) < f.r && Math.abs(u.z - (f.z || 0)) < 30) { this.damageUnit(u, 6 * (f.hot || 1), this.byId[f.owner], { wid: f.hot ? 'thermite' : 'molotov', kind: 'fire' }); if (u.alive) { u.burnT = Math.max(u.burnT, 2); u.burnBy = f.owner; } } });
        const m = this.map, tr = Math.ceil(f.r / T);
        for (let ty = Math.floor(f.y / T) - tr; ty <= Math.floor(f.y / T) + tr; ty++) for (let tx = Math.floor(f.x / T) - tr; tx <= Math.floor(f.x / T) + tr; tx++) {
          if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) continue; const i = ty * m.w + tx, o = m.obj[i];
          if (o && MAT[o].fire && Math.hypot(tx * T + T / 2 - f.x, ty * T + T / 2 - f.y) < f.r + T / 2) { this.damageTile(i, 18, f.owner); if (!m.obj[i]) this.mr.decal('burn', tx * T, ty * T); }
        }
      }
      return f.t > 0;
    });
    this.flares = this.flares.filter(f => {
      f.t -= dt; if (f.t < 4) f.r = 640 * Math.max(0.2, f.t / 4);
      if (this.onScreen(f.x, f.y, 200) && Math.random() < 0.6) this.particles.push({ type: 'spark', x: f.x + (Math.random() - 0.5) * 6, y: f.y + (Math.random() - 0.5) * 6, vx: (Math.random() - 0.5) * 60, vy: 40 + Math.random() * 60, life: 0.5, max: 0.5, drag: 1 });
      return f.t > 0;
    });
    this.units.forEach(u => { if (u.gasT > 0) u.gasT -= dt; });
    this.smokes = this.smokes.filter(s => {
      s.t -= dt; s.r = Math.min(s.maxR, s.r + dt * 90); if (s.t < 2) s.r *= 0.995;
      if (this.onScreen(s.x, s.y) && Math.random() < 0.5) { const a = Math.random() * 6.28, r = Math.random() * s.r * 0.8; this.particles.push({ type: 'smoke', x: s.x + Math.cos(a) * r, y: s.y + Math.sin(a) * r, z: s.z, vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10, life: 2.5, max: 2.5, size: 28, grow: 16, color: s.gas ? '214,214,170' : '205,208,210', drag: 1, top: true, alpha: Math.min(1, s.t / 2) * 0.55 }); }
      // tear gas: slow damage and slowed movement inside the cloud
      if (s.gas && this.auth) { s.tick = (s.tick || 0) - dt; if (s.tick <= 0) { s.tick = 0.5; this.units.forEach(u => { if (u.alive && Math.hypot(u.x - s.x, u.y - s.y) < s.r * 0.85 && Math.abs(u.z - (s.z || 0)) < 80) { this.damageUnit(u, 3, null, { wid: 'gas', kind: 'fire' }); u.gasT = 1; } }); } }
      return s.t > 0;
    });
    // particles
    this.particles = this.particles.filter(p => {
      p.life -= dt; if (p.life <= 0) return false;
      if (p.vx !== undefined) { p.x += p.vx * dt; p.y += p.vy * dt; if (p.drag) { const f = Math.max(0, 1 - p.drag * dt); p.vx *= f; p.vy *= f; } }
      if (p.grow) p.size += p.grow * dt;
      return true;
    });
    if (this.particles.length > 1800) this.particles.splice(0, this.particles.length - 1800);
    if (this.corpses.length && this.corpses.some(c => this.time - c.born > (c.ttl || 45))) this.corpses = this.corpses.filter(c => this.time - c.born <= (c.ttl || 45));
    if (this.corpses.length > 60) this.corpses.shift();
    this.msgs.forEach(m => m.t -= dt); this.msgs = this.msgs.filter(m => m.t > 0);
    this.hitMarkT -= dt; this.dmgFlash = Math.max(0, this.dmgFlash - dt * 0.8); this.shake = Math.max(0, this.shake - dt * 25);
  }
  teamsInPlay() {
    const s = new Set();
    this.units.forEach(u => { if (u.alive || (u.respawnT > 0 && !u.out)) s.add(u.team); });
    return s;
  }
  updateMode(dt) {
    if (this.ended) return;
    this.timeLeft -= dt;
    const mode = this.cfg.mode;
    if (mode === 'snd') {
      this.spotT = (this.spotT || 0) - dt;
      if (this.spotT <= 0) {
        this.spotT = 0.25;
        this.bases.forEach(b => { if (b.hp <= 0) return; for (const u of this.units) {
          if (!u.alive || u.team === b.team || b.seen[u.team]) continue;
          const d = Math.hypot(u.x - b.x, u.y - b.y), see = this.night ? Math.max(300, this.sightRange(u)) : 900;
          if (d < see && this.los(u.x, u.y, b.x, b.y, false, b)) { b.seen[u.team] = true; this.emit(['spotted', u.team]); break; }
        } });
      }
      // intel drop: a castle nobody has found after 4 minutes is revealed so matches don't stall
      if (this.timeLimit - this.timeLeft >= 240) this.bases.forEach(b => { for (let t = 0; t < this.nTeams; t++) if (t !== b.team && !b.seen[t] && b.hp > 0) { b.seen[t] = true; this.emit(['spotted', t, 1]); } });
      // last team with a standing castle wins; teams that lose theirs stop respawning
      this.bases.forEach(b => { if (b.hp <= 0) this.units.forEach(u => { if (u.team === b.team && !u.alive) { u.out = true; u.respawnT = 0; } }); });
      const alive = this.bases.filter(b => b.hp > 0);
      if (alive.length <= 1) return this.endMatch(alive.length ? alive[0].team : -1);
      if (this.timeLeft <= 0) { const best = Math.max(...alive.map(b => b.hp)), top = alive.filter(b => b.hp === best); return this.endMatch(top.length === 1 ? top[0].team : -1); }
      return;
    }
    if (mode === 'zone') {
      const z = this.map.zone, counts = {};
      this.units.forEach(u => { if (u.alive && Math.hypot(u.x - z.x, u.y - z.y) < z.r) { counts[u.team] = (counts[u.team] || 0) + 1; if (this.ffa) u.zoneTime += dt; } });
      if (!this.ffa) {
        // the team with the most soldiers inside captures (at half speed while others are inside too)
        const present = Object.keys(counts).map(Number), most = Math.max(0, ...present.map(t => counts[t])), leaders = present.filter(t => counts[t] === most);
        this.zone.contested = present.length > 1;
        this.zone.holder = leaders.length === 1 ? leaders[0] : -1;
        if (this.zone.holder >= 0) {
          this.zone.prog[this.zone.holder] += dt * (this.zone.contested ? 0.5 : 1);
          if (this.zone.prog[this.zone.holder] >= 30) return this.endMatch(this.zone.holder);
        }
        if (this.timeLeft <= 0) { const best = Math.max(...this.zone.prog), top = this.zone.prog.map((p, t) => p === best ? t : -1).filter(t => t >= 0); return this.endMatch(top.length === 1 ? top[0] : -1); }
      } else {
        this.zone.contested = Object.keys(counts).length > 1;
        this.zone.holder = Object.keys(counts).length === 1 ? +Object.keys(counts)[0] : -1;
        if (this.timeLeft <= 0) { let best = null; this.units.forEach(u => { if (!best || u.zoneTime > best.zoneTime) best = u; }); return this.endMatch(best ? best.team : -1); }
      }
      return;
    }
    if (mode === 'score') {
      if (this.timeLeft > 0) return;
      const sc = this.teamScores(), best = Math.max(...Object.values(sc)), top = Object.keys(sc).filter(t => sc[t] === best);
      return this.endMatch(top.length === 1 ? +top[0] : -1);
    }
    const teams = this.teamsInPlay();
    if (teams.size <= 1) return this.endMatch(teams.size ? [...teams][0] : -1);
    if (this.timeLeft <= 0) {
      const score = {}; this.units.forEach(u => { score[u.team] = (score[u.team] || 0) + (u.alive ? 1000 : 0) + (u.lives === Infinity ? 0 : u.lives * 1000) + u.kills; });
      let best = -1, bs = -1; for (const t in score) if (score[t] > bs) { bs = score[t]; best = +t; }
      this.endMatch(best);
    }
  }
  // battle royale points: kills +100, assists +50, deaths -50 (team score = sum of its players)
  unitScore(u) { return u.kills * 100 + u.assists * 50 - u.deaths * 50; }
  teamScores() { const sc = {}; this.units.forEach(u => { sc[u.team] = (sc[u.team] || 0) + this.unitScore(u); }); return sc; }
  endMatch(winner) {
    if (this.ended) return;
    const result = {
      winner, ffa: this.ffa, mode: this.cfg.mode, teamNames: this.cfg.teamNames, zone: this.zone.prog.slice(), night: this.night, bases: this.bases.map(b => Math.round(b.hp)),
      units: this.units.map(u => ({ id: u.id, name: u.name, team: u.team, isBot: u.isBot, kills: u.kills, deaths: u.deaths, assists: u.assists, zoneTime: Math.round(u.zoneTime), score: this.unitScore(u), ms: u.ms })), duration: Math.round(this.time),
    };
    this.emit(['end', result]);
    this.finish(result);
  }
  finish(result) {
    if (this.ended) return;
    this.input.unlock();
    this.ended = true; this.result = result;
    const me = this.byId[this.localId];
    const won = me && result.winner === me.team;
    this.msg(result.winner < 0 ? 'DRAW' : won ? 'VICTORY' : 'DEFEAT', 5, won ? '#7cd67c' : '#ef5350');
    setTimeout(() => { if (this.cfg.onEnd) this.cfg.onEnd(result); }, 2600);
  }
  cycleSpectate() {
    const me = this.byId[this.localId];
    const list = this.units.filter(u => u.alive && (this.ffa || !me || u.team === me.team || true));
    if (!list.length) return;
    const i = list.findIndex(u => u.id === this.spectate);
    this.spectate = list[(i + 1) % list.length].id;
  }
  updateCamera(dt) {
    const me = this.byId[this.localId];
    let target = me && me.alive ? me : this.byId[this.spectate];
    if (!target || !target.alive) { target = this.units.find(u => u.alive && me && u.team === me.team) || this.units.find(u => u.alive); if (target) this.spectate = target.id; }
    if (!target) return;
    this.cam.x = target.x; this.cam.y = target.y; this.cam.yaw = target === me ? this.input.yaw : target.angle;
    this.recoilPitch *= Math.pow(0.002, dt);
    // recoil recovery: after a short pause the aim settles back about 70% of the way to where it was
    if (this.recoilAcc > 0 && this.time - (this.lastLocalShot || 0) > 0.09) { const back = Math.min(this.recoilAcc, this.recoilAcc * dt * 7 + dt * 0.02); this.input.pitch -= back * 0.7; this.recoilAcc -= back; }
    // scope sway on magnified optics; holding breath (hold the "hold breath" key, Shift by default) steadies it for 4 s
    const meS = this.byId[this.localId], sw = meS && meS.alive && meS.scoped ? this.wstat(meS) : null, mag = sw && (sw.scope || sw.optic && sw.optic.scopeKind);
    if (mag) {
      const I = this.input, hold = I.down('hold') && (this.breath = this.breath === undefined ? 4 : this.breath) > 0;
      this.breath = Math.max(0, Math.min(4, (this.breath === undefined ? 4 : this.breath) + (hold ? -dt : dt * 0.6)));
      const amp = (hold ? 0.0006 : this.breath <= 0 ? 0.004 : 0.0022) * (meS.stance === 'prone' ? 0.35 : meS.stance === 'crouch' ? 0.65 : 1) * (sw.bipod && meS.stance !== 'stand' ? 0.3 : 1);
      const t = this.time, sx = (Math.sin(t * 0.9) + Math.sin(t * 2.3) * 0.4) * amp, sy = (Math.sin(t * 1.3 + 1) + Math.cos(t * 2.9) * 0.4) * amp;
      I.yaw += sx - (this.swayX || 0); I.pitch += sy - (this.swayY || 0); this.swayX = sx; this.swayY = sy; this.holdingBreath = hold;
    } else { this.swayX = this.swayY = 0; this.holdingBreath = false; }
    const it = me && me.alive ? ITEMS[me.slots[me.slot]] : null;
    const ws = me && me.alive ? this.wstat(me) : null;
    this.input.zoomSens = ws && me.scoped ? (ws.adsFov || (ws.scope ? 18 : 60)) / 75 : 1;
  }
  onScreen(x, y, m) { return Math.hypot(x - this.cam.x, y - this.cam.y) < 1500 + (m || 0); }

  // ------------------------------------------------------------- networking
  sendSnapshot() {
    const snap = {
      t: 'snap', tl: Math.round(this.timeLeft), z: [this.zone.holder, this.zone.contested ? 1 : 0, ...this.zone.prog.map(p => +p.toFixed(1))],
      u: this.units.map(u => [u.id, Math.round(u.x), Math.round(u.y), +u.angle.toFixed(2), Math.ceil(u.hp), u.alive ? 1 : 0, u.slot, u.mag[u.slot], u.reloadT > 0 ? +(1 - u.reloadT / this.wstat(u).reload).toFixed(2) : 0,
        u.kills, u.deaths, u.assists, u.lives === Infinity ? -1 : u.lives, +u.respawnT.toFixed(1), u.spawnId, u.utils.map((x, i) => x ? (u.c4Live[i] ? x + '*' : x) : '').join(','), +u.spin.toFixed(2),
        Math.round(u.zoneTime), u.out ? 1 : 0, u.burnT > 0 ? 1 : 0, u.healT > 0 ? 1 : 0, u.invulnT > 0 ? 1 : 0, u.mag.join(','), u.moving ? 1 : 0, u.light ? 1 : 0, u.gearOn ? 1 : 0,
        Math.round(u.z), STANCE_CODE.indexOf(u.stance), +(u.pitch || 0).toFixed(2), u.onLadder ? 1 : 0]),
      n: this.nades.map(n => [n.kind, Math.round(n.x), Math.round(n.y), +(n.t).toFixed(2), Math.round(n.z || 0), +Math.atan2(n.vy || 0, n.vx || 1).toFixed(2)]),
      c: this.claymores.map(c => [Math.round(c.x), Math.round(c.y), +c.a.toFixed(2), c.team, Math.round(c.z || 0)]),
      bs: this.bases.map(b => [Math.ceil(b.hp), +(this.time - b.hitT).toFixed(1), b.seen.map(x => x ? 1 : 0).join('')]),
      fl: this.flares.map(f => [Math.round(f.x), Math.round(f.y), +f.t.toFixed(1), Math.round(f.r)]),
      e: this.events,
    };
    this.events = [];
    this.cfg.net.broadcast(snap);
  }
  onNetMessage(from, msg) {
    if (this.role === 'host' && msg.t === 'in') {
      const prev = this.remoteInputs[from] || { utils: [] };
      msg.utils = (prev.utils || []).concat(msg.utils || []);
      if (prev.slot !== null && prev.slot !== undefined && (msg.slot === null || msg.slot === undefined)) msg.slot = prev.slot;
      msg.reload = msg.reload || prev.reload; msg.melee = msg.melee || prev.melee; msg.light = msg.light || prev.light; msg.gear = msg.gear || prev.gear;
      this.remoteInputs[from] = msg;
    } else if (this.role === 'client' && msg.t === 'snap') {
      this.applySnapshot(msg);
    }
  }
  playerLeft(id) { const u = this.byId[id]; if (u && this.auth) { u.isBot = true; u.isRemote = false; u.name += ' (bot)'; u.ai = new BotBrain(this, u); delete this.remoteInputs[id]; } }
  applySnapshot(s) {
    this.timeLeft = s.tl; this.zone.holder = s.z[0]; this.zone.contested = !!s.z[1]; this.zone.prog = s.z.slice(2);
    s.u.forEach(a => {
      const u = this.byId[a[0]]; if (!u) return;
      const wasAlive = u.alive;
      u.hp = a[4]; u.alive = !!a[5]; u.kills = a[9]; u.deaths = a[10]; u.assists = a[11]; u.lives = a[12] < 0 ? Infinity : a[12]; u.respawnT = a[13];
      u.utils = a[15].split(',').map(x => x ? x.replace('*', '') : null); u.c4Live = a[15].split(',').map(x => x.endsWith('*') ? {} : null);
      u.zoneTime = a[17]; u.out = !!a[18]; u.burnT = a[19] ? 1 : 0; u.healT = a[20] ? 1 : 0; u.invulnT = a[21] ? 1 : 0;
      const mags = a[22].split(',').map(Number);
      // own light/goggles come from the host too, except right after toggling them locally
      if (u.id !== this.localId || this.time - (u.toggleT || -9) > 1) { u.light = !!a[24]; u.gearOn = !!a[25]; }
      if (u.id === this.localId) {
        if (u.spawnId !== a[14] || !wasAlive && u.alive) { u.x = a[1]; u.y = a[2]; u.z = a[26] || 0; u.vz = 0; u.grounded = true; u.stance = 'stand'; this.input.stance = 'stand'; u.spawnId = a[14]; this.input.yaw = a[3]; this.input.pitch = 0; } // face the way the host spawned us
        u.mag = mags; u.reloadPct = a[8]; u.slotSrv = a[6]; u.spin = a[16];
      } else {
        u.px = u.x; u.py = u.y; u.tx = a[1]; u.ty = a[2]; u.ta = a[3]; u.lerpT = 0; u.tz = a[26] || 0; u.stance = STANCE_CODE[a[27]] || 'stand'; u.pitch = a[28] || 0; u.onLadder = !!a[29];
        if (u.spawnId !== a[14] || !wasAlive) { u.x = a[1]; u.y = a[2]; u.spawnId = a[14]; }
        u.slot = a[6]; u.mag = mags; u.reloadPct = a[8]; u.spin = a[16]; u.moving = !!a[23];
      }
    });
    this.nades = s.n.map(n => ({ kind: n[0], x: n[1], y: n[2], t: n[3], z: n[4], vx: Math.cos(n[5] || 0), vy: Math.sin(n[5] || 0) }));
    this.claymores = s.c.map(c => ({ x: c[0], y: c[1], a: c[2], team: c[3], z: c[4] || 0, arm: 0 }));
    (s.bs || []).forEach((v, i) => { const b = this.bases[i]; if (!b) return; if (b.hp > 0 && v[0] <= 0) this.baseTileIdx(b).forEach(k => this.baseTiles.delete(k)); b.hp = v[0]; b.seen = v[2].split('').map(c => c === '1'); b.hitT = this.time - v[1]; });
    this.flares = (s.fl || []).map(f => ({ x: f[0], y: f[1], t: f[2], r: f[3] }));
    s.e.forEach(ev => this.fx(ev));
  }
  updateClient(dt, inp) {
    const me = this.byId[this.localId];
    // own movement predicted locally
    if (me && me.alive) {
      const slotReq = inp.slot;
      this.applyInputClient(me, inp, dt);
      this.seq++;
      this.netT -= dt;
      this.pendingUtils = (this.pendingUtils || []).concat(inp.utils || []);
      this.pendingSlot = slotReq !== null && slotReq !== undefined ? slotReq : this.pendingSlot;
      this.pendingReload = this.pendingReload || inp.reload; this.pendingMelee = this.pendingMelee || inp.melee;
      this.pendingLight = this.pendingLight || inp.light; this.pendingGear = this.pendingGear || inp.gear;
      if (this.netT <= 0) {
        this.netT = 0.033;
        this.cfg.net.send({ t: 'in', x: Math.round(me.x * 10) / 10, y: Math.round(me.y * 10) / 10, z: Math.round(me.z * 10) / 10, gr: me.grounded ? 1 : 0, lad: me.onLadder ? 1 : 0, stance: me.stance, pitch: +inp.pitch.toFixed(3), spawnId: me.spawnId, ax: Math.round(inp.ax), ay: Math.round(inp.ay), fire: inp.fire, scope: inp.scope, sprint: inp.sprint,
          slot: this.pendingSlot, reload: this.pendingReload, melee: this.pendingMelee, utils: this.pendingUtils, light: this.pendingLight, gear: this.pendingGear });
        this.pendingUtils = []; this.pendingSlot = null; this.pendingReload = false; this.pendingMelee = false; this.pendingLight = false; this.pendingGear = false;
      }
    } else if (me && this.input.take('mouse0')) this.cycleSpectate();
    // interpolate others
    this.units.forEach(u => {
      if (u.id === this.localId) return;
      if (u.tx !== undefined) { u.lerpT = Math.min(1, (u.lerpT || 0) + dt / 0.05); const k = Math.min(1, dt * 15); u.x += (u.tx - u.x) * k; u.y += (u.ty - u.y) * k; u.z = (u.z || 0) + ((u.tz || 0) - (u.z || 0)) * k;
        let da = u.ta - u.angle; da = Math.atan2(Math.sin(da), Math.cos(da)); u.angle += da * k; if (u.moving) u.walk += dt * 9; }
      u.swingT = Math.max(0, u.swingT - dt);
      u.flashT = Math.max(0, u.flashT - dt);
    });
    if (me) { me.swingT = Math.max(0, me.swingT - dt); me.flashT = Math.max(0, me.flashT - dt); }
    this.bullets = this.bullets.filter(b => this.updateBullet(b, dt));
    this.updateWorld(dt);
    this.updateConceal();
    this.baseAlerts();
    this.updateCamera(dt);
  }
  applyInputClient(u, inp, dt) {
    if (inp.slot !== null && inp.slot !== undefined && u.slots[inp.slot]) u.slot = inp.slot;
    if (inp.ax || inp.ay) u.angle = Math.atan2(inp.ay - u.y, inp.ax - u.x);
    if (inp.light || inp.gear) this.toggleLightGear(u, inp);
    u.scoped = !!inp.scope;
    const it = ITEMS[u.slots[u.slot]];
    if (inp.pitch !== undefined) u.pitch = inp.pitch;
    this.moveBody(u, inp, dt, this.moveSpeed(u, inp, it));
    if (inp.melee || (inp.fire && it && it.cat === 'melee')) { if ((u.meleeCdC || 0) <= this.time) { u.meleeCdC = this.time + 1 / ITEMS[inp.melee ? (u.slots[3] || 'fists') : it.id].rate; u.swingT = 0.28; } }
    if (inp.reload && it && it.mag) Sfx.reload(u.x, u.y, it);
  }
  // warn the local player when their base takes damage
  baseAlerts() {
    const me = this.byId[this.localId]; if (!me || !this.bases.length) return;
    const b = this.bases.find(x => x.team === me.team); if (!b) return;
    if (this.time - b.hitT < 0.5 && b.hp > 0 && this.time - (this.baseWarnT || -99) > 10) { this.baseWarnT = this.time; this.msg('Your base is under attack!', 2.5, '#ff8a65'); }
  }

  // ------------------------------------------------------------- rendering
  render(dt) {
    this.collectLights();
    this.view.render(dt || 0.016);
    const g = this.g, W = this.canvas.width, H = this.canvas.height, me = this.byId[this.localId];
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    this.renderHUD(g, W, H, me);
    const hint = document.querySelector('#lock-hint');
    if (hint) hint.classList.toggle('hidden', this.input.locked || this.ended || this.paused || !!this.uiBlocked);
  }
  // names above allies (and enemies you are aiming at), castle health bars
  renderTags(g, me) {
    const yaw = this.cam.yaw || 0;
    g.font = 'bold 12px Segoe UI, sans-serif'; g.textAlign = 'center';
    this.units.forEach(u => {
      if (!u.alive || u === me || !me) return;
      const friendly = !this.ffa && u.team === me.team, d = Math.hypot(u.x - me.x, u.y - me.y);
      if (!friendly) {
        let da = Math.atan2(u.y - me.y, u.x - me.x) - yaw; da = Math.atan2(Math.sin(da), Math.cos(da));
        if (d > 700 || Math.abs(da) > 0.12 + 14 / Math.max(1, d) || !this.visibleTo(me, u) || !this.los(me.x, me.y, u.x, u.y, false, false, eyeZ(me), midZ(u))) return;
      } else if (d > 1400) return;
      const p = this.view.project(u.x, (u.z || 0) + STANCES[u.stance || 'stand'].h + 8, u.y); if (!p) return;
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(p.x - 18, p.y - 3, 36, 5);
      g.fillStyle = friendly ? '#66bb6a' : '#ef5350'; g.fillRect(p.x - 17, p.y - 2, 34 * Math.max(0, u.hp) / this.maxHp, 3);
      g.fillStyle = friendly ? '#c8f0c8' : '#ffc8c8'; g.fillText(u.name, p.x, p.y - 8);
    });
    this.bases.forEach(b => {
      if (b.hp <= 0 || !me || !(b.team === me.team || b.seen[me.team])) return;
      const p = this.view.project(b.x, 130, b.y); if (!p) return;
      const mine = b.team === me.team, d = Math.round(Math.hypot(b.x - me.x, b.y - me.y) / T);
      g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(p.x - 31, p.y - 4, 62, 8); g.fillStyle = mine ? '#66bb6a' : '#ef5350'; g.fillRect(p.x - 30, p.y - 3, 60 * b.hp / BASE_HP, 6);
      g.fillStyle = '#fff'; g.font = 'bold 11px Segoe UI, sans-serif'; g.fillText(`${mine ? 'YOUR BASE' : 'ENEMY BASE'} · ${d} m`, p.x, p.y - 10);
    });
  }
  // night vision tube effects drawn over the 3D view: halos round light sources, scintillation grain and the
  // tube's limited field of view (one circle on the PVS-7, one eye on the PVS-14, four tubes on the GPNVG)
  renderNightVision(g, W, H, me) {
    const v = me && me.alive ? me : this.byId[this.spectate], nv = v && this.night && v.gearOn && (v.gear.vision === 'nv' || v.gear.vision === 'fused');
    if (!nv || this.uiBlocked) return;
    const gear = v.gear, white = gear.phosphor === 'white', tint = white ? '220,235,240' : '170,255,150';
    // halos (blooming) around bright lights
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const h of this.view.nvHalos || []) { const r = Math.max(14, h.r), gr = g.createRadialGradient(h.x, h.y, 0, h.x, h.y, r); gr.addColorStop(0, `rgba(${tint},${0.85 * h.a})`); gr.addColorStop(0.25, `rgba(${tint},${0.35 * h.a})`); gr.addColorStop(1, `rgba(${tint},0)`); g.fillStyle = gr; g.fillRect(h.x - r, h.y - r, r * 2, r * 2); }
    g.restore();
    // scintillation: sparkling grain that is stronger when the picture is dark
    if (!this.nvNoise) { this.nvNoise = []; for (let n = 0; n < 4; n++) { const c = Tex.cv(256, 256), cg = c.getContext('2d'), id = cg.createImageData(256, 256); for (let i = 0; i < id.data.length; i += 4) { const on = Math.random() < 0.06, b = on ? 255 : Math.random() * 90; id.data[i] = b; id.data[i + 1] = b; id.data[i + 2] = b; id.data[i + 3] = on ? 200 : Math.random() * 120; } cg.putImageData(id, 0, 0); this.nvNoise.push(c); } }
    g.save(); g.globalAlpha = (gear.grain || 0.12) * (1.6 - (this.view.nvGain || 1) * 0.6); g.globalCompositeOperation = 'screen';
    g.fillStyle = g.createPattern(this.nvNoise[(this.time * 30 | 0) % 4], 'repeat'); g.translate(Math.random() * 256, Math.random() * 256); g.fillRect(-256, -256, W + 512, H + 512); g.restore();
    // tube field of view: dark outside the tubes, a soft edge inside
    const R = H / 2 * (gear.fov || 0.9), cx = W / 2, cy = H / 2;
    const tubes = gear.tube === 'quad' ? [[cx - R * 0.42, cy, R * 0.98], [cx + R * 0.42, cy, R * 0.98], [cx - R * 1.15, cy + R * 0.02, R * 0.8], [cx + R * 1.15, cy + R * 0.02, R * 0.8]] : gear.tube === 'mono' ? [[cx + R * 0.05, cy, R]] : [[cx, cy, R]];
    const key = W + 'x' + H + gear.id;
    if (this.nvMaskKey !== key) { // darkness outside the tubes, with a soft edge (built once per screen size and goggle)
      const c = this.nvMask = Tex.cv(Math.ceil(W), Math.ceil(H)), mg = c.getContext('2d');
      mg.fillStyle = gear.tube === 'mono' ? 'rgba(2,4,8,0.9)' : 'rgba(0,0,0,0.97)'; mg.fillRect(0, 0, W, H); // the naked eye beside a monocular still sees a little
      mg.globalCompositeOperation = 'destination-out';
      tubes.forEach(([x, y, r]) => { const gr = mg.createRadialGradient(x, y, r * 0.7, x, y, r); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)'); mg.fillStyle = gr; mg.beginPath(); mg.arc(x, y, r, 0, Math.PI * 2); mg.fill(); });
      this.nvMaskKey = key;
    }
    g.drawImage(this.nvMask, 0, 0, W, H);
  }
  renderHUD(g, W, H, me) {
    const s = this.dpr || 1;
    // vignette
    const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    if (this.dmgFlash > 0) { const rg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.7); rg.addColorStop(0, 'rgba(180,0,0,0)'); rg.addColorStop(1, `rgba(180,0,0,${this.dmgFlash})`); g.fillStyle = rg; g.fillRect(0, 0, W, H); }
    if (me && me.alive && me.hp < 30) { g.fillStyle = `rgba(120,0,0,${0.15 + Math.sin(this.time * 4) * 0.08})`; g.fillRect(0, 0, W, H); }
    g.save(); g.scale(s, s); W /= s; H /= s;
    this.renderNightVision(g, W, H, me);
    // sniper scope overlay sits under the rest of the HUD
    { const sIt = me && me.alive ? this.wstat(me) : null, kind = sIt && me.scoped ? (sIt.optic && sIt.optic.scopeKind) || (sIt.scope ? 'sniper' : '') : '';
      if (kind === 'acog' && !this.uiBlocked) {
        // 4x combat scope: dark ring around the image, chevron reticle
        const r = Math.min(W, H) * 0.36;
        g.fillStyle = '#050505'; g.beginPath(); g.rect(0, 0, W, H); g.arc(W / 2, H / 2, r, 0, Math.PI * 2, true); g.fill();
        g.strokeStyle = '#222'; g.lineWidth = 10; g.beginPath(); g.arc(W / 2, H / 2, r - 4, 0, 7); g.stroke();
        g.strokeStyle = sIt.optic.thermalSight ? '#fff' : '#e53935'; g.lineWidth = 2; g.beginPath(); g.moveTo(W / 2 - 7, H / 2 + 7); g.lineTo(W / 2, H / 2); g.lineTo(W / 2 + 7, H / 2 + 7); g.stroke();
        g.strokeStyle = 'rgba(0,0,0,0.8)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(W / 2, H / 2 + 12); g.lineTo(W / 2, H / 2 + r); g.stroke(); g.lineWidth = 1;
      }
      if (kind === 'sniper' && !this.uiBlocked) {
        const r = Math.min(W, H) * 0.44;
        g.fillStyle = '#000'; g.beginPath(); g.rect(0, 0, W, H); g.arc(W / 2, H / 2, r, 0, Math.PI * 2, true); g.fill();
        const vg = g.createRadialGradient(W / 2, H / 2, r * 0.8, W / 2, H / 2, r); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.85)'); g.fillStyle = vg; g.beginPath(); g.arc(W / 2, H / 2, r, 0, 7); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.9)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(W / 2 - r, H / 2); g.lineTo(W / 2 + r, H / 2); g.moveTo(W / 2, H / 2 - r); g.lineTo(W / 2, H / 2 + r); g.stroke();
        g.lineWidth = 4; g.beginPath(); g.moveTo(W / 2 - r, H / 2); g.lineTo(W / 2 - r * 0.15, H / 2); g.moveTo(W / 2 + r * 0.15, H / 2); g.lineTo(W / 2 + r, H / 2); g.moveTo(W / 2, H / 2 + r * 0.15); g.lineTo(W / 2, H / 2 + r); g.stroke(); g.lineWidth = 1;
      } }
    g.font = '600 13px Segoe UI, sans-serif'; g.textBaseline = 'middle';
    const panel = (x, y, w, h) => { g.fillStyle = 'rgba(10,14,10,0.62)'; g.fillRect(x, y, w, h); g.strokeStyle = 'rgba(160,190,120,0.25)'; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); };
    if (me) {
      // health / armour
      panel(16, H - 78, 250, 62);
      g.fillStyle = '#ddd'; g.textAlign = 'left'; g.fillText('HEALTH', 28, H - 64);
      g.fillStyle = '#222'; g.fillRect(28, H - 54, 226, 14);
      const hpc = me.hp > 60 ? '#66bb6a' : me.hp > 30 ? '#ffca28' : '#ef5350';
      g.fillStyle = hpc; g.fillRect(28, H - 54, 226 * Math.max(0, me.hp) / this.maxHp, 14);
      g.fillStyle = '#fff'; g.textAlign = 'right'; g.fillText(Math.max(0, Math.ceil(me.hp)), 252, H - 64);
      g.textAlign = 'left'; g.fillStyle = '#aab'; g.font = '12px Segoe UI, sans-serif';
      g.fillText(`${me.armor.name}${me.armor.reduce ? ` (-${me.armor.reduce}%)` : ''}  ·  ${me.weight.toFixed(1)} kg  ·  ${Math.round(me.speedMul * 100)}% speed`, 28, H - 28);
      if (me.boostT > 0) { g.fillStyle = '#4fc3f7'; g.fillText('ADRENALINE', 180, H - 64); }
      if (me.healT > 0) { g.fillStyle = '#81c784'; g.fillText('HEALING...', 180, H - 64); }
      if (me.burnT > 0) { g.fillStyle = '#ff7043'; g.fillText('BURNING!', 110, H - 64); }
      // status chips: concealment, weapon light, night gear
      const chips = [];
      if (me.alive) chips.push([me.onLadder ? 'CLIMBING' : me.stance === 'prone' ? 'PRONE' : me.stance === 'crouch' ? 'CROUCHED' : 'STANDING', '#cfd8dc']);
      if (me.alive && me.conceal) chips.push(['CONCEALED', '#a5d6a7']);
      if (me.light) chips.push(['LIGHT ON', '#ffe082']);
      if (me.gear.vision) chips.push([`${me.gear.vision === 'ir' ? 'THERMAL' : me.gear.vision === 'fused' ? 'ENVG' : 'NVG'} ${me.gearOn ? 'ON' : 'OFF'} (N)`, me.gearOn ? '#9fe0a0' : '#889']);
      g.font = '600 11px Segoe UI, sans-serif'; g.textAlign = 'left';
      let cx = 232;
      chips.forEach(([t, c]) => { const w = g.measureText(t).width + 12; panel(cx, H - 164, w, 18); g.fillStyle = c; g.fillText(t, cx + 6, H - 155); cx += w + 6; });
      // weapon slots
      const names = ['PRIMARY', 'SIDEARM 1', 'SIDEARM 2', 'MELEE'];
      for (let k = 0; k < 4; k++) {
        const id = me.slots[k]; const x = W - 16 - (4 - k) * 112, y = H - 78;
        panel(x, y, 106, 62);
        if (k === me.slot) { g.strokeStyle = '#c5e1a5'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, 104, 60); g.lineWidth = 1; }
        g.font = '10px Segoe UI, sans-serif'; g.fillStyle = '#889'; g.textAlign = 'left'; g.fillText(`${k + 1}  ${names[k]}`, x + 6, y + 10);
        if (!id) { g.fillStyle = '#555'; g.fillText('empty', x + 6, y + 32); continue; }
        const it = ITEMS[id];
        g.save(); g.translate(x + 40, y + 32); g.scale(1.6, 1.6); Art.drawWeaponTop(g, it, me.skins[id]); g.restore();
        g.font = '600 11px Segoe UI, sans-serif'; g.fillStyle = k === me.slot ? '#fff' : '#bbb'; g.fillText(it.name.length > 16 ? it.name.slice(0, 15) + '…' : it.name, x + 6, y + 52);
        if (it.mag) { g.textAlign = 'right'; g.fillStyle = me.mag[k] === 0 ? '#ef5350' : '#ffe082'; g.fillText(`${me.mag[k]}/${this.wstat(me, k).mag}`, x + 100, y + 10); }
        const am = me.ammo && me.ammo[k] && ITEMS[me.ammo[k]];
        if (am) { g.font = '600 9px Segoe UI, sans-serif'; g.textAlign = 'right'; g.fillStyle = AMMO_KINDS[am.kind].tip === '#111' || AMMO_KINDS[am.kind].tip === '#222' ? '#bbb' : AMMO_KINDS[am.kind].tip; g.fillText(AMMO_KINDS[am.kind].label.toUpperCase().slice(0, 16), x + 100, y + 24); }
      }
      // big ammo readout
      const it = ITEMS[me.slots[me.slot]];
      if (it && it.mag) {
        g.textAlign = 'right'; g.font = 'bold 30px Segoe UI, sans-serif';
        const reloading = this.auth ? me.reloadT > 0 : me.reloadPct > 0;
        g.fillStyle = me.mag[me.slot] === 0 ? '#ef5350' : '#fff';
        g.fillText(reloading ? 'RELOADING' : String(me.mag[me.slot]), W - 70, H - 102);
        g.font = '14px Segoe UI, sans-serif'; g.fillStyle = '#aaa'; g.fillText(reloading ? '' : `/ ${this.wstat(me).mag}`, W - 20, H - 98);
        const am = me.ammo && ITEMS[me.ammo[me.slot]];
        g.font = '600 11px Segoe UI, sans-serif'; g.fillStyle = '#c5cbb8'; g.fillText(`${CALIBERS[it.cal] ? CALIBERS[it.cal].name : ''} · ${am ? am.name : CALIBERS[it.cal] ? CALIBERS[it.cal].def : ''}`, W - 20, H - 124);
        if (reloading) { const pct = this.auth ? 1 - me.reloadT / it.reload : me.reloadPct; g.fillStyle = '#333'; g.fillRect(W - 216, H - 88, 200, 4); g.fillStyle = '#ffe082'; g.fillRect(W - 216, H - 88, 200 * pct, 4); }
        if (it.spinup) { g.fillStyle = '#333'; g.fillRect(W - 216, H - 84, 200, 3); g.fillStyle = '#4fc3f7'; g.fillRect(W - 216, H - 84, 200 * (me.spin || 0), 3); }
      }
      // utilities
      for (let k = 0; k < 3; k++) {
        const x = 16 + k * 70, y = H - 140; panel(x, y, 64, 54);
        if (k === me.utilSel) { g.strokeStyle = '#c5e1a5'; g.strokeRect(x + 1, y + 1, 62, 52); }
        g.font = '10px Segoe UI, sans-serif'; g.fillStyle = '#889'; g.textAlign = 'left'; g.fillText(String(k + 5), x + 5, y + 9);
        const id = me.utils[k];
        if (id) { const ut = ITEMS[id]; drawUtilIcon(g, ut, x + 32, y + 26); g.fillStyle = '#ddd'; g.textAlign = 'center'; g.fillText(me.c4Live[k] ? 'DETONATE' : ut.name.split(' ')[0], x + 32, y + 46); }
        else { g.fillStyle = '#444'; g.textAlign = 'center'; g.fillText('—', x + 32, y + 28); }
      }
    }
    if (me) this.renderTags(g, me);
    // top-center status
    this.renderStatus(g, W, H, me, panel);
    // minimap
    const mm = this.minimap, mw = Math.min(200, mm.width), mh = mw * mm.height / mm.width;
    panel(W - mw - 20, 12, mw + 8, mh + 8);
    g.drawImage(mm, W - mw - 16, 16, mw, mh);
    const msx = mw / (this.map.w * T), msy = mh / (this.map.h * T);
    this.bases.forEach(b => {
      if (b.hp <= 0) return; const mine = me && b.team === me.team;
      if (!mine && !(me && b.seen[me.team])) return;
      const x = W - mw - 16 + b.x * msx, y = 16 + b.y * msy;
      g.fillStyle = mine ? '#66bb6a' : '#ef5350'; g.fillRect(x - 4, y - 4, 8, 8); g.strokeStyle = '#000'; g.strokeRect(x - 4.5, y - 4.5, 9, 9);
    });
    this.units.forEach(u => {
      if (!u.alive) return;
      const friendly = me && (u.id === me.id || (!this.ffa && u.team === me.team));
      if (!friendly && this.time - u.lastShotT > 1.5) return;
      g.fillStyle = u.id === this.localId ? '#fff' : friendly ? '#66bb6a' : '#ef5350';
      g.beginPath(); g.arc(W - mw - 16 + u.x * msx, 16 + u.y * msy, u.id === this.localId ? 3.5 : 2.5, 0, 7); g.fill();
    });
    // view rectangle
    { const cx = W - mw - 16 + this.cam.x * msx, cy = 16 + this.cam.y * msy, a = this.cam.yaw || 0; g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, 26, a - 0.6, a + 0.6); g.closePath(); g.fill(); }
    // kill feed
    g.font = '600 12px Segoe UI, sans-serif'; g.textAlign = 'right';
    this.killfeed.forEach((k, i) => {
      const age = this.time - k.t; if (age > 8) return;
      const y = 30 + mh + 16 + i * 22, a = Math.min(1, (8 - age));
      const tc = t => !me ? '#ddd' : t === me.team && !this.ffa ? '#81c784' : '#ef9a9a';
      const txt = `${k.k ? k.k + '  ' : ''}[${k.w || '?'}]${k.flags && k.flags.includes('W') ? ' ⟂' : ''}${k.flags && k.flags.includes('H') ? ' ⌖' : ''}  ${k.v}`;
      const tw = g.measureText(txt).width; g.globalAlpha = a;
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(W - 20 - tw - 10, y - 10, tw + 14, 20);
      let x = W - 16;
      g.fillStyle = tc(k.vt); g.fillText(k.v, x, y); x -= g.measureText(k.v + '  ').width;
      const mid = `[${k.w || '?'}]${k.flags && k.flags.includes('W') ? ' ⟂' : ''}${k.flags && k.flags.includes('H') ? ' ⌖' : ''}`; g.fillStyle = '#ccc'; g.fillText(mid, x, y); x -= g.measureText(mid + '  ').width;
      if (k.k) { g.fillStyle = tc(k.kt); g.fillText(k.k, x, y); }
      g.globalAlpha = 1;
    });
    // centre messages
    g.textAlign = 'center';
    this.msgs.forEach((m, i) => { g.globalAlpha = Math.min(1, m.t * 2); g.font = i === this.msgs.length - 1 ? 'bold 26px Segoe UI, sans-serif' : 'bold 18px Segoe UI, sans-serif'; g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText(m.text, W / 2 + 2, H * 0.28 + i * 32 + 2); g.fillStyle = m.color; g.fillText(m.text, W / 2, H * 0.28 + i * 32); });
    g.globalAlpha = 1;
    // death / respawn
    if (me && !me.alive && !this.ended) {
      g.font = 'bold 20px Segoe UI, sans-serif'; g.fillStyle = '#fff';
      const sp = this.byId[this.spectate];
      if (me.respawnT > 0) g.fillText(`Respawning in ${Math.ceil(me.respawnT)}...`, W / 2, H * 0.62);
      else g.fillText('ELIMINATED', W / 2, H * 0.62);
      g.font = '14px Segoe UI, sans-serif'; g.fillStyle = '#bbb';
      if (sp) g.fillText(`Spectating ${sp.name}  ·  click to switch`, W / 2, H * 0.62 + 26);
    }
    // red arcs point to whoever just hit you
    if (me && me.alive) {
      this.hitDirs = this.hitDirs.filter(h => this.time - h.t < 1.6);
      this.hitDirs.forEach(h => { const r = h.a - (this.cam.yaw || 0) - Math.PI / 2; g.strokeStyle = `rgba(230,40,30,${0.85 * (1 - (this.time - h.t) / 1.6)})`; g.lineWidth = 8; g.beginPath(); g.arc(W / 2, H / 2, Math.min(W, H) * 0.2, r - 0.3, r + 0.3); g.stroke(); });
      g.lineWidth = 1;
    }
    // crosshair (sniper scopes get a full scope overlay instead)
    const cIt = me && me.alive ? this.wstat(me) : null, optK = cIt && me.scoped ? (cIt.optic && cIt.optic.scopeKind) || (cIt.scope ? 'sniper' : '') : '';
    // red dot / holographic sight: reticle in the middle while aiming
    if (cIt && me.scoped && cIt.optic && cIt.optic.reticle && !this.uiBlocked) {
      g.strokeStyle = 'rgba(255,40,40,0.9)'; g.fillStyle = 'rgba(255,40,40,0.95)';
      if (cIt.optic.reticle === 'holo') { g.lineWidth = 1.5; g.beginPath(); g.arc(W / 2, H / 2, 14, 0, 7); g.stroke(); }
      g.beginPath(); g.arc(W / 2, H / 2, 2, 0, 7); g.fill(); g.lineWidth = 1;
    } else if (optK && !this.uiBlocked) {
      if (this.breath !== undefined && this.breath < 4) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(W / 2 - 60, H - 150, 120, 8); g.fillStyle = this.holdingBreath ? '#81d4fa' : '#90a4ae'; g.fillRect(W / 2 - 60, H - 150, 120 * this.breath / 4, 8); g.font = '11px Segoe UI'; g.textAlign = 'center'; g.fillStyle = '#ddd'; g.fillText(this.holdingBreath ? 'Holding breath' : 'Breath', W / 2, H - 156); }
      if (this.hitMarkT > 0) { g.strokeStyle = '#ff5252'; g.lineWidth = 2; g.beginPath(); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { g.moveTo(W / 2 + a * 8, H / 2 + b * 8); g.lineTo(W / 2 + a * 16, H / 2 + b * 16); }); g.stroke(); g.lineWidth = 1; }
    } else if (me && me.alive && !this.uiBlocked) {
      const it = this.wstat(me);
      const mx = W / 2, my = H / 2;
      // the crosshair gap shows the real spread cone right now (it opens while moving, jumping and during sustained fire)
      const fov = this.view.camera.fov * Math.PI / 180;
      const spr = it && it.spread && it.cat !== 'melee' ? Math.max(3, Math.min(120, Math.tan(aimSpread(me, it, this.time) / 2) / Math.tan(fov / 2) * H / 2)) : 6;
      g.strokeStyle = this.hitMarkT > 0 ? '#ff5252' : 'rgba(255,255,255,0.9)'; g.lineWidth = 2;
      g.beginPath();
      g.moveTo(mx - spr - 7, my); g.lineTo(mx - spr, my); g.moveTo(mx + spr, my); g.lineTo(mx + spr + 7, my);
      g.moveTo(mx, my - spr - 7); g.lineTo(mx, my - spr); g.moveTo(mx, my + spr); g.lineTo(mx, my + spr + 7); g.stroke();
      g.fillStyle = '#fff'; g.fillRect(mx - 1, my - 1, 2, 2);
      if (this.hitMarkT > 0) { g.strokeStyle = '#fff'; g.beginPath(); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { g.moveTo(mx + a * 6, my + b * 6); g.lineTo(mx + a * 12, my + b * 12); }); g.stroke(); }
      if (this.time < (this.headMarkUntil || 0)) { g.font = 'bold 12px Segoe UI, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#ffd34a'; g.fillText('HEADSHOT', mx, my + 30); }
      if (this.time < (this.killMarkUntil || 0)) { const k = (this.killMarkUntil - this.time) / 0.6; g.strokeStyle = `rgba(255,60,50,${k})`; g.lineWidth = 3; g.beginPath(); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { g.moveTo(mx + a * 8, my + b * 8); g.lineTo(mx + a * 18, my + b * 18); }); g.stroke(); }
      g.lineWidth = 1;
    }
    // scoreboard
    if (this.input.down('scores') || this.ended) this.renderScoreboard(g, W, H, me);
    g.restore();
    // flashbang whiteout
    if (me && me.flashT > 0) { g.fillStyle = `rgba(255,255,255,${Math.min(1, me.flashT / 2)})`; g.fillRect(0, 0, this.canvas.width, this.canvas.height); }
  }
  renderStatus(g, W, H, me, panel) {
    const mode = this.cfg.mode, tn = this.cfg.teamNames || TEAM_NAMES;
    const mmss = t => { t = Math.max(0, Math.ceil(t)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
    g.textAlign = 'center';
    if (!this.ffa && this.nTeams > 2) {
      // three to six teams: one compact column per team
      const myTeam = me ? me.team : 0, n = this.nTeams, cw = Math.min(150, (W - 420) / n), x0 = W / 2 - cw * n / 2;
      panel(x0 - 8, 12, cw * n + 16, mode === 'zone' || mode === 'snd' ? 78 : 62);
      g.fillStyle = '#fff'; g.font = 'bold 13px Segoe UI, sans-serif'; g.fillText(mmss(this.timeLeft) + (mode === 'zone' ? (this.zone.contested ? ' · CONTESTED ×½' : this.zone.holder < 0 ? ' · NEUTRAL' : ` · ${tn[this.zone.holder]} capturing`) : ''), W / 2, 24);
      for (let t = 0; t < n; t++) {
        const x = x0 + cw * t + cw / 2, us = this.units.filter(u => u.team === t), mine = t === myTeam;
        g.font = 'bold 12px Segoe UI, sans-serif'; g.fillStyle = mine ? '#81c784' : '#ef9a9a'; g.fillText(tn[t], x, 40);
        g.font = '11px Segoe UI, sans-serif'; g.fillStyle = '#ccc';
        g.fillText(mode === 'score' ? `${this.teamScores()[t] || 0} pts · ${us.reduce((s, u) => s + u.kills, 0)}K` : `${us.filter(u => u.alive).length}/${us.length} · ${us.reduce((s, u) => s + u.kills, 0)}K${mode === 'deathmatch' && (this.cfg.lives || 1) > 1 ? ' · ' + us.reduce((s, u) => s + (u.lives === Infinity ? 0 : u.lives), 0) + 'R' : ''}`, x, 54);
        let p = -1, label = '';
        if (mode === 'zone') { p = this.zone.prog[t] / 30; label = this.zone.prog[t].toFixed(0) + 's'; }
        if (mode === 'snd') { const b = this.bases.find(b => b.team === t), known = b && (mine || b.seen[myTeam]); p = known ? b.hp / BASE_HP : 0; label = known ? (b.hp > 0 ? Math.ceil(b.hp) + ' HP' : 'DESTROYED') : 'not found'; }
        if (p >= 0) { g.fillStyle = '#222'; g.fillRect(x - cw / 2 + 8, 62, cw - 16, 9); g.fillStyle = mine ? '#66bb6a' : '#e53935'; g.fillRect(x - cw / 2 + 8, 62, (cw - 16) * Math.min(1, p), 9); g.fillStyle = '#fff'; g.font = '9px Segoe UI'; g.fillText(label, x, 67); }
      }
    } else if (!this.ffa) {
      const myTeam = me ? me.team : 0;
      const info = [0, 1].map(t => { const us = this.units.filter(u => u.team === t); return { alive: us.filter(u => u.alive).length, total: us.length, lives: us.reduce((s, u) => s + (u.lives === Infinity ? 0 : u.lives), 0), kills: us.reduce((s, u) => s + u.kills, 0) }; });
      panel(W / 2 - 220, 12, 440, mode === 'zone' || mode === 'snd' ? 70 : 54);
      g.font = 'bold 15px Segoe UI, sans-serif';
      [0, 1].forEach(t => {
        const left = t === 0, x = W / 2 + (left ? -110 : 110);
        g.fillStyle = t === myTeam ? '#81c784' : '#ef9a9a';
        g.fillText(tn[t], x, 26);
        g.font = '12px Segoe UI, sans-serif'; g.fillStyle = '#ccc';
        g.fillText(mode === 'score' ? `${this.teamScores()[t] || 0} points · ${info[t].kills} kills` : mode === 'zone' || mode === 'snd' ? `${info[t].alive}/${info[t].total} alive · ${info[t].kills} kills` : `${info[t].alive}/${info[t].total} alive${(this.cfg.lives || 1) > 1 ? ` · ${info[t].lives} respawns` : ''}`, x, 44);
        g.font = 'bold 15px Segoe UI, sans-serif';
        if (mode === 'snd') { const b = this.bases.find(x => x.team === t), known = b && (t === myTeam || b.seen[myTeam]); const p = b ? b.hp / BASE_HP : 0;
          g.fillStyle = '#222'; g.fillRect(x - 90, 58, 180, 10); if (known) { g.fillStyle = t === myTeam ? '#66bb6a' : '#e53935'; g.fillRect(x - 90, 58, 180 * p, 10); }
          g.fillStyle = '#fff'; g.font = '10px Segoe UI'; g.fillText(known ? `Base ${Math.ceil(b.hp)} / ${BASE_HP}` : 'Base: not found', x, 63); g.font = 'bold 15px Segoe UI, sans-serif'; }
        if (mode === 'zone') { const p = this.zone.prog[t] / 30; g.fillStyle = '#222'; g.fillRect(x - 90, 58, 180, 10); g.fillStyle = t === myTeam ? '#66bb6a' : '#e53935'; g.fillRect(left ? x + 90 - 180 * p : x - 90, 58, 180 * p, 10); g.fillStyle = '#fff'; g.font = '10px Segoe UI'; g.fillText(`${this.zone.prog[t].toFixed(1)}s / 30s`, x, 63); g.font = 'bold 15px Segoe UI, sans-serif'; }
      });
      g.fillStyle = '#fff'; g.font = 'bold 14px Segoe UI, sans-serif'; g.fillText(mmss(this.timeLeft), W / 2, 26);
      if (mode === 'zone') { g.font = '11px Segoe UI'; g.fillStyle = this.zone.contested ? '#ffb74d' : '#aaa'; g.fillText(this.zone.contested ? 'CONTESTED ×½' : this.zone.holder < 0 ? 'NEUTRAL' : 'CAPTURING', W / 2, 44); }
    } else {
      panel(W / 2 - 170, 12, 340, mode === 'zone' ? 76 : 46);
      g.font = 'bold 14px Segoe UI, sans-serif'; g.fillStyle = '#fff';
      if (mode === 'zone') {
        g.fillText(`ZONE · ${mmss(this.timeLeft)}`, W / 2, 26);
        const top = this.units.slice().sort((a, b) => b.zoneTime - a.zoneTime).slice(0, 3);
        g.font = '12px Segoe UI, sans-serif';
        top.forEach((u, i) => { g.fillStyle = u.id === this.localId ? '#81c784' : '#ddd'; g.fillText(`${i + 1}. ${u.name} — ${Math.floor(u.zoneTime)}s`, W / 2, 44 + i * 14); });
      } else {
        const left = this.units.filter(u => u.alive || (u.respawnT > 0 && !u.out)).length;
        if (mode === 'score') {
          const top = this.units.slice().sort((a, b) => this.unitScore(b) - this.unitScore(a)), rank = me ? top.indexOf(me) + 1 : 0;
          g.fillText(`BATTLE ROYALE · ${mmss(this.timeLeft)}`, W / 2, 26);
          if (me) { g.font = '12px Segoe UI'; g.fillStyle = '#ccc'; g.fillText(`You: ${this.unitScore(me)} pts (#${rank}) · Leader: ${top[0].name} ${this.unitScore(top[0])} pts`, W / 2, 44); }
        } else {
          g.fillText(`FREE FOR ALL · ${left} remaining · ${mmss(this.timeLeft)}`, W / 2, 26);
          if (me) { g.font = '12px Segoe UI'; g.fillStyle = '#ccc'; g.fillText(`Kills ${me.kills}${(this.cfg.lives || 1) > 1 ? ` · Respawns left ${me.lives}` : ''}`, W / 2, 44); }
        }
      }
    }
  }
  renderScoreboard(g, W, H, me) {
    const rows = this.units.slice().sort((a, b) => (a.team - b.team) * (this.ffa ? 0 : 1) || (this.cfg.mode === 'score' ? this.unitScore(b) - this.unitScore(a) : 0) || b.kills - a.kills || a.deaths - b.deaths);
    // two columns of rows for big matches
    if (rows.length > 18) return this.renderScoreboardWide(g, W, H, me, rows);
    const w = 560, h = 70 + rows.length * 24, x = W / 2 - w / 2, y = H / 2 - h / 2;
    g.fillStyle = 'rgba(8,12,8,0.88)'; g.fillRect(x, y, w, h); g.strokeStyle = 'rgba(160,190,120,0.4)'; g.strokeRect(x, y, w, h);
    g.textAlign = 'left'; g.font = 'bold 16px Segoe UI'; g.fillStyle = '#fff'; g.fillText('SCOREBOARD', x + 16, y + 22);
    g.font = '11px Segoe UI'; g.fillStyle = '#999';
    const cols = [x + 16, x + 260, x + 320, x + 380, x + 440, x + 500];
    ['PLAYER', 'K', 'D', 'A', this.cfg.mode === 'zone' && this.ffa ? 'ZONE' : this.cfg.mode === 'score' ? 'SCORE' : this.cfg.mode === 'deathmatch' && (this.cfg.lives || 1) > 1 ? 'LIVES' : '', ''].forEach((t, i) => g.fillText(t, cols[i], y + 48));
    rows.forEach((u, i) => {
      const ry = y + 70 + i * 24;
      if (u.id === this.localId) { g.fillStyle = 'rgba(129,199,132,0.15)'; g.fillRect(x + 6, ry - 12, w - 12, 22); }
      const friendly = me && (u.id === me.id || (!this.ffa && u.team === me.team));
      g.fillStyle = friendly ? '#a5d6a7' : '#ef9a9a'; g.font = '13px Segoe UI';
      g.fillText(`${!this.ffa ? '[' + (this.cfg.teamNames || TEAM_NAMES)[u.team] + '] ' : ''}${u.name}${u.isBot ? ' 🤖' : ''}${u.alive ? '' : ' ✝'}`, cols[0], ry);
      g.fillStyle = '#eee'; g.fillText(u.kills, cols[1], ry); g.fillText(u.deaths, cols[2], ry); g.fillText(u.assists, cols[3], ry);
      g.fillText(this.cfg.mode === 'zone' && this.ffa ? Math.floor(u.zoneTime) + 's' : this.cfg.mode === 'score' ? this.unitScore(u) : this.cfg.mode === 'deathmatch' && (this.cfg.lives || 1) > 1 ? (u.out ? 'OUT' : u.lives + 1) : '', cols[4], ry);
    });
  }
}

Game.prototype.renderScoreboardWide = function (g, W, H, me, rows) {
  const half = Math.ceil(rows.length / 2), cw = 420, w = cw * 2 + 30, h = 60 + half * 18, x = W / 2 - w / 2, y = Math.max(10, H / 2 - h / 2);
  g.fillStyle = 'rgba(8,12,8,0.9)'; g.fillRect(x, y, w, h); g.strokeStyle = 'rgba(160,190,120,0.4)'; g.strokeRect(x, y, w, h);
  g.textAlign = 'left'; g.font = 'bold 16px Segoe UI'; g.fillStyle = '#fff'; g.fillText(`SCOREBOARD · ${rows.length} soldiers`, x + 16, y + 22);
  rows.forEach((u, i) => {
    const cx = x + 12 + (i >= half ? cw + 10 : 0), ry = y + 46 + (i % half) * 18;
    if (u.id === this.localId) { g.fillStyle = 'rgba(129,199,132,0.15)'; g.fillRect(cx - 4, ry - 10, cw, 17); }
    const friendly = me && (u.id === me.id || (!this.ffa && u.team === me.team));
    g.font = '12px Segoe UI'; g.fillStyle = friendly ? '#a5d6a7' : '#ef9a9a';
    g.fillText(`${!this.ffa ? '[' + (this.cfg.teamNames || TEAM_NAMES)[u.team] + '] ' : ''}${u.name}${u.isBot ? ' 🤖' : ''}${u.alive ? '' : ' ✝'}`, cx, ry);
    g.fillStyle = '#eee'; g.fillText(`${u.kills} / ${u.deaths} / ${u.assists}${this.cfg.mode === 'score' ? ' · ' + this.unitScore(u) : ''}`, cx + cw - 130, ry);
  });
};
function drawUtilIcon(g, ut, x, y) {
  g.save(); g.translate(x, y);
  const k = ut.kind;
  if (ut.id === 'stick') { g.fillStyle = '#6b5233'; g.fillRect(-2, -2, 4, 14); g.fillStyle = '#4a5530'; g.fillRect(-6, -12, 12, 10); g.restore(); return; }
  if (k === 'thermite' || k === 'gas') { g.fillStyle = k === 'gas' ? '#8a8a5a' : '#5a5a5a'; g.fillRect(-6, -9, 12, 18); g.fillStyle = k === 'gas' ? '#d4c84a' : '#e05a2a'; g.fillRect(-6, -2, 12, 3); g.fillStyle = '#999'; g.fillRect(-3, -12, 6, 4); g.restore(); return; }
  if (k === 'satchel') { g.fillStyle = '#6b6a4a'; g.fillRect(-11, -7, 22, 14); g.strokeStyle = '#3a3a2a'; g.beginPath(); g.moveTo(-6, -7); g.lineTo(-2, -12); g.lineTo(2, -12); g.lineTo(6, -7); g.stroke(); g.restore(); return; }
  if (k === 'mine') { g.fillStyle = '#4a5230'; g.beginPath(); g.arc(0, 0, 9, 0, 7); g.fill(); g.fillStyle = '#222'; g.fillRect(-1, -12, 2, 6); g.fillRect(-4, -12, 8, 2); g.restore(); return; }
  if (k === 'heal') { g.fillStyle = ut.id === 'adrenaline' ? '#e0e0e0' : '#c62828'; g.fillRect(-10, -8, 20, 16); g.fillStyle = ut.id === 'adrenaline' ? '#c62828' : '#fff'; g.fillRect(-2, -6, 4, 12); g.fillRect(-6, -2, 12, 4); }
  else if (k === 'c4') { g.fillStyle = '#d8cfa8'; g.fillRect(-11, -6, 22, 12); g.fillStyle = '#222'; g.fillRect(-4, -4, 8, 6); }
  else if (k === 'claymore') { g.fillStyle = '#5a6236'; g.beginPath(); g.moveTo(-11, -6); g.lineTo(11, -6); g.lineTo(9, 6); g.lineTo(-9, 6); g.fill(); }
  else if (k === 'molotov') { g.fillStyle = '#5a7a3a'; g.fillRect(-5, -2, 10, 12); g.fillRect(-2, -10, 4, 8); g.fillStyle = '#ff9800'; g.beginPath(); g.arc(0, -12, 3, 0, 7); g.fill(); }
  else { g.fillStyle = k === 'smoke' ? '#5a6b4a' : k === 'flash' ? '#888' : '#4a5530'; if (k === 'smoke' || k === 'flash') g.fillRect(-6, -9, 12, 18); else { g.beginPath(); g.ellipse(0, 2, 8, 9, 0, 0, 7); g.fill(); } g.fillStyle = '#999'; g.fillRect(-3, -12, 6, 4); g.fillRect(3, -12, 2, 10); }
  g.restore();
}
function segCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy; let t = l2 ? ((cx - x1) * dx + (cy - y1) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
  const px = x1 + dx * t, py = y1 + dy * t; return (px - cx) ** 2 + (py - cy) ** 2 < r * r;
}
