// ============================================================================
// Described maps: the player writes the place they want ("a casino in the
// desert with a big car park", "a museum by a river in winter", "an abandoned
// hospital in a forest") and this interpreter reads it: which kinds of places
// are asked for (each one has a floor plan, rooms and furniture), and what is
// around them (landscape, season, water, roads, parking, gardens, walls). The
// same text and seed always give the same map, so described maps play online
// and can be saved like any generated map.
//
// The generator builds several candidate layouts from the description and keeps
// the one that plays best (open routes between the spawns, cover, interiors).
// ============================================================================

// ---- furniture patterns for a room (x, y, w, h = the floor inside its walls) ----------------------------------------
const DESC_FURNISH = {
  // card and roulette tables in rows with wide aisles
  gaming(c, x, y, w, h) { for (let j = y + 2; j < y + h - 2; j += 4) for (let i = x + 2; i < x + w - 3; i += 5) c.put(i, j, O.TABLE, 2, 1); },
  // banks of slot machines: long rows with a gap every few machines
  slots(c, x, y, w, h) { for (let j = y + 1; j < y + h - 1; j += 3) for (let i = x + 1; i < x + w - 1; i++) if ((i - x) % 7 < 5) c.put(i, j, O.TABLE); },
  // a long bar counter along one wall, stools of barrels in front
  bar(c, x, y, w, h) { for (let i = x + 2; i < x + w - 2; i++) c.put(i, y + 1, O.TABLE); for (let i = x + 3; i < x + w - 3; i += 2) c.put(i, y + 3, O.BARREL); },
  // a vault: rows of strongboxes and cash crates
  vault(c, x, y, w, h) { for (let j = y + 1; j < y + h - 1; j += 2) for (let i = x + 1; i < x + w - 1; i++) if ((i - x) % 4 < 3) c.put(i, j, O.CRATE); },
  // gallery: pedestals with sculptures in a grid, display cases along the walls
  gallery(c, x, y, w, h) { for (let j = y + 2; j < y + h - 2; j += 4) for (let i = x + 2; i < x + w - 2; i += 4) c.put(i, j, O.STONE); c.alongWalls(x, y, w, h, O.TABLE, 3); },
  // a sculpture court: big statues on plinths, planters
  sculpture(c, x, y, w, h) { for (let j = y + 2; j < y + h - 3; j += 6) for (let i = x + 2; i < x + w - 3; i += 6) c.put(i, j, O.STONE, 2, 2); c.alongWalls(x, y, w, h, O.HEDGE, 4); },
  // a hall of vehicles (transport museum, showroom, garage)
  vehicles(c, x, y, w, h) { for (let j = y + 2; j < y + h - 2; j += 4) for (let i = x + 2; i < x + w - 3; i += 5) c.put(i, j, O.CAR, 2, 1); },
  // lobby: a reception desk and planters
  lobby(c, x, y, w, h) { const mx = x + Math.floor(w / 2) - 2; c.put(mx, y + Math.floor(h / 2), O.TABLE, 4, 1); c.corners(x, y, w, h, O.HEDGE); },
  // offices: desks in pairs
  office(c, x, y, w, h) { for (let j = y + 1; j < y + h - 1; j += 3) for (let i = x + 1; i < x + w - 2; i += 4) c.put(i, j, O.TABLE, 2, 1); },
  // hospital ward: beds along both long walls
  ward(c, x, y, w, h) { for (let i = x + 1; i < x + w - 1; i += 3) { c.put(i, y, O.TABLE); c.put(i, y + h - 1, O.TABLE); } },
  // classroom: rows of desks facing a teacher's desk
  classroom(c, x, y, w, h) { for (let j = y + 3; j < y + h - 1; j += 2) for (let i = x + 1; i < x + w - 1; i += 2) c.put(i, j, O.TABLE); c.put(x + Math.floor(w / 2) - 1, y + 1, O.TABLE, 2, 1); },
  // library: long shelves with gaps
  library(c, x, y, w, h) { for (let j = y + 1; j < y + h - 1; j += 3) for (let i = x + 1; i < x + w - 1; i++) if ((i - x) % 8 < 6) c.put(i, j, O.CRATE); },
  // shop: shelves and a counter by the door
  shop(c, x, y, w, h) { for (let j = y + 2; j < y + h - 1; j += 3) for (let i = x + 2; i < x + w - 2; i++) if ((i - x) % 6 < 4) c.put(i, j, O.CRATE); c.put(x + 1, y + 1, O.TABLE, 3, 1); },
  // pews: rows with an aisle down the middle, an altar at the end
  pews(c, x, y, w, h) { const mid = x + Math.floor(w / 2); for (let j = y + 4; j < y + h - 1; j += 2) for (let i = x + 1; i < x + w - 1; i++) if (Math.abs(i - mid) > 1) c.put(i, j, O.TABLE); c.put(mid - 1, y + 1, O.STONE, 3, 1); },
  // restaurant / canteen: tables spread out
  dining(c, x, y, w, h) { for (let j = y + 2; j < y + h - 1; j += 3) for (let i = x + 2; i < x + w - 2; i += 3) c.put(i, j, O.TABLE); },
  // kitchen: counters along the walls
  kitchen(c, x, y, w, h) { c.alongWalls(x, y, w, h, O.TABLE, 1); },
  // machine hall: machines (containers) and drums
  machines(c, x, y, w, h) { for (let j = y + 2; j < y + h - 3; j += 5) for (let i = x + 2; i < x + w - 4; i += 7) c.put(i, j, O.CONTAINER, 3, 2); for (let k = 0; k < w * h / 30; k++) c.put(x + c.ri(1, w - 2), y + c.ri(1, h - 2), O.BARREL); },
  storage(c, x, y, w, h) { c.B.furnish(x, y, w, h, 'warehouse'); },
  home(c, x, y, w, h) { c.B.furnish(x, y, w, h, 'home'); },
  // a gym / sports hall / ballroom: open floor, benches along the walls
  hall(c, x, y, w, h) { c.alongWalls(x, y, w, h, O.TABLE, 5); },
  // a dance floor ringed by tables (night club)
  club(c, x, y, w, h) { c.alongWalls(x, y, w, h, O.TABLE, 2); c.put(x + Math.floor(w / 2) - 2, y + 1, O.TABLE, 4, 1); },
  // prison cells: a row of small cells with bars on the corridor side
  cells(c, x, y, w, h) { for (let i = x; i < x + w - 3; i += 4) { for (let j = y; j < y + h; j++) c.put(i + 3, j, c.wall); c.put(i + 1, y, O.TABLE); for (let k = 0; k < 3; k++) if (k !== 1) c.put(i + k, y + h - 1, O.CHAINLINK); } },
  // an armoury / barracks: bunks and racks
  barracks(c, x, y, w, h) { for (let i = x + 1; i < x + w - 1; i += 2) { c.put(i, y, O.TABLE); c.put(i, y + h - 1, O.CRATE); } },
  // waiting area / departure lounge: rows of seats
  seating(c, x, y, w, h) { for (let j = y + 2; j < y + h - 1; j += 3) for (let i = x + 2; i < x + w - 2; i++) if ((i - x) % 8 < 6) c.put(i, j, O.TABLE); },
  // a stairwell room: kept empty so the building can have its stairs
  stairs() {},
  empty() {},
};

