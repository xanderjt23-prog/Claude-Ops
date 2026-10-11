// ============================================================================
// FRONTLINE OPS - static game data: weapons, armour, utilities, camos,
// achievements, level rewards.
// Units: damage vs 100 HP, rpm = rounds per minute, range in px (32px = 1 m-ish
// tile), weight in kg, pen = penetration power (see MATERIALS in maps.js).
// level = minimum player level to invest XP into the item, xp = XP needed,
// coins = shop price.
// ============================================================================

const ITEMS = {};
function def(list) { list.forEach(it => { ITEMS[it.id] = it; }); }

// ---------------------------------------------------------------- primaries
def([
  // Assault rifles
  { id:'m4', name:'M4 Carbine', cat:'primary', cal:'556', type:'Assault Rifle', dmg:26, rpm:800, mag:30, reload:2.2, range:900, spread:3, speed:1900, weight:3.4, pen:1.5, auto:true, level:1, xp:0, coins:0, desc:'Compact 5.56mm carbine. Reliable all-rounder and standard issue.' },
  { id:'g36', name:'HK G36', cat:'primary', cal:'556', type:'Assault Rifle', dmg:27, rpm:750, mag:30, reload:2.3, range:920, spread:2.6, speed:1900, weight:3.6, pen:1.5, auto:true, level:4, xp:1100, coins:1600, desc:'Polymer-bodied German rifle with a stable, accurate action.' },
  { id:'m16', name:'M16A2', cat:'primary', cal:'556', type:'Assault Rifle', dmg:31, rpm:750, mag:30, reload:2.4, range:1000, spread:2, speed:2000, weight:3.8, pen:1.6, burst:3, level:3, xp:800, coins:1200, desc:'Full-length 5.56mm rifle firing 3-round bursts. Long reach.' },
  { id:'famas', name:'FAMAS', cat:'primary', cal:'556', type:'Assault Rifle', dmg:25, rpm:1000, mag:25, reload:2.4, range:850, spread:3.2, speed:1850, weight:3.6, pen:1.4, auto:true, level:5, xp:1500, coins:2000, desc:'French bullpup with a blistering rate of fire.' },
  { id:'ak47', name:'AK-47', cat:'primary', cal:'762x39', type:'Assault Rifle', dmg:33, rpm:600, mag:30, reload:2.5, range:880, spread:4.5, speed:1750, weight:3.9, pen:1.8, auto:true, level:6, xp:1800, coins:2500, desc:'Hard-hitting 7.62x39mm rifle. Kicks hard, punches through cover.' },
  { id:'aug', name:'Steyr AUG', cat:'primary', cal:'556', type:'Assault Rifle', dmg:28, rpm:720, mag:30, reload:2.4, range:950, spread:2.2, speed:1950, weight:3.6, pen:1.5, auto:true, level:8, xp:2600, coins:3500, desc:'Austrian bullpup with integrated optic. Very accurate.' },
  { id:'hk416', name:'HK416', cat:'primary', cal:'556', type:'Assault Rifle', dmg:28, rpm:850, mag:30, reload:2.1, range:950, spread:2.5, speed:1950, weight:3.5, pen:1.6, auto:true, level:9, xp:3000, coins:4000, desc:'Piston-driven 5.56mm rifle favoured by special forces.' },
  { id:'scar', name:'FN SCAR-H', cat:'primary', cal:'762x51', type:'Battle Rifle', dmg:38, rpm:600, mag:20, reload:2.5, range:1050, spread:2.8, speed:2050, weight:3.6, pen:2.2, auto:true, level:14, xp:5500, coins:7000, desc:'7.62mm NATO battle rifle. Heavy hitting at all ranges.' },
  { id:'m14', name:'M14 Rifle', cat:'primary', cal:'762x51', type:'Marksman Rifle', dmg:55, rpm:300, mag:20, reload:2.6, range:1300, spread:1.2, speed:2200, weight:4.5, pen:2.5, auto:false, level:11, xp:4000, coins:5000, desc:'Semi-automatic 7.62mm marksman rifle. Penetrates light walls.' },
  // Shotguns
  { id:'r870', name:'Remington 870', cat:'primary', cal:'12ga', type:'Shotgun', dmg:14, pellets:8, rpm:70, mag:6, reload:3.5, range:440, spread:14, speed:1400, weight:3.6, pen:0.5, auto:false, level:2, xp:500, coins:800, desc:'Classic 12-gauge pump action. Devastating up close.' },
  { id:'spas12', name:'Franchi SPAS-12', cat:'primary', cal:'12ga', type:'Shotgun', dmg:13, pellets:9, rpm:110, mag:8, reload:4.0, range:450, spread:13, speed:1400, weight:4.4, pen:0.5, auto:false, level:7, xp:2200, coins:3000, desc:'Italian combat shotgun with a fast pump cycle.' },
  { id:'m1014', name:'Benelli M4 (M1014)', cat:'primary', cal:'12ga', type:'Shotgun', dmg:13, pellets:8, rpm:200, mag:7, reload:3.8, range:460, spread:13, speed:1450, weight:3.8, pen:0.5, auto:false, level:10, xp:3500, coins:4500, desc:'Semi-automatic military shotgun. Fire as fast as you can pull.' },
  { id:'aa12', name:'AA-12', cat:'primary', cal:'12ga', type:'Shotgun', dmg:11, pellets:8, rpm:300, mag:20, reload:3.5, range:415, spread:15, speed:1400, weight:5.2, pen:0.5, auto:true, level:20, xp:9000, coins:11000, desc:'Fully automatic drum-fed shotgun. A wall of buckshot.' },
  // Snipers
  { id:'mosin', name:'Mosin-Nagant', cat:'primary', norail:true, cal:'762x54', type:'Sniper Rifle', dmg:85, rpm:45, mag:5, reload:3.5, range:1600, spread:0.5, speed:2400, weight:4.0, pen:2.5, auto:false, scope:true, level:4, xp:1200, coins:1800, desc:'WWII-era bolt-action. Slow but lethal.' },
  { id:'m24', name:'M24 SWS', cat:'primary', cal:'762x51', type:'Sniper Rifle', dmg:95, rpm:45, mag:5, reload:3.2, range:1700, spread:0.4, speed:2500, weight:5.4, pen:2.8, auto:false, scope:true, level:12, xp:4500, coins:6000, desc:'US Army bolt-action sniper system based on the Remington 700.' },
  { id:'svd', name:'Dragunov SVD', cat:'primary', cal:'762x54', type:'Sniper Rifle', dmg:70, rpm:180, mag:10, reload:2.8, range:1500, spread:1.0, speed:2300, weight:4.3, pen:2.6, auto:false, scope:true, level:16, xp:6500, coins:8000, desc:'Semi-automatic Soviet designated marksman rifle.' },
  { id:'awm', name:'Accuracy Intl. AWM', cat:'primary', cal:'338', type:'Sniper Rifle', dmg:115, rpm:40, mag:5, reload:3.5, range:1900, spread:0.3, speed:2700, weight:6.5, pen:3.2, auto:false, scope:true, level:24, xp:11000, coins:14000, desc:'.338 Lapua Magnum bolt-action. One shot, one kill.' },
  { id:'m82', name:'Barrett M82', cat:'primary', cal:'50bmg', type:'Anti-Materiel Rifle', dmg:150, rpm:90, mag:10, reload:4.0, range:2200, spread:0.5, speed:2800, weight:14.0, pen:4.5, auto:false, scope:true, level:35, xp:20000, coins:25000, desc:'.50 BMG anti-materiel rifle. Shoots through brick walls.' },
  // LMG
  { id:'rpk', name:'RPK', cat:'primary', cal:'762x39', type:'Light Machine Gun', dmg:32, rpm:600, mag:75, reload:4.5, range:950, spread:5, speed:1800, weight:4.8, pen:1.8, auto:true, level:13, xp:5000, coins:6500, desc:'Heavy-barrel AK with a 75-round drum.' },
  { id:'m249', name:'M249 SAW', cat:'primary', cal:'556', type:'Light Machine Gun', dmg:26, rpm:850, mag:100, reload:5.5, range:950, spread:5.5, speed:1900, weight:7.5, pen:2.0, auto:true, level:15, xp:6000, coins:7500, desc:'Belt-fed 5.56mm squad automatic weapon.' },
  { id:'m60', name:'M60', cat:'primary', cal:'762x51', type:'Light Machine Gun', dmg:34, rpm:550, mag:100, reload:6.0, range:1000, spread:5, speed:2000, weight:10.5, pen:2.5, auto:true, level:18, xp:8000, coins:10000, desc:'"The Pig". 7.62mm general-purpose machine gun.' },
  { id:'pkm', name:'PKM', cat:'primary', cal:'762x54', type:'Light Machine Gun', dmg:34, rpm:650, mag:100, reload:5.8, range:1000, spread:5, speed:2000, weight:7.5, pen:2.5, auto:true, level:21, xp:9500, coins:12000, desc:'Russian 7.62x54mmR machine gun. Lighter than the M60.' },
  // HMG
  { id:'m2hb', name:'M2 Browning', cat:'primary', cal:'50bmg', type:'Heavy Machine Gun', dmg:60, rpm:500, mag:100, reload:8.0, range:1400, spread:4, speed:2400, weight:38.0, pen:4.5, auto:true, level:40, xp:25000, coins:30000, desc:'"Ma Deuce" .50 cal. Shreds walls and vehicles. Crushingly heavy.' },
  { id:'m134', name:'M134 Minigun', cat:'primary', cal:'762x51', type:'Heavy Machine Gun', dmg:28, rpm:3000, mag:500, reload:10.0, range:1000, spread:7, speed:2000, weight:39.0, pen:3.0, auto:true, spinup:0.6, level:45, xp:30000, coins:38000, desc:'Six-barrel rotary gun. Spins up, then saws through everything.' },
  // Flamethrowers
  { id:'lpo50', name:'LPO-50', cat:'primary', cal:'fuel', type:'Flamethrower', dmg:7, rpm:900, mag:120, reload:5.0, range:220, spread:9, speed:420, weight:23.0, pen:0, auto:true, flame:true, level:17, xp:7000, coins:9000, desc:'Soviet flamethrower. Ignites people, plants and wooden structures.' },
  { id:'m2flame', name:'M2 Flamethrower', cat:'primary', cal:'fuel', type:'Flamethrower', dmg:8, rpm:900, mag:150, reload:5.5, range:260, spread:9, speed:460, weight:30.0, pen:0, auto:true, flame:true, level:27, xp:13000, coins:16000, desc:'US WWII flamethrower with a longer reach.' },
  // Launchers
  { id:'m32', name:'Milkor M32 MGL', cat:'primary', cal:'40mm', type:'Grenade Launcher', dmg:110, blast:90, rpm:120, mag:6, reload:6.0, range:700, spread:2, speed:700, weight:5.3, pen:0, auto:false, explosive:true, lob:true, level:30, xp:16000, coins:20000, desc:'Six-shot 40mm revolver grenade launcher.' },
  { id:'rpg7', name:'RPG-7', cat:'primary', cal:'pg7', type:'Rocket Launcher', dmg:160, blast:120, rpm:20, mag:1, reload:3.5, range:1100, spread:1.5, speed:900, weight:7.0, pen:0, auto:false, explosive:true, rocket:true, level:32, xp:18000, coins:22000, desc:'Shoulder-fired rocket launcher. Demolishes buildings.' },
]);

