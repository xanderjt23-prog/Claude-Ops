// vertical gameplay: stairs, jumping, ladders, stances, headshots, buildings
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  const mk = (map, extra) => b.eval(`(() => { if (window._g) _g.stop(); UI.go('game'); const lo = p => ({ primary: p, sidearm1: 'glock20', sidearm2: null, melee: 'kabar', armor: 'noarmor', gear: 'nogear', utils: ['m67', 'smoke', null], ammo: {} });
    const parts = [{ id: 'me', name: 'You', team: 0, loadout: lo('m24'), skins: {} }, { id: 'e', name: 'Enemy', team: 1, isBot: true, loadout: lo('ak47'), skins: {} }];
    const g = window._g = new Game({ mapId: '${map}', seed: 1000 + MAPS.findIndex(m => m.id === '${map}'), mode: 'deathmatch', participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game'));
    g.units.forEach(u => u.ai = null); g.start(); ${extra || ''} return 'ok'; })()`);
  const step = (inp, n) => b.eval(`(() => { const g = _g, me = g.byId.me; for (let i = 0; i < ${n}; i++) { g.applyInput(me, Object.assign({ mx: 0, my: 0, utils: [], slot: null }, ${JSON.stringify(inp)}), 1/60); g.updateUnits(1/60); } return JSON.stringify({ x: Math.round(me.x), y: Math.round(me.y), z: +me.z.toFixed(1), st: me.stance, lad: me.onLadder }); })()`);
  // --- stairs in old town
  await mk('oldtown');
  console.log('stairs', await b.eval(`JSON.stringify(_g.map.stairs.slice(0, 2).map(s => ({ dx: s.dx, dy: s.dy, sx: s.sx, sy: s.sy })))`));
  await b.eval(`(() => { const g = _g, me = g.byId.me, s = g.map.stairs[0], a = s.approach, m = g.map; me.x = (a % m.w) * T + T / 2; me.y = ((a / m.w) | 0) * T + T / 2; me.z = 0; g.byId.e.x = me.x + 40; g.byId.e.y = me.y + 300; g.byId.e.alive = false; window._s = s; })()`);
  const sdx = await b.eval(`_s.dx`), sdy = await b.eval(`_s.dy`);
  for (let k = 0; k < 4; k++) console.log('walk up', await step({ mx: sdx, my: sdy }, 25));
  await b.eval(`(() => { _g.input.yaw = Math.atan2(_s.dy, _s.dx); _g.input.pitch = -0.1; })()`); await b.sleep(500); await b.shot('30-upstairs');
  await b.eval(`(() => { _g.input.yaw += Math.PI; _g.input.pitch = -0.35; })()`); await b.sleep(400); await b.shot('31-stairs-down-view');
  // --- jump
  await b.eval(`(() => { const me = _g.byId.me; const s = _g.map.spawns[0][0]; me.x = s.x; me.y = s.y; me.z = 0; me.vz = 0; me.grounded = true; })()`);
  let maxZ = 0; await step({ jump: true }, 1); for (let i = 0; i < 30; i++) { const r = JSON.parse(await step({}, 2)); maxZ = Math.max(maxZ, r.z); }
  console.log('jump apex', maxZ, 'landed', await step({}, 10));
  // --- stances
  console.log('crouch', await step({ stance: 'crouch' }, 2), 'prone', await step({ stance: 'prone' }, 2), 'stand', await step({ stance: 'stand' }, 2));
  // --- headshot vs body with the M24
  console.log('headshot test', await b.eval(`(() => { const g = _g, me = g.byId.me, e = g.byId.e; e.alive = true; e.hp = 100; e.invulnT = 0; e.stance = 'stand'; e.z = 0; me.z = 0; me.stance = 'stand';
    e.x = me.x + 200; e.y = me.y; me.angle = 0; const out = [];
    for (const [label, tz] of [['body', 35], ['head', 56]]) { e.hp = 100; e.alive = true; me.pitch = Math.atan2(tz - eyeZ(me), 200 - 0); const it = g.wstat(me, 0); me.slot = 0; me.mag[0] = 5; const sp = it.spread; it.spread = 0; g.shoot(me, it); it.spread = sp; for (let i = 0; i < 40; i++) g.updateProjectiles(1/60); out.push(label + ':' + (100 - Math.max(0, e.hp)).toFixed(0)); }
    return out.join(' '); })()`));
  // --- ladder on a desert roof
  await mk('desert');
  console.log('ladders', await b.eval(`_g.map.ladders.length`));
  await b.eval(`(() => { const g = _g, me = g.byId.me, L = g.map.ladders[0]; me.x = L.x * T + T / 2; me.y = L.y * T + T / 2; me.z = 0; window._L = L; g.byId.e.alive = false; g.input.yaw = Math.atan2(L.dy, L.dx); })()`);
  const ldx = await b.eval(`_L.dx`), ldy = await b.eval(`_L.dy`);
  for (let k = 0; k < 3; k++) console.log('climb', await step({ mx: ldx, my: ldy }, 30));
  console.log('onto roof', await step({ mx: ldx, my: ldy }, 40), 'roofH', await b.eval(`_L.top`));
  await b.eval(`(() => { _g.input.yaw += Math.PI * 0.8; _g.input.pitch = -0.25; })()`); await b.sleep(500); await b.shot('32-desert-roof');
  // --- building exteriors
  for (const [map, fx, fy, yaw] of [['farm', 50, 52, -0.6], ['airfield', 38, 30, -1.2], ['oldtown', 28, 25, 0.3]]) {
    await mk(map, `const me = g.byId.me; me.x = ${fx} * T; me.y = ${fy} * T; g.input.yaw = ${yaw}; g.input.pitch = 0.12; g.byId.e.alive = false;`);
    await b.sleep(900); await b.shot('33-ext-' + map);
  }
  // --- third person look at stances: put the camera on the enemy looking at us
  await b.eval(`(() => { const g = _g, me = g.byId.me, e = g.byId.e; e.alive = true; e.x = me.x + 70; e.y = me.y; e.z = me.z; e.angle = Math.PI; me.stance = 'crouch'; me.alive = false; g.spectate = 'e'; })()`); await b.sleep(400); await b.shot('34-crouched-seen');
  await b.eval(`_g.byId.me.stance = 'prone'`); await b.sleep(300); await b.shot('35-prone-seen');
};