// ---- the places a description can ask for --------------------------------------------------------------------------
// size: building footprint [w, h] (tiles) on a medium map; stories; wall, floor; plan: 'hall' (a big main floor ringed
// by rooms) or 'corridor' (rooms either side of corridors); main: the main floor's furniture; rooms: the other rooms
const DESC_VENUES = {
  casino: { words: ['casino', 'gambling', 'poker', 'roulette', 'blackjack', 'slot', 'vegas', 'betting'], name: 'Casino', size: [44, 28], stories: 2, wall: O.STUCCO, floor: F.CARPET, plan: 'hall', main: ['gaming', 'slots'], rooms: ['bar', 'vault', 'lobby', 'office', 'kitchen', 'club', 'stairs'], outside: ['parking', 'plaza', 'fountain'] },
  museum: { words: ['museum', 'gallery', 'exhibition', 'exhibit', 'art', 'louvre', 'artifact', 'artefact', 'sculpture', 'painting'], name: 'Museum', size: [42, 30], stories: 2, wall: O.CONCRETE, floor: F.MARBLE, plan: 'hall', main: ['sculpture'], rooms: ['gallery', 'gallery', 'vehicles', 'gallery', 'library', 'shop', 'lobby', 'stairs'], outside: ['plaza', 'garden'] },
  mall: { words: ['mall', 'shopping', 'shops', 'store', 'stores', 'boutique', 'arcade', 'department'], name: 'Mall', size: [46, 30], stories: 2, wall: O.CONCRETE, floor: F.TILE, plan: 'hall', main: ['lobby'], rooms: ['shop', 'shop', 'dining', 'shop', 'storage', 'shop', 'kitchen', 'stairs'], outside: ['parking', 'parking'] },
  supermarket: { words: ['supermarket', 'grocery', 'market', 'hypermarket'], name: 'Supermarket', size: [34, 24], stories: 1, wall: O.CONCRETE, floor: F.TILE, plan: 'hall', main: ['shop'], rooms: ['storage', 'office', 'kitchen'], outside: ['parking'] },
  hospital: { words: ['hospital', 'clinic', 'medical', 'infirmary', 'asylum', 'sanatorium'], name: 'Hospital', size: [44, 26], stories: 3, wall: O.CONCRETE, floor: F.TILE, plan: 'corridor', main: ['empty'], rooms: ['ward', 'ward', 'office', 'ward', 'kitchen', 'storage', 'lobby', 'stairs'], outside: ['parking', 'garden'] },
  school: { words: ['school', 'university', 'college', 'campus', 'academy', 'classroom'], name: 'School', size: [42, 26], stories: 2, wall: O.BRICK, floor: F.WOOD, plan: 'corridor', main: ['empty'], rooms: ['classroom', 'classroom', 'library', 'classroom', 'hall', 'dining', 'office', 'stairs'], outside: ['field', 'parking'] },
  prison: { words: ['prison', 'jail', 'penitentiary', 'gulag', 'detention', 'cells'], name: 'Prison', size: [44, 28], stories: 2, wall: O.CONCRETE, floor: F.CONCRETE, plan: 'corridor', main: ['empty'], rooms: ['cells', 'cells', 'dining', 'cells', 'office', 'barracks', 'stairs'], outside: ['wall', 'yard', 'towers'] },
  airport: { words: ['airport', 'terminal', 'airfield', 'runway', 'hangar', 'aircraft', 'planes'], name: 'Airport', size: [48, 22], stories: 2, wall: O.CONCRETE, floor: F.TILE, plan: 'hall', main: ['seating'], rooms: ['shop', 'dining', 'office', 'lobby', 'storage', 'stairs'], outside: ['runway', 'parking'] },
  office: { words: ['office', 'offices', 'skyscraper', 'corporate', 'headquarters', 'hq', 'tower', 'highrise', 'company', 'business'], name: 'Office Tower', size: [30, 24], stories: 4, wall: O.CONCRETE, floor: F.CARPET, plan: 'corridor', main: ['empty'], rooms: ['office', 'office', 'office', 'lobby', 'kitchen', 'stairs'], outside: ['plaza', 'parking'] },
  hotel: { words: ['hotel', 'motel', 'inn', 'resort', 'lodge', 'hostel'], name: 'Hotel', size: [40, 24], stories: 4, wall: O.STUCCO, floor: F.CARPET, plan: 'corridor', main: ['empty'], rooms: ['home', 'home', 'lobby', 'home', 'dining', 'home', 'kitchen', 'stairs'], outside: ['pool', 'garden', 'parking'] },
  bank: { words: ['bank', 'vault', 'heist', 'treasury', 'mint', 'reserve'], name: 'Bank', size: [32, 22], stories: 2, wall: O.FIELDSTONE, floor: F.MARBLE, plan: 'hall', main: ['lobby'], rooms: ['vault', 'office', 'vault', 'office', 'stairs'], outside: ['plaza', 'street'] },
  library: { words: ['library', 'archive', 'archives', 'books'], name: 'Library', size: [34, 24], stories: 2, wall: O.FIELDSTONE, floor: F.WOOD, plan: 'hall', main: ['library'], rooms: ['office', 'library', 'dining', 'stairs'], outside: ['garden', 'plaza'] },
  church: { words: ['church', 'cathedral', 'chapel', 'temple', 'monastery', 'abbey', 'mosque', 'basilica', 'shrine'], name: 'Cathedral', size: [36, 22], stories: 1, wall: O.FIELDSTONE, floor: F.MARBLE, plan: 'hall', main: ['pews'], rooms: ['office', 'library', 'storage'], outside: ['graveyard', 'garden'] },
  castle: { words: ['castle', 'fortress', 'fort', 'citadel', 'keep', 'palace', 'stronghold', 'medieval'], name: 'Castle', size: [30, 24], stories: 4, wall: O.FIELDSTONE, floor: F.COBBLE, plan: 'hall', main: ['hall'], rooms: ['barracks', 'dining', 'storage', 'home', 'kitchen', 'stairs'], outside: ['curtain', 'moat'] },
  mansion: { words: ['mansion', 'manor', 'estate', 'villa', 'chateau'], name: 'Manor', size: [36, 26], stories: 3, wall: O.STUCCO, floor: F.MARBLE, plan: 'hall', main: ['lobby'], rooms: ['home', 'library', 'dining', 'home', 'kitchen', 'home', 'stairs'], outside: ['garden', 'fountain', 'hedges'] },
  stadium: { words: ['stadium', 'arena', 'colosseum', 'pitch', 'court', 'sports'], name: 'Stadium', size: [50, 34], stories: 1, wall: O.CONCRETE, floor: F.CONCRETE, plan: 'ring', main: ['empty'], rooms: ['seating', 'seating', 'shop', 'seating', 'office', 'seating'], outside: ['parking'] },
  warehouse: { words: ['warehouse', 'depot', 'storage', 'logistics', 'distribution'], name: 'Warehouse', size: [40, 24], stories: 1, wall: O.METALWALL, floor: F.CONCRETE, plan: 'hall', main: ['storage'], rooms: ['office', 'storage'], outside: ['containers', 'parking'] },
  factory: { words: ['factory', 'plant', 'mill', 'foundry', 'refinery', 'industrial', 'assembly', 'workshop'], name: 'Factory', size: [44, 26], stories: 1, wall: O.BRICK, floor: F.METAL, plan: 'hall', main: ['machines'], rooms: ['storage', 'office', 'machines', 'kitchen'], outside: ['containers', 'yard'] },
  military: { words: ['military', 'army', 'base', 'barracks', 'outpost', 'bunker', 'compound', 'garrison', 'camp', 'fob'], name: 'Military Base', size: [32, 20], stories: 2, wall: O.CONCRETE, floor: F.CONCRETE, plan: 'corridor', main: ['empty'], rooms: ['barracks', 'barracks', 'office', 'storage', 'dining', 'stairs'], outside: ['wall', 'sandbags', 'towers', 'containers'] },
  police: { words: ['police', 'precinct', 'sheriff', 'station house'], name: 'Police Station', size: [30, 22], stories: 2, wall: O.BRICK, floor: F.TILE, plan: 'corridor', main: ['empty'], rooms: ['office', 'cells', 'office', 'lobby', 'storage', 'stairs'], outside: ['parking'] },
  station: { words: ['train', 'railway', 'railroad', 'subway', 'metro', 'tracks'], name: 'Railway Station', size: [40, 18], stories: 2, wall: O.BRICK, floor: F.TILE, plan: 'hall', main: ['seating'], rooms: ['shop', 'office', 'dining', 'stairs'], outside: ['rails'] },
  restaurant: { words: ['restaurant', 'diner', 'cafe', 'bistro', 'pub', 'tavern', 'bar', 'saloon'], name: 'Restaurant', size: [26, 18], stories: 1, wall: O.BRICK, floor: F.WOOD, plan: 'hall', main: ['dining'], rooms: ['kitchen', 'bar', 'storage'], outside: ['street', 'parking'] },
  nightclub: { words: ['nightclub', 'club', 'disco', 'rave', 'concert', 'theatre', 'theater', 'cinema', 'opera'], name: 'Club', size: [34, 24], stories: 2, wall: O.BRICK, floor: F.TILE, plan: 'hall', main: ['club'], rooms: ['bar', 'office', 'storage', 'lobby', 'stairs'], outside: ['street', 'parking'] },
  embassy: { words: ['embassy', 'consulate', 'government', 'parliament', 'capitol', 'courthouse', 'city hall', 'town hall', 'ministry'], name: 'Embassy', size: [38, 26], stories: 3, wall: O.FIELDSTONE, floor: F.MARBLE, plan: 'hall', main: ['lobby'], rooms: ['office', 'office', 'library', 'dining', 'office', 'stairs'], outside: ['wall', 'garden', 'fountain'] },
  lab: { words: ['lab', 'laboratory', 'research', 'science', 'facility', 'reactor', 'nuclear', 'secret'], name: 'Research Facility', size: [40, 26], stories: 2, wall: O.CONCRETE, floor: F.METAL, plan: 'corridor', main: ['empty'], rooms: ['machines', 'office', 'vault', 'storage', 'office', 'stairs'], outside: ['wall', 'containers', 'parking'] },
  gasstation: { words: ['gas station', 'petrol', 'filling station', 'truck stop', 'motorway services'], name: 'Gas Station', size: [18, 12], stories: 1, wall: O.CONCRETE, floor: F.TILE, plan: 'hall', main: ['shop'], rooms: ['storage', 'office'], outside: ['pumps', 'parking'] },
  farm: { words: ['farm', 'ranch', 'barn', 'farmstead', 'homestead'], name: 'Farm', size: [24, 16], stories: 1, wall: O.BARNWALL, floor: F.WOOD, plan: 'hall', main: ['storage'], rooms: ['home', 'storage'], outside: ['fields', 'hay'] },
  harbor: { words: ['harbor', 'harbour', 'port', 'docks', 'dock', 'pier', 'shipyard', 'marina', 'wharf'], name: 'Docks', size: [36, 20], stories: 1, wall: O.METALWALL, floor: F.CONCRETE, plan: 'hall', main: ['storage'], rooms: ['office', 'storage'], outside: ['sea', 'containers', 'piers'] },
};
// words for the surroundings
const DESC_MODS = {
  snow: ['snow', 'snowy', 'winter', 'arctic', 'frozen', 'ice', 'icy', 'tundra', 'siberia', 'alpine', 'christmas'],
  desert: ['desert', 'sand', 'sandy', 'dune', 'dunes', 'arid', 'sahara', 'vegas', 'nevada', 'egypt', 'middle east', 'oasis'],
  jungle: ['jungle', 'tropical', 'rainforest', 'amazon', 'tropics', 'palm', 'palms', 'caribbean'],
  forest: ['forest', 'woods', 'woodland', 'trees', 'pine', 'pines'],
  coast: ['beach', 'coast', 'coastal', 'sea', 'ocean', 'seaside', 'shore', 'bay', 'cliff'],
  island: ['island', 'isle', 'atoll', 'islet'],
  river: ['river', 'stream', 'canal', 'creek'],
  lake: ['lake', 'pond', 'lagoon', 'reservoir', 'pool'],
  city: ['city', 'urban', 'downtown', 'town', 'streets', 'street', 'metropolis', 'block', 'neighbourhood', 'neighborhood'],
  rural: ['countryside', 'rural', 'fields', 'farmland', 'village', 'meadow', 'hills'],
  ruined: ['ruined', 'ruins', 'abandoned', 'destroyed', 'bombed', 'derelict', 'war-torn', 'warzone', 'war zone', 'apocalypse', 'post-apocalyptic', 'zombie', 'decayed', 'haunted'],
  walled: ['walled', 'fenced', 'fence', 'perimeter', 'compound', 'guarded', 'secure', 'fortified'],
  parking: ['parking', 'car park', 'cars', 'garage', 'lot'],
  garden: ['garden', 'gardens', 'park', 'lawn', 'courtyard', 'hedge', 'hedges', 'maze'],
  big: ['big', 'huge', 'large', 'giant', 'massive', 'grand', 'enormous', 'vast', 'sprawling', 'mega'],
  small: ['small', 'tiny', 'little', 'compact', 'cramped'],
  tall: ['tall', 'high-rise', 'highrise', 'multi-storey', 'multistorey', 'multi-story', 'skyscraper', 'towering'],
};
const DESC_NUM = { one: 1, a: 1, an: 1, single: 1, two: 2, twin: 2, pair: 2, double: 2, three: 3, triple: 3, four: 4, five: 5, several: 3, many: 4, multiple: 3, some: 2 };