// ---------------------------------------------------------------- sidearms
def([
  { id:'glock20', name:'Glock 20', cat:'sidearm', cal:'10mm', type:'Pistol', dmg:24, rpm:400, mag:15, reload:1.6, range:650, spread:3, speed:1500, weight:1.1, pen:0.6, auto:false, level:1, xp:0, coins:0, desc:'10mm Auto polymer pistol. Standard issue sidearm.' },
  { id:'makarov', name:'Makarov PM', cat:'sidearm', cal:'9x18', type:'Pistol', dmg:18, rpm:400, mag:8, reload:1.5, range:550, spread:3.5, speed:1300, weight:0.73, pen:0.4, auto:false, level:1, xp:200, coins:300, desc:'Small Soviet service pistol. Light but weak.' },
  { id:'m9', name:'Beretta M9', cat:'sidearm', cal:'9mm', type:'Pistol', dmg:22, rpm:400, mag:15, reload:1.7, range:620, spread:2.8, speed:1450, weight:0.95, pen:0.5, auto:false, level:2, xp:400, coins:600, desc:'US military 9mm pistol for over 30 years.' },
  { id:'m1911', name:'M1911', cat:'sidearm', cal:'45acp', type:'Pistol', dmg:30, rpm:350, mag:7, reload:1.7, range:600, spread:3, speed:1300, weight:1.1, pen:0.6, auto:false, level:3, xp:700, coins:1000, desc:'.45 ACP legend. Slow, heavy rounds.' },
  { id:'p226', name:'SIG Sauer P226', cat:'sidearm', cal:'9mm', type:'Pistol', dmg:23, rpm:420, mag:15, reload:1.6, range:650, spread:2.4, speed:1500, weight:0.96, pen:0.5, auto:false, level:6, xp:1500, coins:2000, desc:'Accurate, dependable 9mm. Navy SEAL favourite.' },
  { id:'deagle', name:'Desert Eagle', cat:'sidearm', cal:'50ae', type:'Pistol', dmg:48, rpm:200, mag:7, reload:2.0, range:700, spread:4, speed:1600, weight:2.0, pen:1.2, auto:false, level:19, xp:7500, coins:9000, desc:'.50 AE hand cannon. Brutal recoil, brutal damage.' },
  { id:'nagant', name:'Nagant M1895', cat:'sidearm', norail:true, cal:'762x38r', type:'Revolver', dmg:26, rpm:180, mag:7, reload:3.0, range:600, spread:2.5, speed:1300, weight:0.8, pen:0.6, auto:false, level:3, xp:600, coins:900, desc:'Seven-shot gas-seal revolver.' },
  { id:'python', name:'Colt Python', cat:'sidearm', cal:'357', type:'Revolver', dmg:42, rpm:160, mag:6, reload:2.8, range:700, spread:2, speed:1550, weight:1.2, pen:1.0, auto:false, level:10, xp:3500, coins:4500, desc:'.357 Magnum revolver with a superb trigger.' },
  { id:'mod29', name:'S&W Model 29', cat:'sidearm', cal:'44mag', type:'Revolver', dmg:50, rpm:140, mag:6, reload:3.0, range:720, spread:2.4, speed:1600, weight:1.4, pen:1.2, auto:false, level:15, xp:6000, coins:7500, desc:'.44 Magnum. "The most powerful handgun in the world."' },
  { id:'uzi', name:'Uzi', cat:'sidearm', cal:'9mm', type:'Submachine Gun', dmg:17, rpm:600, mag:32, reload:2.0, range:550, spread:6, speed:1300, weight:3.5, pen:0.5, auto:true, level:2, xp:600, coins:900, desc:'Israeli open-bolt 9mm SMG.' },
  { id:'mp5', name:'HK MP5', cat:'sidearm', cal:'9mm', type:'Submachine Gun', dmg:19, rpm:800, mag:30, reload:2.0, range:600, spread:3.5, speed:1400, weight:2.5, pen:0.5, auto:true, level:5, xp:1400, coins:2000, desc:'Roller-delayed 9mm SMG. Smooth and precise.' },
  { id:'thompson', name:'Thompson M1928', cat:'sidearm', norail:true, cal:'45acp', type:'Submachine Gun', dmg:21, rpm:700, mag:30, reload:2.4, range:560, spread:5, speed:1250, weight:4.9, pen:0.6, auto:true, level:6, xp:1700, coins:2300, desc:'The "Tommy Gun". .45 ACP stopping power.' },
  { id:'mp7', name:'HK MP7', cat:'sidearm', cal:'46x30', type:'Submachine Gun', dmg:18, rpm:950, mag:40, reload:2.0, range:650, spread:3.5, speed:1700, weight:1.9, pen:1.0, auto:true, level:12, xp:4500, coins:6000, desc:'4.6mm PDW designed to defeat body armour.' },
  { id:'p90', name:'FN P90', cat:'sidearm', cal:'57x28', type:'Submachine Gun', dmg:18, rpm:900, mag:50, reload:2.6, range:650, spread:4, speed:1700, weight:2.6, pen:0.9, auto:true, level:14, xp:5200, coins:6800, desc:'Futuristic bullpup PDW with a 50-round top magazine.' },
  { id:'vector', name:'KRISS Vector', cat:'sidearm', cal:'45acp', type:'Submachine Gun', dmg:19, rpm:1200, mag:25, reload:1.9, range:560, spread:3.8, speed:1350, weight:2.7, pen:0.6, auto:true, level:22, xp:10000, coins:13000, desc:'Recoil-mitigating .45 SMG with an insane fire rate.' },
]);

// ---------------------------------------------------------------- melee
def([
  { id:'fists', name:'Fists', cat:'melee', type:'Unarmed', dmg:15, rate:2.0, reach:42, weight:0, level:1, xp:0, coins:0, noImage:true, desc:'Bare knuckles. Better than nothing.' },
  { id:'kabar', name:'KA-BAR Knife', cat:'melee', type:'Knife', dmg:45, rate:1.8, reach:50, weight:0.3, level:1, xp:150, coins:200, desc:'USMC fighting knife.' },
  { id:'bayonet', name:'M9 Bayonet', cat:'melee', type:'Knife', dmg:50, rate:1.7, reach:52, weight:0.4, level:4, xp:1000, coins:1400, desc:'Multi-purpose bayonet with a wire-cutter scabbard.' },
  { id:'etool', name:'Entrenching Tool', cat:'melee', type:'Club', dmg:55, rate:1.2, reach:60, weight:1.0, level:5, xp:1300, coins:1800, desc:'A sharpened folding shovel. Brutal in the trenches.' },
  { id:'machete', name:'Machete', cat:'melee', type:'Blade', dmg:60, rate:1.3, reach:62, weight:0.6, level:7, xp:2000, coins:2800, desc:'Long chopping blade. Clears jungle and enemies.' },
  { id:'trenchclub', name:'Trench Club', cat:'melee', type:'Club', dmg:70, rate:1.1, reach:58, weight:1.2, level:9, xp:2900, coins:3800, desc:'WWI improvised raiding club studded with hobnails.' },
  { id:'axe', name:'Fire Axe', cat:'melee', type:'Axe', dmg:85, rate:0.9, reach:64, weight:2.7, level:13, xp:4800, coins:6200, desc:'Heavy axe. Also chops through wooden walls.', breaker:2 },
  { id:'katana', name:'Katana', cat:'melee', type:'Sword', dmg:90, rate:1.2, reach:72, weight:1.1, level:20, xp:9000, coins:11000, desc:'Japanese longsword. Long reach, lightning fast cuts.' },
  { id:'sledge', name:'Sledgehammer', cat:'melee', type:'Hammer', dmg:110, rate:0.6, reach:66, weight:4.5, level:25, xp:11500, coins:14500, desc:'Slow swing that smashes through brick.', breaker:4 },
]);

