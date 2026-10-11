export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  await b.eval(`UI.go('sp')`); await b.sleep(400);
  await b.eval(`document.querySelector('[data-massive]').click()`); await b.sleep(200);
  await b.eval(`document.querySelector('[data-teams="2"]').click()`); await b.sleep(300);
  await b.eval(`(() => { const r = document.querySelector('[data-sizerange]'); r.value = 18; r.oninput(); r.onchange(); })()`); await b.sleep(300);
  await b.shot('95-massive-2teams');
  console.log(await b.eval(`document.querySelector('#sp-body .row:nth-of-type(2)') && [...document.querySelectorAll('#sp-body .row')].map(r => r.textContent.replace(/\s+/g, ' ').trim()).join(' / ')`));
  await b.eval(`document.querySelector('[data-teams="4"]').click()`); await b.sleep(300); await b.shot('96-massive-4teams');
};
