# Frontline Ops 3D

The first-person 3D version of Frontline Ops. Same weapons, ammunition, gear, maps, modes, bots, progression and online play as the top-down game, rendered in 3D with three.js. Open `index.html` in Chrome, Edge or Firefox, or serve the folder with any static web server. A reasonably modern GPU is recommended. Settings → Graphics: *High* (sun shadows, grass), *Medium* (grass, no shadows) or *Low* (fastest).

## Playing
- **Single Player**: Team Battle with 2–6 teams (any team size as long as the total is at most 12, e.g. 6×2, 4×3, 3×4, 2×6) or Free For All (2–12) against AI bots with gear of similar quality to yours.
- **Massive battles**: switch on *Massive battle* for up to 36 participants (three times the normal limit), as Team Battle (e.g. 6×6, 3×12, 2×18) or Free For All. They are played on three huge themed maps, each about four times the area of a normal map: **Greater Old Town** (a whole city of avenues, apartment blocks, plazas, parks and a river), **Harvest Valley** (farmsteads, wheat fields, hedgerows and woods along a river) and **Dust Province** (a sprawling mud-brick town around a market, with an oasis). Generated maps can be massive too.
- **Online Multiplayer**: *Host* generates a 6-character game code; friends *Join* with it (peer-to-peer over WebRTC via the free PeerJS broker). 3D lobbies are separate from the top-down game's lobbies.
- **Modes**:
  - **Deathmatch**: choose 1–16 lives each; last team or player standing wins.
  - **Battle Royale**: unlimited respawns for 2–15 minutes (the player or host decides). Kills +100, assists +50, deaths −50; the highest team (or player in Free For All) score wins.
  - **Zone** and **Search & Destroy** (teams only: find and destroy the enemy castle, 1000 HP, placed at random on the enemy side).