// read a description into a plan: venues (with counts), surroundings and building settings
function parseMapDesc(text) {
  let t = ' ' + String(text || '').toLowerCase().replace(/[^a-z0-9\- ]+/g, ' ').replace(/\s+/g, ' ') + ' ';
  t = t.replace(/ (big|large|huge|giant|small|little) (car park|parking lot|parking)/g, ' $2').replace(/ car park/g, ' parking').replace(/ parking lot/g, ' parking');
  const has = w => t.includes(' ' + w + ' ') || (w.length > 4 && !w.includes(' ') && new RegExp(' ' + w + '(s|es)? ').test(t));
  const at = w => { const k = t.indexOf(' ' + w); return k < 0 ? 1e9 : k; };
  const venues = [];
  for (const [id, v] of Object.entries(DESC_VENUES)) {
    let first = 1e9, hit = null; for (const w of v.words) if (has(w) && at(w) < first) { first = at(w); hit = w; }
    if (!hit) continue;
    // a number word just before it ("two casinos", "3 hospitals")
    const before = t.slice(0, first).trim().split(' ').slice(-2); let n = 1;
    for (const b of before.reverse()) { if (DESC_NUM[b]) { n = DESC_NUM[b]; break; } if (/^\d+$/.test(b)) { n = Math.min(5, +b); break; } }
    venues.push({ id, v, n: Math.max(1, Math.min(5, n)), pos: first, word: hit });
  }
  // a word that names two venues ("bar" is a restaurant, "pool" a lake...): keep the more specific one
  venues.sort((a, b) => a.pos - b.pos);
  const dedup = venues.filter((x, i) => !venues.some((y, j) => j !== i && y.pos === x.pos && y.word.length > x.word.length));
  const mods = {}; for (const [k, ws] of Object.entries(DESC_MODS)) mods[k] = ws.some(has);
  if (dedup.some(v => v.id === 'harbor')) mods.coast = true;
  // storeys asked for ("3 floors", "five-storey", "two story")
  let stories = null; const sm = t.match(/ (\d|one|two|three|four|five|six)[ -](storey|story|floor|level)s? /); if (sm) stories = Math.min(4, isNaN(+sm[1]) ? DESC_NUM[sm[1]] || 2 : +sm[1]);
  if (mods.tall && !stories) stories = 4;
  // materials
  const mat = has('brick') ? O.BRICK : has('stone') || has('stone-walled') ? O.FIELDSTONE : has('wooden') || has('wood') || has('timber') || has('log') ? O.WOODWALL : has('concrete') || has('brutalist') ? O.CONCRETE : has('metal') || has('steel') || has('tin') ? O.METALWALL : has('glass') || has('modern') ? O.CONCRETE : has('marble') || has('white') ? O.STUCCO : null;
  // a name: "called X" / "named X", else from the first place
  const nm = String(text || '').match(/(?:called|named)\s+["']?([A-Za-z0-9' ]{2,24})/i);
  return { text: String(text || ''), venues: dedup, mods, stories, mat, name: nm ? nm[1].trim() : null };
}
// what the generator understood, in words (shown under the preview)
function descSummary(p) {
  const v = p.venues.length ? p.venues.map(x => (x.n > 1 ? x.n + ' × ' : '') + x.v.name.toLowerCase()).join(', ') : 'no specific building (a settlement fitting the landscape)';
  const mm = { island: 'an island', snow: 'snow', desert: 'desert', jungle: 'jungle', forest: 'forest', coast: 'by the sea', river: 'a river', lake: 'a lake', city: 'city streets', rural: 'countryside', ruined: 'ruined', walled: 'walled grounds', parking: 'parking', garden: 'gardens', big: 'large', small: 'small', tall: 'tall' };
  const m = Object.keys(mm).filter(k => p.mods[k]).map(k => mm[k]);
  return 'Understood: ' + v + (m.length ? ' · ' + m.join(', ') : '') + (p.stories ? ' · ' + p.stories + ' storeys' : '');
}
function descMapName(text, seed) {
  const p = parseMapDesc(text); if (p.name) return p.name.replace(/\b\w/g, c => c.toUpperCase()).slice(0, 26);
  const r = mulberry32((seed ^ 0x5bd1e995) >>> 0), pick = a => a[Math.floor(r() * a.length)];
  const adj = p.mods.ruined ? ['Old', 'Fallen', 'Silent', 'Broken'] : p.mods.snow ? ['Frost', 'White', 'Winter', 'Glacier'] : p.mods.desert ? ['Mirage', 'Sun', 'Golden', 'Dune'] : p.mods.coast ? ['Harbour', 'Bay', 'Tide', 'Coral'] : p.mods.jungle ? ['Jade', 'Emerald', 'Orchid'] : ['Grand', 'Royal', 'Imperial', 'Crown', 'Liberty', 'Eagle', 'Northgate', 'Highland'];
  return pick(adj) + ' ' + (p.venues.length ? p.venues[0].v.name : pick(['Valley', 'Crossing', 'Heights', 'Point']));
}

// ---- building a described map -------------------------------------------------------------------------------------
GENT.described = function (m, B, rng, K, o) {
  const { W, H, ri } = K, p = parseMapDesc(o.prompt), M = p.mods, scale = Math.sqrt(W * H / (92 * 70));
  const list = []; p.venues.forEach(x => { for (let k = 0; k < x.n; k++) list.push(x); });
  const sizeMul = (M.big ? 1.18 : M.small ? 0.78 : 1) * scale * (list.length > 2 ? 0.75 : list.length > 1 ? 0.88 : 1);
  const sizeOf = vn => [Math.max(12, Math.min(W - 26, Math.round(vn.v.size[0] * sizeMul))), Math.max(10, Math.min(H - 14, Math.round(vn.v.size[1] * sizeMul)))];
  const main = list.length ? sizeOf(list[0]) : [0, 0], keep = { x0: W / 2 - main[0] / 2 - 5, x1: W / 2 + main[0] / 2 + 5, y0: H / 2 - main[1] / 2 - 5, y1: H / 2 + main[1] / 2 + 5 };
  // ground and landscape
  const ground = M.snow ? F.SNOW : M.desert ? F.SAND : M.jungle ? F.FOREST : M.ruined ? F.DIRT : F.GRASS, alt = M.snow ? F.ICE : M.desert ? F.GRAVEL : M.jungle ? F.GRASS : F.FOREST;
  B.fill(ground); for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (valueNoise(i / 7, j / 7, m.seed % 97) < 0.28) B.floor(i, j, alt);
  if (M.coast) for (let i = 0; i < W; i++) { const s = H - Math.round(9 * scale) + Math.round(Math.sin(i / 9 + m.seed) * 2); for (let j = s; j < H; j++) { B.floor(i, j, F.WATER); K.occ[j * W + i] = 3; } for (let j = s - 3; j < s; j++) if (j > 0) B.floor(i, j, M.snow ? F.SNOW : F.SAND); }
  if (M.island) for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const d = Math.hypot((i - W / 2) / (W * 0.5), (j - H / 2) / (H * 0.5)) + (valueNoise(i / 9, j / 9, 7) - 0.5) * 0.16; if (d > 0.9 && i > 8 && i < W - 9) { B.floor(i, j, F.WATER); K.occ[j * W + i] = 3; } else if (d > 0.84 && i > 8 && i < W - 9) B.floor(i, j, M.snow ? F.SNOW : F.SAND); }
  if (M.river) { // beside the main building, between it and a spawn side (or across the map above or below it)
    const left = rng() < 0.5, at = left ? Math.max(14, keep.x0 - 6) : Math.min(W - 14, keep.x1 + 6), amp = Math.max(1, Math.min(4, left ? keep.x0 - 16 : W - keep.x1 - 16));
    if (left ? keep.x0 > 18 : keep.x1 < W - 18) K.river(false, at, 2.2, amp); else K.river(true, rng() < 0.5 ? Math.max(5, keep.y0 - 4) : Math.min(H - 5, keep.y1 + 4), 2, 1.5); }
  if (M.lake) { const lx = ri(Math.round(W * 0.2), Math.round(W * 0.8)), ly = keep.y0 > 14 ? ri(7, Math.round(keep.y0 - 6)) : ri(Math.round(keep.y1 + 6), H - 7); B.blob(lx, ly, 4 * scale, M.snow ? F.ICE : F.WATER, 2); K.mark(Math.round(lx - 6 * scale), Math.round(ly - 6 * scale), Math.round(12 * scale), Math.round(12 * scale), 3); }
  K.reserveSpawns(o.spawn);
  // the main road through the middle (the spawns face each other along it)
  K.road(K.meander(true, H / 2, 2, 1, rng() * 6), M.city ? 5 : 3, M.city || M.desert && p.venues.length ? F.ASPHALT : F.DIRT, M.city);
  const furn = (kind, x, y, w, h, wall) => {
    const c = { B, ri, wall, put(i, j, obj, ww, hh) { ww = ww || 1; hh = hh || 1; for (let b = j; b < j + hh; b++) for (let a = i; a < i + ww; a++) if (!B.ok(a, b) || B.get(a, b) || a < x || b < y || a >= x + w || b >= y + h) return; if (c.nearOpen(i, j, ww, hh)) return; B.rectO(i, j, ww, hh, obj); },
      nearOpen(i, j, ww, hh) { for (let b = j - 1; b <= j + hh; b++) for (let a = i - 1; a <= i + ww; a++) { if (a >= x && b >= y && a < x + w && b < y + h) continue; if (B.ok(a, b) && !B.get(a, b)) return true; } return false; },
      alongWalls(x0, y0, ww, hh, obj, step) { for (let a = x0 + 1; a < x0 + ww - 1; a += step) { c.put(a, y0, obj); c.put(a, y0 + hh - 1, obj); } for (let b = y0 + 2; b < y0 + hh - 2; b += step) { c.put(x0, b, obj); c.put(x0 + ww - 1, b, obj); } },
      corners(x0, y0, ww, hh, obj) { c.put(x0, y0, obj); c.put(x0 + ww - 1, y0, obj); c.put(x0, y0 + hh - 1, obj); c.put(x0 + ww - 1, y0 + hh - 1, obj); } };
    (DESC_FURNISH[kind] || DESC_FURNISH.home)(c, x, y, w, h);
  };
  // a wall line inside a building with door gaps (2 wide) at the given positions
  const partition = (x0, y0, x1, y1, wall, gaps) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) B.obj(x, y, wall);
    gaps.forEach(([x, y, w, h]) => B.clear(x, y, w, h));
  };
  // one venue building with its floor plan
  const build = (vn, bx, by, bw, bh) => {
    const v = vn.v, wall = p.mat || v.wall, stories = p.stories || v.stories;
    K.house(bx, by, bw, bh, wall, v.floor, { doors: ['n', 's', 'e', 'w'], doorWidth: bw > 24 ? 3 : 2, stories, wells: stories > 2 ? 2 : 1, windows: wall !== O.METALWALL });
    const ix = bx + 1, iy = by + 1, iw = bw - 2, ih = bh - 2, horiz = iw >= ih;
    const rooms = []; let ri0 = 0; const nextRoom = () => v.rooms[(ri0++) % v.rooms.length];
    if (v.plan === 'ring') { // stadium: the stands are a ring of rooms around an open pitch
      const d = Math.max(4, Math.round(Math.min(iw, ih) * 0.2));
      partition(ix + d, iy + d, ix + iw - d - 1, iy + d, wall, [[ix + Math.floor(iw / 2) - 2, iy + d, 4, 1]]); partition(ix + d, iy + ih - d - 1, ix + iw - d - 1, iy + ih - d - 1, wall, [[ix + Math.floor(iw / 2) - 2, iy + ih - d - 1, 4, 1]]);
      partition(ix + d, iy + d, ix + d, iy + ih - d - 1, wall, [[ix + d, iy + Math.floor(ih / 2) - 2, 1, 4]]); partition(ix + iw - d - 1, iy + d, ix + iw - d - 1, iy + ih - d - 1, wall, [[ix + iw - d - 1, iy + Math.floor(ih / 2) - 2, 1, 4]]);
      B.rectF(ix + d + 1, iy + d + 1, iw - 2 * d - 2, ih - 2 * d - 2, F.GRASS); for (let k = 0; k < 6; k++) { const sx = ix + d + 3 + ri(0, iw - 2 * d - 8), sy = iy + d + 3 + ri(0, ih - 2 * d - 8); if (!B.get(sx, sy)) B.rectO(sx, sy, 2, 1, O.SANDBAG); }
      furn('seating', ix, iy, iw, d, wall); furn('seating', ix, iy + ih - d, iw, d, wall); furn('shop', ix, iy + d, d, ih - 2 * d, wall);
      return;
    }
    // rooms along both long sides (the strips); the middle is the main floor ('hall') or a corridor
    const depth = v.plan === 'corridor' ? Math.max(4, Math.floor(((horiz ? ih : iw) - 3) / 2)) : Math.max(4, Math.min(7, Math.round((horiz ? ih : iw) * 0.24)));
    const len = horiz ? iw : ih;
    for (const side of [0, 1]) {
      // the wall between the strip and the middle
      const off = side === 0 ? depth : (horiz ? ih : iw) - depth - 1;
      const cuts = []; for (let a = 0; a < len;) { let L = ri(6, 9); if (len - (a + L) < 5) L = len - a; cuts.push([a, L]); a += L + 1; }
      if (horiz) partition(ix, iy + off, ix + iw - 1, iy + off, wall, []); else partition(ix + off, iy, ix + off, iy + ih - 1, wall, []);
      cuts.forEach(([a, L], k) => {
        // a door from each room to the middle, and the wall to the next room
        const dpos = a + Math.floor(L / 2) - 1;
        if (horiz) B.clear(ix + dpos, iy + off, 2, 1); else B.clear(ix + off, iy + dpos, 1, 2);
        if (k < cuts.length - 1) { const wpos = a + L; if (horiz) partition(ix + wpos, side === 0 ? iy : iy + off + 1, ix + wpos, side === 0 ? iy + off - 1 : iy + ih - 1, wall, rng() < 0.4 ? [[ix + wpos, (side === 0 ? iy : iy + off + 1) + 1, 1, 2]] : []);
          else partition(side === 0 ? ix : ix + off + 1, iy + wpos, side === 0 ? ix + off - 1 : ix + iw - 1, iy + wpos, wall, rng() < 0.4 ? [[(side === 0 ? ix : ix + off + 1) + 1, iy + wpos, 2, 1]] : []); }
        const rx = horiz ? ix + a : side === 0 ? ix : ix + off + 1, ry = horiz ? (side === 0 ? iy : iy + off + 1) : iy + a, rw = horiz ? L : depth, rh = horiz ? depth : L;
        rooms.push([rx, ry, rw, rh]);
      });
    }
    // keep the room by each outside door free of furniture in front of the door; give every room its kind
    rooms.forEach(([rx, ry, rw, rh]) => { const kind = stories > 1 && rooms.indexOf(rooms.find(r => r[0] === rx && r[1] === ry)) % 5 === 0 ? 'stairs' : nextRoom(); furn(kind, rx, ry, rw, rh, wall); });
    // the main floor (or corridor)
    const mx = horiz ? ix : ix + depth + 1, my = horiz ? iy + depth + 1 : iy, mw = horiz ? iw : iw - 2 * depth - 2, mh = horiz ? ih - 2 * depth - 2 : ih;
    if (v.plan === 'hall' && mw > 4 && mh > 4) { // the main floor in parts, each with its own furniture, and a clear walk through the middle
      const parts = v.main.length;
      for (let k = 0; k < parts; k++) { const a = horiz ? mx + Math.floor(mw * k / parts) : mx, b = horiz ? my : my + Math.floor(mh * k / parts); furn(v.main[k], a, b, horiz ? Math.floor(mw / parts) : mw, horiz ? mh : Math.floor(mh / parts), wall); }
      if (horiz) B.clear(mx, my + Math.floor(mh / 2), mw, 1); else B.clear(mx + Math.floor(mw / 2), my, 1, mh);
    }
  };
  // the grounds around a building
  const grounds = (vn, bx, by, bw, bh) => {
    const out = new Set(vn.v.outside); if (M.parking) out.add('parking'); if (M.garden) out.add('garden'); if (M.walled) out.add('wall');
    const pad = 3, gx = bx - pad - 1, gy = by - pad - 1, gw = bw + 2 * pad + 2, gh = bh + 2 * pad + 2;
    for (let j = by - pad; j < by + bh + pad; j++) for (let i = bx - pad; i < bx + bw + pad; i++) if (B.ok(i, j) && !K.occ[j * W + i]) { B.floor(i, j, M.snow ? F.SNOW : F.COBBLE); B.obj(i, j, 0); K.occ[j * W + i] = 4; }
    const lotAt = (w, h) => { for (let t2 = 0; t2 < 30; t2++) { const x = ri(8, W - 8 - w), y = ri(3, H - 3 - h); if (K.free(x, y, w, h, 1)) return [x, y]; } return null; };
    if (out.has('parking')) { const L = lotAt(Math.round(14 * scale), 9); if (L) { B.rectF(L[0], L[1], Math.round(14 * scale), 9, F.ASPHALT); K.mark(L[0], L[1], Math.round(14 * scale), 9, 4); for (let y = L[1] + 1; y < L[1] + 8; y += 3) for (let x = L[0] + 1; x < L[0] + Math.round(14 * scale) - 2; x += 3) if (rng() < 0.65) B.rectO(x, y, 2, 1, O.CAR, Math.floor(rng() * 256)); } }
    if (out.has('plaza') || out.has('fountain')) { const fx = bx + Math.floor(bw / 2), fy = by - pad - 4; if (K.inb(fx, fy, 6)) { B.blob(fx, fy, 2, F.WATER, 0.4); for (let a = 0; a < 12; a++) { const px = Math.round(fx + Math.cos(a / 12 * 6.28) * 3.3), py = Math.round(fy + Math.sin(a / 12 * 6.28) * 3.3); if (B.ok(px, py) && !B.get(px, py)) B.obj(px, py, O.STONE); } K.mark(fx - 4, fy - 4, 9, 9, 4); } }
    if (out.has('garden') || out.has('hedges')) { for (let i = bx - pad; i < bx + bw + pad; i++) for (const j of [by - pad - 1, by + bh + pad]) if (B.ok(i, j) && !K.occ[j * W + i] && i % 5 && !B.get(i, j)) B.obj(i, j, O.HEDGE); }
    if (out.has('pool')) { const L = lotAt(10, 6); if (L) { B.rectF(L[0], L[1], 10, 6, F.TILE); B.rectF(L[0] + 2, L[1] + 1, 6, 4, F.WATER); K.mark(L[0], L[1], 10, 6, 4); } }
    if (out.has('field')) { const L = lotAt(Math.round(20 * scale), 12); if (L) { B.rectF(L[0], L[1], Math.round(20 * scale), 12, F.GRASS); K.mark(L[0], L[1], Math.round(20 * scale), 12, 4); } }
    if (out.has('graveyard')) { const L = lotAt(12, 8); if (L) { for (let y = L[1]; y < L[1] + 8; y += 2) for (let x = L[0]; x < L[0] + 12; x += 2) B.obj(x, y, O.STONE); K.mark(L[0], L[1], 12, 8, 4); } }
    if (out.has('containers')) for (let k = 0; k < 6; k++) { const L = lotAt(6, 2); if (L) { B.rectO(L[0], L[1], 6, 1, O.CONTAINER, Math.floor(rng() * 256)); K.mark(L[0], L[1], 6, 2, 4); } }
    if (out.has('sandbags')) for (let k = 0; k < 6; k++) K.sandbagNest(ri(10, W - 14), ri(4, H - 6));
    if (out.has('hay')) K.sprinkle(O.HAY, 20);
    if (out.has('fields')) for (let k = 0; k < 4; k++) { const L = lotAt(12, 8); if (L) { for (let y = L[1]; y < L[1] + 8; y++) for (let x = L[0]; x < L[0] + 12; x++) B.obj(x, y, O.WHEAT); K.mark(L[0], L[1], 12, 8, 5); } }
    if (out.has('pumps')) for (let k = 0; k < 4; k++) { const x = bx + 2 + k * 4, y = by + bh + pad + 2; if (B.ok(x, y) && !B.get(x, y)) { B.obj(x, y, O.BARREL); B.floor(x, y, F.CONCRETE); } }
    if (out.has('runway')) { const y = M.coast ? 4 : H - 9; B.rectF(0, y, W, 5, F.ASPHALT); for (let x = 2; x < W; x += 6) B.rectF(x, y + 2, 3, 1, F.LINE); K.mark(0, y, W, 5, 1); for (let k = 0; k < 2; k++) { const L = lotAt(14, 10); if (L) K.house(L[0], L[1], 14, 10, O.METALWALL, F.CONCRETE, { doors: ['s', 'n'], doorWidth: 6, windows: false, furnish: 'warehouse' }); } }
    if (out.has('rails')) { const y = by + bh + pad + 2; for (const dy of [0, 4]) if (y + dy + 1 < H - 2) { B.rectF(0, y + dy, W, 1, F.METAL); B.rectF(0, y + dy + 2, W, 1, F.METAL); K.mark(0, y + dy, W, 3, 1); } for (let k = 0; k < 5; k++) { const x = ri(8, W - 14); if (!B.get(x, y + 1)) B.rectO(x, y + 1, 6, 1, O.CONTAINER, Math.floor(rng() * 256)); } }
    if (out.has('sea') && !M.coast) for (let i = 0; i < W; i++) for (let j = H - 7; j < H; j++) { B.floor(i, j, F.WATER); K.occ[j * W + i] = 3; }
    if (out.has('piers')) for (let x = 12; x < W - 12; x += 16) { const top = H - 10; for (let j = top; j < H - 1; j++) if (m.floor[j * W + x] === F.WATER || m.floor[j * W + x + 1] === F.WATER) { B.rectF(x, j, 2, 1, F.BRIDGE); K.occ[j * W + x] = 1; } }
    if (out.has('moat')) for (let j = gy - 2; j < gy + gh + 2; j++) for (let i = gx - 2; i < gx + gw + 2; i++) { if (!B.ok(i, j)) continue; const e = i < gx || j < gy || i >= gx + gw || j >= gy + gh; if (e && !K.occ[j * W + i] && Math.abs(j - (by + bh / 2)) > 2) { B.floor(i, j, F.WATER); K.occ[j * W + i] = 3; } }
    if (out.has('wall') || out.has('curtain') || out.has('yard') || out.has('towers')) {
      const wm = out.has('curtain') ? O.FIELDSTONE : vn.v.wall === O.CONCRETE || out.has('wall') ? O.CONCRETE : O.CHAINLINK, ex = gx - 3, ey = gy - 3, ew = gw + 6, eh = gh + 6;
      for (let i = ex; i < ex + ew; i++) for (const j of [ey, ey + eh - 1]) if (B.ok(i, j) && Math.abs(i - (ex + ew / 2)) > 2 && K.occ[j * W + i] !== 1) B.obj(i, j, out.has('wall') || out.has('curtain') ? wm : O.CHAINLINK);
      for (let j = ey; j < ey + eh; j++) for (const i of [ex, ex + ew - 1]) if (B.ok(i, j) && Math.abs(j - (ey + eh / 2)) > 2 && K.occ[j * W + i] !== 1) B.obj(i, j, out.has('wall') || out.has('curtain') ? wm : O.CHAINLINK);
      if (out.has('towers')) for (const [tx, ty] of [[ex - 1, ey - 1], [ex + ew - 4, ey - 1], [ex - 1, ey + eh - 4], [ex + ew - 4, ey + eh - 4]]) if (K.inb(tx, ty, 2) && K.inb(tx + 4, ty + 4, 2)) { B.clear(tx, ty, 5, 5); K.house(tx, ty, 5, 5, O.CONCRETE, F.CONCRETE, { doors: ['s'], stories: 2 }); }
    }
  };
  // place the asked-for buildings: the first in the middle, the others around it (repeats for counts)
  const placed = [];
  list.slice(0, 6).forEach((vn, k) => {
    let [bw, bh] = sizeOf(vn);
    let spot = null;
    if (k === 0) { const x = Math.round(W / 2 - bw / 2), y = Math.round(H / 2 - bh / 2) + (M.coast ? -3 : 0); for (let j = y - 3; j < y + bh + 3; j++) for (let i = x - 3; i < x + bw + 3; i++) if (K.inb(i, j) && (K.occ[j * W + i] === 1 || K.occ[j * W + i] === 3)) { K.occ[j * W + i] = 0; m.floor[j * W + i] = ground; } if (K.free(x, y, bw, bh, 3)) spot = [x, y]; }
    for (let t2 = 0; !spot && t2 < 300; t2++) { const s = t2 > 200 ? 0.65 : t2 > 100 ? 0.8 : 1, w2 = Math.round(bw * s), h2 = Math.round(bh * s), x = ri(9, W - 9 - w2), y = ri(3, H - 3 - h2); if (K.free(x, y, w2, h2, t2 > 150 ? 2 : 4)) { spot = [x, y]; bw = w2; bh = h2; } }
    if (!spot) return;
    build(vn, spot[0], spot[1], bw, bh); placed.push([vn, spot[0], spot[1], bw, bh]);
  });
  placed.forEach(([vn, x, y, w, h]) => grounds(vn, x, y, w, h));
  // around the buildings: city blocks, a village, or open country, so there is always somewhere to fight through
  if (M.city) { // a street grid around the buildings, the blocks filled with buildings
    const step = Math.round(22 * Math.min(1.2, scale)), road = (x, y) => { if (K.inb(x, y) && !K.occ[y * W + x]) { m.floor[y * W + x] = F.ASPHALT; m.obj[y * W + x] = 0; K.occ[y * W + x] = 1; } };
    const xs = [], ys = []; for (let x = 9 + ri(0, 6); x < W - 9; x += step) xs.push(x); for (let y = 4 + ri(0, 5); y < H - 4; y += Math.round(step * 0.8)) ys.push(y);
    xs.forEach(x => { for (let y = 0; y < H; y++) for (let d = 0; d < 4; d++) road(x + d, y); }); ys.forEach(y => { for (let x = 0; x < W; x++) for (let d = 0; d < 4; d++) road(x, y + d); });
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) if (!K.occ[y * W + x] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => K.occ[(y + dy) * W + x + dx] === 1)) { m.floor[y * W + x] = F.CONCRETE; K.occ[y * W + x] = 4; } // pavements
    const cols = [7, ...xs.map(x => x + 4), W - 7], rows = [1, ...ys.map(y => y + 4), H - 1];
    for (let r = 0; r < rows.length - 1; r++) for (let c = 0; c < cols.length - 1; c++) { const x0 = cols[c] + 1, y0 = rows[r] + 1, w = (c < xs.length ? xs[c] : W - 7) - x0 - 1, h = (r < ys.length ? ys[r] : H - 1) - y0 - 1; if (w >= 8 && h >= 7) K.fillPlot(x0, y0, w, h, () => ({ wall: M.ruined ? O.RUIN : rng() < 0.5 ? O.BRICK : O.CONCRETE, floor: F.WOOD, opts: { doors: ['n', 's', 'e', 'w'].filter(() => rng() < 0.5).concat(['s']), furnish: true, stories: rng() < 0.4 ? 3 : 2 } })); }
  }
  const town = M.city || !placed.length;
  if (town) { const pick = () => ({ wall: M.ruined ? O.RUIN : M.desert ? O.MUDBRICK : M.snow ? O.WOODWALL : rng() < 0.5 ? O.BRICK : O.STUCCO, floor: F.WOOD, opts: { doors: ['n', 's'], furnish: true } });
    for (let t2 = 0; t2 < 60 && m.buildings.length < W * H / (placed.length ? 700 : 450); t2++) { const x = ri(9, W - 22), y = ri(3, H - 14), w = ri(9, 13), h = ri(7, 10); if (K.free(x, y, w, h, 2)) K.house(x, y, w, h, pick().wall, F.WOOD, pick().opts); } }
  else for (let t2 = 0; t2 < 30 && m.buildings.length < placed.length + Math.round(W * H / 2200); t2++) { const x = ri(9, W - 20), y = ri(3, H - 12), w = ri(8, 11), h = ri(7, 9); if (K.free(x, y, w, h, 3)) K.house(x, y, w, h, M.desert ? O.MUDBRICK : M.snow ? O.WOODWALL : O.WHITEWOOD, F.WOOD, { doors: ['n', 's'], furnish: true }); }
  // ruins: broken walls, rubble, craters
  if (M.ruined) { for (let i = 0; i < W * H; i++) if (isWallObj(m.obj[i]) && hash2(i % W, (i / W) | 0, 77) < 0.08 && !(m.floor[i] === F.WATER)) m.obj[i] = hash2(i, 3, 5) < 0.5 ? 0 : O.RUIN; K.sprinkle(O.CRATE, 30); K.sprinkle(O.BARREL, 20); for (let k = 0; k < 10; k++) { const x = ri(8, W - 8), y = ri(4, H - 4); if (!K.occ[y * W + x]) B.blob(x, y, 1.8, F.MUD, 1); } }
  // nature and cover
  const tree = M.snow ? O.PINE : M.desert || M.jungle ? O.PALM : O.TREE;
  const woods = M.forest || M.jungle ? 22 : M.desert ? 3 : M.city ? 2 : 8;
  for (let k = 0; k < woods * scale; k++) K.forest(k + 200, tree, ri(4, W - 4), ri(4, H - 4), ri(4, 9), M.jungle ? 0.55 : 0.35);
  K.sprinkle(M.desert ? O.ROCK : O.BUSH, Math.round(W * H / (M.desert ? 260 : 120))); K.sprinkle(O.ROCK, Math.round(W * H / 500));
  if (M.city) { K.sprinkle(O.CAR, Math.round(W * H / 700), (x, y) => m.floor[y * W + x] === F.ASPHALT); K.sprinkle(O.BARREL, 12); }
  if (M.rural) K.sprinkle(O.HAY, 14);
  m.described = { name: descMapName(o.prompt, m.seed), summary: descSummary(p) };
  m.terrainProf = { amp: M.snow || M.rural || M.forest ? 46 : M.city ? 14 : 24, wave: 30 };
};

