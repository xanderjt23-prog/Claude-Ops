// walk cycle gallery: walking, sprinting, strafing, backwards, crouch-walking, crawling (side view, several moments)
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  await b.eval(`(() => { UI.go('game');
    const lo = { primary: 'm4', sidearm1: 'glock20', sidearm2: null, melee: 'kabar', armor: 'mtv', gear: 'nogear', utils: [null, null, null], ammo: {}, att: {} };
    const kinds = [['walk', 'stand', 200, 0], ['sprint', 'stand', 270, 0], ['strafe', 'stand', 200, Math.PI / 2], ['back', 'stand', 160, Math.PI], ['crouch', 'crouch', 110, 0], ['crawl', 'prone', 56, 0], ['idle', 'stand', 0, 0]];
    const parts = [{ id: 'me', name: 'You', team: 0, loadout: lo, skins: {} }].concat(kinds.map((k, i) => ({ id: 'e' + i, name: k[0], team: 1, isBot: true, loadout: lo, skins: {}, uniform: 'woodland' })));
    const g = window._g = new Game({ mapId: 'killhouse', seed: 1000, mode: 'deathmatch', participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game'));
    g.units.forEach(u => u.ai = null); g.start();
    const me = g.byId.me; me.x = 22 * T; me.y = 17 * T + 230; me.z = 0; g.input.yaw = -Math.PI / 2; g.input.pitch = -0.1;
    const base = kinds.map((k, i) => { const u = g.byId['e' + i]; u.x = me.x - 165 + i * 55; u.y = 17 * T - 20; u.z = 0; u.stance = k[1]; u.angle = 0; return { u, k, x0: u.x, y0: u.y }; });
    // move each soldier back and forth along its own path at its speed (facing stays +x)
    let t = 0; window._mv = setInterval(() => { t += 1 / 60; base.forEach(({ u, k, x0, y0 }) => { const d = Math.sin(t * 0.5) > 0 ? 1 : -1, s = k[2] / 60, a = k[3];
      u.x += Math.cos(a) * s * 0.6 * (a === Math.PI / 2 ? d : 1) * (a === 0 || a === Math.PI ? 0.15 : 1) * 0; u.stance = k[1]; u.angle = 0;
      const ph = t * k[2] / 40; u.x = x0 + Math.cos(a) * ((t * k[2]) % 60) * 0 + Math.cos(a) * (Math.abs(((t * k[2] / 60) % 2) - 1) - 0.5) * 60; u.y = y0 + Math.sin(a) * (Math.abs(((t * k[2] / 60) % 2) - 1) - 0.5) * 60; }); }, 1000 / 60);
  })()`);
  for (let k = 0; k < 4; k++) { await b.sleep(k ? 230 : 1500); await b.shot('160-walk-' + k); }
};
