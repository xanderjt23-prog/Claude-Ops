export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  await b.eval(`(() => { const p = Profile.get(); p.level = 30; p.coins = 200000; ['reddot','acog','supp556','vgrip','laser','extmag'].forEach(id => p.owned[id] = true); Profile.save(); })()`);
  await b.eval(`UI.go('sp')`); await b.sleep(400);
  await b.eval(`document.querySelector('[data-teams="3"]').click()`); await b.sleep(200);
  await b.eval(`document.querySelector('[data-size="4"]').click()`); await b.sleep(200); await b.shot('70-setup-3x4');
  await b.eval(`document.querySelector('[data-massive]').click()`); await b.sleep(200);
  await b.eval(`document.querySelector('[data-teams="6"]').click()`); await b.sleep(200); await b.shot('71-setup-massive');
  await b.eval(`document.querySelector('#sp-next').click()`); await b.sleep(1500); await b.shot('72-maps-massive');
  await b.eval(`UI.go('weapons')`); await b.sleep(300); await b.eval(`document.querySelector('[data-cat="attach"]').click()`); await b.sleep(400); await b.shot('73-weapons-attach');
  await b.eval(`UI.go('shop')`); await b.sleep(300); await b.eval(`document.querySelector('#s-tabs [data-cat="attach"]').click()`); await b.sleep(400); await b.shot('74-shop-attach');
  await b.eval(`UI.go('sp')`); await b.sleep(300); await b.eval(`document.querySelector('#sp-next').click()`); await b.sleep(300); await b.eval(`document.querySelector('#sp-next').click()`); await b.sleep(500);
  await b.eval(`document.querySelector('[data-setatt="optic:acog"]').click()`); await b.sleep(300);
  await b.eval(`document.querySelector('[data-setatt="muzzle:supp556"]').click()`); await b.sleep(300); await b.shot('75-loadout-att');
  console.log(JSON.stringify(await b.eval(`Profile.get().loadout.att`)));
  await b.eval(`document.querySelector('#sp-next').click()`); await b.sleep(4000); await b.shot('76-massive-game');
  console.log(await b.eval(`JSON.stringify({ n: UI.game.units.length, teams: UI.game.nTeams, map: UI.game.map.id, fps: UI.game.fps })`));
};