// ---------------------------------------------------------------- armour
def([
  { id:'noarmor', name:'No Armour', cat:'armor', type:'None', reduce:0, blast:0, weight:0, level:1, xp:0, coins:0, noImage:true, desc:'Just your fatigues.' },
  { id:'vest', name:'Kevlar Vest (IIIA)', cat:'armor', type:'Soft Armour', reduce:15, blast:10, weight:2.3, level:2, xp:500, coins:700, desc:'Concealable soft armour. Stops pistol rounds and fragments.' },
  { id:'mtv', name:'Modular Tactical Vest', cat:'armor', type:'Plate Carrier', reduce:25, blast:20, weight:4.5, level:8, xp:2500, coins:3200, desc:'Plate carrier with ballistic inserts front and back.' },
  { id:'interceptor', name:'Interceptor Body Armour', cat:'armor', type:'Plate Armour', reduce:30, blast:25, weight:7.5, level:12, xp:4500, coins:6000, desc:'Kevlar vest with SAPI ceramic plates.' },
  { id:'iotv', name:'Improved Outer Tactical Vest', cat:'armor', type:'Plate Armour', reduce:38, blast:32, weight:9.0, level:18, xp:8000, coins:10000, desc:'Full-coverage modern armour with side plates.' },
  { id:'eod', name:'EOD Bomb Suit', cat:'armor', type:'Bomb Suit', reduce:55, blast:80, weight:36.0, level:30, xp:15000, coins:19000, desc:'Bomb disposal suit. Shrugs off explosions, barely walks.' },
]);

// ---------------------------------------------------------------- utilities
def([
  { id:'m61', name:'M61 Frag Grenade', cat:'utility', type:'Grenade', dmg:100, blast:100, fuse:3.0, weight:0.45, level:1, xp:0, coins:0, kind:'frag', desc:'Fragmentation grenade with a safety clip. 3 second fuse.' },
  { id:'rgd5', name:'RGD-5 Grenade', cat:'utility', type:'Grenade', dmg:90, blast:95, fuse:3.4, weight:0.31, level:3, xp:600, coins:300, kind:'frag', desc:'Light Soviet frag. Can be thrown further.' },
  { id:'mk2', name:'Mk 2 "Pineapple"', cat:'utility', type:'Grenade', dmg:95, blast:105, fuse:4.0, weight:0.6, level:5, xp:1400, coins:600, kind:'frag', desc:'WWII cast-iron grenade. Long fuse, big boom.' },
  { id:'m67', name:'M67 Frag Grenade', cat:'utility', type:'Grenade', dmg:115, blast:110, fuse:3.0, weight:0.4, level:9, xp:3000, coins:1000, kind:'frag', desc:'Modern US frag. 15 m casualty radius.' },
  { id:'smoke', name:'Smoke Grenade', cat:'utility', type:'Tactical', fuse:1.5, weight:0.5, level:2, xp:400, coins:250, kind:'smoke', desc:'Creates a thick smoke screen that blocks sight lines.' },
  { id:'flash', name:'Stun Grenade', cat:'utility', type:'Tactical', fuse:1.8, blast:190, weight:0.4, level:4, xp:1000, coins:400, kind:'flash', desc:'Blinds and deafens everyone nearby for a few seconds.' },
  { id:'molotov', name:'Molotov Cocktail', cat:'utility', type:'Incendiary', dmg:12, blast:80, weight:0.7, level:6, xp:1600, coins:500, kind:'molotov', desc:'Bursts into a pool of fire on impact. Burns wood and plants.' },
  { id:'claymore', name:'M18 Claymore', cat:'utility', type:'Mine', dmg:130, blast:150, weight:1.6, level:14, xp:5000, coins:2000, kind:'claymore', desc:'Directional mine. Placed facing your aim; triggers on enemies.' },
  { id:'c4', name:'C-4 Charge', cat:'utility', type:'Explosive', dmg:190, blast:140, weight:0.6, level:16, xp:6000, coins:2500, kind:'c4', desc:'Throw it, then press the key again to detonate. Levels walls.' },
  { id:'bandage', name:'Emergency Bandage', cat:'utility', type:'Medical', heal:25, useTime:1.0, weight:0.1, level:1, xp:100, coins:80, kind:'heal', desc:'Pressure bandage. Restores 25 HP.' },
  { id:'medkit', name:'First Aid Kit', cat:'utility', type:'Medical', heal:30, useTime:3.0, weight:1.0, level:1, xp:200, coins:150, kind:'heal', desc:'Field medical kit. Restores 30 HP over 3 seconds.' },
  { id:'adrenaline', name:'Adrenaline Autoinjector', cat:'utility', type:'Medical', heal:15, useTime:0.5, boost:6, weight:0.1, level:8, xp:2500, coins:900, kind:'heal', desc:'Restores 15 HP and boosts speed by 30% for 6 seconds.' },
]);

// ---------------------------------------------------------------- night gear (head-mounted optics)
// vision: 'nv' image intensifier, 'ir' thermal, 'fused' both. range = how far you can see in the dark (px)
def([
  { id:'nogear', name:'No Night Gear', cat:'gear', type:'None', weight:0, level:1, xp:0, coins:0, noImage:true, desc:'Naked eyes and a weapon light. At night you only see what is lit.' },
  { id:'pvs7', name:'AN/PVS-7 NVG', cat:'gear', type:'Night Vision (Gen 2+)', vision:'nv', range:560, weight:0.68, level:6, xp:1800, coins:2400, desc:'Single-tube binocular night vision goggles. Amplifies moon and star light into a green image.' },
  { id:'pvs14', name:'AN/PVS-14 Monocular', cat:'gear', type:'Night Vision (Gen 3)', vision:'nv', range:720, weight:0.35, level:12, xp:4500, coins:5500, desc:'Gen 3 night vision monocular. Brighter, sharper and lighter than the PVS-7.' },
  { id:'gpnvg18', name:'GPNVG-18 Panoramic NVG', cat:'gear', type:'Night Vision (Gen 3, panoramic)', vision:'nv', range:950, wide:true, weight:0.88, level:24, xp:11000, coins:15000, desc:'Four-tube panoramic goggles with a 97° field of view. No tunnel vision.' },
  { id:'pas13', name:'AN/PAS-13 Thermal Sight', cat:'gear', type:'Infrared (thermal)', vision:'ir', range:800, weight:1.6, level:16, xp:6500, coins:8500, desc:'Thermal imager. Body heat glows white through darkness, smoke and foliage. Works in daylight too.' },
  { id:'psq20', name:'AN/PSQ-20 ENVG', cat:'gear', type:'Fused Night Vision + Thermal', vision:'fused', range:900, weight:1.0, level:34, xp:19000, coins:26000, desc:'Enhanced night vision goggle that overlays thermal outlines on a night vision image.' },
]);

