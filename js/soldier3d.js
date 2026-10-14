// ============================================================================
// Soldier models for the 3D view: the classic blocky soldier (box limbs, round
// head and helmet) with a little more detail - hands, neck, belt, pouches, helmet
// brim, bedroll - and knees, so kneeling, crawling and lying poses bend properly.
// Walking uses the classic leg swing. Model space: facing +x, up +y, right +z.
// ============================================================================
const Soldier3D = (() => {
  const geo = {};
  const box = (w, h, d) => { const k = `b${w},${h},${d}`; return geo[k] || (geo[k] = new THREE.BoxGeometry(w, h, d)); };
  // an arm: a box from 0 to 1 along +x (scaled to the arm's length when posed)
  const armGeo = () => geo.arm || (geo.arm = new THREE.BoxGeometry(1, 4, 4).translate(0.5, 0, 0));
  const bandGeo = () => geo.band || (geo.band = new THREE.BoxGeometry(3.6, 4.7, 4.7).translate(1.8, 0, 0));

  // ---- faces: plain skin; a face only appears once the player paints one in the Locker (bots never have one)
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

  // build a soldier: o = { uniform, skin, boots, dark, helmet, band (materials), vest (material or null), vestSize, face, faceAlways, gear, mats }
  function build(o) {
    const root = new THREE.Group(), mats = o.mats || [];
    const M = m => { if (m && !mats.includes(m)) mats.push(m); return m; };
    const uni = M(o.uniform), skin = M(o.skin), boots = M(o.boots), helmetM = M(o.helmet), band = M(o.band), dark = M(o.dark);
    const add = (parent, g, m, x, y, z) => { const me = new THREE.Mesh(g, m); me.position.set(x, y, z); parent.add(me); return me; };
    const hips = new THREE.Group(); root.add(hips);
    // legs: thigh pivot at the hip, knee pivot, shin and boot
    const legs = [-4, 4].map(z => {
      const thigh = new THREE.Group(); thigh.position.set(0, 0, z); hips.add(thigh);
      add(thigh, box(7, 12.5, 6.5), uni, 0, -6.25, 0);
      const knee = new THREE.Group(); knee.position.set(0, -12.5, 0); thigh.add(knee);
      add(knee, box(6.4, 11.5, 6), uni, 0, -5.75, 0);
      add(knee, box(10, 3.6, 7.4), boots, 1.8, -12.5, 0);
      add(knee, box(10.4, 1, 7.8), dark, 1.8, -14.2, 0); // sole
      return { thigh, knee };
    });
    // torso: belt, chest, vest and kit, neck, head
    const torso = new THREE.Group(); hips.add(torso);
    add(torso, box(10.6, 3, 16.4), dark, 0, 1.5, 0);
    add(torso, box(1.2, 2.2, 3), boots, 5.4, 1.5, 0); // buckle
    add(torso, box(10, 20, 16), uni, 0, 12, 0);
    if (o.vest) {
      const vm = M(o.vest), big = o.vestSize || 1;
      add(torso, box(12 * big, 14 * big, 17.4 * big), vm, 0.4, 13, 0);
      for (const z of [-4.4, 0, 4.4]) add(torso, box(2.6, 4.4, 3.6), vm, 0.4 + 6.2 * big, 9.4, z); // magazine pouches
    }
    add(torso, box(6, 15, 12), dark, -8.2, 13.5, 0); // pack
    add(torso, geo.roll || (geo.roll = new THREE.CylinderGeometry(2.6, 2.6, 13, 8).rotateX(Math.PI / 2)), dark, -8.6, 22.4, 0); // bedroll
    add(torso, box(4, 3, 4.6), skin, 0.5, 23.2, 0); // neck
    const head = new THREE.Group(); head.position.set(0.5, 23.5, 0); torso.add(head);
    add(head, geo.head || (geo.head = new THREE.SphereGeometry(5.5, 12, 9)), skin, 0, 3.6, 0);
    let faceMat = null;
    if (o.face || o.faceAlways) { // face paint: a skin-tight cap over the front of the head
      faceMat = new THREE.MeshLambertMaterial({ map: faceTexture(o.face) }); M(faceMat);
      const cap = add(head, geo.faceCap || (geo.faceCap = new THREE.SphereGeometry(5.62, 14, 10, Math.PI * 0.2, Math.PI * 0.6, Math.PI * 0.3, Math.PI * 0.45)), faceMat, 0, 3.6, 0);
      cap.rotation.y = Math.PI / 2; // centre of the segment faces +x
    }
    add(head, geo.helmet || (geo.helmet = new THREE.SphereGeometry(6.7, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2)), helmetM, -0.3, 4.9, 0);
    add(head, geo.brim || (geo.brim = new THREE.CylinderGeometry(7.2, 7.5, 1, 14)), helmetM, -0.3, 4.9, 0);
    let gear = null; if (o.gear) { gear = add(head, box(2.6, 2.6, 6), dark, 5.6, 7.2, 0); }
    // arms and weapon in an aim frame at shoulder height (pitches with the aim)
    const armG = new THREE.Group(); armG.position.set(0.5, 17, 0); torso.add(armG);
    const arms = [0, 1].map(() => { const a = new THREE.Mesh(armGeo(), uni), h = new THREE.Mesh(box(3, 3.4, 3), skin); armG.add(a); armG.add(h); return { a, h }; });
    const bandM = new THREE.Mesh(bandGeo(), band); armG.add(bandM);
    const gun = new THREE.Group(); armG.add(gun);
    root.userData = { hips, torso, head, legs, armG, arms, bandM, gun, mats, helmetMat: helmetM, band, gear, faceMat, face: o.face || null };
    return root;
  }

  const V = (x, y, z) => new THREE.Vector3(x, y, z), X = V(1, 0, 0), q = new THREE.Quaternion(), tv = new THREE.Vector3();
  // stretch an arm from the shoulder to the hand
  function arm(m, from, to) { tv.subVectors(to, from); const len = tv.length(); m.position.copy(from); m.quaternion.setFromUnitVectors(X, tv.multiplyScalar(1 / Math.max(1e-4, len))); m.scale.set(len, 1, 1); }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // p: { stance, walk, moving, pitch, weapon, gunLen, swing (0..1), swingYaw, dead }
  function pose(root, p) {
    const d = root.userData, st = p.dead ? 'dead' : p.stance || 'stand', w = p.walk || 0, mv = p.moving ? 1 : 0;
    const pitch = clamp(p.pitch || 0, -0.9, 0.9), [L, R] = d.legs;
    let hipY = 26.3, hipX = 0, hipRot = 0, lean = 0, headRot = pitch * 0.6, armRot = pitch;
    d.armG.visible = true; d.legs.forEach(l => { l.thigh.rotation.set(0, 0, 0); l.knee.rotation.set(0, 0, 0); });
    if (st === 'stand') {
      // the classic walk: legs swing from the hip
      const s = Math.sin(w) * 0.55 * mv; L.thigh.rotation.z = s; R.thigh.rotation.z = -s;
    } else if (st === 'crouch') {
      if (!mv) { // kneel on the right knee
        hipX = -1.5; hipY = 14.6; lean = 0.25;
        L.thigh.rotation.z = 1.45; L.knee.rotation.z = -1.45; R.thigh.rotation.z = -0.05; R.knee.rotation.z = -1.5;
      } else { // low, bent-legged walk
        const s = Math.sin(w) * 0.3; hipX = -1; hipY = 15.5 + Math.abs(Math.cos(w)) * 0.6; lean = 0.32;
        L.thigh.rotation.z = 1.0 + s; L.knee.rotation.z = -1.9 - s * 0.6; R.thigh.rotation.z = 1.0 - s; R.knee.rotation.z = -1.9 + s * 0.6;
      }
      headRot = lean + pitch * 0.6; armRot = lean + pitch;
    } else if (st === 'prone') {
      // on the belly, rifle forward, crawling with the knees
      hipX = -8; hipY = 5.2; hipRot = -Math.PI / 2 + 0.08;
      const s = Math.sin(w) * mv; L.thigh.rotation.z = Math.max(0, s) * 0.45; L.knee.rotation.z = -Math.max(0, s) * 0.9; R.thigh.rotation.z = Math.max(0, -s) * 0.45; R.knee.rotation.z = -Math.max(0, -s) * 0.9;
      L.thigh.rotation.x = 0.08; R.thigh.rotation.x = -0.08;
      headRot = Math.PI / 2 - 0.08 + clamp(pitch, -0.2, 0.5) * 0.6; armRot = Math.PI / 2 - 0.08 + clamp(pitch, -0.2, 0.5);
    } else { // dead: on the back, legs apart, arms out
      hipY = 5.2; hipRot = Math.PI / 2 - 0.05; L.thigh.rotation.x = -0.15; R.thigh.rotation.x = 0.15; headRot = 0.25; armRot = 0;
    }
    d.hips.position.set(hipX, hipY, 0); d.hips.rotation.set(0, 0, hipRot);
    d.torso.rotation.set(0, 0, -lean); d.head.rotation.set(0, 0, headRot);
    d.armG.rotation.set(0, p.swingYaw || 0, armRot);
    // hands on the weapon
    const it = p.weapon, gun = d.gun, sh = [V(0, 0, -7), V(0, 0, 7)];
    let hands;
    if (st === 'dead') { hands = [V(1, -1, -16), V(2, -1, 16)]; gun.visible = false; }
    else if (!it || it.id === 'fists') { hands = [V(11, -1, -3.5), V(10, 0, 3.5)]; gun.visible = false; }
    else if (it.cat === 'melee') {
      // two-handed weapons (axe, sledgehammer, katana) are held up across the body in both hands and chop down;
      // the rest in the right hand
      const mu = gun.children[0] && gun.children[0].userData.melee, sw = p.swing ? Math.sin(p.swing * Math.PI) : 0;
      gun.visible = true;
      if (mu && mu.hold === 'two') {
        const a = 0.95 - sw * 1.7, d = mu.hand2 * 1.15;
        gun.position.set(9, -4, 2.5); gun.rotation.set(0, -Math.PI / 2, a, 'ZYX');
        hands = [V(9 + Math.cos(a) * d, -4 + Math.sin(a) * d, 1.5), V(9, -4, 2.5)];
      } else {
        gun.position.set(10, -3, 4); gun.rotation.set(0, -Math.PI / 2, -0.5 + sw * 1.2, 'ZYX');
        hands = [V(3, -12, -8.5), V(10, -3, 4)];
      }
    } else if (it.cat === 'sidearm' && it.type !== 'Submachine Gun') {
      gun.visible = true; gun.position.set(15, -0.5, 0.5); gun.rotation.set(0, -Math.PI / 2, 0, 'ZYX');
      hands = [V(14.6, -2, -0.6), V(15, -1.6, 0.8)];
    } else {
      const len = p.gunLen || 20; gun.visible = true; gun.position.set(8, -1.6, 2.6); gun.rotation.set(0, -Math.PI / 2, 0, 'ZYX');
      hands = [V(8 + len * 0.42, -1.2, 0.6), V(8.4, -2.6, 2.8)];
    }
    d.arms.forEach((a, k) => { arm(a.a, sh[k], hands[k]); a.h.position.copy(hands[k]); a.h.quaternion.copy(a.a.quaternion); });
    // team armband round the right upper arm
    d.bandM.position.copy(sh[1]).lerp(hands[1], 0.18); d.bandM.quaternion.copy(d.arms[1].a.quaternion);
  }
  return { build, pose, faceTexture };
})();
