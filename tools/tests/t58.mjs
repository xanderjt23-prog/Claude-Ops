// all wall tiles inside the manor footprint: wallTop histogram, and tiles with walls shorter than the building
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html');
  console.log(await b.eval(`(() => { try { UI.go('game');
    const parts = [{ id: 'me', name: 'You', team: 0, loadout: DEFAULT_LOADOUT, skins: {} }, { id: 'x', name: 'x', team: 1, isBot: true, loadout: botLoadout(3), skins: {} }];
    const g = window._g = new Game({ mapId: 'mansion', seed: 1234, mode: 'deathmatch', participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game')); g.start();
    const m = g.map, bd = m.buildings[0], hist = {}, short = [], rows = [];
    for (let y = bd.y; y < bd.y + bd.h; y++) { let row = ''; for (let x = bd.x; x < bd.x + bd.w; x++) { const i = y * m.w + x, o = m.obj[i];
      if (o && MAT[o].wall) { hist[m.wallTop[i]] = (hist[m.wallTop[i]] || 0) + 1; if (m.wallTop[i] < 380) short.push(x - bd.x + ',' + (y - bd.y) + ':' + m.wallTop[i]); row += m.wallTop[i] >= 380 ? '#' : m.wallTop[i] > 0 ? 'h' : 'l'; }
      else row += m.lintel[i] ? '=' : o ? 'o' : (m.stairAt && m.stairAt.get(i) ? 's' : '.'); } rows.push(row); }
    return JSON.stringify({ hist, short: short.slice(0, 40), nShort: short.length }) + ' ROWS ' + rows.join('|'); } catch (e) { return e.stack; } })()`));
};