// ---------------------------------------------------------------- WWII & extra weapons, utilities, armour
// norail: no accessory rail (period guns) -> no optics, grips or lasers
def([
  { id:'stg44', name:'StG 44', cat:'primary', cal:'792x33', type:'Assault Rifle', dmg:30, rpm:550, mag:30, reload:2.6, range:850, spread:3.6, speed:1700, weight:4.6, pen:1.6, auto:true, norail:true, level:7, xp:2400, coins:3200, desc:'WWII German Sturmgewehr. The first true assault rifle.' },
  { id:'ak12', name:'AK-12', cat:'primary', cal:'545x39', type:'Assault Rifle', dmg:27, rpm:700, mag:30, reload:2.3, range:930, spread:2.6, speed:1900, weight:3.5, pen:1.7, auto:true, level:16, xp:6500, coins:8200, desc:'Modern Russian 5.45mm rifle with full-length rails.' },
  { id:'garand', name:'M1 Garand', cat:'primary', cal:'3006', type:'Marksman Rifle', dmg:48, rpm:320, mag:8, reload:2.2, range:1200, spread:1.5, speed:2100, weight:4.4, pen:2.3, auto:false, norail:true, level:6, xp:2000, coins:2800, desc:'Semi-automatic .30-06 service rifle. Eight rounds and a ping.' },
  { id:'mk14', name:'Mk 14 EBR', cat:'primary', cal:'762x51', type:'Marksman Rifle', dmg:52, rpm:420, mag:20, reload:2.5, range:1300, spread:1.1, speed:2200, weight:5.1, pen:2.5, auto:false, level:19, xp:8000, coins:10500, desc:'Enhanced Battle Rifle: an M14 in a modern railed chassis.' },
  { id:'enfield', name:'Lee-Enfield No. 4', cat:'primary', cal:'303', type:'Marksman Rifle', dmg:72, rpm:70, mag:10, reload:3.2, range:1400, spread:0.8, speed:2200, weight:4.1, pen:2.4, auto:false, norail:true, level:5, xp:1600, coins:2200, desc:'British bolt-action with a famously fast action and a 10-round magazine.' },
  { id:'k98k', name:'Karabiner 98k', cat:'primary', cal:'792x57', type:'Sniper Rifle', dmg:88, rpm:45, mag:5, reload:3.4, range:1600, spread:0.5, speed:2350, weight:4.1, pen:2.6, auto:false, scope:true, norail:true, level:8, xp:2700, coins:3600, desc:'German Mauser bolt-action with a ZF 39 scope.' },
  { id:'bar', name:'M1918 BAR', cat:'primary', cal:'3006', type:'Light Machine Gun', dmg:40, rpm:550, mag:20, reload:3.0, range:1000, spread:4, speed:2000, weight:8.8, pen:2.3, auto:true, norail:true, level:11, xp:3800, coins:5000, desc:'Browning Automatic Rifle. Heavy, hard-hitting squad automatic.' },
  { id:'mg42', name:'MG 42', cat:'primary', cal:'792x57', type:'Light Machine Gun', dmg:36, rpm:1200, mag:50, reload:5.5, range:1000, spread:6, speed:2000, weight:11.6, pen:2.5, auto:true, norail:true, level:23, xp:10500, coins:13500, desc:'"Hitler\'s buzzsaw". A terrifying 1,200 rounds per minute.' },
  { id:'luger', name:'Luger P08', cat:'sidearm', cal:'9mm', type:'Pistol', dmg:22, rpm:400, mag:8, reload:1.8, range:600, spread:2.6, speed:1400, weight:0.87, pen:0.5, auto:false, norail:true, level:3, xp:600, coins:900, desc:'Toggle-locked German officer\'s pistol.' },
  { id:'p38', name:'Walther P38', cat:'sidearm', cal:'9mm', type:'Pistol', dmg:22, rpm:420, mag:8, reload:1.7, range:610, spread:2.8, speed:1400, weight:0.8, pen:0.5, auto:false, norail:true, level:4, xp:900, coins:1200, desc:'Double-action wartime 9mm pistol.' },
  { id:'glock18', name:'Glock 18C', cat:'sidearm', cal:'9mm', type:'Pistol', dmg:20, rpm:1100, mag:19, reload:1.6, range:560, spread:4.5, speed:1400, weight:0.9, pen:0.5, auto:true, level:13, xp:4800, coins:6400, desc:'Select-fire machine pistol. Empties a magazine in a second.' },
  { id:'mp40', name:'MP 40', cat:'sidearm', cal:'9mm', type:'Submachine Gun', dmg:19, rpm:550, mag:32, reload:2.3, range:560, spread:4, speed:1300, weight:4.0, pen:0.5, auto:true, norail:true, level:4, xp:1100, coins:1600, desc:'German WWII submachine gun with a folding stock.' },
  { id:'sten', name:'Sten Mk II', cat:'sidearm', cal:'9mm', type:'Submachine Gun', dmg:18, rpm:550, mag:32, reload:2.2, range:520, spread:5, speed:1250, weight:3.2, pen:0.5, auto:true, norail:true, level:2, xp:500, coins:700, desc:'Cheap, crude and effective British SMG.' },
  { id:'trenchknife', name:'Mk I Trench Knife', cat:'melee', type:'Knife', dmg:55, rate:1.8, reach:48, weight:0.45, level:3, xp:700, coins:900, desc:'WWI knuckle-duster knife. Fast and nasty.' },
  { id:'flakvest', name:'M1952 Flak Vest', cat:'armor', type:'Flak Jacket', reduce:18, blast:30, weight:3.6, level:3, xp:700, coins:1000, desc:'Nylon and fibreglass vest. Better against shrapnel than bullets.' },
  { id:'stick', name:'Model 24 Stick Grenade', cat:'utility', type:'Grenade', dmg:95, blast:100, fuse:4.5, weight:0.6, level:4, xp:900, coins:500, kind:'frag', throwSpeed:760, desc:'German "potato masher". The handle lets you throw it much further.' },
  { id:'thermite', name:'AN-M14 Thermite Grenade', cat:'utility', type:'Incendiary', dmg:14, blast:70, fuse:2.0, weight:0.9, level:10, xp:3200, coins:1200, kind:'thermite', desc:'Burns at 2,200 °C for 40 seconds worth of fun: a long, hot fire on the spot where it lands.' },
  { id:'gas', name:'CS Gas Grenade', cat:'utility', type:'Tactical', fuse:1.5, weight:0.5, level:7, xp:2200, coins:700, kind:'gas', desc:'Tear gas cloud. Hurts slowly, blurs vision and slows anyone without a mask.' },
  { id:'satchel', name:'Satchel Charge', cat:'utility', type:'Explosive', dmg:240, blast:170, fuse:5.0, weight:2.5, level:20, xp:9000, coins:3500, kind:'satchel', throwSpeed:380, desc:'Heavy demolition charge on a 5 second fuse. Flattens buildings.' },
  { id:'mine', name:'M16 "Bouncing Betty" Mine', cat:'utility', type:'Mine', dmg:140, blast:110, weight:3.5, level:12, xp:4200, coins:1800, kind:'mine', desc:'Buried anti-personnel mine. Triggers on any enemy that steps close, in every direction.' },
]);

