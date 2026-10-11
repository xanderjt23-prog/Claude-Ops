export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  await b.eval(`UI.go('sp')`); await b.sleep(400);
  await b.eval(`(() => { const r = document.querySelector('[data-lives]'); r.value = 5; r.oninput(); r.onchange(); })()`); await b.sleep(300); await b.shot('150-dm-lives');
  await b.eval(`document.querySelector('[data-mode="score"]').click()`); await b.sleep(300); await b.shot('151-score');
  await b.eval(`UI.go('achievements')`); await b.sleep(500); await b.shot('152-achievements');
};
