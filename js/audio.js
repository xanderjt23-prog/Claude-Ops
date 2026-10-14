// ============================================================================
// Sound effects: real recorded gunshots, explosions and handling sounds
// (js/sounds.js) played through WebAudio with distance muffling and panning.
// ============================================================================
const Sfx = (() => {
  let ac = null, master = null, muffle = null, active = 0;
  const buffers = {}, playing = {}, lastPlay = {};
  let volume = 0.5;
  try { const v = parseFloat(localStorage.getItem('fo-volume')); if (!isNaN(v)) volume = v; } catch (e) {}
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      // master volume -> muffle filter (flashbang deafness) -> limiter so many shots don't clip
      master = ac.createGain(); master.gain.value = volume;
      muffle = ac.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 20000;
      const lim = ac.createDynamicsCompressor(); lim.threshold.value = -10; lim.knee.value = 6; lim.ratio.value = 12; lim.attack.value = 0.002; lim.release.value = 0.2;
      master.connect(muffle); muffle.connect(lim); lim.connect(ac.destination);
      for (const name in (window.SOUND_DATA || {})) {
        const bin = atob(SOUND_DATA[name]), arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        ac.decodeAudioData(arr.buffer).then(b => { buffers[name] = b; }).catch(() => {});
      }
    } catch (e) { ac = null; }
  }
  // listener position (camera); distance muffles and quietens, x offset pans
  let lx = 0, ly = 0, lyaw = 0;
  function play(name, o) {
    o = o || {};
    const buf = buffers[name]; if (!ac || !buf || active > 48) return;
    let gain = o.vol === undefined ? 1 : o.vol, pan = 0, cut = 20000;
    if (o.x !== undefined) {
      const d = Math.hypot(o.x - lx, o.y - ly), range = o.range || 2600;
      if (d > range) return;
      gain *= Math.pow(1 - d / range, 1.6);
      cut = Math.max(700, 20000 * Math.exp(-d / (o.far ? 1400 : 800)));
      // first person: pan by direction relative to where the listener is looking
      if (d > 1) pan = Math.max(-0.8, Math.min(0.8, Math.sin(Math.atan2(o.y - ly, o.x - lx) - lyaw) * Math.min(1, d / 120)));
    }
    if (o.cut) cut = Math.min(cut, o.cut);
    if (gain < 0.01) return;
    if ((playing[name] || 0) >= (o.max || 8)) return;
    const t = ac.currentTime + (o.delay || 0);
    const src = ac.createBufferSource(); src.buffer = buf;
    src.playbackRate.value = (o.rate || 1) * (1 + ((o.jitter === undefined ? 0.03 : o.jitter) * (Math.random() * 2 - 1)));
    const g = ac.createGain(); g.gain.value = gain;
    let node = src;
    if (cut < 19000) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cut; node.connect(f); node = f; }
    node.connect(g);
    if (ac.createStereoPanner && pan) { const p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(master); } else g.connect(master);
    if (o.dur) { g.gain.setValueAtTime(gain, t + o.dur * 0.7); g.gain.linearRampToValueAtTime(0, t + o.dur); src.start(t, 0, o.dur + 0.02); } else src.start(t);
    active++; playing[name] = (playing[name] || 0) + 1;
    src.onended = () => { active--; playing[name]--; };
  }
  // which recording each gun uses (several guns share a recording at a different pitch)
  const GUN = {
    glock20: ['pistol', 0.97], makarov: ['pistol', 1.12], m9: ['pistol', 1.05], p226: ['pistol', 1.03], m1911: ['pistol', 0.9],
    deagle: ['magnum', 0.8, 1.15], python: ['magnum', 1], mod29: ['magnum', 0.9, 1.1], nagant: ['magnum', 1.12, 0.8],
    uzi: ['uzi', 1], thompson: ['uzi', 0.9], vector: ['uzi', 0.95], mp5: ['mp5', 1], mp7: ['mp5', 1.12], p90: ['mp5', 1.07],
    m4: ['ar15', 1.02], hk416: ['ar15', 1], g36: ['ar15', 1.03], famas: ['ar15', 1.05], aug: ['ar15', 0.98], m16: ['ar15', 0.96], m249: ['carbine', 0.95, 1.1],
    ak47: ['ak', 1], rpk: ['ak', 0.95], scar: ['fal', 1.02], m14: ['fal', 0.97], svd: ['fal', 0.93, 1.1],
    m60: ['mag', 0.97], pkm: ['mag', 1.02], mosin: ['rifle', 1.04], m24: ['rifle', 1], awm: ['rifle', 0.86, 1.15],
    m82: ['cal50', 0.88, 1.3], m2hb: ['cal50', 1, 1.2],
    r870: ['shotgun2', 0.95], spas12: ['shotgun2', 1], m1014: ['shotgun2', 1.02], aa12: ['shotgun2', 1.06],
    m32: ['m203', 1], rpg7: ['rpg', 1, 1.1],
    // newer additions and the WW2 arsenal
    stg44: ['ak', 1.06], ak12: ['ak', 1.04], garand: ['fal', 1.01], mk14: ['fal', 0.99], enfield: ['rifle', 1.08], k98k: ['rifle', 1.02],
    bar: ['mag', 1.06, 0.95], mg42: ['mag', 1.15, 0.95], luger: ['pistol', 1.08], p38: ['pistol', 1.0], glock18: ['pistol', 1.1, 0.9],
    mp40: ['uzi', 0.86], sten: ['uzi', 0.82], hk417: ['fal', 1.0], galil: ['ak', 1.05], svt40: ['fal', 0.95], l96: ['rifle', 1.02], ksg: ['shotgun2', 0.97], ump45: ['mp5', 0.9], cz75: ['pistol', 1.04], fiveseven: ['pistol', 1.15, 0.9],
  };
  function shot(it, x, y, shooter, ammoKind, suppressed) {
    if (it.flame || it.spinup) { // continuous: re-trigger a burst segment while the trigger is held
      const name = it.flame ? 'flame' : 'minigun', key = shooter + name, now = ac ? ac.currentTime : 0;
      if (now - (lastPlay[key] || -9) < 0.42) return;
      lastPlay[key] = now; play(name, { x, y, vol: it.flame ? 0.75 : 1, dur: 0.6, jitter: 0.01, max: 12, far: !it.flame }); return;
    }
    const g = GUN[it.id] || [it.cat === 'sidearm' ? 'pistol' : 'ar15', 1];
    // suppressed: a muffled crack that carries only a short way
    if (suppressed) play(g[0], { x, y, rate: g[1] * 1.12, vol: (g[2] || 1) * 0.32, cut: 1500, range: 750, max: 10, dur: 0.35 });
    else play(g[0], { x, y, rate: g[1], vol: g[2] || 1, far: true, range: it.pellets || it.cat === 'sidearm' ? 2600 : 3400, max: 10 });
    if (ammoKind === 'dragon') play('fireball', { x, y, vol: 0.7, rate: 1.3 });
  }
  return {
    init,
    setListener(x, y, yaw) { lx = x; ly = y; lyaw = yaw || 0; },
    setVolume(v) { volume = v; if (master) master.gain.value = v; try { localStorage.setItem('fo-volume', v); } catch (e) {} },
    getVolume: () => volume,
    shot,
    boom(x, y, big, kind) {
      const o = { x, y, range: 5000, far: true, max: 6, jitter: 0.06 };
      if (kind === 'flash') return play('flashbang', Object.assign(o, { vol: 1 }));
      if (kind === 'pop') return play('smokehiss', { x, y, vol: 0.55, range: 1500 });
      if (kind === 'c4' || kind === 'rocket' || big) play(Math.random() < 0.5 ? 'bomb' : 'boom1', Object.assign(o, { vol: 1 }));
      else if (kind === 'he') play('boom2', Object.assign(o, { vol: 0.8 }));
      else if (kind === 'barrel') play('boom1', Object.assign(o, { vol: 0.9 }));
      else play(Math.random() < 0.5 ? 'nade' : 'boom3', Object.assign(o, { vol: 1 }));
    },
    hit(x, y) { play('flesh', { x, y, vol: 0.5, range: 1200, max: 4 }); },
    tileHit(x, y, hard) { if (hard >= 3.5 && Math.random() < 0.12) play('ricochet', { x, y, vol: 0.25, range: 1200, max: 3, jitter: 0.15 }); },
    glass(x, y) { play('glass', { x, y, vol: 0.6, range: 1600, max: 4, jitter: 0.08 }); },
    ignite(x, y) { play('fireball', { x, y, vol: 0.6, range: 1600, max: 3 }); },
    swing(x, y) { play('whoosh', { x, y, vol: 0.7, range: 900, max: 4, jitter: 0.1 }); },
    reload(x, y, it) {
      const o = { x, y, range: 900, max: 6 };
      if (!it) return play('magin', o);
      if (it.type === 'Shotgun' && !it.auto) return play('pump', Object.assign(o, { delay: Math.max(0, it.reload - 0.8) }));
      if (it.cat === 'sidearm' && it.type !== 'Submachine Gun') return play('pistolmag', Object.assign(o, { delay: Math.min(0.6, it.reload * 0.3) }));
      play('magin', Object.assign(o, { delay: 0.15, rate: it.type.includes('Heavy') || it.type.includes('Machine') ? 0.85 : 1 }));
      play('bolt', Object.assign(o, { delay: Math.max(0.5, it.reload - 0.5) }));
    },
    empty(x, y) { play('dryfire', { x, y, vol: 0.7, range: 600 }); },
    pin(x, y) { play('dryfire', { x, y, vol: 0.5, rate: 1.5, range: 700 }); },
    heal(x, y) { play('rip', { x, y, vol: 0.6, range: 700 }); },
    gear(on) { play(on ? 'nvg' : 'flashlight', { vol: on ? 0.45 : 0.6 }); },
    light() { play('flashlight', { vol: 0.6, jitter: 0 }); },
    buy() { play('bolt', { vol: 0.5, jitter: 0 }); },
    // flashbanged: everything goes muffled for a few seconds
    flash() { if (!ac) return; const t = ac.currentTime; muffle.frequency.cancelScheduledValues(t); muffle.frequency.setValueAtTime(350, t); muffle.frequency.setValueAtTime(350, t + 1.5); muffle.frequency.exponentialRampToValueAtTime(20000, t + 5); },
    // the arcade-style beeps were removed; these stay as silent hooks
    hitmarker() {}, kill() {}, ui() {}, click() {}, death() {}, levelup() {},
  };
})();