// ---------------------------------------------------------------- attachments
// slot: optic, muzzle, under, mag, laser. fits(gun) decides compatibility.
const ATT_SLOTS = [['optic', 'Optic'], ['muzzle', 'Muzzle'], ['under', 'Underbarrel'], ['mag', 'Magazine'], ['laser', 'Laser']];
const RIFLES = ['Assault Rifle', 'Battle Rifle', 'Marksman Rifle', 'Light Machine Gun'];
const PISTOL_CALS = ['9mm', '10mm', '9x18', '45acp', '46x30', '57x28'], CAL_556 = ['556', '545x39'], CAL_762 = ['762x39', '762x51', '762x54', '792x57', '3006', '338', '792x33', '303'];
const railed = g => !g.norail && !g.explosive && !g.flame;
const ATT_FITS = {
  rifleOptic: g => railed(g) && (RIFLES.includes(g.type) || g.type === 'Submachine Gun' || g.type === 'Shotgun'),
  magnified: g => railed(g) && RIFLES.includes(g.type),
  pistolOptic: g => railed(g) && g.type === 'Pistol',
  sniperOptic: g => !g.norail && (g.type === 'Sniper Rifle' || g.type === 'Anti-Materiel Rifle'),
  thermalOptic: g => railed(g) && (RIFLES.includes(g.type) || g.type === 'Sniper Rifle' || g.type === 'Anti-Materiel Rifle'),
  pso: g => ['ak47', 'rpk', 'ak12', 'svd'].includes(g.id),
  suppPistol: g => !g.explosive && PISTOL_CALS.includes(g.cal) && g.type !== 'Revolver',
  supp556: g => CAL_556.includes(g.cal) && !g.explosive,
  supp762: g => CAL_762.includes(g.cal) && !g.explosive && g.type !== 'Revolver',
  comp: g => !g.explosive && !g.flame && ['Assault Rifle', 'Battle Rifle', 'Submachine Gun', 'Pistol'].includes(g.type),
  brake: g => ['Sniper Rifle', 'Anti-Materiel Rifle', 'Battle Rifle', 'Marksman Rifle'].includes(g.type),
  flashhider: g => RIFLES.includes(g.type) && !g.explosive,
  grip: g => railed(g) && (RIFLES.includes(g.type) || g.type === 'Submachine Gun' || g.type === 'Shotgun'),
  bipod: g => ['Marksman Rifle', 'Sniper Rifle', 'Light Machine Gun', 'Battle Rifle', 'Anti-Materiel Rifle'].includes(g.type) && !g.explosive,
  extmag: g => ['Assault Rifle', 'Battle Rifle', 'Marksman Rifle', 'Submachine Gun', 'Pistol'].includes(g.type) && !g.burst || g.id === 'm16',
  drum: g => ['Assault Rifle', 'Submachine Gun'].includes(g.type),
  speedloader: g => g.type === 'Revolver',
  shells: g => g.type === 'Shotgun' && !g.auto,
  laser: g => railed(g) && g.type !== 'Revolver' && !['Sniper Rifle', 'Anti-Materiel Rifle', 'Heavy Machine Gun'].includes(g.type),
};
def([
  { id:'reddot', name:'Aimpoint CompM4 Red Dot', slot:'optic', fit:'rifleOptic', adsSpread:0.85, adsFov:62, reticle:'dot', weight:0.26, level:3, xp:600, coins:900, desc:'Rifle red dot sight. Faster, steadier aiming at close and medium range.' },
  { id:'holo', name:'EOTech EXPS3 Holographic', slot:'optic', fit:'rifleOptic', adsSpread:0.8, adsFov:60, reticle:'holo', weight:0.32, level:7, xp:1600, coins:2200, desc:'Holographic sight with a large window and a ring reticle.' },
  { id:'rmr', name:'Trijicon RMR Pistol Dot', slot:'optic', fit:'pistolOptic', adsSpread:0.8, adsFov:62, reticle:'dot', weight:0.05, level:5, xp:900, coins:1300, desc:'Miniature red dot for slide-mounted pistols. Does not fit rifles.' },
  { id:'acog', name:'Trijicon ACOG 4x', slot:'optic', fit:'magnified', adsSpread:0.6, adsFov:22, scopeKind:'acog', adsSpeed:0.85, weight:0.45, level:12, xp:3500, coins:5000, desc:'4x combat scope for rifles and machine guns.' },
  { id:'pso', name:'PSO-1 4x Scope', slot:'optic', fit:'pso', adsSpread:0.6, adsFov:22, scopeKind:'acog', adsSpeed:0.85, weight:0.58, level:10, xp:2800, coins:3800, desc:'Soviet side-rail scope. Only fits AK-pattern rifles and the SVD.' },
  { id:'sniper8', name:'Leupold Mark 5 8x', slot:'optic', fit:'sniperOptic', adsSpread:0.75, adsFov:11, scopeKind:'sniper', weight:0.9, level:18, xp:7000, coins:9500, desc:'High-power sniper scope. Replaces the stock scope with a stronger zoom.' },
  { id:'thermscope', name:'FLIR ThermoSight', slot:'optic', fit:'thermalOptic', adsSpread:0.7, adsFov:26, scopeKind:'acog', thermalSight:true, weight:1.2, level:28, xp:14000, coins:20000, desc:'Thermal weapon sight. Bodies glow white through smoke and darkness while you aim.' },
  { id:'supp9', name:'Pistol / SMG Suppressor', slot:'muzzle', fit:'suppPistol', suppressed:true, dmgMul:0.93, rangeMul:0.9, weight:0.2, level:6, xp:1500, coins:2000, desc:'Quiets pistol-calibre shots: no minimap ping, no muzzle flash, short sound range. Slight loss of power.' },
  { id:'supp556', name:'5.56 Rifle Suppressor', slot:'muzzle', fit:'supp556', suppressed:true, dmgMul:0.95, rangeMul:0.92, weight:0.5, level:11, xp:3600, coins:4800, desc:'Suppressor for 5.56 and 5.45 rifles.' },
  { id:'supp762', name:'7.62 Rifle Suppressor', slot:'muzzle', fit:'supp762', suppressed:true, dmgMul:0.95, rangeMul:0.92, weight:0.6, level:15, xp:5800, coins:7500, desc:'Suppressor for full-power rifle calibres.' },
  { id:'comp', name:'Compensator', slot:'muzzle', fit:'comp', spreadMul:0.9, recoilMul:0.7, weight:0.1, level:4, xp:800, coins:1100, desc:'Ported muzzle device that fights muzzle climb.' },
  { id:'brake', name:'Muzzle Brake', slot:'muzzle', fit:'brake', spreadMul:0.92, recoilMul:0.55, weight:0.2, level:9, xp:2600, coins:3400, desc:'Big-bore brake for heavy rifles. Much less recoil, much louder.' },
  { id:'flashhider', name:'Flash Hider', slot:'muzzle', fit:'flashhider', noFlash:true, weight:0.1, level:2, xp:400, coins:600, desc:'Hides the muzzle flash: you light up less at night.' },
  { id:'vgrip', name:'Vertical Foregrip', slot:'under', fit:'grip', spreadMul:0.85, recoilMul:0.85, weight:0.15, level:5, xp:1200, coins:1600, desc:'Better control when firing on the move.' },
  { id:'agrip', name:'Angled Foregrip', slot:'under', fit:'grip', spreadMul:0.9, adsSpeed:1.15, weight:0.1, level:8, xp:2200, coins:3000, desc:'Faster handling and aiming.' },
  { id:'bipod', name:'Harris Bipod', slot:'under', fit:'bipod', bipod:0.45, weight:0.4, level:9, xp:2500, coins:3300, desc:'Rock steady (55% less spread) when crouched or prone.' },
  { id:'extmag', name:'Extended Magazine', slot:'mag', fit:'extmag', magMul:1.5, reloadMul:1.1, weight:0.3, level:6, xp:1500, coins:2000, desc:'50% more rounds, slightly slower reloads.' },
  { id:'drum', name:'Drum Magazine', slot:'mag', fit:'drum', magMul:2.5, reloadMul:1.35, weight:1.0, level:14, xp:5200, coins:6800, desc:'Huge drum. Two and a half times the rounds, heavy and slow to reload.' },
  { id:'speedloader', name:'Speed Loader', slot:'mag', fit:'speedloader', reloadMul:0.5, weight:0.1, level:4, xp:800, coins:1000, desc:'Reloads a revolver in one go.' },
  { id:'shells', name:'Side-Saddle Shell Holder', slot:'mag', fit:'shells', reloadMul:0.75, weight:0.2, level:5, xp:1000, coins:1400, desc:'Spare shells on the receiver: faster reloads for pump shotguns.' },
  { id:'laser', name:'Visible Laser Sight', slot:'laser', fit:'laser', hipSpread:0.75, laser:'red', weight:0.15, level:4, xp:900, coins:1200, desc:'25% tighter hip fire. The red beam is visible to everyone at night.' },
  { id:'irlaser', name:'AN/PEQ-15 IR Laser', slot:'laser', fit:'laser', hipSpread:0.75, laser:'ir', weight:0.2, level:13, xp:4600, coins:6200, desc:'Infrared laser: same accuracy bonus, only visible through night vision.' },
].map(a => Object.assign(a, { cat:'attach', type:ATT_SLOTS.find(s => s[0] === a.slot)[1] })));
const attachFits = (attId, gunId) => { const a = ITEMS[attId], g = ITEMS[gunId]; return !!(a && g && a.cat === 'attach' && ATT_FITS[a.fit](g)); };
const attachmentsFor = gunId => Object.values(ITEMS).filter(a => a.cat === 'attach' && attachFits(a.id, gunId));

