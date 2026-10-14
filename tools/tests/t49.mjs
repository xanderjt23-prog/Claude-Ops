export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  console.log(await b.eval(`(() => { const out = []; for (const id of ['hk417','galil','svt40','l96','ksg','ump45','cz75','fiveseven']) { try { const m = GunModel.get(ITEMS[id], {}); out.push(id + ':' + m.children.length + ' parts, ' + ballistics(ITEMS[id]).v / 32 + 'm/s'); } catch (e) { out.push(id + ' ERR ' + e.message); } } return out.join(' | '); })()`));
  console.log(await b.eval(`(() => { UI.go('game'); const lo = u => ({ primary: 'ksg', sidearm1: 'fiveseven', sidearm2: null, melee: 'kabar', armor: 'ghillie', gear: 'nogear', utils: u, ammo: {}, att: {} });
    const parts = [{ id: 'me', name: 'You', team: 0, loadout: lo(['rgo', 'flare', null]), skins: {} }, { id: 'x', name: 'x', team: 1, isBot: true, loadout: lo([null, null, null]), skins: {} }];
    const g = new Game({ mapId: 'farm', seed: 5, mode: 'deathmatch', night: true, participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game'));
    g.units.forEach(u => u.ai = null); const me = g.byId.me, x = g.byId.x; x.x = me.x + 300; x.y = me.y; x.z = g.groundAt(x.x, x.y); x.stance = 'prone'; x.moving = false;
    g.useUtil(me, 0, me.x + 200, me.y); let t = 0, boomAt = -1; while (t < 3) { g.update(1 / 30); t += 1 / 30; if (boomAt < 0 && !g.nades.some(n => n.item === 'rgo')) boomAt = t; }
    g.useUtil(me, 1, me.x + 150, me.y); for (let k = 0; k < 60; k++) g.update(1 / 30); g.updateConceal();
    g.stop(); return JSON.stringify({ rgoExplodedAfter: +boomAt.toFixed(2), flares: g.flares.length, ghillieProneConceal: x.conceal }); })()`));
};
