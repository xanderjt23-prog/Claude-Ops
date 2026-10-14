// the generator panel: type a description, press the button, wait for the layouts, screenshot
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1200);
  await b.eval(`(() => { UI.go('sp'); document.querySelector('#sp-next').click(); })()`); await b.sleep(400);
  await b.eval(`document.querySelector('[data-genopen]').click()`); await b.sleep(800);
  await b.eval(`(() => { const t = document.querySelector('[data-gprompt]'); t.value = 'an abandoned hospital in a snowy forest with a lake'; t.dispatchEvent(new Event('input')); document.querySelector('[data-gdescribe]').click(); })()`);
  await b.sleep(400); await b.shot('380-gen-working'); await b.sleep(6000); await b.shot('380-gen-done');
  console.log(await b.eval(`document.querySelector('.gen-panel') ? document.querySelector('.gen-panel').innerText.slice(-400) : 'no panel'`));
};