// ---------------------------------------------------------------- calibres & ammunition
// Every gun fires its calibre's default round for free. Other rounds are bought in the shop and only fit guns of that calibre.
const CALIBERS = {
  '556':     { name:'5.56×45mm NATO', def:'M855 Ball' },
  '762x39':  { name:'7.62×39mm', def:'57-N-231 Ball' },
  '762x51':  { name:'7.62×51mm NATO', def:'M80 Ball' },
  '762x54':  { name:'7.62×54mmR', def:'LPS Ball' },
  '338':     { name:'.338 Lapua Magnum', def:'B408 FMJ' },
  '50bmg':   { name:'.50 BMG (12.7×99mm)', def:'M33 Ball' },
  '12ga':    { name:'12 gauge', def:'00 Buckshot' },
  '40mm':    { name:'40×46mm grenade', def:'M406 HE' },
  'pg7':     { name:'PG-7 rocket', def:'PG-7V HEAT' },
  'fuel':    { name:'Flamethrower fuel', def:'Gasoline/diesel mix' },
  '9mm':     { name:'9×19mm Parabellum', def:'M882 FMJ' },
  '10mm':    { name:'10mm Auto', def:'FMJ' },
  '9x18':    { name:'9×18mm Makarov', def:'57-N-181 FMJ' },
  '45acp':   { name:'.45 ACP', def:'M1911 Ball' },
  '50ae':    { name:'.50 Action Express', def:'FMJ' },
  '762x38r': { name:'7.62×38mmR Nagant', def:'Lead round nose' },
  '357':     { name:'.357 Magnum', def:'JSP' },
  '44mag':   { name:'.44 Magnum', def:'JSP' },
  '46x30':   { name:'4.6×30mm', def:'DM11 Ball' },
  '57x28':   { name:'5.7×28mm', def:'SS190' },
  '545x39':  { name:'5.45×39mm', def:'7N6 Ball' },
  '792x33':  { name:'7.92×33mm Kurz', def:'Pist.Patr. 43 Ball' },
  '792x57':  { name:'7.92×57mm Mauser', def:'s.S. Ball' },
  '3006':    { name:'.30-06 Springfield', def:'M2 Ball' },
  '303':     { name:'.303 British', def:'Mk VII Ball' },
};
// display order (object keys like '556' would otherwise be sorted numerically first)
const CALIBER_ORDER = ['9mm', '10mm', '9x18', '45acp', '50ae', '357', '44mag', '762x38r', '46x30', '57x28', '556', '545x39', '762x39', '792x33', '762x51', '762x54', '792x57', '3006', '303', '338', '50bmg', '12ga', '40mm', 'pg7', 'fuel'];
// What each round type does (multipliers on the gun's stats). armorMul scales the target's armour reduction.
const AMMO_KINDS = {
  tracer:    { label:'Tracer', tip:'#d33', tracer:true, desc:'Burning base marks the bullet path. Easy to walk fire onto targets and glows at night, but it also gives away your position. Can ignite hay and dry plants.' },
  ap:        { label:'Armour Piercing', tip:'#111', penAdd:1.2, armorMul:0.45, dmgMul:0.92, desc:'Hardened steel or tungsten core. Punches through armour and cover, slightly less damage to soft targets.' },
  epr:       { label:'Enhanced Performance', tip:'#b9a26a', penAdd:0.6, armorMul:0.75, dmgMul:1.05, desc:'Copper slug with an exposed steel penetrator. Better against armour and cover than ball.' },
  hp:        { label:'Hollow Point', tip:'#b87333', dmgMul:1.22, armorMul:1.6, penMul:0.45, desc:'Expands on impact. Much more damage to unarmoured targets, poor against armour and cover.' },
  match:     { label:'Match', tip:'#666', spreadMul:0.55, dmgMul:1.05, rangeMul:1.1, desc:'Precision-loaded match round. Tighter groups and longer effective range.' },
  api:       { label:'Armour Piercing Incendiary', tip:'#9a2', penAdd:1.0, armorMul:0.55, incendiary:true, desc:'Steel core with an incendiary charge. Penetrates armour and sets targets and flammable cover on fire.' },
  apit:      { label:'AP Incendiary Tracer', tip:'#c33', penAdd:1.1, armorMul:0.5, incendiary:true, tracer:true, desc:'Armour piercing, incendiary and tracer in one round.' },
  raufoss:   { label:'High Explosive Incendiary AP', tip:'#2a8', penAdd:1.4, armorMul:0.4, incendiary:true, blast:40, blastDmg:45, desc:'Multipurpose round: tungsten penetrator, explosive and incendiary filler. Small explosion on impact.' },
  slug:      { label:'Slug', tip:'#555', slug:true, desc:'One solid lead projectile instead of pellets. Accurate out to long range and punches through light cover.' },
  birdshot:  { label:'Birdshot', tip:'#3a6', pelletsMul:2.5, dmgMul:0.35, spreadMul:1.35, rangeMul:0.8, penSet:0.2, desc:'Dozens of tiny pellets. Wide spread, weak and short ranged.' },
  flechette: { label:'Flechette', tip:'#ccc', pelletsMul:2.2, dmgMul:0.5, spreadMul:0.7, rangeMul:1.4, penSet:1.2, desc:'Steel darts. Tighter pattern, longer range and better penetration than buckshot.' },
  dragon:    { label:"Dragon's Breath", tip:'#e60', dragon:true, dmgMul:0.6, rangeMul:0.7, incendiary:true, desc:'Magnesium pellets that leave the barrel as a jet of fire. Ignites people and plants, lights up the night.' },
  breach:    { label:'Breaching', tip:'#888', breach:true, desc:'Frangible slug for blowing doors off hinges. Wrecks wooden walls and windows, useless past a few metres.' },
  frag12:    { label:'High Explosive', tip:'#d4b000', frag12:true, desc:'Fin-stabilised explosive 12 gauge round. Small explosion on impact.' },
  hedp:      { label:'High Explosive Dual Purpose', tip:'#d4b000', dmgMul:0.9, structMul:2.2, armorMul:0.5, desc:'Shaped charge plus fragmentation. Far better against cover and armour.' },
  buck40:    { label:'Buckshot', tip:'#222', buck40:true, desc:'40mm canister of 20 buckshot pellets. A giant shotgun at close range.' },
  illum:     { label:'Illumination', tip:'#fff', illum:true, desc:'Parachute flare that lights a large area for 25 seconds. No damage. Essential at night.' },
  smoke40:   { label:'Smoke', tip:'#7a7', smoke40:true, desc:'Ground marker smoke. Makes a smoke screen where it lands.' },
  ogfrag:    { label:'Fragmentation', tip:'#444', blastMul:1.35, dmgMul:1.1, structMul:0.4, desc:'Anti-personnel warhead. Bigger lethal radius, much weaker against buildings.' },
  tbg:       { label:'Thermobaric', tip:'#a22', blastMul:1.6, dmgMul:1.2, structMul:1.3, fire:true, desc:'Fuel-air warhead. Enormous blast that leaves fires behind.' },
  tandem:    { label:'Tandem HEAT', tip:'#333', blastMul:0.8, dmgMul:0.9, structMul:2.6, desc:'Two shaped charges in a row. Made to defeat armour: obliterates walls and cover.' },
  napalm:    { label:'Napalm', tip:'#a40', rangeMul:1.3, burnMul:1.8, dmgMul:1.1, desc:'Thickened fuel. Shoots further, sticks to targets and burns much longer.' },
};
// name, calibre, kind, level requirement, price
[
  ['556_tracer', 'M856 Tracer', '556', 'tracer', 3, 300], ['556_epr', 'M855A1 EPR', '556', 'epr', 8, 900],
  ['556_hp', 'Mk 262 Open Tip Match', '556', 'hp', 6, 700], ['556_ap', 'M995 Armour Piercing', '556', 'ap', 12, 1500],
  ['762x39_tracer', 'T-45 Tracer', '762x39', 'tracer', 4, 350], ['762x39_hp', 'JHP', '762x39', 'hp', 7, 800],
  ['762x39_ap', '7N23 Armour Piercing', '762x39', 'ap', 12, 1400], ['762x39_api', 'BZ API', '762x39', 'api', 16, 2000],
  ['762x51_tracer', 'M62 Tracer', '762x51', 'tracer', 5, 400], ['762x51_match', 'M118LR Match', '762x51', 'match', 9, 1000],
  ['762x51_hp', 'Soft Point (JSP)', '762x51', 'hp', 10, 1000], ['762x51_ap', 'M993 Armour Piercing', '762x51', 'ap', 15, 1800],
  ['762x54_tracer', 'T-46 Tracer', '762x54', 'tracer', 5, 400], ['762x54_match', '7N1 Sniper', '762x54', 'match', 11, 1100],
  ['762x54_ap', '7N13 Armour Piercing', '762x54', 'ap', 14, 1600], ['762x54_api', 'B-32 API', '762x54', 'api', 17, 2100],
  ['338_tracer', '.338 LM Tracer', '338', 'tracer', 24, 2500], ['338_hp', 'Scenar OTM', '338', 'hp', 25, 3000], ['338_ap', 'AP485 Armour Piercing', '338', 'ap', 26, 3500],
  ['50_tracer', 'M17 Tracer', '50bmg', 'tracer', 35, 3000], ['50_ap', 'M2 Armour Piercing', '50bmg', 'ap', 36, 4000], ['50_api', 'M8 API', '50bmg', 'api', 38, 5000],
  ['50_apit', 'M20 APIT', '50bmg', 'apit', 40, 6000], ['50_raufoss', 'Mk 211 Raufoss', '50bmg', 'raufoss', 45, 9000],
  ['12_birdshot', '#8 Birdshot', '12ga', 'birdshot', 2, 150], ['12_slug', 'Rifled Slug', '12ga', 'slug', 4, 400], ['12_breach', 'Breaching Round', '12ga', 'breach', 7, 700],
  ['12_flechette', 'Flechette', '12ga', 'flechette', 9, 1100], ['12_dragon', "Dragon's Breath", '12ga', 'dragon', 12, 1500], ['12_frag', 'FRAG-12 HE', '12ga', 'frag12', 22, 4000],
  ['40_smoke', 'M713 Smoke', '40mm', 'smoke40', 30, 1000], ['40_illum', 'M583A1 Illumination', '40mm', 'illum', 30, 1200],
  ['40_buck', 'M576 Buckshot', '40mm', 'buck40', 30, 2000], ['40_hedp', 'M433 HEDP', '40mm', 'hedp', 31, 2500],
  ['pg7_og', 'OG-7V Fragmentation', 'pg7', 'ogfrag', 32, 3000], ['pg7_tandem', 'PG-7VR Tandem', 'pg7', 'tandem', 36, 5000], ['pg7_tbg', 'TBG-7V Thermobaric', 'pg7', 'tbg', 38, 6000],
  ['fuel_napalm', 'Napalm', 'fuel', 'napalm', 20, 3000],
  ['9mm_hp', 'JHP', '9mm', 'hp', 2, 200], ['9mm_tracer', 'Tracer', '9mm', 'tracer', 4, 250], ['9mm_ap', '7N21 Armour Piercing', '9mm', 'ap', 9, 900],
  ['10mm_hp', 'JHP', '10mm', 'hp', 3, 250], ['9x18_ap', 'PBM Armour Piercing', '9x18', 'ap', 8, 700],
  ['45_hp', 'JHP', '45acp', 'hp', 3, 300], ['45_tracer', 'M26 Tracer', '45acp', 'tracer', 6, 400],
  ['50ae_hp', 'JHP', '50ae', 'hp', 19, 1500], ['357_hp', 'JHP', '357', 'hp', 10, 800], ['357_ap', 'KTW Armour Piercing', '357', 'ap', 14, 1500],
  ['44_hp', 'JHP', '44mag', 'hp', 15, 1200], ['46_hp', 'DM21 Action (expanding)', '46x30', 'hp', 12, 1000],
  ['57_tracer', 'L191 Tracer', '57x28', 'tracer', 14, 900], ['57_hp', 'SS197SR V-Max', '57x28', 'hp', 14, 900],
  ['545_tracer', '7T3 Tracer', '545x39', 'tracer', 16, 500], ['545_ap', '7N24 Armour Piercing', '545x39', 'ap', 18, 1600], ['545_epr', '7N10 Enhanced Penetration', '545x39', 'epr', 17, 1100],
  ['79k_tracer', 'Pist.Patr. 43 Tracer', '792x33', 'tracer', 7, 400],
  ['79m_tracer', 'S.m.K. Tracer', '792x57', 'tracer', 8, 450], ['79m_ap', 'S.m.K. Armour Piercing', '792x57', 'ap', 13, 1500], ['79m_api', 'P.m.K. Phosphor API', '792x57', 'api', 18, 2000],
  ['3006_tracer', 'M25 Tracer', '3006', 'tracer', 6, 450], ['3006_ap', 'M2 AP (black tip)', '3006', 'ap', 12, 1500], ['3006_api', 'M14 API', '3006', 'api', 17, 2000],
  ['303_tracer', 'Mk VIIG Tracer', '303', 'tracer', 5, 400], ['303_ap', 'W Mk I Armour Piercing', '303', 'ap', 11, 1400],
].forEach(([id, name, cal, kind, level, coins]) => {
  // special rounds are expensive: 10x the base price
  ITEMS[id] = { id, name, cat:'ammo', type:AMMO_KINDS[kind].label, cal, kind, level, xp:0, coins: coins * 10, weight:0, desc:AMMO_KINDS[kind].desc };
});
const gunsForCaliber = cal => Object.values(ITEMS).filter(it => it.cal === cal && it.cat !== 'ammo');
const ammoForGun = gunId => Object.values(ITEMS).filter(it => it.cat === 'ammo' && it.cal === ITEMS[gunId].cal);

