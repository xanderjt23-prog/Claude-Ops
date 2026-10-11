export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  console.log(await b.eval(`(() => { UI.go('game'); const parts = [];
    for (let i = 0; i < 10; i++) parts.push({ id: i ? 'b' + i : 'me', name: 'Bot' + i, team: i % 2, isBot: true, loadout: botLoadout(25), skins: {} });
    const g = new Game({ mapId: 'farm', seed: 99, mode: 'zone', night: false, participants: parts, localId: 'me', role: 'local' }, document.querySelector('#game'));
    window._g = g; const gl = g.view.renderer.getContext(), px = new Uint8Array(4);
    const time = (label, fn) => { const t0 = performance.now(); for (let i = 0; i < 5; i++) { fn(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); } return label + ' ' + ((performance.now() - t0) / 5).toFixed(0) + 'ms'; };
    const R = g.view.renderer, out = [];
    out.push(time('full', () => g.render(0.016)));
    out.push(time('scene only', () => { R.clear(); R.render(g.view.scene, g.view.camera); }));
    g.view.points.forEach(l => l.visible = false); g.view.spots.forEach(l => l.visible = false); g.view.eyeLight.visible = false;
    out.push(time('scene no extra lights', () => { R.clear(); R.render(g.view.scene, g.view.camera); }));
    R.setPixelRatio(0.5); g.view.resize();
    out.push(time('half res', () => { R.clear(); R.render(g.view.scene, g.view.camera); }));
    out.push('calls ' + R.info.render.calls + ' tris ' + R.info.render.triangles);
    return out.join(' | '); })()`));
};
