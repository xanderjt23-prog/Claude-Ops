export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  await b.eval(`(() => { UI.go('game'); const lo = p => ({ primary: p, sidearm1: 'glock20', sidearm2: null, melee: 'kabar', armor: 'mtv', gear: 'nogear', utils: [null, null, null], ammo: {} });
    const parts = [{ id: 'me', name: 'You', team: 0, loadout: lo('m4'), skins: {} }, { id: 'e', name: 'Stand', team: 1, isBot: true, loadout: lo('ak47'), skins: {} }, { id: 'e2', name: 'Crouch', team: 1, isBot: true, loadout: lo('ak47'), skins: {} }, { id: 'e3', name: 'Prone', team: 1, isBot: true, loadout: lo('m24'), skins: {} }];
    const g = window._g = new Game({ mapId: 'farm', seed: 1002, mode: 'deathmatch', participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game'));
    g.units.forEach(u => u.ai = null); g.start();
    const me = g.byId.me; me.x = 60 * T; me.y = 42 * T; g.input.yaw = 0; g.input.pitch = -0.08;
    [['e', 'stand', -50], ['e2', 'crouch', 0], ['e3', 'prone', 50]].forEach(([id, st, dy]) => { const u = g.byId[id]; u.x = me.x + 160; u.y = me.y + dy; u.z = 0; u.stance = st; u.angle = Math.PI; });
  })()`);
  await b.sleep(1200); await b.shot('41-stances');
  await b.eval(`_g.input.yaw = 0.35`); await b.sleep(700); await b.shot('42-prone');
};
