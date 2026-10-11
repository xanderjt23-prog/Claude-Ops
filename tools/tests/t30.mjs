export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  await b.eval(`UI.go('locker')`); await b.sleep(1500); await b.shot('130-locker');
  await b.eval(`document.querySelector('[data-l="face"]').click()`); await b.sleep(600);
  await b.eval(`document.querySelector('[data-fpre="stripes"]').click()`); await b.sleep(300);
  // paint a stroke with pointer events
  await b.eval(`(() => { const ed = document.querySelector('#face-ed'), r = ed.getBoundingClientRect(); const ev = (t, x, y) => ed.dispatchEvent(new PointerEvent(t, { clientX: r.left + x, clientY: r.top + y, pointerId: 1, bubbles: true }));
    ed.setPointerCapture = () => {}; ev('pointerdown', 60, 250); for (let x = 60; x < 260; x += 10) ev('pointermove', x, 250); ev('pointerup', 260, 250); })()`);
  await b.sleep(1200); await b.shot('131-facepaint');
  console.log('face saved:', await b.eval(`(Profile.get().face || '').slice(0, 30) + ' len ' + (Profile.get().face || '').length`));
  // in a match, a bot facing us and our own face on a teammate? show face on a soldier: use our participant as a bot-controlled unit
  await b.eval(`(() => { UI.go('game'); const P = Profile.get(); const lo = { primary: 'm4', sidearm1: 'glock20', sidearm2: null, melee: 'kabar', armor: 'noarmor', gear: 'nogear', utils: [null, null, null], ammo: {}, att: {} };
    const parts = [{ id: 'me', name: 'You', team: 0, loadout: lo, skins: {} }, { id: 'p2', name: 'Painted', team: 1, isBot: true, loadout: lo, skins: {}, face: P.face }, { id: 'p3', name: 'Bot', team: 1, isBot: true, loadout: lo, skins: {} }];
    const g = window._g = new Game({ mapId: 'killhouse', seed: 1000, mode: 'deathmatch', participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game'));
    g.units.forEach(u => u.ai = null); g.start(); const me = g.byId.me; me.x = 22 * T; me.y = 17 * T; me.z = 0; g.input.yaw = 0; g.input.pitch = 0.02;
    [['p2', -14], ['p3', 16]].forEach(([id, dy]) => { const u = g.byId[id]; u.x = me.x + 52; u.y = me.y + dy; u.z = 0; u.angle = Math.PI; }); })()`);
  await b.sleep(1500); await b.shot('132-face-ingame');
};