// how well a generated map plays: the spawns reach each other, there is cover in between, and room to move
function scoreMap(m) {
  const W = m.w, H = m.h, s0 = m.spawns[0][0], s1 = m.spawns[1][0]; if (!s0 || !s1) return -1;
  const pass = i => { const o = m.obj[i]; return m.floor[i] !== F.WATER && !(o && MAT[o].solid); };
  const seen = new Uint8Array(W * H), q = [Math.floor(s0.y / T) * W + Math.floor(s0.x / T)]; seen[q[0]] = 1; let n = 0;
  while (q.length) { const c = q.pop(); n++; const x = c % W, y = (c / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = x + dx, b = y + dy; if (a < 0 || b < 0 || a >= W || b >= H) continue; const i = b * W + a; if (!seen[i] && pass(i)) { seen[i] = 1; q.push(i); } } }
  const reach = seen[Math.floor(s1.y / T) * W + Math.floor(s1.x / T)] ? 1 : 0;
  let walk = 0, cover = 0; for (let i = 0; i < W * H; i++) { if (pass(i)) walk++; if (m.obj[i] && MAT[m.obj[i]].cover) cover++; }
  return reach * 100 + 40 * n / Math.max(1, walk) + Math.min(20, cover / (W * H) * 400) + Math.min(20, (m.buildings || []).length);
}
