// ============================================================================
// Shared drawing: camo patterns, soldiers, weapon sprites (top-down + side view)
// ============================================================================
const Art = (() => {
  const patCache = {};
  function camoCanvas(colors, pattern, size, seed) {
    const c = Tex.cv(size, size), g = c.getContext('2d'), rnd = mulberry32(seed || 7);
    g.fillStyle = colors[0]; g.fillRect(0, 0, size, size);
    const pick = () => colors[1 + Math.floor(rnd() * (colors.length - 1))] || colors[0];
    switch (pattern) {
      case 'solid': for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,255,255,0.03)'; g.fillRect(rnd()*size, rnd()*size, 3, 3); } break;
      case 'blobs': for (let i = 0; i < 18; i++) { g.fillStyle = pick(); g.beginPath(); const x = rnd()*size, y = rnd()*size, r = 4 + rnd()*9;
        for (let k = 0; k < 8; k++) { const a = k/8*Math.PI*2, d = r*(0.6+rnd()*0.6); for (const ox of [0, -size, size]) for (const oy of [0]) {} g.lineTo(x + Math.cos(a)*d, y + Math.sin(a)*d); } g.closePath(); g.fill(); } break;
      case 'stripes': for (let i = 0; i < 9; i++) { g.fillStyle = pick(); g.beginPath(); const y = rnd()*size; g.moveTo(0, y); for (let x = 0; x <= size; x += 8) g.lineTo(x, y + Math.sin(x*0.2 + i)*4 + rnd()*3); for (let x = size; x >= 0; x -= 8) g.lineTo(x, y + 3 + Math.sin(x*0.2 + i)*4); g.closePath(); g.fill(); } break;
      case 'pixels': for (let y = 0; y < size; y += 4) for (let x = 0; x < size; x += 4) if (rnd() < 0.55) { g.fillStyle = pick(); g.fillRect(x, y, 4, 4); } break;
      case 'weave': for (let y = 0; y < size; y += 4) for (let x = 0; x < size; x += 4) { g.fillStyle = ((x + y) / 4) % 2 ? colors[1] : colors[0]; g.fillRect(x, y, 4, 4); g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x, y, 4, 1); } break;
      case 'waves': for (let i = 0; i < size; i += 3) { g.strokeStyle = i % 6 ? colors[1] : colors[2]; g.lineWidth = 1.5; g.beginPath(); for (let x = 0; x <= size; x += 2) g.lineTo(x, i + Math.sin(x * 0.18 + i * 0.4) * 3); g.stroke(); } break;
      case 'metal': { const grd = g.createLinearGradient(0, 0, size, size); grd.addColorStop(0, colors[2]); grd.addColorStop(0.5, colors[0]); grd.addColorStop(1, colors[1]); g.fillStyle = grd; g.fillRect(0, 0, size, size);
        for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(rnd()*size, rnd()*size, 6, 1); } break; }
      default: // uniform style multi-blob
        for (let i = 0; i < 26; i++) { g.fillStyle = pick(); g.beginPath(); g.ellipse(rnd()*size, rnd()*size, 2 + rnd()*6, 1.5 + rnd()*4, rnd()*3, 0, 7); g.fill(); }
    }
    return c;
  }
  function camoPattern(g, id, isUniform) {
    const key = (isUniform ? 'u:' : 'c:') + id;
    if (!patCache[key]) {
      const c = isUniform ? (UNIFORMS.find(u => u.id === id) || UNIFORMS[0]) : (CAMOS.find(u => u.id === id) || CAMOS[0]);
      patCache[key] = { canvas: camoCanvas(c.colors, isUniform ? 'uniform' : c.pattern, isUniform ? 48 : 64, id.length * 31), base: c.colors[0] };
    }
    const e = patCache[key];
    if (!e.pat) e.pat = g.createPattern(e.canvas, 'repeat');
    return e.pat;
  }
  function camoBase(id) { return (CAMOS.find(u => u.id === id) || CAMOS[0]).colors[0]; }

  // ---- top-down weapon geometry ---------------------------------------
  function weaponLen(it) {
    if (!it) return 0;
    switch (it.type) {
      case 'Pistol': return 14; case 'Revolver': return 16; case 'Submachine Gun': return 21;
      case 'Assault Rifle': return 32; case 'Battle Rifle': return 34; case 'Marksman Rifle': return 38;
      case 'Sniper Rifle': return 42; case 'Anti-Materiel Rifle': return 50; case 'Shotgun': return 34;
      case 'Light Machine Gun': return 37; case 'Heavy Machine Gun': return 44; case 'Flamethrower': return 34;
      case 'Grenade Launcher': return 30; case 'Rocket Launcher': return 42;
      default: return it.reach ? Math.min(36, it.reach * 0.55) : 0;
    }
  }
  // draws a gun pointing to +x, grip at origin
  function drawWeaponTop(g, it, skin, spin) {
    if (!it) return;
    const L = weaponLen(it), pat = camoPattern(g, skin || 'factory');
    g.save();
    g.lineJoin = 'round';
    const metal = '#1f2224';
    if (it.cat === 'melee') {
      if (it.id === 'fists') { g.restore(); return; }
      const blade = ['Knife', 'Blade', 'Sword'].includes(it.type);
      g.fillStyle = '#2a1e14'; g.fillRect(-4, -2, 10, 4); // handle
      if (blade) { g.fillStyle = pat; g.beginPath(); g.moveTo(6, -2.5); g.lineTo(L, -0.5); g.lineTo(L + 3, 0); g.lineTo(6, 2.5); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(7, -1.5, L - 8, 1); g.fillStyle = '#555'; g.fillRect(5, -4, 2, 8); }
      else if (it.type === 'Axe' || it.type === 'Hammer') { g.fillStyle = '#5a3f22'; g.fillRect(6, -1.5, L - 6, 3); g.fillStyle = pat; it.type === 'Axe' ? (g.beginPath(), g.moveTo(L - 6, -2), g.lineTo(L + 2, -10), g.lineTo(L + 4, 2), g.lineTo(L - 6, 2), g.fill()) : g.fillRect(L - 8, -7, 10, 14); }
      else { g.fillStyle = pat; g.fillRect(6, -2.5, L - 6, 5); g.fillStyle = '#888'; for (let k = 10; k < L; k += 4) g.fillRect(k, -3.5, 1.5, 7); }
      g.restore(); return;
    }
    const w = it.type === 'Heavy Machine Gun' ? 7 : it.type === 'Rocket Launcher' ? 6 : it.type === 'Grenade Launcher' ? 9 : it.cat === 'sidearm' ? 4 : 5;
    const stock = it.cat === 'primary' && !['Rocket Launcher', 'Flamethrower'].includes(it.type) ? 10 : 0;
    // stock
    if (stock) { g.fillStyle = pat; g.fillRect(-stock, -w/2 + 0.5, stock, w - 1); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-stock, -w/2 + 0.5, 2, w - 1); }
    // receiver/body
    g.fillStyle = pat; g.fillRect(0, -w/2, L * 0.62, w);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, -w/2, L * 0.62, 1.2);
    // barrel
    if (it.id === 'm134') {
      g.fillStyle = metal; for (let k = -1; k <= 1; k++) g.fillRect(L * 0.5, k * 2.2 - 0.8 + Math.sin((spin || 0)) * 0.6, L * 0.5, 1.6);
    } else if (it.type === 'Rocket Launcher') {
      g.fillStyle = '#3d4a2a'; g.fillRect(-12, -3, L + 8, 6); g.fillStyle = '#6a5034'; g.fillRect(4, -3.5, 10, 7);
      g.fillStyle = '#4a5a2a'; g.beginPath(); g.moveTo(L - 4, -6); g.lineTo(L + 8, 0); g.lineTo(L - 4, 6); g.closePath(); g.fill();
    } else if (it.type === 'Flamethrower') {
      g.fillStyle = metal; g.fillRect(L * 0.6, -1.5, L * 0.4, 3); g.fillStyle = '#c96a2a'; g.fillRect(L - 2, -2, 3, 4);
    } else {
      const bw = it.type === 'Shotgun' ? 2.8 : it.type === 'Anti-Materiel Rifle' || it.type === 'Heavy Machine Gun' ? 3 : 1.8;
      g.fillStyle = metal; g.fillRect(L * 0.6, -bw/2, L * 0.4, bw);
      if (it.id === 'm82' || it.id === 'm2hb') { g.fillRect(L - 3, -3, 4, 6); }
    }
    // magazine / extras
    g.fillStyle = metal;
    if (it.scope) { g.fillStyle = '#111'; g.fillRect(L * 0.12, -2, L * 0.36, 4); g.fillStyle = '#6aa0c8'; g.fillRect(L * 0.46, -1.2, 1.5, 2.4); }
    if (it.type === 'Light Machine Gun') { g.fillStyle = '#3a3f2c'; g.fillRect(L * 0.2, w/2, 8, 6); }
    if (it.type === 'Heavy Machine Gun' && it.id !== 'm134') { g.fillStyle = '#5a5a3a'; g.fillRect(L * 0.1, w/2, 10, 8); }
    if (it.id === 'm134') { g.fillStyle = '#3a3f2c'; g.fillRect(L * 0.05, w/2, 12, 7); }
    if (it.type === 'Grenade Launcher') { g.fillStyle = '#2a2a2a'; g.beginPath(); g.arc(L * 0.35, 0, 6, 0, 7); g.fill(); }
    g.restore();
  }

  // ---- soldier -------------------------------------------------------------
  // o: {x,y,angle,helmet:'green'|'black',uniform,armor,armorSkin,weapon,weaponSkin,walk,swing,scale,dead,spin,flashLight}
  function drawSoldier(g, o) {
    const it = o.weapon ? ITEMS[o.weapon] : null;
    const arm = o.armor ? ITEMS[o.armor] : null;
    g.save(); g.translate(o.x, o.y); if (o.scale) g.scale(o.scale, o.scale);
    if (o.dead) { g.globalAlpha = 0.85; }
    // shadow
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(3, 4, 15, 13, 0, 0, 7); g.fill();
    g.rotate(o.angle);
    const uni = camoPattern(g, o.uniform || 'multicam', true);
    // feet (walk cycle)
    if (!o.dead) {
      const step = Math.sin(o.walk || 0) * 6;
      g.fillStyle = '#2a241c';
      g.beginPath(); g.ellipse(step, -6, 5, 3.2, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(-step, 6, 5, 3.2, 0, 0, 7); g.fill();
    }
    // backpack / fuel tanks
    if (it && it.type === 'Flamethrower') { g.fillStyle = '#4a4f3a'; g.beginPath(); g.arc(-11, -5, 5, 0, 7); g.arc(-11, 5, 5, 0, 7); g.fill(); g.strokeStyle = '#222'; g.stroke(); }
    else { g.fillStyle = '#4a4535'; g.fillRect(-15, -7, 7, 14); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-15, -7, 2, 14); }
    // torso
    g.fillStyle = uni; g.beginPath(); g.ellipse(0, 0, 9, 14, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; g.stroke();
    // armour
    if (arm && arm.id !== 'noarmor') {
      const ap = camoPattern(g, o.armorSkin || 'olive');
      const big = arm.id === 'eod' ? 1.35 : arm.reduce >= 30 ? 1.12 : 1;
      g.fillStyle = ap; g.beginPath(); g.roundRect ? g.roundRect(-7 * big, -10 * big, 14 * big, 20 * big, 4) : g.rect(-7 * big, -10 * big, 14 * big, 20 * big); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.45)'; g.stroke();
      if (arm.reduce >= 25) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-2, -7 * big, 6, 4); g.fillRect(-2, 3 * big, 6, 4); g.fillRect(-2, -2, 6, 4); }
      if (arm.reduce >= 30) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-6 * big, -12 * big, 10, 3); g.fillRect(-6 * big, 9 * big, 10, 3); }
    }
    // arms + weapon
    const L = weaponLen(it);
    let swing = o.swing || 0;
    if (it && it.cat === 'melee' && it.id !== 'fists') {
      g.save(); g.rotate(-1.1 + swing * 2.2);
      g.strokeStyle = uni; g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(0, 10); g.lineTo(12, 4); g.stroke();
      g.save(); g.translate(14, 3); drawWeaponTop(g, it, o.weaponSkin); g.restore();
      g.fillStyle = '#c9a07a'; g.beginPath(); g.arc(13, 3, 2.8, 0, 7); g.fill();
      g.restore();
      g.strokeStyle = uni; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, -10); g.lineTo(8, -8); g.stroke();
    } else if (it && it.cat !== 'melee') {
      const gx = 6, side = it.cat === 'sidearm' && L < 18;
      g.save(); g.translate(gx, side ? 0 : 3);
      drawWeaponTop(g, it, o.weaponSkin, o.spin);
      g.restore();
      g.strokeStyle = uni; g.lineWidth = 5; g.lineCap = 'round';
      const handFront = side ? 8 : Math.min(L * 0.55, 22);
      g.beginPath(); g.moveTo(0, 11); g.lineTo(gx + 1, side ? 1 : 4); g.stroke();
      g.beginPath(); g.moveTo(0, -11); g.lineTo(gx + handFront, side ? -1 : 2); g.stroke();
      g.fillStyle = '#c9a07a';
      g.beginPath(); g.arc(gx + 2, side ? 1 : 4, 2.6, 0, 7); g.fill();
      g.beginPath(); g.arc(gx + handFront + 1, side ? -1 : 2, 2.6, 0, 7); g.fill();
    } else { // fists
      const p = swing > 0 ? Math.sin(swing * Math.PI) * 10 : 0;
      g.strokeStyle = uni; g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(0, 11); g.lineTo(10 + p, 6); g.stroke();
      g.beginPath(); g.moveTo(0, -11); g.lineTo(10, -6); g.stroke();
      g.fillStyle = '#c9a07a'; g.beginPath(); g.arc(11 + p, 6, 3, 0, 7); g.arc(11, -6, 3, 0, 7); g.fill();
    }
    // head / helmet
    const hc = o.helmet === 'green' ? ['#6f8f3c', '#4a6322', '#2f4214'] : ['#4a4a4a', '#222', '#0c0c0c'];
    const grd = g.createRadialGradient(-1, -2, 1, 1, 0, 9); grd.addColorStop(0, hc[0]); grd.addColorStop(0.6, hc[1]); grd.addColorStop(1, hc[2]);
    g.fillStyle = grd; g.beginPath(); g.arc(1, 0, 8.2, 0, 7); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1; g.stroke();
    // helmet details: brim, strap band, NVG mount
    g.strokeStyle = o.helmet === 'green' ? 'rgba(30,45,15,0.7)' : 'rgba(80,80,80,0.6)'; g.lineWidth = 1.2;
    g.beginPath(); g.arc(1, 0, 5.5, -1.2, 1.2); g.stroke();
    g.fillStyle = o.helmet === 'green' ? '#3a4a20' : '#333'; g.fillRect(6.5, -1.5, 2.5, 3);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.arc(-1, -3, 2.5, 0, 7); g.fill();
    // night vision / thermal goggles: flipped down over the eyes when switched on
    if (o.gear) { const gi = ITEMS[o.gear]; if (gi && gi.vision) { g.fillStyle = '#1b211d'; const fx = o.gearOn ? 8 : 4; if (gi.wide) { g.fillRect(fx, -5, 5, 2.4); g.fillRect(fx, -2.2, 5, 2.4); g.fillRect(fx, 0.6, 5, 2.4); g.fillRect(fx, 3.4, 5, 2.4); } else if (gi.vision === 'ir' || gi.id === 'pvs14') g.fillRect(fx, -3.5, 6, 3.4); else { g.fillRect(fx, -4, 5, 3); g.fillRect(fx, 1, 5, 3); } if (o.gearOn) { g.fillStyle = 'rgba(90,255,120,0.5)'; g.fillRect(fx + 4.5, -1, 1.5, 2); } } }
    g.restore();
  }

  // ---- side profile (locker / missing-image fallback) ------------------------
  // side views of attachments (shop / weapons screen thumbnails)
  function drawAttachment(g, it, W, H) {
    g.save(); g.translate(W / 2, H / 2); const s = Math.min(W / 300, H / 120); g.scale(s, s);
    const body = (x, y, w, h, c, r) => { const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, Tex.shade(c, 1.5)); gr.addColorStop(0.45, c); gr.addColorStop(1, Tex.shade(c, 0.55)); g.fillStyle = gr; g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r || 3); else g.rect(x, y, w, h); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1.5; g.stroke(); };
    const lens = (x, y, r, c) => { const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r); gr.addColorStop(0, '#fff'); gr.addColorStop(0.3, c); gr.addColorStop(1, '#111'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r * 0.35, r, 0, 0, 7); g.fill(); };
    const rail = (x, w, y) => { body(x, y, w, 10, '#2a2c2e', 2); for (let k = x + 4; k < x + w - 4; k += 9) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(k, y + 1, 3, 4); } };
    const M = '#2a2c2f', id = it.id;
    if (id === 'reddot' || id === 'rmr') { const k = id === 'rmr' ? 0.7 : 1; body(-60 * k, -30 * k, 120 * k, 52 * k, M, 16 * k); lens(-60 * k, -4 * k, 24 * k, '#7a4aff'); lens(60 * k, -4 * k, 24 * k, '#ff4040'); rail(-50 * k, 100 * k, 22 * k); }
    else if (id === 'holo') { body(-80, 8, 160, 22, M, 4); g.fillStyle = M; g.fillRect(-70, -40, 14, 50); g.fillRect(56, -40, 14, 50); g.fillRect(-70, -44, 140, 10); g.fillStyle = 'rgba(140,190,255,0.35)'; g.fillRect(-56, -34, 112, 42); g.strokeStyle = '#ff5050'; g.lineWidth = 2; g.beginPath(); g.arc(0, -12, 12, 0, 7); g.stroke(); rail(-70, 140, 30); }
    else if (id === 'acog' || id === 'pso' || id === 'sniper8') { const L = id === 'sniper8' ? 260 : 180; body(-L / 2, -22, L, 34, M, 12); body(-L / 2 - 10, -30, 50, 50, M, 10); body(L / 2 - 46, -28, 46, 46, M, 10); body(-14, -44, 28, 22, M, 4); if (id === 'sniper8') body(-14, 12, 28, 18, M, 3); lens(L / 2, -5, 22, '#4a7aff'); if (id !== 'sniper8') rail(-50, 100, 14); }
    else if (id === 'thermscope') { body(-110, -40, 200, 66, '#1f2021', 8); body(90, -32, 30, 50, '#1f2021', 6); lens(120, -7, 25, '#b050ff'); body(-40, -56, 60, 16, '#333', 4); rail(-70, 140, 28); }
    else if (id.startsWith('supp')) { const L = id === 'supp9' ? 180 : 230; body(-L / 2, -22, L, 44, '#1d1e20', 10); for (let k = -L / 2 + 30; k < L / 2 - 20; k += 30) { g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(k, -20, 3, 40); } body(-L / 2 - 30, -12, 34, 24, '#3a3c3e', 3); }
    else if (id === 'comp' || id === 'brake' || id === 'flashhider') { body(-60, -20, 120, 40, M, 6); g.fillStyle = '#000'; const n = id === 'brake' ? 3 : 4; for (let k = 0; k < n; k++) { if (id === 'flashhider') g.fillRect(-40 + k * 26, -20, 8, 30); else g.fillRect(-40 + k * 26, -14, id === 'brake' ? 16 : 7, id === 'brake' ? 28 : 10); } }
    else if (id === 'vgrip') { rail(-50, 100, -40); body(-22, -30, 44, 90, '#262626', 10); for (let k = -20; k < 50; k += 12) { g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(-20, k, 40, 3); } }
    else if (id === 'agrip') { rail(-70, 140, -40); g.fillStyle = '#262626'; g.beginPath(); g.moveTo(-60, -30); g.lineTo(60, -30); g.lineTo(-20, 30); g.lineTo(-60, 20); g.closePath(); g.fill(); g.strokeStyle = '#000'; g.stroke(); }
    else if (id === 'bipod') { body(-30, -44, 60, 20, M, 4); g.strokeStyle = '#3a3c3e'; g.lineWidth = 8; g.beginPath(); g.moveTo(-10, -26); g.lineTo(-70, 48); g.moveTo(10, -26); g.lineTo(70, 48); g.stroke(); g.fillStyle = '#111'; g.fillRect(-82, 44, 22, 8); g.fillRect(60, 44, 22, 8); }
    else if (id === 'extmag') { g.save(); g.rotate(0.12); body(-26, -55, 52, 115, '#2b2b2b', 4); g.restore(); }
    else if (id === 'drum') { const gr = g.createRadialGradient(-10, -10, 4, 0, 0, 52); gr.addColorStop(0, '#555'); gr.addColorStop(1, '#141414'); g.fillStyle = gr; g.beginPath(); g.arc(0, 8, 50, 0, 7); g.fill(); body(-16, -58, 32, 30, '#2b2b2b', 3); g.fillStyle = '#888'; g.beginPath(); g.arc(0, 8, 9, 0, 7); g.fill(); }
    else if (id === 'speedloader') { g.fillStyle = '#333'; g.beginPath(); g.arc(0, 0, 44, 0, 7); g.fill(); for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28; g.fillStyle = '#c9a23a'; g.beginPath(); g.arc(Math.cos(a) * 26, Math.sin(a) * 26, 10, 0, 7); g.fill(); } body(-8, -10, 16, 20, '#555', 3); }
    else if (id === 'shells') { body(-80, -26, 160, 52, '#262626', 4); for (let k = 0; k < 6; k++) { body(-72 + k * 25, -36, 18, 50, '#a32a1f', 3); g.fillStyle = '#c9a23a'; g.fillRect(-72 + k * 25, 4, 18, 10); } }
    else if (id === 'laser' || id === 'irlaser') { body(-70, -26, 140, 52, id === 'laser' ? '#2b2b2b' : '#4b5320', 6); lens(70, -8, 10, id === 'laser' ? '#ff2020' : '#222'); lens(70, 12, 8, '#ddd'); rail(-50, 100, 26); if (id === 'laser') { g.strokeStyle = 'rgba(255,40,40,0.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(74, -8); g.lineTo(150, -8); g.stroke(); } }
    else body(-60, -25, 120, 50, M, 6);
    g.restore();
  }
  function drawWeaponSide(g, it, skin, W, H) {
    if (it.cat === 'attach') return drawAttachment(g, it, W, H);
    g.save();
    const pat = camoPattern(g, skin || 'factory');
    const metal = '#1d1f21';
    g.translate(W / 2, H / 2);
    const s = Math.min(W / 300, H / 120);
    g.scale(s, s);
    g.lineJoin = 'round';
    // fill + volumetric shading (top highlight, bottom shadow) so parts read as solid objects
    const fillShape = (pts, fill) => {
      g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath();
      g.fillStyle = fill; g.fill();
      let y0 = 1e9, y1 = -1e9; pts.forEach(p => { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
      const sh = g.createLinearGradient(0, y0, 0, y1);
      sh.addColorStop(0, 'rgba(255,255,255,0.28)'); sh.addColorStop(0.18, 'rgba(255,255,255,0.06)'); sh.addColorStop(0.6, 'rgba(0,0,0,0.05)'); sh.addColorStop(1, 'rgba(0,0,0,0.42)');
      g.fillStyle = sh; g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1.5; g.stroke();
      g.save(); g.clip(); g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 2; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1] + 1.5) : g.moveTo(p[0], p[1] + 1.5)); g.stroke(); g.restore();
    };
    if (it.cat === 'ammo') { g.restore(); drawCartridge(g, it.cal, it.kind, W, H); return; }
    if (it.cat === 'gear') {
      if (it.id === 'nogear') { g.restore(); return; }
      g.fillStyle = '#222'; g.fillRect(-40, -46, 80, 14); // helmet mount
      fillShape([[-12, -34], [12, -34], [10, -14], [-10, -14]], '#2a2c2e');
      const tube = (x, y, w, h, c) => { fillShape([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], c || '#2f3236'); g.fillStyle = '#0d1a10'; g.beginPath(); g.ellipse(x + w, y + h / 2, 4, h / 2 - 2, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(90,255,120,0.55)'; g.beginPath(); g.ellipse(x + w + 1, y + h / 2, 2, Math.max(1, h / 2 - 5), 0, 0, 7); g.fill(); };
      if (it.vision === 'ir') { fillShape([[-70, -14], [60, -14], [60, 30], [-70, 30]], '#3b3d33'); g.fillStyle = '#111'; g.beginPath(); g.arc(70, 8, 24, 0, 7); g.fill(); g.fillStyle = 'rgba(140,60,200,0.5)'; g.beginPath(); g.arc(72, 4, 12, 0, 7); g.fill(); for (let k = -60; k < 50; k += 10) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(k, -10, 4, 36); } }
      else if (it.wide) { tube(-60, -14, 110, 18); tube(-60, 6, 110, 18); tube(-50, 26, 80, 14, '#26292c'); tube(-50, -30, 80, 14, '#26292c'); }
      else if (it.vision === 'fused') { tube(-60, -14, 110, 26); fillShape([[-55, 14], [40, 14], [40, 34], [-55, 34]], '#3b3d33'); g.fillStyle = '#111'; g.beginPath(); g.arc(44, 24, 10, 0, 7); g.fill(); }
      else if (it.id === 'pvs14') tube(-55, -12, 115, 30);
      else { fillShape([[-80, -12], [10, -12], [10, 24], [-80, 24]], '#3a3e30'); tube(10, -16, 80, 44, '#2f3329'); }
      g.restore(); return;
    }
    if (it.cat === 'melee') {
      if (it.id === 'fists') { g.fillStyle = '#c9a07a'; g.beginPath(); g.arc(0, 0, 30, 0, 7); g.fill(); g.restore(); return; }
      fillShape([[-130, -7], [-60, -7], [-60, 7], [-130, 7]], '#2b1d12');
      for (let k = -125; k < -65; k += 8) { g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(k, -7, 3, 14); }
      if (['Knife', 'Blade', 'Sword'].includes(it.type)) {
        const len = it.type === 'Sword' ? 190 : it.type === 'Blade' ? 150 : 90;
        fillShape([[-58, -14], [-50, -14], [-50, 14], [-58, 14]], '#777');
        fillShape([[-50, -8], [-50 + len, -6], [-50 + len + 18, 6], [-50, 8]], pat);
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(-48, 3, len, 2);
      } else if (it.type === 'Axe' || it.type === 'Hammer') {
        fillShape([[-60, -5], [110, -5], [110, 5], [-60, 5]], '#6a4a2a');
        if (it.type === 'Axe') fillShape([[95, -8], [135, -40], [140, 30], [95, 8]], pat);
        else fillShape([[90, -30], [140, -30], [140, 30], [90, 30]], pat);
      } else {
        fillShape([[-60, -8], [100, -12], [100, 12], [-60, 8]], pat);
        g.fillStyle = '#999'; for (let k = 20; k < 100; k += 12) { g.beginPath(); g.arc(k, -10, 3, 0, 7); g.arc(k, 10, 3, 0, 7); g.fill(); }
      }
      g.restore(); return;
    }
    if (it.cat === 'armor') {
      if (it.id === 'noarmor') { g.restore(); return; }
      const big = it.id === 'eod' ? 1.3 : 1;
      fillShape([[-60*big, -50], [-25, -55], [-15, -40], [15, -40], [25, -55], [60*big, -50], [65*big, 55], [-65*big, 55]], pat);
      g.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = -45; k < 50; k += 22) g.fillRect(k, 10, 18, 26);
      g.strokeStyle = 'rgba(0,0,0,0.35)'; for (let y = -20; y < 50; y += 10) { g.beginPath(); g.moveTo(-55, y); g.lineTo(55, y); g.stroke(); }
      g.restore(); return;
    }
    if (it.cat === 'utility') {
      const col = it.kind === 'smoke' ? '#5a6b4a' : it.kind === 'heal' ? '#c03030' : it.kind === 'c4' ? '#d8cfa8' : it.kind === 'molotov' ? '#5a7a3a' : '#4a5530';
      if (it.kind === 'heal') { fillShape([[-60, -40], [60, -40], [60, 40], [-60, 40]], col); g.fillStyle = '#fff'; g.fillRect(-10, -28, 20, 56); g.fillRect(-28, -10, 56, 20); }
      else if (it.kind === 'c4') { fillShape([[-80, -30], [80, -30], [80, 30], [-80, 30]], col); g.fillStyle = '#222'; g.fillRect(-20, -18, 40, 24); g.fillStyle = '#e53935'; g.fillRect(-14, -14, 8, 6); }
      else if (it.kind === 'claymore') { fillShape([[-70, -30], [70, -30], [60, 30], [-60, 30]], '#5a6236'); g.fillStyle = '#ddd'; g.font = 'bold 14px sans-serif'; g.fillText('FRONT TOWARD ENEMY', -66, 4); }
      else if (it.kind === 'molotov') { fillShape([[-20, -10], [-20, 50], [20, 50], [20, -10], [8, -30], [8, -55], [-8, -55], [-8, -30]], col); g.fillStyle = '#e8e0c0'; g.fillRect(-6, -70, 12, 18); }
      else { g.fillStyle = col; g.beginPath(); g.ellipse(0, 10, 34, 42, 0, 0, 7); g.fill(); g.strokeStyle = '#222'; g.stroke(); fillShape([[-12, -42], [12, -42], [12, -30], [-12, -30]], '#888'); fillShape([[10, -40], [40, -38], [44, 20], [36, 20], [32, -30], [10, -32]], '#999'); g.beginPath(); g.strokeStyle = '#bbb'; g.lineWidth = 3; g.arc(-22, -40, 10, 0, 7); g.stroke(); }
      g.restore(); return;
    }
    // ---- firearms: parametric silhouette
    const t = it.type;
    const pistol = it.cat === 'sidearm' && (t === 'Pistol' || t === 'Revolver');
    const len = pistol ? 150 : t === 'Submachine Gun' ? 190 : t === 'Anti-Materiel Rifle' || t === 'Heavy Machine Gun' ? 290 : t === 'Sniper Rifle' ? 280 : 250;
    const x0 = -len / 2, bodyH = pistol ? 26 : 22;
    if (pistol) {
      fillShape([[x0, -18], [x0 + 110, -18], [x0 + 110, 2], [x0, 2]], pat); // slide / frame
      fillShape([[x0 + 10, 2], [x0 + 40, 2], [x0 + 30, 52], [x0 + 5, 52]], '#222'); // grip
      g.strokeStyle = '#222'; g.lineWidth = 3; g.beginPath(); g.arc(x0 + 52, 8, 9, 0, Math.PI); g.stroke();
      if (t === 'Revolver') { fillShape([[x0 + 40, -12], [x0 + 75, -12], [x0 + 75, 10], [x0 + 40, 10]], '#333'); fillShape([[x0 + 75, -14], [x0 + len, -14], [x0 + len, -4], [x0 + 75, -4]], metal); }
      else { g.fillStyle = 'rgba(0,0,0,0.3)'; for (let k = 4; k < 30; k += 6) g.fillRect(x0 + k, -16, 2, 14); }
      g.restore(); return;
    }
    // stock
    if (!['Rocket Launcher', 'Flamethrower', 'Heavy Machine Gun'].includes(t) || it.id === 'm134') {
      fillShape([[x0, -10], [x0 + 55, -12], [x0 + 55, 12], [x0 + 8, 26], [x0, 26]], pat);
    }
    if (t === 'Rocket Launcher') {
      fillShape([[x0, -14], [x0 + len - 40, -14], [x0 + len - 40, 14], [x0, 14]], '#3d4a2a');
      fillShape([[x0 + 80, -16], [x0 + 140, -16], [x0 + 140, 16], [x0 + 80, 16]], '#6a5034');
      fillShape([[x0 + len - 40, -22], [x0 + len + 20, 0], [x0 + len - 40, 22]], '#4a5a2a');
      fillShape([[x0 + 100, 14], [x0 + 115, 14], [x0 + 112, 50], [x0 + 98, 50]], '#222');
      g.restore(); return;
    }
    if (t === 'Flamethrower') {
      g.fillStyle = '#4a4f3a'; g.beginPath(); g.arc(x0 + 40, 10, 40, 0, 7); g.fill(); g.strokeStyle = '#222'; g.stroke();
      fillShape([[x0 + 70, -6], [x0 + len, -6], [x0 + len, 6], [x0 + 70, 6]], pat);
      g.fillStyle = '#c96a2a'; g.fillRect(x0 + len - 8, -10, 10, 20);
      g.restore(); return;
    }
    // receiver
    fillShape([[x0 + 50, -bodyH / 2 - 6], [x0 + len * 0.62, -bodyH / 2 - 6], [x0 + len * 0.62, bodyH / 2], [x0 + 50, bodyH / 2]], pat);
    // handguard
    fillShape([[x0 + len * 0.62, -12], [x0 + len * 0.82, -12], [x0 + len * 0.82, 6], [x0 + len * 0.62, 8]], pat);
    // barrel(s)
    if (it.id === 'm134') { for (let k = -1; k <= 1; k++) fillShape([[x0 + len * 0.55, k * 7 - 3], [x0 + len, k * 7 - 3], [x0 + len, k * 7 + 3], [x0 + len * 0.55, k * 7 + 3]], metal); }
    else { const bh = t === 'Shotgun' || t === 'Anti-Materiel Rifle' || t === 'Heavy Machine Gun' ? 8 : 5; fillShape([[x0 + len * 0.82, -bh / 2 - 4], [x0 + len, -bh / 2 - 4], [x0 + len, bh / 2 - 4], [x0 + len * 0.82, bh / 2 - 4]], metal);
      if (t === 'Anti-Materiel Rifle' || it.id === 'm2hb') fillShape([[x0 + len - 6, -14], [x0 + len + 10, -14], [x0 + len + 10, 6], [x0 + len - 6, 6]], metal); }
    if (t === 'Shotgun') fillShape([[x0 + len * 0.62, 6], [x0 + len * 0.95, 6], [x0 + len * 0.95, 14], [x0 + len * 0.62, 14]], '#333');
    // pistol grip + trigger guard
    fillShape([[x0 + 75, bodyH / 2], [x0 + 95, bodyH / 2], [x0 + 88, bodyH / 2 + 38], [x0 + 70, bodyH / 2 + 36]], '#222');
    g.strokeStyle = '#222'; g.lineWidth = 3; g.beginPath(); g.arc(x0 + 108, bodyH / 2 + 2, 9, 0, Math.PI); g.stroke();
    // magazine
    if (t === 'Light Machine Gun' || t === 'Heavy Machine Gun') { fillShape([[x0 + 115, bodyH / 2], [x0 + 160, bodyH / 2], [x0 + 160, bodyH / 2 + 38], [x0 + 115, bodyH / 2 + 38]], '#3a3f2c'); g.fillStyle = '#b08d3a'; for (let k = 0; k < 6; k++) g.fillRect(x0 + 120 + k * 6, -bodyH / 2 - 10, 4, 6); }
    else if (t === 'Grenade Launcher') { g.fillStyle = '#2a2a2a'; g.beginPath(); g.arc(x0 + 140, 0, 30, 0, 7); g.fill(); g.fillStyle = '#555'; for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; g.beginPath(); g.arc(x0 + 140 + Math.cos(a) * 17, Math.sin(a) * 17, 6, 0, 7); g.fill(); } }
    else if (t !== 'Shotgun' || it.id === 'aa12') { const curve = it.id === 'ak47' || it.id === 'rpk' ? 12 : 3; const mh = it.id === 'aa12' || it.id === 'rpk' ? 0 : 44;
      if (mh) fillShape([[x0 + 118, bodyH / 2], [x0 + 136, bodyH / 2], [x0 + 136 + curve, bodyH / 2 + mh], [x0 + 118 + curve, bodyH / 2 + mh]], '#252525');
      else { g.fillStyle = '#252525'; g.beginPath(); g.arc(x0 + 128, bodyH / 2 + 18, 20, 0, 7); g.fill(); } }
    // optics / rail
    if (it.scope) { fillShape([[x0 + 70, -bodyH / 2 - 26], [x0 + 160, -bodyH / 2 - 26], [x0 + 160, -bodyH / 2 - 12], [x0 + 70, -bodyH / 2 - 12]], '#111'); g.fillStyle = '#6aa0c8'; g.fillRect(x0 + 157, -bodyH / 2 - 24, 4, 10); }
    else { g.fillStyle = '#1a1a1a'; g.fillRect(x0 + 60, -bodyH / 2 - 10, len * 0.5, 4); }
    if (t === 'Light Machine Gun' || t === 'Anti-Materiel Rifle') { g.strokeStyle = '#222'; g.lineWidth = 3; g.beginPath(); g.moveTo(x0 + len * 0.8, 0); g.lineTo(x0 + len * 0.75, 40); g.moveTo(x0 + len * 0.8, 0); g.lineTo(x0 + len * 0.86, 40); g.stroke(); }
    g.restore();
  }

  // ---- cartridges (shop / loadout): proportions per calibre, tip colours follow NATO-style markings ----
  const CART = { // [case length, case width, bullet length, bottleneck]
    '556': [90, 18, 40, 1], '762x39': [76, 22, 44, 1], '762x51': [102, 24, 48, 1], '762x54': [106, 25, 50, 1], '338': [130, 30, 60, 1], '50bmg': [170, 40, 84, 1],
    '9mm': [38, 20, 24, 0], '10mm': [44, 21, 26, 0], '9x18': [34, 19, 22, 0], '45acp': [42, 24, 28, 0], '50ae': [56, 28, 34, 0], '762x38r': [70, 16, 10, 0],
    '357': [62, 19, 28, 0], '44mag': [64, 23, 32, 0], '46x30': [56, 16, 26, 1], '57x28': [64, 16, 32, 1],
  };
  function drawCartridge(g, cal, kind, W, H) {
    g.save(); g.translate(W / 2, H / 2); const s = Math.min(W / 300, H / 120); g.scale(s, s); g.lineJoin = 'round';
    const k = kind && AMMO_KINDS[kind], tip = k ? k.tip : null;
    const shade = (y0, y1) => { const sh = g.createLinearGradient(0, y0, 0, y1); sh.addColorStop(0, 'rgba(255,255,255,0.45)'); sh.addColorStop(0.35, 'rgba(255,255,255,0.05)'); sh.addColorStop(1, 'rgba(0,0,0,0.4)'); return sh; };
    const shape = (pts, fill) => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fillStyle = fill; g.fill(); let a = 1e9, b = -1e9; pts.forEach(p => { a = Math.min(a, p[1]); b = Math.max(b, p[1]); }); g.fillStyle = shade(a, b); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 1.2; g.stroke(); };
    if (cal === '12ga') {
      const hull = { dragon: '#d2691e', slug: '#2a52a0', birdshot: '#3a8a3a', breach: '#666', flechette: '#ccc', frag12: '#d4b000' }[kind] || '#b22222';
      shape([[-80, -26], [-40, -26], [-40, 26], [-80, 26]], '#c9a23a'); shape([[-86, -29], [-80, -29], [-80, 29], [-86, 29]], '#b8902a');
      shape([[-40, -24], [80, -24], [80, 24], [-40, 24]], hull);
      for (let x = 50; x < 80; x += 6) { g.strokeStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.moveTo(x, -24); g.lineTo(x + 3, 24); g.stroke(); }
      if (kind === 'frag12') shape([[80, -10], [100, -10], [110, 0], [100, 10], [80, 10]], '#556b2f');
    } else if (cal === '40mm') {
      const band = { illum: '#fff', smoke40: '#6a6', buck40: '#222' }[kind] || '#d4b000';
      shape([[-70, -36], [-10, -36], [-10, 36], [-70, 36]], '#a8a8a8');
      shape([[-10, -36], [40, -36], [60, -20], [64, 0], [60, 20], [40, 36], [-10, 36]], kind === 'buck40' ? '#333' : '#4b5320');
      g.fillStyle = band; g.fillRect(0, -36, 10, 72); if (kind === 'hedp') { g.fillStyle = '#d4b000'; g.fillRect(16, -34, 8, 68); }
    } else if (cal === 'pg7') {
      shape([[-130, -9], [-10, -9], [-10, 9], [-130, 9]], '#4b5320');
      for (let i = 0; i < 4; i++) shape([[-130 + i * 6, -9], [-118 + i * 6, -22], [-114 + i * 6, -22], [-124 + i * 6, -9]], '#3a4219');
      if (kind === 'ogfrag') shape([[-10, -16], [80, -16], [100, 0], [80, 16], [-10, 16]], '#5a5a5a');
      else if (kind === 'tbg') shape([[-10, -26], [50, -26], [120, 0], [50, 26], [-10, 26]], '#7a2a2a');
      else shape([[-10, -28], [40, -28], [120, -3], [130, 0], [120, 3], [40, 28], [-10, 28]], kind === 'tandem' ? '#333' : '#4b5320');
      if (kind === 'tandem') shape([[125, -4], [150, -4], [150, 4], [125, 4]], '#333');
    } else if (cal === 'fuel') {
      shape([[-90, -40], [70, -40], [70, 40], [-90, 40]], kind === 'napalm' ? '#7a3a10' : '#8b0000');
      shape([[70, -12], [96, -12], [96, 12], [70, 12]], '#555');
      g.fillStyle = 'rgba(255,255,255,0.8)'; g.font = 'bold 18px sans-serif'; g.textAlign = 'center'; g.fillText(kind === 'napalm' ? 'NAPALM' : 'FUEL', -10, 7);
    } else {
      const dims = CART[cal] || [80, 20, 36, 1], cl = dims[0], cw = dims[1], bl = dims[2], neck = dims[3];
      const total = cl + bl, x0 = -total / 2, hw = cw / 2, bw = neck ? hw * 0.62 : hw * 0.92;
      shape([[x0 - 4, -hw - 2], [x0 + 2, -hw - 2], [x0 + 2, hw + 2], [x0 - 4, hw + 2]], '#b8902a');
      const caseCol = cal === '762x39' ? '#7b8a5a' : '#c9a23a'; // lacquered steel case on Soviet 7.62x39
      if (neck) shape([[x0 + 2, -hw], [x0 + cl * 0.72, -hw], [x0 + cl * 0.84, -bw], [x0 + cl, -bw], [x0 + cl, bw], [x0 + cl * 0.84, bw], [x0 + cl * 0.72, hw], [x0 + 2, hw]], caseCol);
      else shape([[x0 + 2, -hw], [x0 + cl, -hw], [x0 + cl, hw], [x0 + 2, hw]], caseCol);
      const bx = x0 + cl, tipLen = bl * (neck ? 0.6 : 0.45), hp = kind === 'hp';
      shape([[bx, -bw], [bx + bl - tipLen, -bw], [bx + bl, hp ? -bw * 0.35 : 0], [bx + bl, hp ? bw * 0.35 : 0], [bx + bl - tipLen, bw], [bx, bw]], cal === '762x38r' ? '#8a8a8a' : '#b87333');
      if (hp) { g.fillStyle = '#2a1a0a'; g.beginPath(); g.ellipse(bx + bl, 0, 2, bw * 0.3, 0, 0, 7); g.fill(); }
      else if (tip && kind !== 'match') { const tx = bx + bl - tipLen * 0.45; g.beginPath(); g.moveTo(tx, -bw * 0.5); g.lineTo(bx + bl, 0); g.lineTo(tx, bw * 0.5); g.closePath(); g.fillStyle = tip; g.fill(); }
      if (kind === 'apit' || kind === 'raufoss') { g.fillStyle = kind === 'raufoss' ? '#2a8' : '#d33'; g.fillRect(bx + bl - tipLen * 0.8, -bw * 0.75, 4, bw * 1.5); }
    }
    g.restore();
  }

  // cached data-URL thumbnails for items without a downloaded photo
  const thumbCache = {};
  function itemThumb(id, skin) {
    const key = id + ':' + (skin || '');
    if (!thumbCache[key]) { const c = Tex.cv(300, 140); drawWeaponSide(c.getContext('2d'), ITEMS[id], skin || (ITEMS[id].cat === 'armor' ? 'olive' : 'factory'), 300, 140); thumbCache[key] = c.toDataURL(); }
    return thumbCache[key];
  }
  function itemImage(id) {
    const c = window.IMAGE_CREDITS && IMAGE_CREDITS[id];
    return c ? c.file : itemThumb(id);
  }
  return { camoPattern, camoCanvas, camoBase, drawSoldier, drawWeaponTop, drawWeaponSide, drawCartridge, weaponLen, itemThumb, itemImage };
})();
