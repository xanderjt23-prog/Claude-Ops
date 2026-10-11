export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  await b.eval(`UI.go('weapons')`); await b.sleep(300); await b.eval(`document.querySelector('[data-cat="attach"]').click()`); await b.sleep(1500); await b.shot('100-attach-photos');
  await b.eval(`document.querySelector('#w-grid').scrollTop = 600`); await b.sleep(800); await b.shot('101-attach-photos2');
  await b.eval(`document.querySelector('[data-cat="primary"]').click()`); await b.sleep(400); await b.eval(`document.querySelector('#w-grid').scrollTop = 99999`); await b.sleep(1500); await b.shot('102-primary-photos');
  await b.eval(`UI.go('shop')`); await b.sleep(300); await b.eval(`document.querySelector('#s-tabs [data-cat="utility"]').click()`); await b.sleep(1500); await b.shot('103-utility-photos');
  console.log(await b.eval(`[...document.images].filter(i => i.complete && !i.naturalWidth).map(i => i.src).join(' ')`));
};