const STARTING_ITEMS = ['m4', 'glock20', 'm61', 'fists', 'noarmor', 'nogear'];
const DEFAULT_LOADOUT = { primary:'m4', sidearm1:'glock20', sidearm2:null, melee:'fists', armor:'noarmor', gear:'nogear', utils:['m61','m61',null], ammo:{}, att:{} };

// Level milestones that grant a free item.
const LEVEL_REWARDS = { 3:'medkit', 5:'mp5', 8:'vest', 10:'ak47', 15:'m249', 20:'deagle', 25:'svd', 30:'m32', 35:'m82', 40:'m2hb', 50:'m134' };

const CATEGORIES = [
  { id:'primary', name:'Primary' },
  { id:'sidearm', name:'Sidearms' },
  { id:'melee', name:'Melee' },
  { id:'armor', name:'Body Armour' },
  { id:'gear', name:'Night Gear' },
  { id:'attach', name:'Attachments' },
  { id:'utility', name:'Utilities' },
];

// ---------------------------------------------------------------- camos (locker)
const CAMOS = [
  { id:'factory', name:'Factory', price:0, colors:['#2b2d2f','#3a3d40','#1d1f21'], pattern:'solid' },
  { id:'olive', name:'Olive Drab', price:0, colors:['#4b5320','#3d4419','#5a6428'], pattern:'solid' },
  { id:'desert', name:'Desert Tan', price:0, colors:['#c2a878','#a88f5f','#d6c193'], pattern:'solid' },
  { id:'woodland', name:'Woodland', price:500, colors:['#4a5a2a','#6b5a3a','#2a2a1e','#7a8a4a'], pattern:'blobs' },
  { id:'urban', name:'Urban Grey', price:500, colors:['#8a8d90','#5d6064','#b5b8bb','#3e4144'], pattern:'blobs' },
  { id:'arctic', name:'Arctic', price:800, colors:['#e8ecef','#b9c2c9','#8c979f'], pattern:'blobs' },
  { id:'tiger', name:'Tiger Stripe', price:1200, colors:['#5b6b33','#2a2a20','#8a7a4a'], pattern:'stripes' },
  { id:'digital', name:'Digital', price:1500, colors:['#6d7b5a','#4d5a3c','#a29c7a','#2f3626'], pattern:'pixels' },
  { id:'carbon', name:'Carbon Fibre', price:2500, colors:['#1a1a1a','#2e2e2e'], pattern:'weave' },
  { id:'crimson', name:'Crimson', price:3000, colors:['#7a1010','#a51c1c','#4a0808'], pattern:'blobs' },
  { id:'cobalt', name:'Cobalt', price:3000, colors:['#1c3d7a','#2a5bb0','#0f2048'], pattern:'blobs' },
  { id:'damascus', name:'Damascus Steel', price:6000, colors:['#8d9196','#5a5e63','#c3c7cc'], pattern:'waves' },
  { id:'gold', name:'Gold', price:10000, colors:['#d4af37','#b8902a','#f3d36b'], pattern:'metal' },
];
const UNIFORMS = [
  { id:'multicam', name:'Multicam', price:0, colors:['#8a8060','#6b6447','#a69a72','#4f4a35'] },
  { id:'woodland', name:'Woodland', price:0, colors:['#4a5a2a','#6b5a3a','#2a2a1e','#7a8a4a'] },
  { id:'desert', name:'Desert', price:400, colors:['#c2a878','#a88f5f','#8a7550','#d6c193'] },
  { id:'urban', name:'Urban', price:600, colors:['#7d8084','#5d6064','#9a9da0','#3e4144'] },
  { id:'night', name:'Night Ops', price:1500, colors:['#2a2f36','#1d2126','#3a4049','#15181c'] },
  { id:'snow', name:'Snow', price:1500, colors:['#dfe4e8','#b9c2c9','#9aa4ac','#eef1f3'] },
];

// ---------------------------------------------------------------- maps meta (generators in maps.js)
const MAPS = [
  { id:'killhouse', name:'Killhouse', size:'Small', desc:'Tight plywood training facility. Close quarters only.' },
  { id:'oldtown', name:'Old Town', size:'Medium', desc:'Dense European streets packed with brick and concrete buildings.' },
  { id:'farm', name:'Harvest Farm', size:'Large', desc:'Open countryside with wheat fields, a big red barn and a farmhouse.' },
  { id:'forest', name:'Black Pines', size:'Large', desc:'Thick pine forest split by a river, with a hunting cabin.' },
  { id:'desert', name:'Dust Village', size:'Medium', desc:'Mud-brick desert village with sandbag positions and palms.' },
  { id:'rustyard', name:'Rust Yard', size:'Medium', desc:'Industrial port: warehouses, shipping containers and crates.' },
  { id:'snowbase', name:'Frostbite Outpost', size:'Medium', desc:'Snowbound radar station with concrete bunkers, a frozen lake and pine woods.' },
  { id:'airfield', name:'Northfield Airbase', size:'Large', desc:'Airstrip with corrugated hangars, a control tower and long open sight lines.' },
  { id:'ruins', name:'Jungle Ruins', size:'Medium', desc:'Crumbling stone temple swallowed by jungle, split by a muddy river.' },
  { id:'mansion', name:'Blackwood Manor', size:'Large', desc:'A huge four-storey country mansion in a walled estate, with a hedge maze, fountain court, garages, a chapel and woods.' },
  { id:'omaha', name:'Omaha Bluffs', size:'Large', desc:'WWII beach assault: hedgehogs and wire on the sand, bunkers and trenches on the bluffs, a Normandy village behind.' },
  { id:'highland', name:'Highland Pass', size:'Large', desc:'Alpine valley between snowy peaks, with a stone bridge, chalets and pine slopes.' },
  { id:'suburbs', name:'Maple Street', size:'Large', desc:'A quiet suburb: houses with fenced back yards, curving streets and a three-storey school with a sports field.' },
  { id:'harbor', name:'Port Haven', size:'Extra Large', desc:'A harbour town on the sea: piers, quayside warehouses, a lighthouse and an old town of stucco and brick behind.' },
  { id:'canyon', name:'Red Canyon', size:'Extra Large', desc:'A winding desert valley between high mesas, with a rail line, a mining camp and ramps up to ranches on the cliffs.' },
  { id:'oldtown_xl', name:'Greater Old Town', size:'Massive', massive:true, desc:'A whole city: avenues and side streets, apartment blocks, plazas, parks and a river. For massive battles.' },
  { id:'farm_xl', name:'Harvest Valley', size:'Massive', massive:true, desc:'A wide river valley of farmsteads, wheat fields, hedgerows and woods. For massive battles.' },
  { id:'desert_xl', name:'Dust Province', size:'Massive', massive:true, desc:'A sprawling desert town of mud-brick compounds around a market, with an oasis and rocky flats. For massive battles.' },
];

const TEAM_NAMES = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot'];
const MAX_PLAYERS = 12, MAX_MASSIVE = 36;
const GAMEMODES = [
  { id:'deathmatch', name:'Deathmatch', desc:'Everyone has a set number of lives (1-16). Last team or player standing wins.' },
  { id:'score', name:'Battle Royale', desc:'Unlimited respawns for a set time (2-15 min). Kills +100, assists +50, deaths −50. Highest score wins.' },
  { id:'zone', name:'Zone', desc:'Teams: hold the zone for 30 s to win. FFA: most time in the zone after 5 minutes wins.' },
  { id:'snd', name:'Search & Destroy', teamsOnly:true, desc:'Teams only. Each team has a hidden base (1000 HP) on its side of the map. Find the enemy base and destroy it first. Unlimited respawns.' },
];
const BASE_HP = 1000;

