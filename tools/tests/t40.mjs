export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1500);
  await b.eval(`(() => { const p = Profile.get(); p.level = 1; p.coins = 999999; Profile.save(); })()`);
  await b.eval(`UI.go('sp')`); await b.sleep(400);
  await b.eval(`document.querySelector('[data-mod="ddmg"]').click()`); await b.sleep(200); await b.eval(`document.querySelector('[data-mod="vampire"]').click()`); await b.sleep(300);
  await b.shot('180-mods');
  await b.eval(`UI.go('shop')`); await b.sleep(300); await b.eval(`document.querySelector('#s-tabs [data-cat="primary"]').click()`); await b.sleep(800);
  console.log('level-1 buy of the highest-level gun:', await b.eval(`(() => { const top = Object.values(ITEMS).filter(i => i.cat === 'primary').sort((a, c) => c.level - a.level)[0]; const btn = document.querySelector('[data-buy="' + top.id + '"]'); const ok = btn && !btn.disabled; if (ok) btn.click(); return top.name + ' (level ' + top.level + ', ¢' + top.coins + '): button enabled=' + ok + ', owned now=' + !!Profile.get().owned[top.id]; })()`));
  await b.eval(`document.querySelector('#s-tabs [data-cat="attach"]').click()`); await b.sleep(800); await b.shot('181-shop-attach');
  console.log('disabled attachment buttons at level 1:', await b.eval(`[...document.querySelectorAll('#s-grid [data-buy]')].filter(x => x.disabled).length + ' of ' + document.querySelectorAll('#s-grid [data-buy]').length`));
};