- **Night mode**: only lit things are visible: weapon lights, fires, flares, muzzle flashes, tracers. Night vision and thermal gear from the Shop let you see in the dark.
- **Concealment**: soldiers in bushes, wheat or loose hay, or pressed against hay bales and trees, are only visible from close up.
- 15 normal maps (Small to Extra Large) plus 3 massive ones. **Blackwood Manor** is a large walled estate around a huge four-storey manor with two switchback stairwells, plus a hedge maze, fountain court, garages, a chapel and woods. **Maple Street** (Large) is a suburb of houses with fenced yards and a three-storey school; **Port Haven** (Extra Large) is a harbour town with piers, quayside warehouses, a lighthouse and an old town; **Red Canyon** (Extra Large) is a winding desert valley between high mesas with a rail line, a mining camp and ramps up the cliffs. Also **Omaha Bluffs** (World War 2: beach with Czech hedgehogs and barbed wire, steep bluffs with bunkers and a trench line, bocage hedgerows and a Normandy village) and **Highland Pass** (a river valley between steep snow-capped mountains). (The map maker of the top-down version is not included.)
- **Map generator**: in the map step choose *Map Generator*, pick a theme (City, Countryside, Forest, Desert, Arctic, Industrial, Coast, Suburbs, Canyon or Random) and a size (Medium, Large, Extra Large; Massive in massive battles), and roll maps until you like one. Play it straight away, or *Save* it: saved maps sit with the other maps (and appear in your online lobbies for everyone to vote on) until you delete them with the 🗑 button.
- Crates and barrels come in sensible stacks against walls instead of single random blocks, and houses are furnished with a few tables and cabinets along the walls; only warehouses and garages are filled with crates.
- **Terrain**: maps have hills, valleys and mountain edges. Walking uphill is slower, very steep slopes can't be climbed, and hills block line of sight and bullets. Buildings stand on levelled ground.
- **Buildings**: houses have roofs (flat roofs with parapets, pitched roofs, arched hangar roofs), many are two storeys and some up to four (apartment blocks, the manor) with switchback stairs inside, and flat roofs (desert houses, bunkers, some town houses) can be reached by ladders outside. The farm barn has a hay loft with a ladder. Upper-floor windows are open firing positions.
- **Movement**: jump onto crates and sandbags, crouch-jump through broken windows, kneel behind low cover, go prone in wheat and grass (harder to spot, steadier aim, but slow). Falling from roofs hurts. Soldiers are fully posed: kneeling on one knee when crouched, lying on their belly with the rifle forward when prone.
- **Face paint**: in the Locker choose *Face paint* and paint on your soldier's face (colours, brush sizes, eraser, undo and presets such as camo stripes or a skull). Other players see it in matches; bots never wear face paint.
- Bodies sink away after 30–60 seconds.
- **Headshots** do double damage (body armour gives the head only half protection). Bullets travel in 3D, so height matters: you can shoot over crouched targets, from upper floors and through the floor openings.
- Bots aim up and down, crouch or go prone to steady longer shots, jump over obstacles, duck through broken windows and use stairs to every floor (they don't use ladders). They only know where you are when they see or hear you: otherwise they search likely areas, give up on places they can't reach, and only shoot when they have a clear line of fire.

## Weapons, attachments and utilities
- New weapons include the AK-12, Mk 14 EBR and Glock 18, and a World War 2 arsenal: StG 44, M1 Garand, Lee-Enfield, Kar98k, BAR, MG 42, MP 40, Sten, Luger and P38 (with their own calibres: 7.92×33 Kurz, 7.92×57 Mauser, .30-06, .303 British, 5.45×39).
- New utilities: M16 "Bouncing Betty" mine, satchel charge, thermite grenade, CS gas grenade and the Model 24 stick grenade; new trench knife and flak vest.
- **Attachments** (Weapons → Attachments to unlock with XP, or Shop → Attachments for coins; many need a minimum level): optics (red dot, holographic, pistol dot, ACOG 4x, PSO-1, 8x sniper scope, thermal scope), muzzles (suppressors, compensator, muzzle brake, flash hider), foregrips and bipod, extended/drum magazines, speed loader, shell holder, and visible or IR lasers. Each lists its stats and the guns it fits: a rifle optic won't fit a pistol, PSO scopes only fit AK-pattern rifles and the SVD, suppressors must match the calibre, and period guns without rails take no optics. Fit them per gun in the loadout. Suppressed shots are quiet, short-ranged and don't show on the enemy's radar.
- Special ammunition costs ten times as much as before; levels need 1.1× the XP of the previous level (was 1.2×).

## Controls
Click the game to capture the mouse (Esc releases it and opens the menu) · WASD move · Shift sprint · Space jump (or stand up) · C crouch, hold C to go prone · walk into a ladder to climb it (back off to climb down, Space to let go) · Mouse look · LMB fire · RMB aim down sights / scope · R reload · 1–4 or wheel switch weapon · F melee · 5/6/7 use utility (or Q select + G use; C-4 detonates with a second press) · look up/down to throw grenades further/shorter · L weapon light · N night vision / thermal · Tab scoreboard

Mouse sensitivity and graphics quality are in Settings (⚙ in the menu, or Settings in the in-game menu).

## Achievements
70 achievements with bigger rewards: kill and headshot milestones, multi-kills and streaks, long shots (50 m+), prone and suppressed kills, flawless wins, winning every mode, massive battles, beating three or more teams, playing generated maps and saving your own, playing 10 different maps, face paint, levels, collecting and more.

## Progression
Same as the top-down game: kills, assists, wins and achievements give XP and coins; buy weapons, armour, night gear, ammunition, utilities, camos and uniforms in the Shop. Progress is saved in the browser and shared with the top-down version when both are opened from the same browser.

## How it works
The simulation (movement, ballistics, penetration, explosions, destruction, bots, networking) is the same 2D top-down engine as the original game; the 3D view renders that world with height: walls, buildings, trees and props become 3D meshes, soldiers are 3D models, and you see through your soldier's eyes. On top of the top-down grid the 3D version stores heights per tile (wall heights, floors, roofs, stairs, ladders), and soldiers, bullets and grenades have a height too, so jumping, stances, multi-storey buildings and headshots work.

## Files
- `js/view3d.js`: the three.js renderer (terrain, instanced map objects, soldiers, castles, particles, lasers, lights, night vision and thermal)
- `js/gunmodel.js`: 3D weapon models with fitted attachments (first person and on soldiers)
- `js/soldier3d.js`: rigged soldier models (IK arms and legs, standing/kneeling/prone/dead poses, faces with face paint)
- `js/mapgen.js`: the themed map generator (also builds the massive maps, Maple Street, Port Haven and Red Canyon)
- `js/game.js`: engine (simulation, first-person input, HUD overlay, net sync)
- `js/data.js`, `js/maps.js`, `js/ai.js`, `js/net.js`, `js/ui.js`, `js/profile.js`, `js/render.js` (2D art for menus and HUD icons)
- `js/audio.js` + `js/sounds.js`: real recorded sounds, panned by where you are looking (sources and pipeline in `tools/sounds/`)
- `vendor/three.min.js`: three.js r149 (MIT licence), included so the game also runs offline
- `img/items/`: photos from Wikimedia Commons; image and sound credits open from the Credits button on the main menu
- `tools/tests/`: headless-Chrome test scripts
