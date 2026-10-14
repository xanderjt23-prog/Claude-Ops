// every glass/lens mesh on every gun (with each optic fitted) must be a child of a solid housing mesh
export default async (b) => {
  await b.goto('file:///C:/Users/ajons/Claude-Ops/index.html');
  console.log(await b.eval(`(() => { try {
    const optics = [null, 'reddot', 'holo', 'acog', 'pso', 'sniper8', 'thermscope', 'rmr'], bad = [], seen = { lens: 0, guns: 0 };
    for (const it of Object.values(ITEMS)) { if (!['primary', 'sidearm'].includes(it.cat) || !GunReal.has(it.id)) continue; seen.guns++;
      for (const op of optics) { if (op && !attachFits(op, it.id)) continue;
        const m = GunModel.get(it, { atts: op ? [op] : [] });
        m.traverse(o => { if (!o.isMesh || !o.material || !o.material.transparent) return; seen.lens++; if (!o.parent || !o.parent.isMesh) bad.push(it.id + '/' + (op || 'none')); });
        m.traverse(o => { if (o.isMesh && o.material && o.material.transparent === true && o.material.depthWrite === false) bad.push('depth ' + it.id); });
        const solidSeeThrough = []; m.traverse(o => { if (o.isMesh && o.material && o.material.transparent && o.material.opacity > 0.95) solidSeeThrough.push(it.id); }); bad.push(...solidSeeThrough);
      } }
    return JSON.stringify({ seen, bad: bad.slice(0, 30), nBad: bad.length }); } catch (e) { return e.stack; } })()`));
};
