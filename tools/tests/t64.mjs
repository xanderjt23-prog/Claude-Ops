// every item photo in the credits loads in the page
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html'); await b.sleep(1000);
  console.log(await b.eval(`new Promise(res => { const ids = Object.keys(IMAGE_CREDITS); let left = ids.length; const bad = [];
    ids.forEach(id => { const im = new Image(); im.onload = () => { if (!--left) res(JSON.stringify({ n: ids.length, bad })); }; im.onerror = () => { bad.push(id); if (!--left) res(JSON.stringify({ n: ids.length, bad })); }; im.src = Art.itemImage(id); }); })`));
};
