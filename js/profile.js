// ============================================================================
// Player profile, progression and persistence (localStorage).
// ============================================================================
const Profile = (() => {
  const KEY = 'frontline-ops-profile-v1';
  let p = null;
  const listeners = [];

  function fresh() {
    const owned = {}; STARTING_ITEMS.forEach(id => owned[id] = true);
    return {
      name: 'Soldier' + Math.floor(100 + Math.random() * 900),
      level: 1, xp: 0, totalXp: 0, xpBank: 0, coins: 250,
      owned, invested: {},
      loadout: JSON.parse(JSON.stringify(DEFAULT_LOADOUT)),
      skins: {}, uniform: 'multicam',
      ownedCamos: { factory:true, olive:true, desert:true },
      ownedUniforms: { multicam:true, woodland:true },
      stats: { kills:0, deaths:0, assists:0, wins:0, ffaWins:0, zoneWins:0, dmWins:0, games:0, onlineGames:0,
               bestMulti:0, bestStreak:0, destroyed:0, explosiveKills:0, fireKills:0, sniperKills:0,
               meleeKills:0, wallbangs:0, spent:0, sndWins:0, nightKills:0, headshots:0 },
      achievements: {},
      savedMaps: [], // generated maps the player kept: { id, name, theme, size, seed }
      face: null,    // face paint drawing (PNG data URL) shown on your soldier
    };
  }
  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) p = Object.assign(fresh(), JSON.parse(raw)); } catch (e) {}
    if (!p) p = fresh();
    // make sure new stats keys exist
    p.stats = Object.assign(fresh().stats, p.stats);
    // loadouts saved before night gear / ammunition existed
    STARTING_ITEMS.forEach(id => p.owned[id] = true);
    if (!p.loadout.gear || !ITEMS[p.loadout.gear]) p.loadout.gear = 'nogear';
    if (!p.loadout.ammo || typeof p.loadout.ammo !== 'object') p.loadout.ammo = {};
    if (!p.loadout.att || typeof p.loadout.att !== 'object') p.loadout.att = {};
    return p;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} }
  function notify(msg, kind) { listeners.forEach(f => f(msg, kind)); }

  // XP goes to the level bar AND to the investable XP bank (investing never lowers your level).
  function addXp(amount, silent) {
    amount = Math.round(amount);
    if (amount <= 0) return;
    p.xp += amount; p.totalXp += amount; p.xpBank += amount;
    while (p.xp >= xpForLevel(p.level)) {
      p.xp -= xpForLevel(p.level);
      p.level++;
      const c = 100 + p.level * 25;
      p.coins += c;
      notify(`LEVEL UP! You reached level ${p.level} (+${c} coins)`, 'level');
      const reward = LEVEL_REWARDS[p.level];
      if (reward && !p.owned[reward]) {
        p.owned[reward] = true;
        notify(`Level ${p.level} reward unlocked: ${ITEMS[reward].name}`, 'unlock');
      }
    }
    if (!silent) checkAchievements();
    save();
  }
  function addCoins(n) { p.coins += Math.round(n); save(); }

  function canInvest(id) { const it = ITEMS[id]; return !p.owned[id] && p.level >= it.level; }
  function invest(id, amount) {
    const it = ITEMS[id];
    if (!canInvest(id)) return false;
    const need = it.xp - (p.invested[id] || 0);
    amount = Math.min(amount, need, p.xpBank);
    if (amount <= 0) return false;
    p.xpBank -= amount;
    p.invested[id] = (p.invested[id] || 0) + amount;
    if (p.invested[id] >= it.xp) { p.owned[id] = true; notify(`Unlocked ${it.name} with XP!`, 'unlock'); }
    checkAchievements(); save();
    return true;
  }
  function buy(id) {
    const it = ITEMS[id];
    if (p.owned[id] || p.coins < it.coins) return false;
    // anything can be bought with coins at any level (the level is only needed to unlock items with XP)
    p.coins -= it.coins; p.stats.spent += it.coins; p.owned[id] = true;
    notify(`Purchased ${it.name}`, 'unlock');
    checkAchievements(); save();
    return true;
  }
  function buyCamo(id, uniform) {
    const list = uniform ? UNIFORMS : CAMOS, store = uniform ? p.ownedUniforms : p.ownedCamos;
    const c = list.find(x => x.id === id);
    if (!c || store[id] || p.coins < c.price) return false;
    p.coins -= c.price; p.stats.spent += c.price; store[id] = true;
    notify(`Purchased ${c.name} ${uniform ? 'uniform' : 'camo'}`, 'unlock');
    checkAchievements(); save();
    return true;
  }

  function statValue(key) {
    if (key === 'level') return p.level;
    if (key === 'owned') return Object.keys(p.owned).filter(k => ITEMS[k] && !ITEMS[k].noImage && ITEMS[k].cat !== 'ammo' && ITEMS[k].cat !== 'attach').length;
    if (key === 'savedMaps') return (p.savedMaps || []).length;
    if (key === 'facePaint') return p.face ? 1 : 0;
    if (key === 'mapsPlayed') return Object.keys(p.mapsPlayed || {}).length;
    if (key === 'achievementsDone') return Object.keys(p.achievements).filter(k => k !== 'completionist').length;
    return p.stats[key] || 0;
  }
  function checkAchievements() {
    let again = true;
    while (again) {
      again = false;
      for (const a of ACHIEVEMENTS) {
        if (p.achievements[a.id]) continue;
        if (statValue(a.stat) >= a.goal) {
          p.achievements[a.id] = Date.now();
          p.coins += a.coins;
          notify(`Achievement unlocked: ${a.name} (+${a.xp} XP, +${a.coins} coins)`, 'achievement');
          if (a.xp) { addXp(a.xp, true); again = true; }
        }
      }
    }
    save();
  }
  function stat(key, add) { p.stats[key] = (p.stats[key] || 0) + add; }
  function statMax(key, v) { if (v > (p.stats[key] || 0)) p.stats[key] = v; }

  function loadoutWeight(lo) {
    let w = 0;
    ['primary','sidearm1','sidearm2','melee','armor','gear'].forEach(s => { if (lo[s] && ITEMS[lo[s]]) w += ITEMS[lo[s]].weight; });
    lo.utils.forEach(u => { if (u) w += ITEMS[u].weight; });
    // fitted attachments on the carried guns
    [lo.primary, lo.sidearm1, lo.sidearm2].forEach(g => { const a = g && lo.att && lo.att[g]; if (a) for (const k in a) if (ITEMS[a[k]]) w += ITEMS[a[k]].weight; });
    return w;
  }
  // average unlock level of a loadout -> used to give bots comparable gear
  function loadoutTier(lo) {
    const ids = [lo.primary, lo.sidearm1, lo.sidearm2, lo.melee, lo.armor].filter(Boolean);
    return Math.max(1, Math.round(ids.reduce((s, id) => s + ITEMS[id].level, 0) / ids.length + (ITEMS[lo.primary].level / 2)));
  }

  return { load, save, get: () => p, addXp, addCoins, invest, canInvest, buy, buyCamo, checkAchievements,
           stat, statMax, statValue, recheck: () => checkAchievements(), onNotify: f => listeners.push(f), loadoutWeight, loadoutTier,
           reset: () => { p = fresh(); save(); } };
})();

// Movement speed multiplier from carried weight (kg). ~5 kg standard kit = ~0.95x
function speedFromWeight(w) { return Math.max(0.38, Math.min(1.05, 1.08 - w * 0.019)); }