// ---------------------------------------------------------------- achievements
// stat keys are tracked in profile.stats; check(p) returns progress value
const ACHIEVEMENTS = [
  { id:'firstblood', name:'First Blood', desc:'Get your first kill.', stat:'kills', goal:1, xp:150, coins:150 },
  { id:'soldier', name:'Soldier', desc:'Get 50 total kills.', stat:'kills', goal:50, xp:600, coins:600 },
  { id:'veteran', name:'Veteran', desc:'Get 250 total kills.', stat:'kills', goal:250, xp:2000, coins:2000 },
  { id:'warmachine', name:'War Machine', desc:'Get 1,000 total kills.', stat:'kills', goal:1000, xp:7500, coins:7500 },
  { id:'legend', name:'Living Legend', desc:'Get 2,500 total kills.', stat:'kills', goal:2500, xp:15000, coins:15000 },
  { id:'reaper', name:'The Reaper', desc:'Get 5,000 total kills.', stat:'kills', goal:5000, xp:30000, coins:30000 },
  { id:'double', name:'Double Tap', desc:'Get a double kill (2 kills within 4 seconds).', stat:'bestMulti', goal:2, xp:250, coins:250 },
  { id:'triple', name:'Triple Threat', desc:'Get a triple kill.', stat:'bestMulti', goal:3, xp:750, coins:750 },
  { id:'quad', name:'Unstoppable', desc:'Get a quad kill.', stat:'bestMulti', goal:4, xp:2000, coins:2000 },
  { id:'massacre', name:'Massacre', desc:'Get a five-kill multi-kill.', stat:'bestMulti', goal:5, xp:5000, coins:5000 },
  { id:'rampage', name:'Rampage', desc:'Get 5 kills in a single life.', stat:'bestStreak', goal:5, xp:750, coins:750 },
  { id:'untouchable', name:'Untouchable', desc:'Get 10 kills in a single life.', stat:'bestStreak', goal:10, xp:2500, coins:2500 },
  { id:'godlike', name:'Godlike', desc:'Get 15 kills in a single life.', stat:'bestStreak', goal:15, xp:6000, coins:6000 },
  { id:'teamplayer', name:'Team Player', desc:'Get 25 assists.', stat:'assists', goal:25, xp:600, coins:600 },
  { id:'wingman', name:'Wingman', desc:'Get 150 assists.', stat:'assists', goal:150, xp:2200, coins:2200 },
  { id:'guardian', name:'Guardian Angel', desc:'Get 500 assists.', stat:'assists', goal:500, xp:6000, coins:6000 },
  { id:'headhunter', name:'Headhunter', desc:'Get 25 headshot kills.', stat:'headshots', goal:25, xp:1200, coins:1200 },
  { id:'deadeye', name:'Deadeye', desc:'Get 100 headshot kills.', stat:'headshots', goal:100, xp:4000, coins:4000 },
  { id:'surgeon', name:'Surgeon', desc:'Get 500 headshot kills.', stat:'headshots', goal:500, xp:12000, coins:12000 },
  { id:'longshot', name:'Long Shot', desc:'Kill someone more than 50 m away.', stat:'longShots', goal:1, xp:800, coins:800 },
  { id:'sharpshooter', name:'Sharpshooter', desc:'Get 25 kills from more than 50 m.', stat:'longShots', goal:25, xp:4000, coins:4000 },
  { id:'snake', name:'Snake in the Grass', desc:'Get 25 kills while lying prone.', stat:'proneKills', goal:25, xp:2000, coins:2000 },
  { id:'silent', name:'Silent but Deadly', desc:'Get 50 kills with a suppressed weapon.', stat:'quietKills', goal:50, xp:3000, coins:3000 },
  { id:'marksman', name:'Marksman', desc:'Get 25 sniper rifle kills.', stat:'sniperKills', goal:25, xp:1000, coins:1000 },
  { id:'sniperelite', name:'Sniper Elite', desc:'Get 150 sniper rifle kills.', stat:'sniperKills', goal:150, xp:5000, coins:5000 },
  { id:'blade', name:'Up Close & Personal', desc:'Get 10 melee kills.', stat:'meleeKills', goal:10, xp:1000, coins:1000 },
  { id:'butcher', name:'Cold Steel', desc:'Get 50 melee kills.', stat:'meleeKills', goal:50, xp:4000, coins:4000 },
  { id:'boom', name:'Boom!', desc:'Get 10 explosive kills.', stat:'explosiveKills', goal:10, xp:750, coins:750 },
  { id:'demoman', name:'Demolitions Man', desc:'Get 75 explosive kills.', stat:'explosiveKills', goal:75, xp:4000, coins:4000 },
  { id:'pyro', name:'Pyromaniac', desc:'Get 10 kills with fire.', stat:'fireKills', goal:10, xp:750, coins:750 },
  { id:'wallbang', name:'Through the Wall', desc:'Kill someone through cover.', stat:'wallbangs', goal:1, xp:500, coins:500 },
  { id:'xray', name:'X-Ray Vision', desc:'Get 50 kills through cover.', stat:'wallbangs', goal:50, xp:3500, coins:3500 },
  { id:'nightowl', name:'Night Owl', desc:'Get 25 kills in night matches.', stat:'nightKills', goal:25, xp:1000, coins:1000 },
  { id:'nightstalker', name:'Night Stalker', desc:'Get 150 kills in night matches.', stat:'nightKills', goal:150, xp:4500, coins:4500 },
  { id:'demolition', name:'Demolition Expert', desc:'Destroy 200 pieces of cover or terrain.', stat:'destroyed', goal:200, xp:750, coins:750 },
  { id:'wrecker', name:'Wrecking Crew', desc:'Destroy 1,500 pieces of cover or terrain.', stat:'destroyed', goal:1500, xp:4000, coins:4000 },
  { id:'victory', name:'Victory', desc:'Win a match.', stat:'wins', goal:1, xp:300, coins:300 },
  { id:'decorated', name:'Decorated', desc:'Win 25 matches.', stat:'wins', goal:25, xp:2500, coins:2500 },
  { id:'conqueror', name:'Conqueror', desc:'Win 100 matches.', stat:'wins', goal:100, xp:9000, coins:9000 },
  { id:'flawless', name:'Flawless', desc:'Win a match without dying once.', stat:'flawless', goal:1, xp:1500, coins:1500 },
  { id:'flawless10', name:'Ghost', desc:'Win 10 matches without dying once.', stat:'flawless', goal:10, xp:8000, coins:8000 },
  { id:'champion', name:'Champion', desc:'Win a Free For All match.', stat:'ffaWins', goal:1, xp:750, coins:750 },
  { id:'kingofhill', name:'King of the Hill', desc:'Win 10 Free For All matches.', stat:'ffaWins', goal:10, xp:5000, coins:5000 },
  { id:'zonelord', name:'Zone Lord', desc:'Win a Zone match.', stat:'zoneWins', goal:1, xp:500, coins:500 },
  { id:'lastman', name:'Last One Standing', desc:'Win a Deathmatch.', stat:'dmWins', goal:1, xp:500, coins:500 },
  { id:'siege', name:'Siege Breaker', desc:'Win a Search & Destroy match.', stat:'sndWins', goal:1, xp:600, coins:600 },
  { id:'scorer', name:'High Scorer', desc:'Win a Battle Royale.', stat:'scoreWins', goal:1, xp:600, coins:600 },
  { id:'score2k', name:'Point Machine', desc:'Score 2,000 points in one Battle Royale.', stat:'bestScore', goal:2000, xp:3000, coins:3000 },
  { id:'multiteam', name:'Survival of the Fittest', desc:'Win a match against 3 or more other teams.', stat:'multiteamWins', goal:1, xp:1500, coins:1500 },
  { id:'massive1', name:'Total War', desc:'Play a massive battle.', stat:'massiveGames', goal:1, xp:600, coins:600 },
  { id:'massive5', name:'Field Marshal', desc:'Win 5 massive battles.', stat:'massiveWins', goal:5, xp:6000, coins:6000 },
  { id:'cartographer', name:'Cartographer', desc:'Play 5 matches on generated maps.', stat:'genGames', goal:5, xp:1000, coins:1000 },
  { id:'architect', name:'Architect', desc:'Save 3 maps from the map generator.', stat:'savedMaps', goal:3, xp:800, coins:800 },
  { id:'tourist', name:'World Tour', desc:'Play on 10 different maps.', stat:'mapsPlayed', goal:10, xp:2000, coins:2000 },
  { id:'warpaint', name:'War Paint', desc:'Paint your face in the Locker.', stat:'facePaint', goal:1, xp:200, coins:300 },
  { id:'lvl5', name:'Private First Class', desc:'Reach level 5.', stat:'level', goal:5, xp:0, coins:750 },
  { id:'lvl10', name:'Sergeant', desc:'Reach level 10.', stat:'level', goal:10, xp:0, coins:2000 },
  { id:'lvl25', name:'Lieutenant', desc:'Reach level 25.', stat:'level', goal:25, xp:0, coins:7500 },
  { id:'lvl50', name:'General', desc:'Reach level 50.', stat:'level', goal:50, xp:0, coins:25000 },
  { id:'lvl75', name:'Commander in Chief', desc:'Reach level 75.', stat:'level', goal:75, xp:0, coins:50000 },
  { id:'collector', name:'Collector', desc:'Own 15 items.', stat:'owned', goal:15, xp:750, coins:750 },
  { id:'arsenal', name:'Arsenal', desc:'Own 40 items.', stat:'owned', goal:40, xp:3500, coins:3500 },
  { id:'museum', name:'Museum Curator', desc:'Own 70 items.', stat:'owned', goal:70, xp:9000, coins:9000 },
  { id:'spender', name:'Big Spender', desc:'Spend 10,000 coins in the shop.', stat:'spent', goal:10000, xp:1200, coins:0 },
  { id:'tycoon', name:'Arms Tycoon', desc:'Spend 250,000 coins in the shop.', stat:'spent', goal:250000, xp:10000, coins:0 },
  { id:'online', name:'Connected', desc:'Play an online multiplayer match.', stat:'onlineGames', goal:1, xp:400, coins:400 },
  { id:'online25', name:'Regular Online', desc:'Play 25 online multiplayer matches.', stat:'onlineGames', goal:25, xp:4000, coins:4000 },
  { id:'matches', name:'Regular', desc:'Play 50 matches.', stat:'games', goal:50, xp:1500, coins:1500 },
  { id:'matches200', name:'Lifer', desc:'Play 200 matches.', stat:'games', goal:200, xp:6000, coins:6000 },
  { id:'completionist', name:'Completionist', desc:'Unlock 50 other achievements.', stat:'achievementsDone', goal:50, xp:20000, coins:20000 },
];

const REWARDS = {
  kill: { xp: 25, coins: 10 },
  assist: { xp: 10, coins: 4 },
  win: { xp: 150, coins: 75 },
  winFFA: { xp: 300, coins: 150 },
  play: { xp: 30, coins: 10 },
};
function xpForLevel(lvl) { return Math.round(500 * Math.pow(1.1, lvl - 1)); }
