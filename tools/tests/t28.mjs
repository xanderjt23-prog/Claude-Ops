export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  await b.eval(`(() => { const p = Profile.get(); p.savedMaps = []; Profile.save(); window.prompt = () => 'Test Town'; window.confirm = () => true; })()`);
  await b.eval(`UI.go('sp')`); await b.sleep(300); await b.eval(`document.querySelector('#sp-next').click()`); await b.sleep(1500); await b.shot('111-maps-step');
  await b.eval(`document.querySelector('[data-genopen]').click()`); await b.sleep(800);
  await b.eval(`document.querySelector('[data-gtheme="town"]').click()`); await b.sleep(800);
  await b.eval(`document.querySelector('[data-gsize="large"]').click()`); await b.sleep(800); await b.shot('112-generator');
  await b.eval(`document.querySelector('[data-gensave]').click()`); await b.sleep(1200); await b.shot('113-saved');
  console.log(await b.eval(`JSON.stringify(Profile.get().savedMaps)`));
  await b.eval(`document.querySelector('#sp-next').click()`); await b.sleep(400); await b.eval(`document.querySelector('#sp-next').click()`); await b.sleep(5000);
  await b.shot('114-play-saved');
  console.log(await b.eval(`JSON.stringify({ map: UI.game.map.id, w: UI.game.map.w, theme: UI.game.map.genOpts && UI.game.map.genOpts.theme, units: UI.game.units.length })`));
  await b.eval(`UI.game.stop(); UI.go('sp')`); await b.sleep(300); await b.eval(`document.querySelector('#sp-next').click()`); await b.sleep(1000);
  await b.eval(`document.querySelector('[data-delmap]').click()`); await b.sleep(800);
  console.log('after delete', await b.eval(`JSON.stringify(Profile.get().savedMaps)`));
};
