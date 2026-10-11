// ============================================================================
// Soldier models for the 3D view: a rigged body (torso, head, two-bone arms and
// legs solved with simple IK every frame) so standing, kneeling, prone and dead
// soldiers are real poses rather than squashed boxes. Faces can carry the
// player's face paint. Model space: facing +x, up +y, right side +z; 1 unit = 1 px.
// ============================================================================
const Soldier3D = (() => {
  const geo = {};
  // a box with rounded edges (soft, not blobby)
  function rbox(w, h, d, r) {
    const k = `rb${w},${h},${d},${r}`; if (geo[k]) return geo[k];
    r = Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01);
    // the bevel grows the outline by bs, so the outline itself is shrunk to keep the final size w x h x d
    const bs = r * 0.6, w0 = w - 2 * bs, h0 = h - 2 * bs, r0 = Math.max(0.05, Math.min(r - bs * 0.5, w0 / 2 - 0.01, h0 / 2 - 0.01));
    const s = new THREE.Shape(), x = -w0 / 2 + r0, y = -h0 / 2 + r0, W = w0 - 2 * r0, H = h0 - 2 * r0;
    r = r0;
    s.moveTo(x, y - r); s.lineTo(x + W, y - r); s.quadraticCurveTo(x + W + r, y - r, x + W + r, y); s.lineTo(x + W + r, y + H);
    s.quadraticCurveTo(x + W + r, y + H + r, x + W, y + H + r); s.lineTo(x, y + H + r); s.quadraticCurveTo(x - r, y + H + r, x - r, y + H); s.lineTo(x - r, y); s.quadraticCurveTo(x - r, y - r, x, y - r);
    const bt = Math.min(bs / 0.6, d / 2 - 0.01);
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.1, d - 2 * bt), bevelEnabled: true, bevelThickness: bt, bevelSize: bs, bevelSegments: 2, curveSegments: 3 });
    g.translate(0, 0, -(d - 2 * bt) / 2); g.computeVertexNormals();
    // box UVs from position so camo textures wrap evenly
    const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + p.getZ(i)) / 16, p.getY(i) / 16);
    return (geo[k] = g);
  }
  // a limb segment of unit length along +y from 0 to 1 (scaled to length when posed), slightly flattened
  function limb(r0, r1, flat) {
    const k = `lb${r0},${r1},${flat}`; if (geo[k]) return geo[k];
    const g = new THREE.CylinderGeometry(r1, r0, 1, 9, 1); g.translate(0, 0.5, 0); g.scale(1, 1, flat || 1);
    const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, Math.atan2(p.getZ(i), p.getX(i)) / 3, p.getY(i) * 0.9);
    return (geo[k] = g);
  }
  const ball = (r) => geo['bl' + r] || (geo['bl' + r] = new THREE.SphereGeometry(r, 8, 6));

  // ---- faces: blank skin; a face only appears once the player paints one in the Locker (bots never have one)
  const faceCache = {};
  function faceTexture(paint) {
    const key = paint || '-'; if (faceCache[key]) return faceCache[key];
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    g.fillStyle = '#c9a07a'; g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c); tex.magFilter = THREE.LinearFilter;
    faceCache[key] = tex;
    if (paint) { const im = new Image(); im.onload = () => { g.drawImage(im, 0, 0, 64, 64); tex.needsUpdate = true; }; im.src = paint; }
    return tex;
  }

  const V = (x, y, z) => new THREE.Vector3(x, y, z), UP = V(0, 1, 0), tmpQ = new THREE.Quaternion(), tmpV = new THREE.Vector3();
  // place a unit limb mesh from point a to point b
  function seg(mesh, a, b) {
    tmpV.subVectors(b, a); const len = tmpV.length(); if (len < 1e-4) return;
    mesh.position.copy(a); mesh.quaternion.setFromUnitVectors(UP, tmpV.multiplyScalar(1 / len)); mesh.scale.set(1, len, 1);
  }
  // two-bone IK: joint position for a limb from root to target, bending toward the pole direction
  function ik(root, target, l1, l2, pole) {
    const d = tmpV.subVectors(target, root), dist = Math.min(l1 + l2 - 0.05, Math.max(0.1, d.length()));
    const dir = d.clone().normalize(), along = (l1 * l1 + dist * dist - l2 * l2) / (2 * dist), h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
    const perp = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))); if (perp.lengthSq() < 1e-6) perp.set(0, 0, 1); perp.normalize();
    const end = root.clone().add(dir.clone().multiplyScalar(dist));
    return { joint: root.clone().add(dir.multiplyScalar(along)).add(perp.multiplyScalar(h)), end };
  }

  // combine a group's direct mesh children that share a material into one mesh
  function mergeStatic(grp) {
    const by = new Map();
    grp.children.filter(c => c.isMesh).forEach(c => { if (!by.has(c.material)) by.set(c.material, []); by.get(c.material).push(c); });
    for (const [mat, list] of by) {
      if (list.length < 2) continue;
      const parts = list.map(c => { c.updateMatrix(); const g = (c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone()).applyMatrix4(c.matrix); if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; });
      const cat = (name, n) => { const a = new Float32Array(parts.reduce((s, g) => s + g.attributes[name].count * n, 0)); let o = 0; parts.forEach(g => { a.set(g.attributes[name].array, o); o += g.attributes[name].count * n; }); return a; };
      const geo2 = new THREE.BufferGeometry(); geo2.setAttribute('position', new THREE.BufferAttribute(cat('position', 3), 3)); geo2.setAttribute('normal', new THREE.BufferAttribute(cat('normal', 3), 3)); geo2.setAttribute('uv', new THREE.BufferAttribute(cat('uv', 2), 2));
      list.forEach(c => grp.remove(c)); grp.add(new THREE.Mesh(geo2, mat));
    }
  }
  // build a soldier: o = { uniform: material, skin, boots, vest (material or null), helmet, band, face (data URL), gear }
  function build(o) {
    const root = new THREE.Group(), mats = o.mats || [];
    const M = m => { if (!mats.includes(m)) mats.push(m); return m; };
    const uni = M(o.uniform), skin = M(o.skin), boots = M(o.boots), helmetM = M(o.helmet), band = M(o.band), dark = M(o.dark);
    const torso = new THREE.Group(); root.add(torso);
    const add = (parent, g, m, x, y, z) => { const me = new THREE.Mesh(g, m); me.position.set(x, y, z); parent.add(me); return me; };
    // pelvis, abdomen, chest, vest and kit (torso local: hips at 0, up the spine +y)
    add(torso, rbox(8.6, 7, 13.5, 2.2), uni, 0, 0, 0);
    add(torso, rbox(8, 8, 12.4, 2.4), uni, 0.2, 6, 0);
    add(torso, rbox(9.6, 9.5, 15, 2.8), uni, 0.4, 13.2, 0);
    if (o.vest) {
      const vm = M(o.vest), big = o.vestSize || 1;
      add(torso, rbox(11 * big, 12 * big, 15.8 * big, 2.4), vm, 0.7, 12, 0);
      for (const z of [-4, 0, 4]) add(torso, rbox(2.2, 3.6, 3.4, 0.8), vm, 0.7 + 5.6 * big, 9.2, z); // magazine pouches
    }
    add(torso, rbox(4.6, 10, 10, 1.6), dark, -6.4, 12.5, 0); // pack
    add(torso, limb(2.4, 2.1), skin, 0.6, 17.6, 0).scale.set(1, 3.2, 1); // neck
    const head = new THREE.Group(); head.position.set(0.8, 20.6, 0); torso.add(head);
    add(head, rbox(8.4, 9.2, 7.8, 3), skin, 0, 4, 0);
    // the painted face sits just in front of the head; without face paint the head is plain
    let faceMat = null;
    if (o.face || o.faceAlways) { faceMat = new THREE.MeshLambertMaterial({ map: faceTexture(o.face) }); M(faceMat); const face = add(head, new THREE.PlaneGeometry(6.8, 7.6), faceMat, 4.22, 4, 0); face.rotation.y = Math.PI / 2; }
    add(head, rbox(1.2, 2.6, 1.2, 0.4), skin, -0.2, 4, 4); add(head, rbox(1.2, 2.6, 1.2, 0.4), skin, -0.2, 4, -4); // ears
    const helmet = add(head, geo.helmet || (geo.helmet = new THREE.SphereGeometry(5.7, 14, 7, 0, Math.PI * 2, 0, Math.PI * 0.52)), helmetM, -0.3, 5.9, 0); helmet.scale.set(1.1, 0.92, 1.04);
    add(head, geo.rim || (geo.rim = new THREE.CylinderGeometry(6.1, 6.4, 1, 14, 1, true)), helmetM, -0.3, 5.9, 0).scale.set(1.1, 1, 1.04);
    let gear = null; if (o.gear) { gear = new THREE.Group(); gear.position.set(4.2, 8.4, 0); head.add(gear); add(gear, rbox(2.4, 2.6, 5.6, 0.7), dark, 0, 0, 0); add(gear, limb(1, 1), dark, 1, 0, 1.2).rotation.z = -Math.PI / 2; add(gear, limb(1, 1), dark, 1, 0, -1.2).rotation.z = -Math.PI / 2; }
    // limbs (placed every frame)
    const L = {}, mk = (k, g, m) => { L[k] = new THREE.Mesh(g, m); root.add(L[k]); };
    for (const s of ['L', 'R']) {
      mk('thigh' + s, limb(3.2, 2.5, 1.05), uni); mk('shin' + s, limb(2.5, 2.0, 1.05), uni); 
      mk('boot' + s, rbox(7.4, 3.6, 4.6, 1.2), boots);
      mk('upper' + s, limb(2.3, 1.95), uni); mk('fore' + s, limb(1.95, 1.6), uni); 
      mk('hand' + s, rbox(3, 3.2, 2.5, 0.9), skin);
    }
    const bandM = new THREE.Mesh(limb(2.5, 2.4), band); root.add(bandM); // armband on the right upper arm
    const gun = new THREE.Group(); root.add(gun);
    mergeStatic(torso); mergeStatic(head);
    root.userData = { torso, head, L, gun, bandM, mats, helmetMat: helmetM, band, gear, faceMat, face: o.face || null, walk: 0, aimAt: V(0, 0, 0) };
    return root;
  }

  // stance poses (root space); feet, hip height, torso lean
  // p: { stance, walk (phase), moving, pitch, swing (0..1 melee), weapon (item), dead, gunLen }
  const SHOULDER = [0.6, 15.6, 7.3], THIGH = 14.5, SHIN = 13.2, UPPER = 10, FORE = 10.4;
  // where a foot is during a step cycle. Stance half: planted, sliding back under the body exactly as fast as the
  // body moves forward (no skating). Swing half: lifted in an arc and carried forward to the next footfall.
  function stepFoot(phase, len, lift) {
    const t = ((phase / (Math.PI * 2)) % 1 + 1) % 1;
    if (t < 0.5) return [len / 2 - t / 0.5 * len, 0];
    const u = (t - 0.5) / 0.5, e = u * u * (3 - 2 * u);
    return [-len / 2 + e * len, Math.sin(u * Math.PI) * lift];
  }
  const lerpV = (a, b, k) => a.clone().lerp(b, k);
  function pose(root, p) {
    const d = root.userData, L = d.L, st = p.dead ? 'dead' : p.stance || 'stand';
    let H, lean, feet, pole, headPitch = p.pitch || 0, twist = 0, bob = 0, lowReady = 0;
    // gait: speed (model units / s), direction of travel relative to facing, step phase, clock
    const gt = p.gait || { speed: 0, dir: 0, phase: 0, t: 0 }, s = gt.speed || 0, ph = gt.phase || 0, dx = Math.cos(gt.dir || 0), dz = Math.sin(gt.dir || 0);
    if (st === 'prone') {
      // crawl: knees come up and out in turn, the body rocks from side to side
      const m = Math.min(1, s / 15), a = Math.sin(ph), b = Math.sin(ph + Math.PI);
      H = V(-8 + a * 0.6 * m, 5.4, a * 1.4 * m); lean = Math.PI / 2 - 0.1;
      feet = [V(-37 + Math.max(0, a) * 7 * m, 1.6, -5.5 - Math.max(0, a) * 2.5 * m), V(-37 + Math.max(0, b) * 7 * m, 1.6, 5.5 + Math.max(0, b) * 2.5 * m)];
      pole = [V(0, -0.6, -1 * (0.3 + m)), V(0, -0.6, 1 * (0.3 + m))];
      headPitch = Math.max(-0.2, Math.min(0.5, headPitch)); bob = a * 0.5 * m;
    } else if (st === 'crouch') {
      // still: kneel on one knee. Moving: a low, bent-legged walk (blended so stopping settles into the kneel)
      const m = Math.min(1, s / 25), len = (8 + Math.min(s, 120) * 0.05) * m;
      const kneelH = V(-1.5, 16, 0), kneelF = [V(8, 1.8, -4.4), V(-10.5, 1.4, 5)];
      const f = [0, 1].map(k => { const [al, up] = stepFoot(ph + (k ? Math.PI : 0), len, 2.2); return V(2 + dx * al, 1.8 + up, (k ? 4.6 : -4.6) + dz * al); });
      H = lerpV(kneelH, V(-1, 18 - 0.5 * Math.cos(2 * ph), Math.sin(ph) * 0.6), m); lean = 0.3 + 0.08 * m;
      feet = [lerpV(kneelF[0], f[0], m), lerpV(kneelF[1], f[1], m)];
      pole = [V(1, 0.3, 0), lerpV(V(1, -0.6, 0), V(1, 0.1, 0), m)]; twist = Math.sin(ph) * 0.06 * m; bob = Math.sin(2 * ph) * 0.4 * m;
    } else if (st === 'dead') {
      H = V(0, 4.2, 0); lean = -Math.PI / 2 + 0.05;
      feet = [V(30, 2, -6), V(29, 2, 6.5)]; pole = [V(0, 1, 0), V(0, 1, 0)]; headPitch = -0.2;
    } else {
      // walking / running: stride and lift grow with speed; hips bob twice per cycle and sway over the planted foot
      const m = Math.min(1, s / 50), run = Math.max(0, Math.min(1, (s - 205) / 60));
      const len = (11 + Math.min(s, 300) * 0.045) * m, lift = (2.4 + run * 3) * m;
      const idle = [V(2, 1.8, -4.2), V(-0.6, 1.8, 4.4)];
      feet = [0, 1].map(k => { const [al, up] = stepFoot(ph + (k ? Math.PI : 0), len, lift); return lerpV(idle[k], V(1 + dx * al, 1.8 + up, (k ? 4 : -4) + dz * al), m); });
      H = V(-0.5 - run * 1.5, 31.2 - m * (0.5 + 0.7 * Math.cos(2 * ph)) - run * 1.4 + (1 - m) * Math.sin((gt.t || 0) * 1.8) * 0.25, m * Math.sin(ph) * 0.7);
      lean = 0.05 + m * 0.04 * Math.max(0, dx) + run * 0.18; pole = [V(1, 0, 0), V(1, 0, 0)];
      twist = m * Math.sin(ph) * (0.07 + run * 0.06); bob = m * Math.sin(2 * ph) * (0.35 + run * 0.4);
      lowReady = p.firing ? 0 : run; // sprinting soldiers carry the rifle low
    }
    d.torso.position.copy(H); d.torso.rotation.set(0, twist, -lean);
    // the head stays level with where the soldier looks, whatever the torso is doing
    d.head.rotation.set(0, -twist, st === 'dead' ? 0.3 : lean + Math.max(-0.7, Math.min(0.7, headPitch)));
    d.torso.updateMatrix(); const TM = d.torso.matrix;
    const toRoot = (x, y, z) => V(x, y, z).applyMatrix4(TM);
    // legs
    ['L', 'R'].forEach((s, k) => {
      const hip = toRoot(0, -1.2, k ? 3.7 : -3.7), r = ik(hip, feet[k], THIGH, SHIN, pole[k]);
      seg(L['thigh' + s], hip, r.joint); seg(L['shin' + s], r.joint, r.end);
      const bt = L['boot' + s]; tmpV.subVectors(r.end, r.joint).normalize(); bt.quaternion.setFromUnitVectors(V(0, -1, 0), tmpV);
      bt.position.copy(r.end).add(V(1.6, -1.2, 0).applyQuaternion(bt.quaternion));
    });
    // arms: hands on the weapon, which points where the soldier aims
    const it = p.weapon, sh = [toRoot(SHOULDER[0], SHOULDER[1], -SHOULDER[2]), toRoot(SHOULDER[0], SHOULDER[1], SHOULDER[2])];
    const aimPitch = st === 'dead' ? 0 : Math.max(-0.9, Math.min(0.9, p.pitch || 0)) * (1 - lowReady) - 0.6 * lowReady, center = sh[0].clone().add(sh[1]).multiplyScalar(0.5);
    center.y += bob;
    const aimRot = (x, y, z) => V(x, y, z).applyAxisAngle(V(0, 0, 1), aimPitch).applyAxisAngle(UP, p.swingYaw || 0).add(center);
    const gun = d.gun; let hands;
    if (st === 'dead') { hands = [toRoot(4, 13, -15), toRoot(2, 13, 15)]; gun.visible = false; }
    else if (!it || it.id === 'fists') { hands = [aimRot(10, -3, -3.5), aimRot(9, -2, 3.5)]; gun.visible = false; }
    else if (it.cat === 'melee') {
      gun.visible = true; gun.position.copy(aimRot(9, -5, 3.5)); gun.rotation.set(0, -Math.PI / 2 + (p.swingYaw || 0) * 1.2, aimPitch - 0.5 + (p.swing ? Math.sin(p.swing * Math.PI) * 1.2 : 0), 'ZYX');
      hands = [toRoot(3, 6, -8.5), gun.position.clone()];
    } else {
      const pistol = it.cat === 'sidearm' && it.type !== 'Submachine Gun', len = (p.gunLen || 20);
      gun.visible = true;
      const gp = pistol ? aimRot(15, -1.5, 0.5) : aimRot(7, -1.6, 4.4); // rifles: stock in the right shoulder
      gun.position.copy(gp); gun.rotation.set(0, -Math.PI / 2, aimPitch, 'ZYX');
      const grip = gp.clone(), fore = pistol ? aimRot(14.5, -2.6, -0.4) : aimRot(7 + len * 0.42, -1.9, 3.4);
      hands = [fore, grip];
    }
    ['L', 'R'].forEach((s, k) => {
      const pl = st === 'dead' ? V(0, 1, 0) : V(-0.3, -1, k ? 0.9 : -0.9), r = ik(sh[k], hands[k], UPPER, FORE, pl);
      seg(L['upper' + s], sh[k], r.joint); seg(L['fore' + s], r.joint, r.end);
      const hd = L['hand' + s]; hd.position.copy(r.end); hd.quaternion.copy(L['fore' + s].quaternion);
      if (k === 1) { const b = d.bandM; b.position.copy(sh[1]).lerp(r.joint, 0.25); b.quaternion.copy(L.upperR.quaternion); b.scale.set(1.05, 2.6, 1.05); }
    });
  }
  // length of one step at a speed, per stance (must match the stride used in pose)
  function strideLen(stance, s) {
    if (stance === 'prone') return 7;
    if (stance === 'crouch') return 8 + Math.min(s, 120) * 0.05;
    return 11 + Math.min(s, 300) * 0.045;
  }
  return { build, pose, faceTexture, strideLen };
})();
