// 3D smoke test: day + night matches, screenshots, frame time
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  await b.shot('01-menu');
  const start = (map, mode, night, extra) => b.eval(`(() => {
    Profile.reset(); Profile.addCoins(500000); ${extra || ''}
    const P = Profile.get(); P.loadout.primary = 'm4';
    UI.go('sp'); document.querySelector('[data-size="3"]').click(); ${night ? `document.querySelector('[data-night]').click();` : ''}
    document.querySelector('[data-mode="${mode}"]').click(); document.querySelector('#sp-next').click(); document.querySelector('[data-map="${map}"]').click();
    document.querySelector('#sp-next').click(); document.querySelector('#sp-next').click(); return 'started'; })()`);
  console.log(await start('oldtown', 'snd', false)); await b.sleep(2500);
  console.log(await b.eval(`(() => { const g = UI.game; g.input.yaw = 0; g.input.pitch = -0.05; return JSON.stringify({ units: g.units.length, meshes: Object.keys(g.view.meshes).length, chunks: g.view.chunks.length }); })()`));
  await b.sleep(1500); await b.shot('02-day-oldtown');
  console.log('frame ms', await b.eval(`(() => { const g = UI.game; const t0 = performance.now(); for (let i = 0; i < 20; i++) g.render(0.016); return ((performance.now() - t0) / 20).toFixed(1); })()`));
  await b.eval(`(() => { const g = UI.game; const me = g.byId.me; g.input.yaw = Math.PI; })()`); await b.sleep(600); await b.shot('03-day-turn');
  // fire a burst
  await b.eval(`(() => { const g = UI.game; g.input.lmb = true; setTimeout(() => g.input.lmb = false, 600); })()`); await b.sleep(250); await b.shot('04-firing'); await b.sleep(800);
  console.log(await start('farm', 'zone', true, "['pvs14','pas13'].forEach(id => Profile.buy(id)); Profile.get().owned.pvs14 = true; Profile.get().loadout.gear = 'nogear';")); await b.sleep(3000);
  await b.eval(`UI.game.input.yaw = 0.3`); await b.sleep(500); await b.shot('05-night-light');
  await b.eval(`(() => { const me = UI.game.byId.me; me.gear = ITEMS.pvs14; me.gearOn = true; me.light = false; })()`); await b.sleep(600); await b.shot('06-night-nvg');
  await b.eval(`(() => { const me = UI.game.byId.me; me.gear = ITEMS.pas13; me.gearOn = true; })()`); await b.sleep(600); await b.shot('07-night-thermal');
  console.log('night frame ms', await b.eval(`(() => { const g = UI.game; const t0 = performance.now(); for (let i = 0; i < 20; i++) g.render(0.016); return ((performance.now() - t0) / 20).toFixed(1); })()`));
};
