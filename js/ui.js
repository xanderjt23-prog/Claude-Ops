// ============================================================================
// UI: menus, single-player setup, loadout editor, armory, shop, locker,
// achievements, multiplayer lobby and match flow.
// ============================================================================
const UI = (() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => Math.round(n).toLocaleString('en-US');
  let P = Profile.load();
  let game = null;
  let current = 'menu';

  // ------------------------------------------------------------------ basics
  function toast(msg, kind) {
    const el = document.createElement('div'); el.className = 'toast ' + (kind || ''); el.textContent = msg;
    $('#toasts').appendChild(el); setTimeout(() => el.remove(), 4500);
    if (kind === 'level') Sfx.levelup();
  }
  Profile.onNotify((m, k) => { toast(m, k); refreshTop(); });

  function refreshTop() {
    P = Profile.get();
    if (document.activeElement !== $('#pname')) $('#pname').value = P.name;
    $('#plevel').textContent = P.level;
    const need = xpForLevel(P.level);
    $('#pxpfill').style.width = (P.xp / need * 100) + '%';
    $('#pxptext').textContent = `${fmt(P.xp)} / ${fmt(need)} XP`;
    $('#pbank').textContent = fmt(P.xpBank);
    $('#pcoins').textContent = fmt(P.coins);
  }
  $('#pname').addEventListener('change', e => { P.name = e.target.value.trim().slice(0, 16) || P.name; Profile.save(); refreshTop(); });

  function go(name) {
    Sfx.init();
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $('#screen-' + name).classList.add('active');
    current = name;
    document.body.classList.toggle('ingame', name === 'game');
    ({ weapons: renderWeapons, shop: renderShop, locker: renderLocker, achievements: renderAchievements, profile: renderProfile, sp: () => { sp.step = 0; renderSP(); }, menu: refreshTop }[name] || (() => {}))();
    refreshTop();
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-go]'); if (b) { Sfx.ui(); go(b.dataset.go); }
  });

  // ------------------------------------------------------------------ background
  (function bg() {
    const c = $('#bg'), g = c.getContext('2d');
    let mr = null, t = 0;
    setTimeout(() => { try { mr = new MapRenderer(makeMap('farm', 1337)); } catch (e) { console.error(e); } }, 50);
    function frame() {
      if (!document.body.classList.contains('ingame')) {
        if (c.width !== innerWidth || c.height !== innerHeight) { c.width = innerWidth; c.height = innerHeight; }
        g.fillStyle = '#0d110c'; g.fillRect(0, 0, c.width, c.height);
        if (mr) {
          t += 0.0007;
          const W = mr.ground.width, H = mr.ground.height, z = 1.25;
          const x = (W - c.width / z) * (0.5 + Math.sin(t) * 0.45), y = (H - c.height / z) * (0.5 + Math.cos(t * 0.8) * 0.45);
          g.drawImage(mr.ground, x, y, c.width / z, c.height / z, 0, 0, c.width, c.height);
          g.drawImage(mr.objs, x, y, c.width / z, c.height / z, 0, 0, c.width, c.height);
        }
        const v = g.createRadialGradient(c.width / 2, c.height / 2, c.height * 0.2, c.width / 2, c.height / 2, c.width * 0.75);
        v.addColorStop(0, 'rgba(0,0,0,0.1)'); v.addColorStop(1, 'rgba(0,0,0,0.75)'); g.fillStyle = v; g.fillRect(0, 0, c.width, c.height);
      }
      requestAnimationFrame(frame);
    }
    frame();
  })();

  // ------------------------------------------------------------------ credits (small button on the main menu opens a popup)
  function renderCredits(tab) {
    document.querySelectorAll('#credits-tabs [data-ctab]').forEach(b => b.classList.toggle('sel', b.dataset.ctab === tab));
    let list;
    if (tab === 'snd') {
      list = (window.SOUND_CREDITS || []).map(c => `<div><b>${esc(c.title)}</b> by ${esc(c.author)} — <a href="${esc(c.source)}" target="_blank" rel="noopener">${esc(c.site)}</a>, ${esc(c.license)} <small>(used for: ${esc(c.used.join(', '))})</small></div>`).join('')
        + '<div style="margin-top:6px">Clips were trimmed, filtered and normalised for the game. CC BY-SA recordings are shared under the same licence.</div>';
    } else {
      list = '<div class="sub">Weapon and equipment photos from Wikimedia Commons:</div>' + Object.entries(window.IMAGE_CREDITS || {}).map(([id, c]) =>
        `<div><b>${esc(ITEMS[id] ? ITEMS[id].name : id)}</b> — <a href="${esc(c.source)}" target="_blank" rel="noopener">${esc(c.title)}</a> by ${esc(c.author)}, ${esc(c.license)}</div>`).join('')
        + '<div style="margin-top:6px">All other graphics are drawn procedurally in-game.</div>';
    }
    $('#credits-list').innerHTML = list;
  }
  $('#credits-btn').onclick = () => { renderCredits('img'); $('#credits-modal').classList.remove('hidden'); };
  $('#credits-close').onclick = () => $('#credits-modal').classList.add('hidden');
  $('#credits-tabs').onclick = e => { const b = e.target.closest('[data-ctab]'); if (b) renderCredits(b.dataset.ctab); };
  $('#credits-modal').onclick = e => { if (e.target.id === 'credits-modal') $('#credits-modal').classList.add('hidden'); };

  // ------------------------------------------------------------------ item helpers
  const owned = id => !!P.owned[id];
  function imgTag(id, cls) { return `<img ${cls ? `class="${cls}"` : ''} src="${Art.itemImage(id)}" alt="${esc(ITEMS[id].name)}" loading="lazy">`; }
  function cardHTML(id, extra) {
    const it = ITEMS[id], own = owned(id);
    return `<div class="card ${own ? '' : 'locked'} ${extra && extra.sel ? 'sel' : ''}" data-id="${id}">
      <div class="imgwrap">${imgTag(id)}</div>
      ${own ? (extra && extra.equipped ? '<span class="eq">EQUIPPED</span>' : '') : `<span class="lock">🔒 Lv ${it.level}</span>`}
      <div class="nm">${esc(it.name)}</div>
      ${extra && extra.meta ? `<div class="meta">${extra.meta}</div>` : ''}
    </div>`;
  }
  function isEquipped(id) { const lo = P.loadout; return [lo.primary, lo.sidearm1, lo.sidearm2, lo.melee, lo.armor, lo.gear].includes(id) || lo.utils.includes(id) || [lo.primary, lo.sidearm1, lo.sidearm2].some(g => g && lo.att && lo.att[g] && Object.values(lo.att[g]).includes(id)); }
  function cartridgeURL(id, w, h) { const c = Tex.cv(w || 300, h || 120); const it = ITEMS[id]; Art.drawCartridge(c.getContext('2d'), it.cal, it.kind, c.width, c.height); return c.toDataURL(); }
  function statRow(label, value, frac, red) { return `<div class="stat"><span>${label}</span><div class="bar ${red ? 'red' : ''}"><i style="width:${Math.max(2, Math.min(100, frac * 100))}%"></i></div><b>${value}</b></div>`; }
  function statsHTML(it) {
    let h = '';
    if (it.cat === 'primary' || it.cat === 'sidearm') {
      const per = it.dmg * (it.pellets || 1);
      h += statRow('Damage', it.pellets ? `${it.pellets}×${it.dmg}` : it.dmg, per / 160);
      if (it.explosive) h += statRow('Blast radius', `${(it.blast / T).toFixed(1)} m`, it.blast / 130);
      h += statRow('Fire rate', `${it.rpm} rpm`, it.rpm / 1200);
      h += statRow('Damage / sec', fmt(per * it.rpm / 60), per * it.rpm / 60 / 1200);
      h += statRow('Magazine', it.mag, it.mag / 100);
      h += statRow('Reload time', `${it.reload}s`, it.reload / 10, true);
      h += statRow('Range', `${Math.round(it.range / T)} m`, it.range / 2200);
      h += statRow('Accuracy', `${Math.round((1 - it.spread / 16) * 100)}%`, 1 - it.spread / 16);
      h += statRow('Penetration', it.flame ? 'burns' : it.explosive ? 'explodes' : it.pen.toFixed(1), it.flame || it.explosive ? 1 : it.pen / 5);
      h += statRow('Weight', `${it.weight} kg`, it.weight / 40, true);
      if (!it.explosive && !it.flame) h += `<div class="stat"><span>Shots to kill</span><div></div><b>${Math.ceil(100 / per)}</b></div>`;
      h += `<p class="sub" style="margin-top:8px">Fire mode: ${it.burst ? it.burst + '-round burst' : it.auto ? 'Fully automatic' : 'Semi-auto / manual'}${it.scope ? ' · Scoped (hold RMB)' : ''}${it.spinup ? ' · Needs to spin up' : ''}. ${penText(it)}</p>`;
      if (it.cal) { const am = ammoForGun(it.id); h += `<p class="sub">Calibre: <b>${esc(CALIBERS[it.cal].name)}</b> · Default round: ${esc(CALIBERS[it.cal].def)}${am.length ? ` · Other rounds in the Shop: ${am.map(a => esc(a.name)).join(', ')}` : ''}</p>`; }
      const atts = attachmentsFor(it.id);
      h += `<p class="sub">Attachments that fit: ${atts.length ? atts.map(a => `<b>${esc(a.name)}</b>`).join(', ') : 'none (no accessory rail)'}</p>`;
    } else if (it.cat === 'attach') {
      h += attStatsHTML(it);
      const guns = Object.values(ITEMS).filter(g => (g.cat === 'primary' || g.cat === 'sidearm') && attachFits(it.id, g.id));
      h += `<p class="sub">Slot: <b>${esc(it.type)}</b> · XP unlock from level <b>${it.level}</b>, or buy it in the Shop at any level. A gun carries one attachment per slot; choose them in the loadout.</p>
        <h4 style="margin:10px 0 6px">Fits these guns (${guns.length})</h4><div class="att-guns">${guns.map(g => `<span class="${owned(g.id) ? 'own' : ''}">${esc(g.name)}</span>`).join('')}</div>`;
    } else if (it.cat === 'melee') {
      h += statRow('Damage', it.dmg, it.dmg / 110);
      h += statRow('Swings / sec', it.rate, it.rate / 2);
      h += statRow('Reach', `${(it.reach / T).toFixed(1)} m`, it.reach / 72);
      h += statRow('Weight', `${it.weight} kg`, it.weight / 40, true);
      if (it.breaker) h += `<p class="sub">Can smash through ${it.breaker >= 4 ? 'brick, wood and plywood walls' : 'wooden walls and fences'}.</p>`;
    } else if (it.cat === 'gear') {
      if (it.vision) {
        h += statRow('Night sight range', `${Math.round(it.range / T)} m`, it.range / 950);
        h += statRow('Weight', `${it.weight} kg`, it.weight / 5, true);
        h += `<p class="sub">${it.vision === 'ir' ? 'Thermal: warm bodies glow white through darkness, smoke and foliage, and through concealment at twice the distance. Works day and night.' : it.vision === 'fused' ? 'Fused: green night vision with thermal highlights on people.' : 'Image intensifier: turns night into a green, grainy day. Only works at night.'} Press N in a match to switch it on or off.</p>`;
      } else h += '<p class="sub">At night you only see what is lit: your weapon light (L), fires, flares, muzzle flashes and tracers.</p>';
    } else if (it.cat === 'armor') {
      h += statRow('Damage reduction', `${it.reduce}%`, it.reduce / 60);
      h += statRow('Blast reduction', `${it.blast}%`, it.blast / 80);
      h += statRow('Weight', `${it.weight} kg`, it.weight / 40, true);
      h += `<p class="sub">Every bullet hit is reduced by ${it.reduce}%. Heavier armour slows you down.</p>`;
    } else {
      if (it.dmg) h += statRow(it.kind === 'molotov' ? 'Fire damage' : 'Damage', it.kind === 'molotov' ? '24/s' : it.dmg, it.kind === 'molotov' ? 0.3 : it.dmg / 190);
      if (it.blast) h += statRow('Radius', `${(it.blast / T).toFixed(1)} m`, it.blast / 190);
      if (it.heal) h += statRow('Heals', `${it.heal} HP`, it.heal / 60);
      if (it.useTime) h += statRow('Use time', `${it.useTime}s`, it.useTime / 3, true);
      if (it.fuse && it.kind !== 'smoke') h += statRow('Fuse', `${it.fuse}s`, it.fuse / 4, true);
      h += statRow('Weight', `${it.weight} kg`, it.weight / 5, true);
      h += `<p class="sub">Each utility slot holds one item. Equip the same utility in several slots to carry more.</p>`;
    }
    const sp = speedFromWeight(it.weight) / speedFromWeight(0);
    if (it.weight) h += `<p class="sub">Carrying this costs about <b>${Math.max(0, Math.round((1 - sp) * 100))}%</b> movement speed.</p>`;
    return h;
  }
  // what an attachment changes, as +/- rows
  function attStatsHTML(a) {
    const pct = (m, lowerBetter) => { const d = Math.round((m - 1) * 100), good = lowerBetter ? d < 0 : d > 0; return `<b style="color:${good ? 'var(--good)' : '#ff7a6a'}">${d > 0 ? '+' : ''}${d}%</b>`; };
    const rows = [];
    if (a.adsFov) rows.push(['Zoom', `<b>${(75 / a.adsFov).toFixed(1)}×</b>`]);
    if (a.reticle) rows.push(['Reticle', `<b>${a.reticle === 'holo' ? 'Holographic ring' : 'Red dot'}</b>`]);
    if (a.adsSpread) rows.push(['Spread while aiming', pct(a.adsSpread, true)]);
    if (a.hipSpread) rows.push(['Hip-fire spread', pct(a.hipSpread, true)]);
    if (a.spreadMul) rows.push(['Spread', pct(a.spreadMul, true)]);
    if (a.recoilMul) rows.push(['Recoil', pct(a.recoilMul, true)]);
    if (a.adsSpeed) rows.push(['Aiming speed', pct(a.adsSpeed)]);
    if (a.dmgMul) rows.push(['Damage', pct(a.dmgMul)]);
    if (a.rangeMul) rows.push(['Range', pct(a.rangeMul)]);
    if (a.magMul) rows.push(['Magazine size', pct(a.magMul)]);
    if (a.reloadMul) rows.push(['Reload time', pct(a.reloadMul, true)]);
    if (a.bipod) rows.push(['Spread crouched / prone', pct(a.bipod, true)]);
    if (a.suppressed) rows.push(['Sound', '<b style="color:var(--good)">Suppressed: quiet, short range, no flash, not shown on enemy radar</b>']);
    if (a.noFlash) rows.push(['Muzzle flash', '<b style="color:var(--good)">Hidden</b>']);
    if (a.thermalSight) rows.push(['Thermal', '<b style="color:var(--good)">Warm bodies glow while aiming</b>']);
    if (a.laser) rows.push(['Beam', `<b>${a.laser === 'ir' ? 'Infrared (night vision only)' : 'Visible red'}</b>`]);
    rows.push(['Weight', `<b>${a.weight} kg</b>`]);
    return rows.map(([l, v]) => `<div class="stat"><span>${l}</span><div></div>${v}</div>`).join('');
  }
  function penText(it) {
    if (it.flame) return 'Sets people, plants and wooden structures on fire.';
    if (it.explosive) return 'Explosions destroy cover and buildings in the blast radius.';
    const p = it.pen;
    if (p >= 4) return 'Shoots through brick walls, wood, sandbags and vehicles.';
    if (p >= 3) return 'Shoots through wooden walls, mud brick, trees and vehicles.';
    if (p >= 2) return 'Shoots through wooden and plywood walls, fences and crates.';
    if (p >= 1) return 'Shoots through plants, fences, crates and plywood.';
    return 'Only shoots through plants and glass.';
  }

  // ------------------------------------------------------------------ WEAPONS screen
  let wCat = 'primary', wSel = 'm4';
  function renderWeapons() {
    $('#w-tabs').innerHTML = CATEGORIES.map(c => `<button class="${c.id === wCat ? 'sel' : ''}" data-cat="${c.id}">${c.name}</button>`).join('');
    const items = Object.values(ITEMS).filter(it => it.cat === wCat).sort((a, b) => a.level - b.level || a.coins - b.coins);
    if (!ITEMS[wSel] || ITEMS[wSel].cat !== wCat) wSel = items[0].id;
    $('#w-grid').innerHTML = items.map(it => cardHTML(it.id, { sel: it.id === wSel, equipped: isEquipped(it.id), meta: wCat === 'attach' ? `${esc(it.type)} · Lv ${it.level}` : wCat === 'armor' ? `-${it.reduce}% dmg · ${it.weight} kg` : wCat === 'gear' ? (it.vision ? `${Math.round(it.range / T)} m · ${it.weight} kg` : '') : it.dmg ? `${it.pellets ? it.pellets + '×' : ''}${it.dmg} dmg · ${it.weight} kg` : `${it.weight} kg` })).join('');
    renderDetail();
  }
  function renderDetail() {
    const it = ITEMS[wSel], own = owned(wSel);
    const inv = P.invested[wSel] || 0;
    let unlock;
    if (own) unlock = `<div class="owned-badge">✔ Unlocked${isEquipped(wSel) ? ' · Equipped' : ''}</div>`;
    else {
      const canLvl = P.level >= it.level;
      unlock = `<div class="costs"><span>XP to unlock: <b>${fmt(it.xp)}</b></span><span>Coins: <b>¢ ${fmt(it.coins)}</b></span><span>Unlock level: <b>${it.level}</b></span></div>
        <div class="bar"><i style="width:${inv / Math.max(1, it.xp) * 100}%"></i></div>
        <small class="sub">${fmt(inv)} / ${fmt(it.xp)} XP invested · You have ${fmt(P.xpBank)} unallocated XP (investing never lowers your level)</small>
        ${canLvl ? `<div class="btns"><button data-inv="100">Invest 100 XP</button><button data-inv="1000">Invest 1,000 XP</button><button class="primary" data-inv="max">Invest max</button><button data-go="shop">Buy in shop</button></div>`
          : `<p class="warn">Reach level ${it.level} to unlock with XP. (You can still buy it in the shop for ¢ ${fmt(it.coins)}.)</p>`}`;
      const rw = Object.entries(LEVEL_REWARDS).find(([, id]) => id === wSel);
      if (rw) unlock += `<p class="sub">Also awarded free at level ${rw[0]}.</p>`;
    }
    $('#w-detail').innerHTML = `<div class="bigimg">${imgTag(wSel)}</div>
      <h3>${esc(it.name)}</h3><div class="type">${esc(it.type)}</div><p class="desc">${esc(it.desc)}</p>
      ${statsHTML(it)}<div class="unlock">${unlock}</div>`;
  }
  $('#w-tabs').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (b) { wCat = b.dataset.cat; Sfx.ui(); renderWeapons(); } });
  $('#w-grid').addEventListener('click', e => { const c = e.target.closest('.card'); if (c) { wSel = c.dataset.id; Sfx.ui(); renderWeapons(); } });
  $('#w-detail').addEventListener('click', e => {
    const b = e.target.closest('[data-inv]'); if (!b) return;
    const it = ITEMS[wSel], need = it.xp - (P.invested[wSel] || 0);
    const amt = b.dataset.inv === 'max' ? need : +b.dataset.inv;
    if (P.xpBank <= 0) return toast('You have no unallocated XP. Earn XP by playing matches.', 'error');
    Profile.invest(wSel, amt); Sfx.ui(); refreshTop(); renderWeapons();
  });

  // ------------------------------------------------------------------ SHOP
  let sCat = 'primary';
  const SHOP_TABS = [['primary', 'Primary'], ['sidearm', 'Sidearms'], ['melee', 'Melee'], ['armor', 'Body Armour'], ['gear', 'Night Gear'], ['ammo', 'Ammunition'], ['attach', 'Attachments'], ['utility', 'Utilities'], ['camo', 'Weapon Camos'], ['uniform', 'Uniforms']];
  function ammoCardHTML(it) {
    const own = owned(it.id), lvlOk = P.level >= it.level;
    return `<div class="card ammo-card" data-ammo="${it.id}"><canvas width="300" height="120" data-cart="${it.id}"></canvas>${own ? '<span class="own">OWNED</span>' : lvlOk ? '' : `<span class="lock">Lv ${it.level}</span>`}
      <div class="nm">${esc(it.name)}</div><div class="cal">${esc(CALIBERS[it.cal].name)}</div><div class="meta">${esc(it.type)} · Level ${it.level}</div>
      ${own ? '<div class="price">Owned</div>' : `<div class="price"><span class="ico coin">¢</span>${fmt(it.coins)}</div><button class="primary" data-buy="${it.id}" ${P.coins < it.coins ? 'disabled' : ''}>Buy</button>`}</div>`;
  }
  function showAmmo(id) {
    const it = ITEMS[id], k = AMMO_KINDS[it.kind], guns = gunsForCaliber(it.cal);
    $('#ammo-body').innerHTML = `<canvas width="600" height="160" data-cart="${id}"></canvas>
      <h3 style="margin-top:10px">${esc(it.name)}</h3><p class="sub"><b style="color:var(--accent2)">${esc(CALIBERS[it.cal].name)}</b> · ${esc(k.label)} · buy at any level · ¢ ${fmt(it.coins)}</p>
      <p>${esc(it.desc)}</p>
      <h3>Fits these guns</h3><div class="gun-list">${guns.map(g => cardHTML(g.id, { meta: owned(g.id) ? 'You own this' : 'Not owned' })).join('')}</div>
      <p class="sub">Rounds only fit guns of the same calibre. Choose which round each gun fires in its loadout slot. Once bought, a round type is yours for good.</p>
      <div class="row">${owned(id) ? '<span class="owned-badge">✔ Owned</span>' : `<button class="primary" data-buy="${id}" ${P.coins < it.coins ? 'disabled' : ''}>Buy for ¢ ${fmt(it.coins)}</button>`}<button id="ammo-close" style="margin-left:auto">Close</button></div>`;
    $('#ammo-body').querySelectorAll('canvas[data-cart]').forEach(drawCart);
    $('#ammo-modal').classList.remove('hidden');
    $('#ammo-close').onclick = () => $('#ammo-modal').classList.add('hidden');
    const b = $('#ammo-body [data-buy]'); if (b) b.onclick = () => { if (Profile.buy(id)) { Sfx.buy(); refreshTop(); renderShop(); showAmmo(id); } };
  }
  function drawCart(cv) { const it = ITEMS[cv.dataset.cart]; Art.drawCartridge(cv.getContext('2d'), it.cal, it.kind, cv.width, cv.height); }
  $('#ammo-modal').onclick = e => { if (e.target.id === 'ammo-modal') $('#ammo-modal').classList.add('hidden'); };
  function renderShop() {
    $('#s-tabs').innerHTML = SHOP_TABS.map(([id, n]) => `<button class="${id === sCat ? 'sel' : ''}" data-cat="${id}">${n}</button>`).join('');
    let html = '';
    if (sCat === 'ammo') {
      // grouped by calibre; the default round of every calibre is free and not listed
      CALIBER_ORDER.forEach(cal => {
        const list = Object.values(ITEMS).filter(it => it.cat === 'ammo' && it.cal === cal).sort((a, b) => a.level - b.level);
        if (!list.length) return;
        html += `<h4 class="shop-cal-head">${esc(CALIBERS[cal].name)} <small>· default ${esc(CALIBERS[cal].def)} is free · fits ${gunsForCaliber(cal).map(g => esc(g.name)).join(', ')}</small></h4>` + list.map(ammoCardHTML).join('');
      });
      $('#s-grid').innerHTML = html;
      $('#s-grid').querySelectorAll('canvas[data-cart]').forEach(drawCart);
      return;
    }
    if (sCat === 'camo' || sCat === 'uniform') {
      const list = sCat === 'camo' ? CAMOS : UNIFORMS, store = sCat === 'camo' ? P.ownedCamos : P.ownedUniforms;
      html = list.map(c => `<div class="card"><canvas class="swatch" data-sw="${c.id}" width="200" height="100"></canvas><div class="nm">${esc(c.name)}</div>
        ${store[c.id] ? '<span class="own">OWNED</span><div class="price">Owned</div>' : `<div class="price"><span class="ico coin">¢</span>${fmt(c.price)}</div><button class="primary" data-buycamo="${c.id}" ${P.coins < c.price ? 'disabled' : ''}>Buy</button>`}</div>`).join('');
    } else {
      html = Object.values(ITEMS).filter(it => it.cat === sCat && !it.noImage).sort((a, b) => sCat === 'attach' ? a.level - b.level || a.coins - b.coins : a.coins - b.coins).map(it => { const lvOk = it.cat !== 'attach' || P.level >= it.level; return `<div class="card">
        <div class="imgwrap">${imgTag(it.id)}</div>${owned(it.id) ? '<span class="own">OWNED</span>' : lvOk ? '' : `<span class="lock">Lv ${it.level}</span>`}
        <div class="nm">${esc(it.name)}</div><div class="meta">${esc(it.type)} · ${it.weight} kg${it.cat === 'attach' ? ' · Lv ' + it.level : ''}</div>
        ${owned(it.id) ? '<div class="price">Owned</div>' : `<div class="price"><span class="ico coin">¢</span>${fmt(it.coins)}</div><button class="primary" data-buy="${it.id}" ${P.coins < it.coins ? 'disabled' : ''}>Buy</button>`}
        <button data-view="${it.id}">View stats</button></div>`; }).join('');
    }
    $('#s-grid').innerHTML = html;
    $('#s-grid').querySelectorAll('canvas[data-sw]').forEach(cv => {
      const list = sCat === 'camo' ? CAMOS : UNIFORMS, c = list.find(x => x.id === cv.dataset.sw), g = cv.getContext('2d');
      g.fillStyle = g.createPattern(Art.camoCanvas(c.colors, sCat === 'camo' ? c.pattern : 'uniform', 64, c.id.length * 31), 'repeat'); g.fillRect(0, 0, 200, 100);
    });
  }
  $('#s-tabs').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (b) { sCat = b.dataset.cat; Sfx.ui(); renderShop(); } });
  $('#s-grid').addEventListener('click', e => {
    const b = e.target.closest('[data-buy]'); if (b) { if (Profile.buy(b.dataset.buy)) { Sfx.buy(); renderShop(); refreshTop(); } return; }
    const c = e.target.closest('[data-buycamo]'); if (c) { if (Profile.buyCamo(c.dataset.buycamo, sCat === 'uniform')) { Sfx.buy(); renderShop(); refreshTop(); } return; }
    const v = e.target.closest('[data-view]'); if (v) { wSel = v.dataset.view; wCat = ITEMS[wSel].cat; go('weapons'); return; }
    const a = e.target.closest('[data-ammo]'); if (a) showAmmo(a.dataset.ammo);
  });

  // ------------------------------------------------------------------ LOCKER
  let lSel = 'm4', lAnim = null;
  function renderLocker() {
    const groups = [['primary', 'Primary'], ['sidearm', 'Sidearms'], ['melee', 'Melee'], ['armor', 'Body Armour']];
    if (lSel !== 'uniform' && lSel !== 'face' && (!ITEMS[lSel] || !owned(lSel))) lSel = P.loadout.primary;
    let h = `<h4>SOLDIER</h4><button class="${lSel === 'uniform' ? 'sel' : ''}" data-l="uniform">Uniform: ${esc((UNIFORMS.find(u => u.id === P.uniform) || UNIFORMS[0]).name)}</button><button class="${lSel === 'face' ? 'sel' : ''}" data-l="face">🎨 Face paint${P.face ? ' ★' : ''}</button>`;
    groups.forEach(([cat, n]) => {
      const its = Object.values(ITEMS).filter(it => it.cat === cat && owned(it.id) && !it.noImage);
      if (!its.length) return;
      h += `<h4>${n.toUpperCase()}</h4>` + its.map(it => `<button class="${it.id === lSel ? 'sel' : ''}" data-l="${it.id}">${esc(it.name)}${isEquipped(it.id) ? ' ★' : ''}</button>`).join('');
    });
    $('#l-list').innerHTML = h;
    const isFace = lSel === 'face';
    // weapons and armour show their real photo (as in the shop and weapons menu); the uniform is drawn
    const photo = !isFace && lSel !== 'uniform';
    $('#l-side').classList.toggle('hidden', isFace || photo); $('#l-face').classList.toggle('hidden', !isFace); $('#l-photo').classList.toggle('hidden', !photo);
    if (photo) { const im = $('#l-photo img'); im.src = Art.itemImage(lSel); im.alt = ITEMS[lSel].name; }
    if (isFace) { $('#l-name').textContent = 'Face paint'; renderFaceTools(); drawLockerPreview(); return; }
    const isU = lSel === 'uniform', list = isU ? UNIFORMS : CAMOS, store = isU ? P.ownedUniforms : P.ownedCamos;
    const cur = isU ? P.uniform : (P.skins[lSel] || (ITEMS[lSel].cat === 'armor' ? 'olive' : 'factory'));
    $('#l-camos').innerHTML = list.map(c => `<button class="camo ${store[c.id] ? '' : 'locked'} ${c.id === cur ? 'sel' : ''}" data-camo="${c.id}"><canvas width="140" height="60" data-sw="${c.id}"></canvas>${esc(c.name)}${store[c.id] ? '' : ` · ¢${fmt(c.price)}`}</button>`).join('');
    $('#l-camos').querySelectorAll('canvas').forEach(cv => { const c = list.find(x => x.id === cv.dataset.sw), g = cv.getContext('2d'); g.fillStyle = g.createPattern(Art.camoCanvas(c.colors, isU ? 'uniform' : c.pattern, 64, c.id.length * 31), 'repeat'); g.fillRect(0, 0, 140, 60); });
    $('#l-name').textContent = isU ? 'Uniform' : ITEMS[lSel].name;
    drawLockerPreview();
  }
  // ---- face paint: a 64 x 64 layer painted over the soldier's face (only you, never bots)
  const facePaint = { color: '#1d2a14', size: 2, erase: false, layer: null, strokes: [] };
  const FACE_COLORS = ['#111111', '#1d2a14', '#3f5a24', '#6b6b3a', '#5a3b22', '#c8b48a', '#f2f2f2', '#b3201e', '#1e4fb3', '#e0c020'];
  function faceLayer() {
    if (facePaint.layer) return facePaint.layer;
    const c = Tex.cv(64, 64); facePaint.layer = c;
    if (P.face) { const im = new Image(); im.onload = () => { c.getContext('2d').drawImage(im, 0, 0); redrawFace(); }; im.src = P.face; }
    return c;
  }
  function faceIsEmpty() { const d = faceLayer().getContext('2d').getImageData(0, 0, 64, 64).data; for (let i = 3; i < d.length; i += 4) if (d[i]) return false; return true; }
  function saveFace() { P.face = faceIsEmpty() ? null : faceLayer().toDataURL('image/png'); Profile.save(); Profile.recheck(); refreshTop(); if (lockerView) lockerView.faceChanged(); }
  function redrawFace() {
    const ed = $('#face-ed'), g = ed.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(Soldier3D.faceTexture(null).image, 0, 0, 320, 320); g.drawImage(faceLayer(), 0, 0, 320, 320);
    g.strokeStyle = 'rgba(255,255,255,0.08)'; for (let k = 40; k < 320; k += 40) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 320); g.moveTo(0, k); g.lineTo(320, k); g.stroke(); }
    if (lockerView) lockerView.faceChanged(true);
  }
  const FACE_PRESETS = {
    stripes: g => { g.fillStyle = '#1d2a14'; for (let k = -64; k < 64; k += 14) { g.beginPath(); g.moveTo(k, 64); g.lineTo(k + 8, 64); g.lineTo(k + 72, 0); g.lineTo(k + 64, 0); g.fill(); } g.fillStyle = '#3f5a24'; for (let k = -57; k < 64; k += 14) { g.beginPath(); g.moveTo(k, 64); g.lineTo(k + 4, 64); g.lineTo(k + 68, 0); g.lineTo(k + 64, 0); g.fill(); } },
    eyeblack: g => { g.fillStyle = '#111'; g.fillRect(12, 33, 14, 5); g.fillRect(38, 33, 14, 5); },
    warpaint: g => { g.fillStyle = '#b3201e'; for (const x of [10, 16, 44, 50]) g.fillRect(x, 34, 3, 14); g.fillStyle = '#111'; g.fillRect(4, 22, 56, 2); },
    skull: g => { g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#111'; g.beginPath(); g.ellipse(19, 29, 8, 7, 0, 0, 7); g.ellipse(45, 29, 8, 7, 0, 0, 7); g.fill(); g.fillRect(29, 38, 6, 6); for (let x = 20; x < 46; x += 5) g.fillRect(x, 50, 2, 8); g.fillRect(18, 49, 28, 2); },
    woodland: g => { const r = mulberry32(7); for (let k = 0; k < 40; k++) { g.fillStyle = ['#1d2a14', '#3f5a24', '#5a3b22', '#6b6b3a'][k % 4]; g.beginPath(); g.ellipse(r() * 64, r() * 64, 3 + r() * 6, 2 + r() * 4, r() * 3, 0, 7); g.fill(); } },
  };
  function renderFaceTools() {
    $('#l-camos').innerHTML = `<div class="face-tools"><h4>PAINT</h4><div class="swatches">${FACE_COLORS.map(c => `<button class="sw ${!facePaint.erase && facePaint.color === c ? 'sel' : ''}" data-fcol="${c}" style="background:${c}"></button>`).join('')}</div>
      <h4>BRUSH</h4><div class="opts">${[[1, 'Fine'], [2, 'Medium'], [4, 'Wide']].map(([s, n]) => `<button class="opt ${facePaint.size === s ? 'sel' : ''}" data-fsize="${s}">${n}</button>`).join('')}<button class="opt ${facePaint.erase ? 'sel' : ''}" data-ferase>Eraser</button></div>
      <h4>PRESETS</h4><div class="opts">${[['stripes', 'Camo stripes'], ['woodland', 'Woodland'], ['eyeblack', 'Eye black'], ['warpaint', 'War paint'], ['skull', 'Skull']].map(([k, n]) => `<button class="opt" data-fpre="${k}">${n}</button>`).join('')}</div>
      <h4>PICTURE</h4><div class="row" style="margin:4px 0"><button data-fupload>📷 Upload a picture…</button><input type="file" accept="image/*" data-ffile hidden></div>
      <p class="sub" style="font-size:12px;margin:0">The middle of the picture is fitted onto the face (you can paint over it afterwards).</p>
      <div class="row"><button data-fundo>↶ Undo</button><button data-fclear>Clear face</button></div>
      <p class="sub">Paint straight onto the face (left). Your soldier wears it in every match and other players see it online. Bots never wear face paint.</p></div>`;
    const T2 = $('#l-camos');
    T2.querySelectorAll('[data-fcol]').forEach(b => b.onclick = () => { facePaint.color = b.dataset.fcol; facePaint.erase = false; renderFaceTools(); });
    T2.querySelectorAll('[data-fsize]').forEach(b => b.onclick = () => { facePaint.size = +b.dataset.fsize; renderFaceTools(); });
    T2.querySelector('[data-ferase]').onclick = () => { facePaint.erase = !facePaint.erase; renderFaceTools(); };
    const snapshot = () => { const c = faceLayer(); facePaint.strokes.push(c.getContext('2d').getImageData(0, 0, 64, 64)); if (facePaint.strokes.length > 30) facePaint.strokes.shift(); };
    T2.querySelectorAll('[data-fpre]').forEach(b => b.onclick = () => { snapshot(); const g = faceLayer().getContext('2d'); g.globalCompositeOperation = 'source-over'; FACE_PRESETS[b.dataset.fpre](g); redrawFace(); saveFace(); Sfx.ui(); });
    T2.querySelector('[data-fclear]').onclick = () => { snapshot(); faceLayer().getContext('2d').clearRect(0, 0, 64, 64); redrawFace(); saveFace(); };
    const file = T2.querySelector('[data-ffile]');
    T2.querySelector('[data-fupload]').onclick = () => file.click();
    file.onchange = () => {
      const f = file.files && file.files[0]; if (!f) return;
      if (!/^image\//.test(f.type)) return toast('Please choose an image file.', 'error');
      const url = URL.createObjectURL(f), im = new Image();
      im.onload = () => {
        // crop the centre square and shrink it to the 64 x 64 face (the game only ever keeps this small copy)
        snapshot(); const g = faceLayer().getContext('2d'), s = Math.min(im.width, im.height);
        g.clearRect(0, 0, 64, 64); g.imageSmoothingQuality = 'high'; g.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, 64, 64);
        URL.revokeObjectURL(url); file.value = ''; redrawFace(); saveFace(); renderLockerList(); Sfx.ui(); toast('Picture added to your face paint');
      };
      im.onerror = () => { URL.revokeObjectURL(url); toast('That image could not be opened.', 'error'); };
      im.src = url;
    };
    T2.querySelector('[data-fundo]').onclick = () => { const s = facePaint.strokes.pop(); if (!s) return; faceLayer().getContext('2d').putImageData(s, 0, 0); redrawFace(); saveFace(); };
    const ed = $('#face-ed');
    if (!ed.dataset.bound) {
      ed.dataset.bound = 1; let down = false, last = null;
      const at = e => { const r = ed.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 64, (e.clientY - r.top) / r.height * 64]; };
      const dab = (x, y) => { const g = faceLayer().getContext('2d'); g.globalCompositeOperation = facePaint.erase ? 'destination-out' : 'source-over'; g.fillStyle = facePaint.color; g.beginPath(); g.arc(x, y, facePaint.size, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over'; };
      ed.onpointerdown = e => { down = true; snapshot(); last = at(e); dab(...last); redrawFace(); ed.setPointerCapture(e.pointerId); };
      ed.onpointermove = e => { if (!down) return; const p = at(e), n = Math.ceil(Math.hypot(p[0] - last[0], p[1] - last[1]) * 2); for (let k = 1; k <= n; k++) dab(last[0] + (p[0] - last[0]) * k / n, last[1] + (p[1] - last[1]) * k / n); last = p; redrawFace(); };
      ed.onpointerup = ed.onpointercancel = () => { if (!down) return; down = false; saveFace(); renderLockerList(); };
    }
    redrawFace();
  }
  function renderLockerList() { const b = $('#l-list [data-l="face"]'); if (b) b.textContent = '🎨 Face paint' + (P.face ? ' ★' : ''); }
  // ---- 3D preview of your soldier in the locker (uniform, armour, weapon and face paint)
  let lockerView = null;
  function makeLockerView() {
    const canvas = $('#l-3d'); let renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch (e) { return null; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(300, 300, false);
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 1, 1, 1000);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x404030, 0.95)); const sun = new THREE.DirectionalLight(0xffffff, 0.6); sun.position.set(1, 2, 1.5); scene.add(sun);
    const camoTex = (id, uni) => { const c = (uni ? UNIFORMS : CAMOS).find(x => x.id === id) || (uni ? UNIFORMS[0] : CAMOS[0]); const t = new THREE.CanvasTexture(Art.camoCanvas(c.colors, uni ? 'uniform' : c.pattern, 64, c.id.length * 31)); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
    let rig = null, a = 0.6, faceCanvas = Tex.cv(64, 64), faceTex = new THREE.CanvasTexture(faceCanvas), key = '';
    const v = {
      build() {
        const weapon = lSel !== 'uniform' && lSel !== 'face' && ITEMS[lSel] && ITEMS[lSel].cat !== 'armor' ? lSel : P.loadout.primary;
        const armor = lSel !== 'uniform' && lSel !== 'face' && ITEMS[lSel] && ITEMS[lSel].cat === 'armor' ? lSel : P.loadout.armor;
        const k = [P.uniform, weapon, armor, P.skins[weapon], P.skins[armor]].join('|'); if (k === key && rig) return; key = k;
        if (rig) scene.remove(rig);
        const L = o => new THREE.MeshLambertMaterial(o), arm = ITEMS[armor];
        rig = Soldier3D.build({ uniform: L({ map: camoTex(P.uniform, true) }), skin: L({ color: 0xc9a07a }), boots: L({ color: 0x2a241c }), dark: L({ color: 0x3d3b30 }), helmet: L({ color: 0x4a6322 }), band: L({ color: 0x43a047 }),
          vest: arm && arm.id !== 'noarmor' ? L({ map: camoTex(P.skins[armor] || 'olive') }) : null, vestSize: arm && arm.id === 'eod' ? 1.3 : 1, face: null, faceAlways: true });
        rig.userData.faceMat.map = faceTex; v.faceChanged(true);
        const it = ITEMS[weapon]; if (it) { const sk = P.skins[weapon]; const gm = GunModel.get(it, { merged: true, atts: Object.values((P.loadout.att || {})[weapon] || {}), camoId: sk, camo: sk && sk !== 'factory' ? L({ map: camoTex(sk) }) : null }); gm.scale.setScalar(1.15); rig.userData.gun.add(gm); }
        Soldier3D.pose(rig, { stance: 'stand', weapon: it, gunLen: it ? Math.max(10, Art.weaponLen(it)) * 0.525 * 1.15 : 0, pitch: -0.1 });
        scene.add(rig);
      },
      faceChanged() { const g = faceCanvas.getContext('2d'); g.clearRect(0, 0, 64, 64); g.drawImage(Soldier3D.faceTexture(null).image, 0, 0); if (lSel === 'face') g.drawImage(faceLayer(), 0, 0); else if (P.face) { const im = v._im || (v._im = new Image()); if (im.src !== P.face) { im.onload = () => v.faceChanged(); im.src = P.face; } else if (im.complete) g.drawImage(im, 0, 0); } faceTex.needsUpdate = true; },
      frame() {
        if (current !== 'locker') { v.running = false; return; }
        const face = lSel === 'face';
        a += face ? (Math.sin(performance.now() / 1400) * 0.004) : 0.008; const ang = face ? 0.35 + Math.sin(performance.now() / 1400) * 0.5 : a;
        const tgt = face ? new THREE.Vector3(0, 55, 0) : new THREE.Vector3(0, 32, 0), dist = face ? 38 : 150;
        cam.position.set(Math.cos(ang) * dist, tgt.y + (face ? 2 : 10), Math.sin(ang) * dist); cam.lookAt(tgt);
        renderer.render(scene, cam); requestAnimationFrame(v.frame);
      },
      start() { v.build(); v.faceChanged(); if (!v.running) { v.running = true; v.frame(); } },
    };
    return v;
  }
  function drawLockerPreview() {
    if (!lockerView) lockerView = makeLockerView();
    if (lockerView) lockerView.start();
    if (lSel === 'face') return;
    const side = $('#l-side'), sg = side.getContext('2d');
    sg.clearRect(0, 0, side.width, side.height);
    if (lSel === 'uniform') {
      const c = UNIFORMS.find(u => u.id === P.uniform) || UNIFORMS[0];
      sg.fillStyle = sg.createPattern(Art.camoCanvas(c.colors, 'uniform', 64, c.id.length * 31), 'repeat');
      sg.beginPath(); sg.moveTo(220, 30); sg.lineTo(420, 30); sg.lineTo(500, 90); sg.lineTo(470, 130); sg.lineTo(430, 100); sg.lineTo(420, 260); sg.lineTo(220, 260); sg.lineTo(210, 100); sg.lineTo(170, 130); sg.lineTo(140, 90); sg.closePath(); sg.fill();
      sg.strokeStyle = 'rgba(0,0,0,0.5)'; sg.lineWidth = 2; sg.stroke();
    }
  }
  $('#l-list').addEventListener('click', e => { const b = e.target.closest('[data-l]'); if (b) { lSel = b.dataset.l; Sfx.ui(); renderLocker(); } });
  $('#l-camos').addEventListener('click', e => {
    const b = e.target.closest('[data-camo]'); if (!b) return;
    const isU = lSel === 'uniform', store = isU ? P.ownedUniforms : P.ownedCamos, id = b.dataset.camo;
    if (!store[id]) { const c = (isU ? UNIFORMS : CAMOS).find(x => x.id === id); toast(`${c.name} costs ¢${fmt(c.price)}. Buy it in the Shop.`, 'error'); sCat = isU ? 'uniform' : 'camo'; return; }
    if (isU) P.uniform = id; else P.skins[lSel] = id;
    Profile.save(); Sfx.ui(); renderLocker();
  });

  // ------------------------------------------------------------------ PROFILE: career statistics
  function renderProfile() {
    const s = P.stats, games = s.games || 0, wins = s.wins || 0, pct = (a, b) => b ? Math.round(a / b * 1000) / 10 + '%' : '—';
    const kd = s.deaths ? (s.kills / s.deaths).toFixed(2) : s.kills ? s.kills.toFixed(2) : '—', kda = s.deaths ? ((s.kills + s.assists) / s.deaths).toFixed(2) : '—';
    const hrs = Math.floor((s.timePlayed || 0) / 3600), mins = Math.floor((s.timePlayed || 0) % 3600 / 60);
    const fav = Object.entries(P.weaponKills || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const done = ACHIEVEMENTS.filter(a => P.achievements[a.id]).length, owned = Profile.statValue('owned');
    const tile = (label, value, sub) => `<div class="pstat"><small>${label}</small><b>${value}</b>${sub ? `<span>${sub}</span>` : ''}</div>`;
    const modeName = id => (GAMEMODES.find(m => m.id === id) || { name: id }).name;
    $('#profile-body').innerHTML = `
      <div class="phead">${P.face ? `<img class="pface" src="${P.face}">` : '<div class="pface blank">🪖</div>'}<div><h2 style="margin:0">${esc(P.name)}</h2><p class="sub" style="margin:4px 0 0">Level <b>${P.level}</b> · ${fmt(P.totalXp || 0)} XP earned in total · ${done}/${ACHIEVEMENTS.length} achievements · ${owned} items owned</p></div></div>
      <h3>Combat</h3><div class="pgrid">
        ${tile('K/D ratio', kd, `${fmt(s.kills)} kills · ${fmt(s.deaths)} deaths`)}${tile('KDA', kda, `${fmt(s.assists)} assists`)}
        ${tile('Accuracy', pct(s.hits || 0, s.shots || 0), `${fmt(s.hits || 0)} hits / ${fmt(s.shots || 0)} shots`)}${tile('Headshot rate', pct(s.headshots || 0, s.kills || 0), `${fmt(s.headshots || 0)} headshot kills`)}
        ${tile('Damage dealt', fmt(s.damage || 0), `${fmt(s.taken || 0)} taken`)}${tile('Best streak', s.bestStreak || 0, `best multi-kill ×${s.bestMulti || 0}`)}
        ${tile('Long shots', s.longShots || 0, 'kills over 50 m')}${tile('Cover destroyed', fmt(s.destroyed || 0))}
      </div>
      <h3>Battles</h3><div class="pgrid">
        ${tile('Battles played', fmt(games), `${fmt(s.onlineGames || 0)} online · ${fmt(s.massiveGames || 0)} massive`)}${tile('Win rate', pct(wins, games), `${fmt(wins)} wins · ${fmt(s.losses || 0)} losses · ${fmt(s.draws || 0)} draws`)}
        ${tile('Flawless wins', s.flawless || 0, 'won without dying')}${tile('Time in battle', hrs ? `${hrs} h ${mins} m` : `${mins} m`)}
      </div>
      <div class="pgrid">${GAMEMODES.map(m => { const x = (P.modeStats || {})[m.id] || { games: 0, wins: 0 }; return tile(m.name, pct(x.wins, x.games), `${x.wins} / ${x.games} won`); }).join('')}</div>
      <h3>Economy</h3><div class="pgrid">
        ${tile('Coins spent', '¢ ' + fmt(s.spent || 0))}${tile('Coins earned', '¢ ' + fmt(s.coinsEarned || 0), 'from battles')}${tile('Coins now', '¢ ' + fmt(P.coins))}${tile('XP earned', fmt(s.xpEarned || 0), 'from battles')}
      </div>
      <div class="pcols"><div><h3>Favourite weapons</h3>${fav.length ? `<table class="sb">${fav.map(([id, n]) => `<tr><td>${esc(ITEMS[id] ? ITEMS[id].name : id)}</td><td>${n} kills</td></tr>`).join('')}</table>` : '<p class="sub">Get some kills to see your favourites.</p>'}</div>
      <div><h3>Recent battles</h3>${(P.history || []).length ? `<table class="sb"><tr><th>RESULT</th><th>MODE</th><th>MAP</th><th>K / D / A</th><th>WHEN</th></tr>${P.history.slice(0, 12).map(h => `<tr><td class="${h.result}">${h.result.toUpperCase()}</td><td>${esc(modeName(h.mode))}${h.ffa ? ' (FFA)' : ''}${h.online ? ' 🌐' : ''}</td><td>${esc(h.map)}</td><td>${h.k} / ${h.d} / ${h.a}</td><td>${new Date(h.t).toLocaleDateString()}</td></tr>`).join('')}</table>` : '<p class="sub">No battles yet.</p>'}</div></div>`;
  }

  // ------------------------------------------------------------------ ACHIEVEMENTS
  const MEDAL = { kills: '🎯', bestMulti: '💥', bestStreak: '🔥', assists: '🤝', wins: '🏆', ffaWins: '👑', zoneWins: '🚩', dmWins: '💀', destroyed: '🧱', explosiveKills: '💣',
    fireKills: '🔥', sniperKills: '🔭', meleeKills: '🔪', wallbangs: '🧱', headshots: '⌖', level: '⭐', owned: '🗄️', spent: '💰', onlineGames: '🌐', games: '🎖️',
    longShots: '📏', proneKills: '🐍', quietKills: '🤫', flawless: '🛡️', scoreWins: '📈', bestScore: '💯', multiteamWins: '🌍', massiveGames: '⚔️', massiveWins: '🏰',
    genGames: '🎲', savedMaps: '🗺️', mapsPlayed: '🧭', facePaint: '🎨', achievementsDone: '🏅' };
  function renderAchievements() {
    const done = ACHIEVEMENTS.filter(a => P.achievements[a.id]).length;
    $('#ach-count').textContent = `${done} / ${ACHIEVEMENTS.length} unlocked`;
    $('#ach-grid').innerHTML = ACHIEVEMENTS.map(a => {
      const v = Math.min(a.goal, Profile.statValue(a.stat)), d = !!P.achievements[a.id];
      return `<div class="ach ${d ? 'done' : ''}"><div class="medal">${MEDAL[a.stat] || '🎖️'}</div><div><b>${esc(a.name)}</b><small>${esc(a.desc)}</small>
        <div class="bar"><i style="width:${v / a.goal * 100}%"></i></div><div class="rw">${fmt(v)} / ${fmt(a.goal)} · Reward: ${a.xp ? fmt(a.xp) + ' XP, ' : ''}¢${fmt(a.coins)}</div></div></div>`;
    }).join('');
  }

  // ------------------------------------------------------------------ LOADOUT EDITOR
  // renders into container; lo = loadout object (mutated); onChange called after edits
  function loadoutEditor(container, lo, onChange) {
    let slot = 'primary';
    const SLOTS = [['primary', 'PRIMARY', 'primary'], ['sidearm1', 'SIDEARM 1', 'sidearm'], ['sidearm2', 'SIDEARM 2', 'sidearm'], ['melee', 'MELEE', 'melee'], ['armor', 'BODY ARMOUR', 'armor'], ['gear', 'NIGHT GEAR', 'gear'], ['u0', 'UTILITY 1', 'utility'], ['u1', 'UTILITY 2', 'utility'], ['u2', 'UTILITY 3', 'utility']];
    lo.ammo = lo.ammo || {}; lo.att = lo.att || {}; if (!lo.gear) lo.gear = 'nogear';
    const ammoName = gun => { const a = lo.ammo[gun] && ITEMS[lo.ammo[gun]]; return a && owned(a.id) && a.cal === ITEMS[gun].cal ? a.name : CALIBERS[ITEMS[gun].cal] ? CALIBERS[ITEMS[gun].cal].def : ''; };
    const get = s => s[0] === 'u' ? lo.utils[+s[1]] : lo[s];
    const set = (s, v) => { if (s[0] === 'u') lo.utils[+s[1]] = v; else lo[s] = v; };
    function draw() {
      const w = Profile.loadoutWeight(lo), sp = speedFromWeight(w);
      const cat = SLOTS.find(s => s[0] === slot)[2];
      const ownedItems = Object.values(ITEMS).filter(it => it.cat === cat && owned(it.id)).sort((a, b) => a.level - b.level);
      const allowEmpty = slot === 'sidearm2' || slot[0] === 'u';
      container.innerHTML = `<div class="loadout"><div><div class="slots">${SLOTS.map(([s, n]) => { const id = get(s);
          return `<button class="slot ${s === slot ? 'sel' : ''} ${id ? '' : 'empty'}" data-slot="${s}"><span class="lbl">${n}</span>${id ? imgTag(id) : `<img src="${Art.itemThumb('noarmor')}">`}<span>${id ? esc(ITEMS[id].name) : '— empty —'}</span>${id && ITEMS[id].cal ? `<small class="am">${esc(ammoName(id))}</small>` : ''}</button>`; }).join('')}</div>
          <div class="weight-info">Total weight: <b>${w.toFixed(1)} kg</b> · Movement speed: <b>${Math.round(sp * 100)}%</b>${sp < 0.6 ? ' <span class="warn">(very slow!)</span>' : ''}</div></div>
        <div class="picker">${(() => { const gun = get(slot); if (!gun || !ITEMS[gun].cal) return '';
            const opts = [{ id: '', name: CALIBERS[ITEMS[gun].cal].def + ' (default)', tip: '#b87333' }].concat(ammoForGun(gun).filter(a => owned(a.id)).map(a => ({ id: a.id, name: a.name, tip: AMMO_KINDS[a.kind].tip })));
            const sel = lo.ammo[gun] && owned(lo.ammo[gun]) ? lo.ammo[gun] : '';
            return `<h4>Ammunition for ${esc(ITEMS[gun].name)} (${esc(CALIBERS[ITEMS[gun].cal].name)})</h4><div class="ammo-pick">${opts.map(o => `<button data-setammo="${o.id}" class="${o.id === sel ? 'sel' : ''}"><i style="background:${o.tip}"></i>${esc(o.name)}</button>`).join('')}
              ${ammoForGun(gun).some(a => !owned(a.id)) ? '<span class="sub" style="font-size:12px;align-self:center">More rounds in Shop → Ammunition</span>' : ''}</div>`; })()}
          ${(() => { const gun = get(slot); if (!gun || !ITEMS[gun].cal) return ''; const all = attachmentsFor(gun); if (!all.length) return `<p class="sub">${esc(ITEMS[gun].name)} takes no attachments.</p>`;
            const cur = lo.att[gun] || {};
            return `<h4>Attachments for ${esc(ITEMS[gun].name)}</h4><div class="att-pick">${ATT_SLOTS.map(([sl, sn]) => { const fit = all.filter(a => a.slot === sl); if (!fit.length) return '';
              return `<div class="att-row"><span class="lbl">${sn}</span><button data-setatt="${sl}:" class="${!cur[sl] ? 'sel' : ''}">None</button>${fit.map(a => `<button data-setatt="${sl}:${a.id}" class="${cur[sl] === a.id ? 'sel' : ''} ${owned(a.id) ? '' : 'locked'}" title="${esc(a.desc)}">${esc(a.name)}${owned(a.id) ? '' : ' 🔒'}</button>`).join('')}</div>`; }).join('')}</div>`; })()}
          <h4>Choose ${SLOTS.find(s => s[0] === slot)[1].toLowerCase()} — owned items</h4>
          ${allowEmpty ? `<div class="card ${!get(slot) ? 'sel' : ''}" data-pick=""><div class="imgwrap" style="opacity:.3"></div><div class="nm">Empty</div></div>` : ''}
          ${ownedItems.map(it => cardHTML(it.id, { sel: get(slot) === it.id, meta: it.cat === 'armor' ? `-${it.reduce}% · ${it.weight} kg` : it.cat === 'gear' ? (it.vision ? `${it.type} · ${it.weight} kg` : 'Weapon light only') : `${it.dmg ? (it.pellets ? it.pellets + '×' : '') + it.dmg + ' dmg · ' : it.heal ? '+' + it.heal + ' HP · ' : ''}${it.weight} kg` }).replace('class="card', `data-pick="${it.id}" class="card`)).join('')}
          <p class="sub" style="grid-column:1/-1">Unlock more gear in Weapons (XP) or the Shop (coins).</p></div></div>`;
    }
    container.onclick = e => {
      const s = e.target.closest('[data-slot]'); if (s) { slot = s.dataset.slot; Sfx.ui(); draw(); return; }
      const at = e.target.closest('[data-setatt]');
      if (at) { const gun = get(slot), [sl, id] = at.dataset.setatt.split(':');
        if (id && !owned(id)) { const a = ITEMS[id]; toast(`${a.name}: unlock it in Weapons → Attachments (${fmt(a.xp)} XP, level ${a.level}) or buy it in the Shop (any level) for ¢${fmt(a.coins)}.`, 'error'); return; }
        const cur = Object.assign({}, lo.att[gun] || {}); if (id) cur[sl] = id; else delete cur[sl];
        if (Object.keys(cur).length) lo.att[gun] = cur; else delete lo.att[gun];
        Sfx.ui(); draw(); onChange && onChange(lo); return; }
      const am = e.target.closest('[data-setammo]'); if (am) { const gun = get(slot); if (am.dataset.setammo) lo.ammo[gun] = am.dataset.setammo; else delete lo.ammo[gun]; draw(); onChange && onChange(lo); return; }
      const p = e.target.closest('[data-pick]'); if (!p) return;
      const id = p.dataset.pick || null;
      if (slot === 'sidearm1' || slot === 'sidearm2') { const other = slot === 'sidearm1' ? 'sidearm2' : 'sidearm1'; if (id && lo[other] === id) lo[other] = slot === 'sidearm1' ? lo.sidearm1 : null; if (slot === 'sidearm1' && !id) return; }
      set(slot, id); Sfx.ui(); draw(); onChange && onChange(lo);
    };
    draw();
  }

  // ------------------------------------------------------------------ SINGLE PLAYER
  const sp = { step: 0, format: 'team', teams: 2, size: 2, ffaCount: 8, ff: false, mode: 'deathmatch', lives: 1, minutes: 5, map: 'oldtown', night: false, massive: false, mods: [] };
  const previewCache = {};
  // built-in maps plus the player's custom maps (host's maps in a lobby)
  function allMaps(st) { return MAPS.filter(m => !!m.massive === !!(st && st.massive)); }
  const limitOf = st => st.massive ? MAX_MASSIVE : MAX_PLAYERS;
  // keep team count x team size within the player limit
  function fixSettings(st) {
    const lim = limitOf(st);
    st.teams = Math.max(2, Math.min(6, st.teams || 2));
    st.size = Math.max(1, Math.min(st.size || 1, Math.floor(lim / st.teams)));
    st.ffaCount = Math.max(2, Math.min(st.ffaCount || 8, lim));
  }
  function mapSeed(id) { const i = MAPS.findIndex(m => m.id === id); return i >= 0 ? 1000 + i : 4242; }
  // ---- generated maps: the current draft from the generator and the player's saved maps
  let genDraft = null; // { theme, size, seed }
  const savedMaps = () => P.savedMaps || (P.savedMaps = []);
  const isMassiveSize = s => s === 'massive';
  // what to build for a map id: a built-in map, the generator draft ('gen') or a saved map ('sm_...')
  function mapSpec(id, saved) {
    if (id === 'gen' && genDraft) return { mapId: 'gen', seed: genDraft.seed, custom: { gen: true, theme: genDraft.theme, size: genDraft.size, prompt: genDraft.prompt }, name: genDraft.prompt ? descMapName(genDraft.prompt, genDraft.seed) : genMapName(genDraft.theme, genDraft.seed), size: MAPGEN_SIZES[genDraft.size].name };
    const sm = (saved || savedMaps()).find(s => s.id === id);
    if (sm) return { mapId: 'gen', seed: sm.seed, custom: { gen: true, theme: sm.theme, size: sm.size, prompt: sm.prompt }, name: sm.name, size: MAPGEN_SIZES[sm.size].name, saved: true };
    const mp = MAPS.find(m => m.id === id);
    return mp ? { mapId: id, seed: mapSeed(id), custom: null, name: mp.name, size: mp.size } : null;
  }
  // map ids that can be picked for these settings (normal vs massive)
  function validMap(id, st, saved) {
    if (id === 'gen') return !!genDraft && isMassiveSize(genDraft.size) === !!st.massive;
    const sm = (saved || savedMaps()).find(s => s.id === id); if (sm) return isMassiveSize(sm.size) === !!st.massive;
    return allMaps(st).some(m => m.id === id);
  }
  function mapPreview(id, canvas, saved) {
    const s = mapSpec(id, saved); if (!s) return;
    const key = s.mapId + ':' + s.seed + ':' + (s.custom ? s.custom.theme + s.custom.size + (s.custom.prompt || '') : '');
    if (!previewCache[key]) { const c = Tex.cv(224, 168); MapRenderer.preview(makeMap(s.mapId, s.seed, s.custom), c); previewCache[key] = c; }
    canvas.getContext('2d').drawImage(previewCache[key], 0, 0, canvas.width, canvas.height);
  }
  function savedCardsHTML(st, selId, attr, withDelete) {
    const list = savedMaps().filter(s => isMassiveSize(s.size) === !!st.massive);
    if (!list.length) return '';
    return `<h3>My saved maps</h3><div class="map-grid">${list.map(s => `<div class="map-card ${selId === s.id ? 'sel' : ''}" ${attr}="${s.id}" role="button"><canvas width="224" height="168"></canvas><span class="size">${esc(MAPGEN_SIZES[s.size].name)} · ${esc(MAPGEN_THEMES[s.theme].name)}</span><b>${esc(s.name)}</b><span>Generated map</span>${withDelete ? `<button class="del-map" data-delmap="${s.id}" title="Delete this map">🗑 Delete</button>` : ''}</div>`).join('')}</div>`;
  }
  function deleteSavedMap(id, after) {
    const s = savedMaps().find(x => x.id === id); if (!s) return;
    if (!confirm(`Delete the saved map "${s.name}"? This cannot be undone.`)) return;
    P.savedMaps = savedMaps().filter(x => x.id !== id); Profile.save(); toast(`Deleted ${s.name}`); after && after();
  }
  // the generator panel: choose a theme and size, roll maps until you like one, then play or save it
  const gen = { theme: 'random', size: 'medium' };
  function renderGenerator(body, st, done) {
    const sizes = st.massive ? ['massive'] : ['medium', 'large', 'xl'];
    if (!sizes.includes(gen.size)) gen.size = sizes[0];
    const roll = () => { const keys = Object.keys(MAPGEN_THEMES).filter(k => !MAPGEN_THEMES[k].hidden); genDraft = { theme: gen.theme === 'random' ? keys[Math.floor(Math.random() * keys.length)] : gen.theme, size: gen.size, seed: Math.floor(Math.random() * 1e9) }; };
    if (!genDraft || genDraft.size !== gen.size && !sizes.includes(genDraft.size)) roll();
    const s = mapSpec('gen'), th = MAPGEN_THEMES[genDraft.theme];
    body.innerHTML = `<h2>🎲 Map Generator</h2><div class="gen-panel"><div>
        <h3>Theme</h3><div class="opts">${['random', ...Object.keys(MAPGEN_THEMES).filter(k => !MAPGEN_THEMES[k].hidden)].map(k => `<button class="opt ${gen.theme === k ? 'sel' : ''}" data-gtheme="${k}">${k === 'random' ? '🎲 Random' : esc(MAPGEN_THEMES[k].name)}</button>`).join('')}</div>
        <h3>Size</h3><div class="opts">${sizes.map(k => `<button class="opt ${gen.size === k ? 'sel' : ''}" data-gsize="${k}">${MAPGEN_SIZES[k].name} <small>${MAPGEN_SIZES[k].wh.join('×')}</small></button>`).join('')}</div>
        <div class="row"><button class="primary" data-generate>🎲 Generate a new map</button></div>
        <h3>…or describe the map you want</h3>
        <textarea data-gprompt rows="3" maxlength="300" placeholder="e.g. a casino in the desert with a big car park · an abandoned hospital in a snowy forest · a museum by a river · two warehouses at the docks" style="width:100%;box-sizing:border-box;font:inherit;padding:6px;border-radius:6px">${esc(gen.prompt || '')}</textarea>
        <div class="row"><button class="primary" data-gdescribe>✨ Generate from description</button><span class="sub" data-gstatus></span></div>
        <p class="sub">Every map is generated from a random seed, so each one is different. Save the ones you like: they appear with the other maps (and in your online lobbies) until you delete them.</p></div>
      <div><canvas id="gen-prev" width="448" height="336"></canvas>
        <div class="row" style="margin:6px 0"><b style="font-size:18px">${esc(s.name)}</b><span class="sub">${esc(th.name)} · ${esc(s.size)} · seed ${genDraft.seed}</span></div>
        <p class="sub" style="margin:0 0 6px">${esc(genDraft.theme === 'novel' ? novelSpec(genDraft.seed).desc : genDraft.prompt ? '“' + genDraft.prompt + '” — ' + descSummary(parseMapDesc(genDraft.prompt)) : th.desc)}</p>
        <div class="row"><button class="primary" data-genplay>▶ Play this map</button><button data-gensave>💾 Save map</button><button data-genback>← All maps</button></div></div></div>`;
    const c = body.querySelector('#gen-prev'); MapRenderer.preview(makeMap(s.mapId, s.seed, s.custom), c);
    body.querySelectorAll('[data-gtheme]').forEach(b => b.onclick = () => { gen.theme = b.dataset.gtheme; roll(); Sfx.ui(); renderGenerator(body, st, done); });
    body.querySelectorAll('[data-gsize]').forEach(b => b.onclick = () => { gen.size = b.dataset.gsize; roll(); Sfx.ui(); renderGenerator(body, st, done); });
    body.querySelector('[data-generate]').onclick = () => { roll(); Sfx.ui(); renderGenerator(body, st, done); };
    // from a description: build several candidate layouts and keep the one that plays best (a moment per candidate)
    body.querySelector('[data-gprompt]').oninput = e => { gen.prompt = e.target.value; };
    body.querySelector('[data-gdescribe]').onclick = () => {
      const prompt = (gen.prompt || '').trim(); if (!prompt) { toast('Describe the map first'); return; }
      Sfx.ui(); const status = body.querySelector('[data-gstatus]'), btn = body.querySelector('[data-gdescribe]'); btn.disabled = true;
      const N = 8, base = Math.floor(Math.random() * 1e9); let best = null, bs = -1, k = 0;
      const step = () => {
        const seed = (base + k * 7919) % 1e9;
        try { const mm = makeMap('gen', seed, { gen: true, theme: 'described', size: gen.size, prompt }); const sc = scoreMap(mm); if (sc > bs) { bs = sc; best = seed; } } catch (e) { console.error(e); }
        k++; status.textContent = `Building layout ${k} of ${N}…`;
        if (k < N) setTimeout(step, 0); else { genDraft = { theme: 'described', size: gen.size, seed: best, prompt }; renderGenerator(body, st, done); }
      };
      status.textContent = 'Reading your description…'; setTimeout(step, 30);
    };
    body.querySelector('[data-genplay]').onclick = () => { Sfx.ui(); done('gen'); };
    body.querySelector('[data-gensave]').onclick = () => {
      const name = (prompt('Name your map:', s.name) || '').trim().slice(0, 28); if (!name) return;
      const id = 'sm_' + Date.now().toString(36);
      savedMaps().push({ id, name, theme: genDraft.theme, size: genDraft.size, seed: genDraft.seed, prompt: genDraft.prompt }); Profile.save();
      toast(`Saved "${name}" to your maps`); Profile.recheck(); refreshTop(); done(id);
    };
    body.querySelector('[data-genback]').onclick = () => { Sfx.ui(); done(null); };
  }
  function matchSettingsHTML(st, editable) {
    fixSettings(st);
    const dis = editable ? '' : 'disabled', lim = limitOf(st), tog = on => editable ? '' : 'style="pointer-events:none;opacity:.6"';
    return `<h3>Match type</h3><div class="opts"><button class="opt ${st.format === 'team' ? 'sel' : ''}" data-format="team" ${dis}>Team Battle</button><button class="opt ${st.format === 'ffa' ? 'sel' : ''}" data-ffa="1" ${dis}>Free For All</button>
        <span class="toggle ${st.massive ? 'on' : ''}" data-massive ${tog()} style="margin-left:10px"><i></i> ⚔ Massive battle</span></div>
      <p class="sub" style="font-size:13px;margin:4px 0 8px">${st.massive ? `Massive battle: up to ${MAX_MASSIVE} participants on huge maps.` : `Up to ${MAX_PLAYERS} participants. Turn on Massive battle for up to ${MAX_MASSIVE} on huge maps.`}</p>
      ${st.format === 'ffa' ? `<div class="row">Participants: <input type="range" min="2" max="${lim}" value="${st.ffaCount}" data-ffacount ${dis}> <b>${st.ffaCount}</b> <span class="sub">(you included)</span></div>` :
        `<div class="row">Teams: ${[2, 3, 4, 5, 6].map(n => `<button class="opt ${st.teams === n ? 'sel' : ''}" data-teams="${n}" ${dis}>${n}</button>`).join('')}</div>
        <div class="row">Players per team: ${Math.floor(lim / st.teams) > 8
            // many choices (massive battles): a slider instead of a long row of buttons
            ? `<input type="range" min="1" max="${Math.floor(lim / st.teams)}" value="${st.size}" data-sizerange ${dis}> <b>${st.size}</b>`
            : Array.from({ length: Math.floor(lim / st.teams) }, (_, k) => k + 1).map(n => `<button class="opt ${st.size === n ? 'sel' : ''}" data-size="${n}" ${dis}>${n}</button>`).join('')}
          <span class="sub">= ${st.teams} × <span data-sizeval>${st.size}</span> = <b data-sizetot>${st.teams * st.size}</b> / ${lim} players</span></div>
        <div class="row"><span class="toggle ${st.ff ? 'on' : ''}" data-ff ${tog()}><i></i> Friendly fire</span></div>`}
      <div class="row"><span class="toggle ${st.night ? 'on' : ''}" data-night ${tog()}><i></i> 🌙 Night mode</span><span class="sub" style="font-size:13px">Darkness: you see only what is lit, or use night vision / thermal gear.</span></div>
      <h3>Modifiers <small class="sub" style="text-transform:none;letter-spacing:0">optional · pick any number</small></h3>
      <div class="mods">${MODIFIERS.map(m => `<button class="mod ${(st.mods || []).includes(m.id) ? 'sel' : ''}" data-mod="${m.id}" title="${esc(m.desc)}" ${dis}><span>${m.icon}</span><b>${esc(m.name)}</b><small>${esc(m.desc)}</small></button>`).join('')}</div>`;
  }
  const modsText = st => (st.mods || []).map(id => MODIFIERS.find(m => m.id === id)).filter(Boolean).map(m => m.icon + ' ' + m.name).join(', ');
  function modeHTML(st, editable, votes) {
    const ffa = st.format === 'ffa';
    return `<h3>Game mode</h3><div class="mode-cards">${GAMEMODES.map(m => `<button class="mode-card ${st.mode === m.id ? 'sel' : ''}" data-mode="${m.id}" ${editable && !(m.teamsOnly && ffa) ? '' : 'disabled'}><b>${m.name}${votes ? ` <small class="votes" style="position:static">${votes[m.id] || 0}</small>` : ''}</b><span>${m.desc}</span></button>`).join('')}</div>
      ${modeOptionsHTML(st, st.mode, editable)}`;
  }
  // per-mode settings: lives for deathmatch, match length for battle royale
  function modeOptionsHTML(st, mode, editable) {
    const dis = editable ? '' : 'disabled';
    if (mode === 'deathmatch') return `<div class="row">Lives each: <input type="range" min="1" max="16" value="${st.lives || 1}" data-lives ${dis}> <b>${st.lives || 1}</b> <span class="sub">${(st.lives || 1) === 1 ? 'one life: classic last-man-standing' : 'respawn until your lives run out'}</span></div>`;
    if (mode === 'score') return `<div class="row">Match length: <input type="range" min="2" max="15" value="${st.minutes || 5}" data-minutes ${dis}> <b>${st.minutes || 5} min</b> <span class="sub">kills +100 · assists +50 · deaths −50</span></div>`;
    return '';
  }
  function bindMatchSettings(root, st, rerender) {
    root.querySelectorAll('[data-size]').forEach(b => b.onclick = () => { st.format = 'team'; st.size = +b.dataset.size; rerender(); });
    root.querySelectorAll('[data-sizerange]').forEach(r => { r.oninput = () => { st.size = +r.value; r.nextElementSibling.textContent = r.value; root.querySelector('[data-sizeval]').textContent = r.value; root.querySelector('[data-sizetot]').textContent = st.teams * st.size; }; r.onchange = () => { st.format = 'team'; rerender(); }; });
    root.querySelectorAll('[data-format]').forEach(b => b.onclick = () => { st.format = 'team'; rerender(); });
    root.querySelectorAll('[data-teams]').forEach(b => b.onclick = () => { st.format = 'team'; st.teams = +b.dataset.teams; fixSettings(st); rerender(); });
    root.querySelectorAll('[data-massive]').forEach(t => t.onclick = () => { st.massive = !st.massive; if (st.massive) { st.size = Math.max(st.size, Math.min(6, Math.floor(MAX_MASSIVE / st.teams))); st.ffaCount = Math.max(st.ffaCount, 24); } fixSettings(st); rerender(); });
    root.querySelectorAll('[data-ffa]').forEach(b => b.onclick = () => { st.format = 'ffa'; if (GAMEMODES.find(m => m.id === st.mode && m.teamsOnly)) st.mode = 'deathmatch'; rerender(); });
    root.querySelectorAll('[data-ffacount]').forEach(r => { r.oninput = () => { st.ffaCount = +r.value; r.nextElementSibling.textContent = r.value; }; r.onchange = rerender; });
    root.querySelectorAll('[data-ff]').forEach(t => t.onclick = () => { st.ff = !st.ff; rerender(); });
    root.querySelectorAll('[data-night]').forEach(t => t.onclick = () => { st.night = !st.night; rerender(); });
    root.querySelectorAll('[data-mod]').forEach(b => b.onclick = () => { const id = b.dataset.mod, l = st.mods = (st.mods || []).slice(); const k = l.indexOf(id); if (k >= 0) l.splice(k, 1); else l.push(id); Sfx.ui(); rerender(); });
    bindModeOptions(root, st, rerender);
  }
  function bindModeOptions(root, st, done) {
    root.querySelectorAll('[data-lives]').forEach(r => { r.oninput = () => { st.lives = +r.value; r.nextElementSibling.textContent = r.value; }; r.onchange = done; });
    root.querySelectorAll('[data-minutes]').forEach(r => { r.oninput = () => { st.minutes = +r.value; r.nextElementSibling.textContent = r.value + ' min'; }; r.onchange = done; });
  }
  function renderSP() {
    const steps = ['Match', 'Map', 'Loadout'];
    $('#sp-steps').innerHTML = steps.map((s, i) => `<div class="${i === sp.step ? 'on' : i < sp.step ? 'done' : ''}">${i + 1}. ${s.toUpperCase()}</div>`).join('');
    const body = $('#sp-body');
    if (sp.step === 0) {
      body.innerHTML = `<h2>Single Player</h2>${matchSettingsHTML(sp, true)}${modeHTML(sp, true)}
        <p class="sub" style="margin-top:12px">AI bots are given gear of similar quality to your loadout (your gear tier: ${Profile.loadoutTier(P.loadout)}).</p>`;
      bindMatchSettings(body, sp, renderSP);
      body.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { sp.mode = b.dataset.mode; renderSP(); });
    } else if (sp.step === 1) {
      if (sp.genOpen) return renderGenerator(body, sp, id => { sp.genOpen = false; if (id) sp.map = id; renderSP(); });
      if (!validMap(sp.map, sp)) sp.map = allMaps(sp)[0].id;
      const draft = genDraft && validMap('gen', sp) ? mapSpec('gen') : null;
      body.innerHTML = `<h2>Choose a map</h2><div class="map-grid">
        <button class="map-card gen-card ${sp.map === 'gen' ? 'sel' : ''}" data-genopen>${draft ? '<canvas width="224" height="168"></canvas>' : '<div class="gen-dice">🎲</div>'}<span class="size">${draft ? esc(draft.size) : 'Any size'}</span><b>${draft ? esc(draft.name) : 'Map Generator'}</b><span>${draft ? 'Generated map · click to open the generator' : 'Create a random map in one of nine themes, play it and save the ones you like.'}</span></button>
        ${allMaps(sp).map(m => `<button class="map-card ${sp.map === m.id ? 'sel' : ''}" data-map="${m.id}"><canvas width="224" height="168"></canvas><span class="size">${esc(m.size)}</span><b>${esc(m.name)}</b><span>${esc(m.desc)}</span></button>`).join('')}</div>
        ${savedCardsHTML(sp, sp.map, 'data-map', true)}`;
      if (draft) mapPreview('gen', body.querySelector('[data-genopen] canvas'));
      body.querySelector('[data-genopen]').onclick = () => { Sfx.ui(); if (draft && sp.map !== 'gen') { sp.map = 'gen'; renderSP(); } else { sp.genOpen = true; renderSP(); } };
      body.querySelectorAll('[data-map]').forEach(b => { mapPreview(b.dataset.map, b.querySelector('canvas')); b.onclick = e => { if (e.target.closest('[data-delmap]')) return; sp.map = b.dataset.map; Sfx.ui(); renderSP(); }; });
      body.querySelectorAll('[data-delmap]').forEach(b => b.onclick = () => deleteSavedMap(b.dataset.delmap, renderSP));
    } else {
      body.innerHTML = `<h2>Choose your weapons</h2><div id="sp-lo"></div>`;
      loadoutEditor($('#sp-lo'), P.loadout, () => Profile.save());
    }
    $('#sp-next').textContent = sp.step === 2 ? '▶ START' : 'Next →';
  }
  $('#sp-back').onclick = () => { Sfx.ui(); if (sp.step === 0) go('play'); else { sp.step--; renderSP(); } };
  $('#sp-next').onclick = () => { Sfx.ui(); if (sp.step < 2) { sp.step++; renderSP(); } else startSingle(); };

  function makeBots(count, team, tier, used) {
    const out = [];
    for (let i = 0; i < count; i++) {
      let name; do { name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]; } while (used.has(name) && used.size < BOT_NAMES.length); used.add(name);
      const skins = {}; const lo = botLoadout(tier);
      [lo.primary, lo.sidearm1, lo.sidearm2, lo.melee].forEach(id => { if (id && Math.random() < 0.5) skins[id] = CAMOS[Math.floor(Math.random() * 9)].id; });
      if (lo.armor) skins[lo.armor] = ['olive', 'desert', 'woodland', 'urban', 'factory'][Math.floor(Math.random() * 5)];
      out.push({ id: 'bot' + Math.random().toString(36).slice(2, 8), name, team, isBot: true, loadout: lo, skins, uniform: UNIFORMS[Math.floor(Math.random() * UNIFORMS.length)].id });
    }
    return out;
  }
  function meParticipant(id, team) { return { id, name: P.name, team, isBot: false, loadout: JSON.parse(JSON.stringify(P.loadout)), skins: Object.assign({}, P.skins), uniform: P.uniform, face: P.face || null, level: P.level }; }
  const validFace = f => typeof f === 'string' && f.startsWith('data:image/png') && f.length < 40000 ? f : null;
  function startSingle() {
    const tier = Profile.loadoutTier(P.loadout), used = new Set();
    let parts = [meParticipant('me', 0)];
    fixSettings(sp); if (!validMap(sp.map, sp)) sp.map = allMaps(sp)[0].id;
    const spec = mapSpec(sp.map);
    if (sp.format === 'ffa') makeBots(sp.ffaCount - 1, 0, tier, used).forEach((b, i) => { b.team = i + 1; parts.push(b); });
    else { parts = parts.concat(makeBots(sp.size - 1, 0, tier, used)); for (let t = 1; t < sp.teams; t++) parts = parts.concat(makeBots(sp.size, t, tier, used)); }
    const ffa = sp.format === 'ffa';
    lastSP = { mapId: spec.mapId, seed: spec.seed, customMap: spec.custom, mapName: spec.name, mode: ffa && sp.mode === 'snd' ? 'deathmatch' : sp.mode, ffa, friendlyFire: sp.ff, lives: sp.lives, minutes: sp.minutes, night: sp.night, mods: (sp.mods || []).slice(),
      teams: ffa ? 0 : sp.teams, massive: !!sp.massive, teamNames: TEAM_NAMES.slice(), participants: parts, localId: 'me', role: 'local' };
    launch(lastSP);
  }
  let lastSP = null;

  // ------------------------------------------------------------------ GAME flow
  function launch(cfg) {
    if (game) game.stop();
    $('#endscreen').classList.add('hidden'); $('#pause').classList.add('hidden');
    go('game');
    cfg.onEnd = res => showEnd(res, cfg);
    game = new Game(cfg, $('#game'));
    game.onEscape = () => togglePause();
    game.onUnlock = () => togglePause(true); // Esc releases the mouse: open the menu
    game.start();
  }
  function togglePause(force) {
    if (!game || game.ended) return;
    const show = force !== undefined ? force : $('#pause').classList.contains('hidden');
    $('#pause').classList.toggle('hidden', !show);
    $('#btn-resume').textContent = 'Resume';
    $('#pause h2').textContent = game.role === 'local' ? 'Paused' : 'Menu (match continues)';
    $('#btn-quit').textContent = game.role === 'local' ? 'Quit Match' : game.role === 'host' ? 'End game for everyone' : 'Leave Match';
    game.paused = show && game.role === 'local'; game.uiBlocked = show;
    if (show) game.input.unlock(); else game.input.lock();
  }
  $('#btn-resume').onclick = () => togglePause(false);
  $('#btn-quit').onclick = () => {
    const role = game ? game.role : 'local';
    if (game) { game.stop(); game = null; }
    $('#pause').classList.add('hidden');
    if (role !== 'local') { Net.close(); lobby = null; }
    go('menu');
  };

  function showEnd(res, cfg) {
    const myId = cfg.localId, online = cfg.role !== 'local';
    const me = res.units.find(u => u.id === myId);
    const myTeam = me ? me.team : -1, won = res.winner === myTeam;
    // ---- rewards
    const R = [];
    let xp = 0, coins = 0;
    if (me) {
      const add = (label, n, r) => { if (n > 0) { R.push([label, n * r.xp, n * r.coins]); xp += n * r.xp; coins += n * r.coins; } };
      add(`Kills ×${me.kills}`, me.kills, REWARDS.kill);
      add(`Assists ×${me.assists}`, me.assists, REWARDS.assist);
      add('Match played', 1, REWARDS.play);
      if (won) add(res.ffa ? 'Free For All victory' : 'Victory', 1, res.ffa ? REWARDS.winFFA : REWARDS.win);
      const st = Profile.get().stats;
      Profile.stat('kills', me.kills); Profile.stat('deaths', me.deaths); Profile.stat('assists', me.assists); Profile.stat('games', 1);
      if (online) Profile.stat('onlineGames', 1);
      if (won) { Profile.stat('wins', 1); if (res.ffa) Profile.stat('ffaWins', 1); if (res.mode === 'zone') Profile.stat('zoneWins', 1); if (res.mode === 'deathmatch') Profile.stat('dmWins', 1); if (res.mode === 'snd') Profile.stat('sndWins', 1); }
      if (res.night) Profile.stat('nightKills', me.kills);
      ['explosiveKills', 'fireKills', 'sniperKills', 'meleeKills', 'wallbangs', 'destroyed', 'headshots', 'longShots', 'proneKills', 'quietKills', 'shots', 'hits', 'damage', 'taken'].forEach(k => Profile.stat(k, Math.round(me.ms[k] || 0)));
      Profile.stat('timePlayed', res.duration || 0); if (!won && res.winner >= 0) Profile.stat('losses', 1); if (res.winner < 0) Profile.stat('draws', 1);
      Object.entries(me.ms.weaponKills || {}).forEach(([w, n]) => { P.weaponKills = P.weaponKills || {}; P.weaponKills[w] = (P.weaponKills[w] || 0) + n; });
      P.modeStats = P.modeStats || {}; const msx = P.modeStats[res.mode] = P.modeStats[res.mode] || { games: 0, wins: 0 }; msx.games++; if (won) msx.wins++;
      P.history = [{ t: Date.now(), map: cfg.mapName || (MAPS.find(x => x.id === cfg.mapId) || {}).name || cfg.mapId, mode: res.mode, ffa: res.ffa, result: res.winner < 0 ? 'draw' : won ? 'win' : 'loss',
        k: me.kills, d: me.deaths, a: me.assists, online, massive: !!cfg.massive }].concat(P.history || []).slice(0, 30);
      Profile.statMax('bestMulti', me.ms.bestMulti); Profile.statMax('bestStreak', me.ms.bestStreak);
      if (res.mode === 'score') { Profile.statMax('bestScore', me.score || 0); if (won) Profile.stat('scoreWins', 1); }
      if (won && me.deaths === 0) Profile.stat('flawless', 1);
      if (won && !res.ffa && new Set(res.units.map(u => u.team)).size >= 4) Profile.stat('multiteamWins', 1);
      if (cfg.massive) { Profile.stat('massiveGames', 1); if (won) Profile.stat('massiveWins', 1); }
      if (cfg.customMap && cfg.customMap.gen) Profile.stat('genGames', 1);
      P.mapsPlayed = P.mapsPlayed || {}; P.mapsPlayed[cfg.customMap && cfg.customMap.gen ? 'gen:' + cfg.customMap.theme + ':' + cfg.seed : cfg.mapId] = 1;
      const lvl0 = P.level;
      Profile.addCoins(coins); Profile.addXp(xp); Profile.stat('coinsEarned', coins); Profile.stat('xpEarned', xp);
      if (P.level > lvl0) R.push([`Level up! ${lvl0} → ${P.level}`, 0, 0]);
    }
    refreshTop();
    const title = res.winner < 0 ? 'DRAW' : won ? 'VICTORY' : 'DEFEAT';
    let winnerText = '';
    if (res.winner >= 0) { if (res.ffa) { const w = res.units.find(u => u.team === res.winner); winnerText = w ? `${w.name} wins!` : ''; } else winnerText = `${(res.teamNames || TEAM_NAMES)[res.winner]} wins!`; }
    const rows = res.units.slice().sort((a, b) => (res.ffa ? 0 : a.team - b.team) || (res.mode === 'zone' && res.ffa ? b.zoneTime - a.zoneTime : res.mode === 'score' ? b.score - a.score : b.kills - a.kills));
    const teamScore = t => res.units.filter(u => u.team === t).reduce((s, u) => s + (u.score || 0), 0);
    const scoreText = res.mode === 'score' && !res.ffa ? ' · ' + [...new Set(res.units.map(u => u.team))].sort().map(t => `${esc((res.teamNames || TEAM_NAMES)[t])} ${teamScore(t)}`).join(', ') : '';
    const baseText = res.mode === 'snd' && res.bases && res.bases.length ? ` · Bases: ${res.bases.map((hp, t) => `${esc((res.teamNames || TEAM_NAMES)[t])} ${hp} HP`).join(', ')}` : '';
    $('#end-body').innerHTML = `<p class="result-title ${res.winner < 0 ? 'draw' : won ? 'win' : 'lose'}">${title}</p><p style="text-align:center" class="sub">${esc(winnerText)} · ${GAMEMODES.find(m => m.id === res.mode).name}${res.night ? ' · Night' : ''}${baseText}${scoreText}${(cfg.mods || []).length ? ' · ' + esc(modsText(cfg)) : ''}</p>
      <h3>Rewards</h3><div class="rewards">${R.map(([l, x, c]) => `<div><span>${esc(l)}</span><span>${x ? '+' + fmt(x) + ' XP' : ''} ${c ? '+¢' + fmt(c) : ''}</span></div>`).join('')}
        <div class="tot"><span>Total</span><span>+${fmt(xp)} XP · +¢${fmt(coins)}</span></div></div>
      <h3>Scoreboard</h3><table class="sb"><tr><th>PLAYER</th>${res.ffa ? '' : '<th>TEAM</th>'}<th>K</th><th>D</th><th>A</th>${res.mode === 'zone' && res.ffa ? '<th>ZONE</th>' : ''}${res.mode === 'score' ? '<th>SCORE</th>' : ''}</tr>
        ${rows.map(u => `<tr class="${u.id === myId ? 'me' : ''}"><td>${esc(u.name)}${u.isBot ? ' 🤖' : ''}</td>${res.ffa ? '' : `<td>${esc((res.teamNames || [])[u.team] || '')}</td>`}<td>${u.kills}</td><td>${u.deaths}</td><td>${u.assists}</td>${res.mode === 'zone' && res.ffa ? `<td>${u.zoneTime}s</td>` : ''}${res.mode === 'score' ? `<td>${u.score}</td>` : ''}</tr>`).join('')}</table>
      <div class="end-btns">${online ? '<button class="primary" id="end-lobby">Back to Lobby</button>' : '<button class="primary" id="end-again">Play Again</button><button id="end-setup">Change Setup</button>'}<button id="end-menu">Main Menu</button></div>`;
    $('#endscreen').classList.remove('hidden');
    const leave = () => { if (game) { game.stop(); game = null; } $('#endscreen').classList.add('hidden'); };
    const again = $('#end-again'); if (again) again.onclick = () => { leave(); startSingle(); };
    const setup = $('#end-setup'); if (setup) setup.onclick = () => { leave(); go('sp'); };
    const lb = $('#end-lobby'); if (lb) lb.onclick = () => { leave(); if (lobby) { if (Net.role === 'host') { lobby.inGame = false; broadcastLobby(); } go('lobby'); renderLobby(); } else go('menu'); };
    $('#end-menu').onclick = () => { leave(); if (online) { Net.close(); lobby = null; } go('menu'); };
  }

  // ------------------------------------------------------------------ MULTIPLAYER
  let lobby = null; // host: authoritative state; client: last received
  let loadoutOpen = false;
  function myLobbyId() { return Net.role === 'host' ? 'H' : Net.myId; }
  function capacity(st) { fixSettings(st); return st.format === 'ffa' ? st.ffaCount : st.size * st.teams; }
  const teamCount = t => lobby.players.filter(p => p.team === t).length;
  function setStatus(t) { $('#mp-status').textContent = t; }

  Net.on('error', msg => { setStatus(msg); toast(msg, 'error'); });
  Net.on('closed', msg => { if (game) { game.stop(); game = null; } lobby = null; $('#endscreen').classList.add('hidden'); toast(msg, 'error'); go('menu'); });
  Net.on('join', id => { /* wait for hello */ });
  Net.on('leave', id => {
    if (!lobby) return;
    const p = lobby.players.find(x => x.id === id);
    if (p) toast(`${p.name} left the game`);
    if (game) game.playerLeft(id);
    lobby.players = lobby.players.filter(x => x.id !== id); delete lobby.votesMap[id]; delete lobby.votesMode[id];
    broadcastLobby(); if (current === 'lobby') renderLobby();
  });
  Net.on('message', (from, msg) => {
    if (game && (msg.t === 'in' || msg.t === 'snap')) return game.onNetMessage(from, msg);
    if (Net.role === 'host') hostMessage(from, msg); else clientMessage(msg);
  });

  $('#mp-host').onclick = () => {
    Sfx.ui(); setStatus('Creating game...');
    Net.host(code => {
      lobby = { code, format: 'team', teams: 2, size: 2, ffaCount: 8, ff: false, night: false, massive: false, lives: 1, minutes: 5, mods: [], teamNames: TEAM_NAMES.slice(), players: [Object.assign(meParticipant('H', 0), { ready: true })], votesMap: { H: 'oldtown' }, votesMode: { H: 'deathmatch' }, inGame: false };
      setStatus(''); go('lobby'); renderLobby();
    });
  };
  $('#mp-join').onclick = () => {
    const code = $('#join-code').value.trim().toUpperCase();
    if (code.length < 4) return setStatus('Enter the 6-character game code from the host.');
    Sfx.ui(); setStatus('Connecting to ' + code + '...');
    Net.join(code, myId => {
      setStatus('Connected! Waiting for lobby...');
      Net.send({ t: 'hello', name: P.name, loadout: P.loadout, skins: P.skins, uniform: P.uniform, face: P.face || null, level: P.level });
    });
  };
  $('#join-code').addEventListener('keydown', e => { if (e.key === 'Enter') $('#mp-join').click(); });

  function broadcastLobby() { if (Net.role === 'host' && lobby) Net.broadcast({ t: 'lobby', state: lobby }); }
  function hostMessage(from, msg) {
    if (!lobby) return;
    const p = lobby.players.find(x => x.id === from);
    switch (msg.t) {
      case 'hello': {
        if (lobby.inGame) { Net.sendTo(from, { t: 'refused', reason: 'A match is in progress. Try again when it ends.' }); setTimeout(() => Net.kick(from), 300); return; }
        // replace a bot if full
        if (lobby.players.length >= capacity(lobby)) { const bi = lobby.players.findIndex(x => x.isBot); if (bi >= 0) lobby.players.splice(bi, 1); else { Net.sendTo(from, { t: 'refused', reason: 'The lobby is full.' }); setTimeout(() => Net.kick(from), 300); return; } }
        let small = 0; for (let t = 1; t < lobby.teams; t++) if (teamCount(t) < teamCount(small)) small = t;
        lobby.players.push({ id: from, name: String(msg.name || 'Player').slice(0, 16), team: lobby.format === 'ffa' ? 0 : small, isBot: false, loadout: sanitizeLoadout(msg.loadout), skins: msg.skins || {}, uniform: msg.uniform || 'multicam', face: validFace(msg.face), level: msg.level || 1, ready: false });
        toast(`${msg.name} joined`);
        break; }
      case 'team': { const t = Math.floor(+msg.team); if (p && lobby.format === 'team' && t >= 0 && t < lobby.teams && teamCount(t) < lobby.size) p.team = t; break; }
      case 'vote': if (p) { if (msg.kind === 'map' && (MAPS.find(m => m.id === msg.value) || (lobby.savedMaps || []).find(m => m.id === msg.value))) lobby.votesMap[from] = msg.value; if (msg.kind === 'mode' && GAMEMODES.find(m => m.id === msg.value)) lobby.votesMode[from] = msg.value; } break;
      case 'loadout': if (p) { p.loadout = sanitizeLoadout(msg.loadout); p.skins = msg.skins || {}; p.uniform = msg.uniform || p.uniform; p.face = validFace(msg.face); p.level = msg.level || p.level; } break;
      case 'ready': if (p) p.ready = !!msg.ready; break;
    }
    broadcastLobby(); if (current === 'lobby') renderLobby();
  }
  function sanitizeLoadout(lo) {
    const ok = (id, cat) => id && ITEMS[id] && ITEMS[id].cat === cat ? id : null;
    lo = lo || {};
    const out = { primary: ok(lo.primary, 'primary') || 'm4', sidearm1: ok(lo.sidearm1, 'sidearm') || 'glock20', sidearm2: ok(lo.sidearm2, 'sidearm'), melee: ok(lo.melee, 'melee') || 'fists', armor: ok(lo.armor, 'armor') || 'noarmor', gear: ok(lo.gear, 'gear') || 'nogear', utils: [0, 1, 2].map(i => ok((lo.utils || [])[i], 'utility')), ammo: {}, att: {} };
    [out.primary, out.sidearm1, out.sidearm2].forEach(g => { const a = g && lo.ammo && lo.ammo[g]; if (a && ITEMS[a] && ITEMS[a].cat === 'ammo' && ITEMS[a].cal === ITEMS[g].cal) out.ammo[g] = a; });
    [out.primary, out.sidearm1, out.sidearm2].forEach(g => { const a = g && lo.att && lo.att[g]; if (!a || typeof a !== 'object') return; const o = {};
      ATT_SLOTS.forEach(([sl]) => { if (a[sl] && attachFits(a[sl], g) && ITEMS[a[sl]].slot === sl) o[sl] = a[sl]; }); if (Object.keys(o).length) out.att[g] = o; });
    return out;
  }
  function clientMessage(msg) {
    switch (msg.t) {
      case 'lobby': {
        const first = !lobby; lobby = msg.state;
        if (first) { setStatus(''); go('lobby'); }
        if (current === 'lobby') renderLobby();
        break; }
      case 'refused': setStatus(msg.reason); toast(msg.reason, 'error'); Net.close(); break;
      case 'kicked': toast('You were removed from the lobby.', 'error'); Net.close(); lobby = null; go('menu'); break;
      case 'start': {
        const cfg = msg.cfg; cfg.role = 'client'; cfg.localId = Net.myId; cfg.net = Net;
        launch(cfg); break; }
    }
  }
  function tally(votes, hostPick) {
    const c = {}; Object.values(votes).forEach(v => c[v] = (c[v] || 0) + 1);
    let best = hostPick, bn = c[hostPick] || 0;
    for (const k in c) if (c[k] > bn) { bn = c[k]; best = k; }
    return { counts: c, winner: best };
  }
  function lobbyProblems() {
    if (!lobby) return 'No lobby';
    const n = lobby.players.length;
    if (lobby.format === 'ffa') { if (n < 2) return 'Need at least 2 participants (add bots).'; if (n > lobby.ffaCount) return 'Too many players for this player count.'; }
    else { for (let t = 0; t < lobby.teams; t++) { const c = teamCount(t); if (!c) return 'Each team needs at least one player (add bots).'; if (c > lobby.size) return 'A team has too many players for this match size.'; }
      if (lobby.players.some(p => p.team >= lobby.teams)) return 'Some players are on a team that no longer exists.'; }
    return null;
  }
  function renderLobby() {
    if (!lobby) return;
    const host = Net.role === 'host', myId = myLobbyId(), me = lobby.players.find(p => p.id === myId);
    // preserve focused team-name input
    const focused = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.tname : undefined;
    const fval = focused !== undefined ? document.activeElement.value : null;
    const mapT = tally(lobby.votesMap, lobby.votesMap.H || 'oldtown'), modeT = modeTally();
    // the host's saved generated maps can be voted on too
    if (host) lobby.savedMaps = savedMaps().map(m => Object.assign({}, m));
    const maps = allMaps(lobby).concat((lobby.savedMaps || []).filter(m => isMassiveSize(m.size) === !!lobby.massive).map(m => ({ id: m.id, name: m.name + ' ★' })));
    const cap = capacity(lobby), problem = lobbyProblems();
    const plRow = p => `<div class="pl ${p.id === myId ? 'me' : ''}"><span class="lv">${p.isBot ? 'BOT' : 'Lv ' + (p.level || 1)}</span>${esc(p.name)}${p.id === 'H' ? ' 👑' : ''}${!p.isBot && p.id !== 'H' ? (p.ready ? ' <small style="color:var(--good)">READY</small>' : ' <small class="sub">not ready</small>') : ''}
      ${host && p.id !== 'H' ? `<button class="x" data-kick="${p.id}" title="${p.isBot ? 'Remove bot' : 'Kick player'}">✕</button>` : ''}</div>`;
    let teamsHTML;
    if (lobby.format === 'ffa') {
      teamsHTML = `<div class="teams ffa"><div class="team"><span class="tname">Free For All · ${lobby.players.length}/${cap}</span>${lobby.players.map(plRow).join('')}
        ${Array.from({ length: Math.max(0, cap - lobby.players.length) }, () => '<div class="pl emptyslot">open slot</div>').join('')}
        ${host ? `<button data-addbot="0" ${lobby.players.length >= cap ? 'disabled' : ''}>+ Add bot</button>` : ''}</div></div>`;
    } else {
      teamsHTML = `<div class="teams" style="grid-template-columns:repeat(${lobby.teams > 4 ? 3 : 2},1fr)">${Array.from({ length: lobby.teams }, (_, t) => t).map(t => { const ps = lobby.players.filter(p => p.team === t);
        return `<div class="team">${host ? `<input data-tname="${t}" value="${esc(lobby.teamNames[t])}" maxlength="16" title="Rename team">` : `<span class="tname">${esc(lobby.teamNames[t])}</span>`}
          <small class="sub">${ps.length}/${lobby.size}</small>${ps.map(plRow).join('')}
          ${Array.from({ length: Math.max(0, lobby.size - ps.length) }, () => '<div class="pl emptyslot">open slot</div>').join('')}
          <div style="display:flex;gap:6px;flex-wrap:wrap">${me && me.team !== t ? `<button data-jointeam="${t}" ${ps.length >= lobby.size ? 'disabled' : ''}>Join team</button>` : ''}
          ${host ? `<button data-addbot="${t}" ${ps.length >= lobby.size ? 'disabled' : ''}>+ Add bot</button>` : ''}</div></div>`; }).join('')}</div>`;
    }
    $('#lobby').innerHTML = `<div class="lobby-top"><h2 style="margin:0">Lobby</h2><span class="sub">Game code</span><span class="code">${esc(lobby.code || Net.code || '')}</span>
        <button id="copy-code">Copy</button><span class="sub">${host ? 'Share this code with friends so they can join.' : 'Waiting for the host to start.'}</span>
        <button class="back" id="lobby-leave" style="margin-left:auto">Leave</button></div>
      <div class="lobby-grid"><div>
        ${host ? `<div id="lobby-settings">${matchSettingsHTML(lobby, true)}</div>` : `<h3>Match</h3><p>${lobby.massive ? '⚔ Massive battle · ' : ''}${lobby.format === 'ffa' ? `Free For All · up to ${lobby.ffaCount} players` : `${lobby.teams} teams of ${lobby.size}`} · Friendly fire ${lobby.format === 'ffa' ? 'n/a' : lobby.ff ? 'ON' : 'OFF'}${lobby.night ? ' · 🌙 Night' : ''}${(lobby.mods || []).length ? '<br>Modifiers: ' + esc(modsText(lobby)) : ''}</p>`}
        <h3>Players</h3>${teamsHTML}
        ${host ? `<div class="row"><button id="fill-bots" ${lobby.players.length >= cap ? 'disabled' : ''}>Fill empty slots with bots</button></div>` : ''}
      </div><div>
        <h3>Vote: game mode</h3><div class="vote-modes">${GAMEMODES.map(m => `<button class="${lobby.votesMode[myId] === m.id ? 'sel' : ''}" data-vmode="${m.id}" ${m.teamsOnly && lobby.format === 'ffa' ? 'disabled title="Not available in Free For All"' : ''}><b>${m.name}</b> <span class="votes" style="position:static">${modeT.counts[m.id] || 0}</span></button>`).join('')}</div>
        ${host ? `<div id="lobby-modeopts">${modeOptionsHTML(lobby, modeT.winner, true)}</div>` : modeT.winner === 'deathmatch' && (lobby.lives || 1) > 1 ? `<p class="sub">${lobby.lives} lives each</p>` : modeT.winner === 'score' ? `<p class="sub">${lobby.minutes || 5} minute match</p>` : ''}
        <h3>Vote: map</h3><div class="lobby-maps">${maps.map(m => `<button class="map-card ${lobby.votesMap[myId] === m.id ? 'sel' : ''}" data-vmap="${m.id}"><canvas width="224" height="168"></canvas>${mapT.counts[m.id] ? `<span class="votes">${mapT.counts[m.id]}</span>` : ''}<b>${esc(m.name)}</b></button>`).join('')}</div>
        <p class="sub">Leading: <b>${esc((maps.find(m => m.id === mapT.winner) || maps[0]).name)}</b> · <b>${GAMEMODES.find(m => m.id === modeT.winner).name}</b>. Ties go to the host's vote.</p>
        <h3>Your loadout</h3><div class="row"><button id="edit-lo">${loadoutOpen ? 'Hide loadout' : 'Choose weapons'}</button>${!host && me ? `<button id="ready" class="${me.ready ? 'sel' : ''}">${me.ready ? '✔ Ready' : 'Ready up'}</button>` : ''}</div>
        ${host ? `<div class="row"><button class="primary" id="lobby-start" ${problem ? 'disabled' : ''}>▶ START MATCH</button><span class="${problem ? 'warn' : 'sub'}">${problem || (lobby.players.some(p => !p.isBot && !p.ready) ? 'Some players are not ready (you can still start).' : 'Everyone is ready.')}</span></div>` : ''}
      </div></div><div id="lobby-lo" class="${loadoutOpen ? '' : 'hidden'}"></div>`;
    const L = $('#lobby');
    L.querySelectorAll('[data-vmap]').forEach(b => mapPreview(b.dataset.vmap, b.querySelector('canvas'), lobby.savedMaps || []));
    if (loadoutOpen) loadoutEditor($('#lobby-lo'), P.loadout, () => { Profile.save(); sendMyLoadout(); });
    if (focused !== undefined) { const inp = L.querySelector(`[data-tname="${focused}"]`); if (inp) { inp.value = fval; inp.focus(); } }
    // bindings
    $('#copy-code').onclick = () => { try { navigator.clipboard.writeText(lobby.code || Net.code); toast('Code copied'); } catch (e) {} };
    $('#lobby-leave').onclick = () => { Net.close(); lobby = null; loadoutOpen = false; go('menu'); };
    $('#edit-lo').onclick = () => { loadoutOpen = !loadoutOpen; renderLobby(); };
    const rd = $('#ready'); if (rd) rd.onclick = () => Net.send({ t: 'ready', ready: !me.ready });
    L.querySelectorAll('[data-vmode]').forEach(b => b.onclick = () => vote('mode', b.dataset.vmode));
    L.querySelectorAll('[data-vmap]').forEach(b => b.onclick = () => vote('map', b.dataset.vmap));
    L.querySelectorAll('[data-jointeam]').forEach(b => b.onclick = () => { const t = +b.dataset.jointeam; if (host) { if (lobby.players.filter(p => p.team === t).length < lobby.size) { me.team = t; changed(); } } else Net.send({ t: 'team', team: t }); });
    if (host) {
      const set = L.querySelector('#lobby-settings');
      bindMatchSettings(set, lobby, () => { trimToCapacity(); changed(); });
      const mo = L.querySelector('#lobby-modeopts'); if (mo) bindModeOptions(mo, lobby, changed);
      L.querySelectorAll('[data-tname]').forEach(i => { i.onchange = () => { lobby.teamNames[+i.dataset.tname] = i.value.trim().slice(0, 16) || TEAM_NAMES[+i.dataset.tname]; i.blur(); changed(); }; i.onkeydown = e => { if (e.key === 'Enter') i.onchange(); }; });
      L.querySelectorAll('[data-addbot]').forEach(b => b.onclick = () => { addBots(+b.dataset.addbot, 1); changed(); });
      L.querySelectorAll('[data-kick]').forEach(b => b.onclick = () => { const id = b.dataset.kick, p = lobby.players.find(x => x.id === id); if (p && !p.isBot) Net.kick(id); lobby.players = lobby.players.filter(x => x.id !== id); delete lobby.votesMap[id]; delete lobby.votesMode[id]; changed(); });
      const fb = $('#fill-bots'); if (fb) fb.onclick = () => { if (lobby.format === 'ffa') addBots(0, lobby.ffaCount - lobby.players.length); else for (let t = 0; t < lobby.teams; t++) addBots(t, lobby.size - teamCount(t)); changed(); };
      $('#lobby-start').onclick = startOnline;
    }
  }
  function changed() { broadcastLobby(); renderLobby(); }
  function vote(kind, value) { Sfx.ui(); if (Net.role === 'host') { (kind === 'map' ? lobby.votesMap : lobby.votesMode).H = value; changed(); } else Net.send({ t: 'vote', kind, value }); }
  function sendMyLoadout() {
    if (Net.role === 'host') { const me = lobby.players.find(p => p.id === 'H'); me.loadout = JSON.parse(JSON.stringify(P.loadout)); me.skins = Object.assign({}, P.skins); me.uniform = P.uniform; me.face = P.face || null; me.name = P.name; broadcastLobby(); }
    else Net.send({ t: 'loadout', loadout: P.loadout, skins: P.skins, uniform: P.uniform, face: P.face || null, level: P.level });
  }
  function humanTier() { const hs = lobby.players.filter(p => !p.isBot); return Math.round(hs.reduce((s, p) => s + Profile.loadoutTier(p.loadout), 0) / Math.max(1, hs.length)); }
  function addBots(team, n) {
    const used = new Set(lobby.players.map(p => p.name));
    makeBots(Math.max(0, Math.min(n, capacity(lobby) - lobby.players.length)), team, humanTier(), used).forEach(b => { b.level = 0; lobby.players.push(b); });
  }
  function trimToCapacity() {
    // remove bots beyond capacity, and move overflow humans to the other team when possible
    if (lobby.format === 'team') {
      const roomy = () => { for (let t = 0; t < lobby.teams; t++) if (teamCount(t) < lobby.size) return t; return -1; };
      // players on removed teams move to a team with room (bots are dropped instead)
      lobby.players.slice().forEach(p => { if (p.team < lobby.teams) return; if (p.isBot) { lobby.players.splice(lobby.players.indexOf(p), 1); return; } const t = roomy(); p.team = t >= 0 ? t : 0; });
      for (let t = 0; t < lobby.teams; t++) { let ps = lobby.players.filter(p => p.team === t); while (ps.length > lobby.size) { const bot = ps.slice().reverse().find(p => p.isBot); if (bot) lobby.players.splice(lobby.players.indexOf(bot), 1); else { const h = ps[ps.length - 1], r = roomy(); if (r >= 0 && r !== t) h.team = r; else break; } ps = lobby.players.filter(p => p.team === t); } }
    } else { while (lobby.players.length > lobby.ffaCount) { const bi = lobby.players.map(p => p.isBot).lastIndexOf(true); if (bi < 0) break; lobby.players.splice(bi, 1); } }
  }
  // votes for team-only modes don't count in Free For All
  function modeTally() {
    const ffa = lobby.format === 'ffa', ok = id => !(ffa && GAMEMODES.find(m => m.id === id).teamsOnly), votes = {};
    for (const k in lobby.votesMode) if (ok(lobby.votesMode[k])) votes[k] = lobby.votesMode[k];
    return tally(votes, ok(lobby.votesMode.H || 'deathmatch') ? lobby.votesMode.H || 'deathmatch' : 'deathmatch');
  }
  function startOnline() {
    if (lobbyProblems()) return;
    sendMyLoadout();
    let mapId = tally(lobby.votesMap, lobby.votesMap.H || 'oldtown').winner; const mode = modeTally().winner;
    if (!validMap(mapId, lobby, lobby.savedMaps || [])) mapId = allMaps(lobby)[0].id;
    const spec = mapSpec(mapId, lobby.savedMaps || []);
    const ffa = lobby.format === 'ffa';
    const parts = lobby.players.map((p, i) => ({ id: p.id, name: p.name, team: ffa ? i : p.team, isBot: p.isBot, isRemote: !p.isBot && p.id !== 'H', loadout: p.loadout, skins: p.skins, uniform: p.uniform, face: p.isBot ? null : p.face || null }));
    const cfg = { mapId: spec.mapId, seed: spec.custom ? spec.seed : Math.floor(Math.random() * 1e9), customMap: spec.custom, mapName: spec.name, mode, ffa, friendlyFire: lobby.ff, night: !!lobby.night, lives: lobby.lives || 1, minutes: lobby.minutes || 5, mods: (lobby.mods || []).slice(), teams: ffa ? 0 : lobby.teams, massive: !!lobby.massive, teamNames: lobby.teamNames.slice(), participants: parts };
    lobby.inGame = true; broadcastLobby();
    Net.broadcast({ t: 'start', cfg });
    launch(Object.assign({}, cfg, { role: 'host', localId: 'H', net: Net }));
  }

  // ------------------------------------------------------------------ settings
  // ---- keybinds editor
  let rebinding = null;
  function renderKeybinds() {
    $('#keybinds').innerHTML = Keybinds.ACTIONS.map(([id, name]) => `<div class="kb"><span>${esc(name)}</span><button data-bind="${id}" class="${rebinding === id ? 'sel waiting' : ''}">${rebinding === id ? 'Press a key…' : esc(Keybinds.label(Keybinds.get(id)))}</button></div>`).join('');
    $('#keybinds').querySelectorAll('[data-bind]').forEach(b => b.onclick = () => { rebinding = b.dataset.bind; renderKeybinds(); });
    updateControlsHint();
  }
  window.addEventListener('keydown', e => {
    if (!rebinding) return;
    e.preventDefault(); e.stopPropagation();
    if (e.code !== 'Escape') { const was = Keybinds.ACTIONS.map(([id]) => Keybinds.get(id)); Keybinds.set(rebinding, e.code); const moved = Keybinds.ACTIONS.filter(([id], i) => id !== rebinding && Keybinds.get(id) !== was[i]); if (moved.length) toast(`Swapped: ${moved.map(a => a[1]).join(', ')} now uses ${Keybinds.label(Keybinds.get(moved[0][0]))}`); }
    rebinding = null; renderKeybinds();
  }, true);
  $('#btn-keys-reset').onclick = () => { Keybinds.reset(); rebinding = null; renderKeybinds(); toast('Controls reset to default'); };
  function updateControlsHint() {
    const k = id => Keybinds.label(Keybinds.get(id)), h = document.querySelector('.controls-hint'); if (!h) return;
    h.textContent = `Click to capture the mouse · ${k('forward')}${k('left')}${k('back')}${k('right')} move · ${k('sprint')} sprint · ${k('jump')} jump · ${k('crouch')} crouch (hold: prone) · Mouse look · LMB fire · RMB aim/scope (${k('hold')} hold breath) · ${k('reload')} reload · ${k('w1')}-${k('w4')} weapons · ${k('melee')} melee · ${k('u1')}-${k('u3')} utilities (or ${k('unext')} select, ${k('uuse')} use) · ${k('light')} weapon light · ${k('gear')} night gear · ${k('scores')} scores · Esc menu`;
  }
  updateControlsHint();
  $('#btn-settings').onclick = () => { $('#vol').value = Sfx.getVolume(); rebinding = null; renderKeybinds(); $('#settings').classList.remove('hidden'); };
  $('#btn-close-settings').onclick = () => $('#settings').classList.add('hidden');
  $('#btn-pause-settings').onclick = () => $('#btn-settings').click();
  try { $('#quality').value = localStorage.getItem('fo3d-quality') || 'high'; } catch (e) {}
  $('#quality').onchange = e => { try { localStorage.setItem('fo3d-quality', e.target.value); } catch (er) {} toast('Graphics setting applies from the next match.'); };
  $('#vol').oninput = e => { Sfx.init(); Sfx.setVolume(+e.target.value); };
  try { $('#sens').value = parseFloat(localStorage.getItem('fo3d-sens')) || 1; } catch (e) {}
  $('#sens').oninput = e => { try { localStorage.setItem('fo3d-sens', e.target.value); } catch (er) {} if (game) game.input.sens = 0.0024 * +e.target.value; };
  $('#btn-reset').onclick = () => { if (confirm('Reset ALL progress, unlocks and coins? This cannot be undone.')) { Profile.reset(); P = Profile.get(); refreshTop(); $('#settings').classList.add('hidden'); toast('Progress reset.'); go('menu'); } };
  window.addEventListener('beforeunload', () => Net.close());

  // ------------------------------------------------------------------ init
  refreshTop();
  go('menu');
  return { go, toast, get game() { return game; } };
})();
