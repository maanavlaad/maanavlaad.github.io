// ============================================================
//  DOMINION — Game Data
//  Territories, adjacency, continents, cards
// ============================================================

const CONTINENTS = {
  northAmerica: { name: 'North America', bonus: 5, color: '#c8a96e', territories: ['alaska','northwest','alberta','ontario','quebec','western_us','eastern_us','central_america','greenland'] },
  southAmerica: { name: 'South America', bonus: 2, color: '#8fba6a', territories: ['venezuela','peru','brazil','argentina'] },
  europe:       { name: 'Europe',        bonus: 5, color: '#7ba7c4', territories: ['iceland','great_britain','western_europe','northern_europe','scandinavia','ukraine','southern_europe'] },
  africa:       { name: 'Africa',        bonus: 3, color: '#d4a84b', territories: ['north_africa','egypt','east_africa','congo','south_africa','madagascar'] },
  asia:         { name: 'Asia',          bonus: 7, color: '#b07ab0', territories: ['ural','siberia','yakutsk','kamchatka','irkutsk','mongolia','japan','china','india','siam','middle_east','afghanistan'] },
  australia:    { name: 'Australia',     bonus: 2, color: '#e8855a', territories: ['indonesia','new_guinea','western_australia','eastern_australia'] },
};

const TERRITORIES = {
  // North America
  alaska:          { name: 'Alaska',           continent: 'northAmerica', x: 70,  y: 95,  adj: ['northwest','alberta','kamchatka'] },
  northwest:       { name: 'Northwest Terr.',  continent: 'northAmerica', x: 150, y: 95,  adj: ['alaska','alberta','ontario','greenland'] },
  alberta:         { name: 'Alberta',           continent: 'northAmerica', x: 140, y: 150, adj: ['alaska','northwest','ontario','western_us'] },
  ontario:         { name: 'Ontario',           continent: 'northAmerica', x: 200, y: 145, adj: ['northwest','alberta','western_us','eastern_us','quebec','greenland'] },
  quebec:          { name: 'Quebec',            continent: 'northAmerica', x: 265, y: 130, adj: ['ontario','eastern_us','greenland'] },
  western_us:      { name: 'Western US',        continent: 'northAmerica', x: 140, y: 200, adj: ['alberta','ontario','eastern_us','central_america'] },
  eastern_us:      { name: 'Eastern US',        continent: 'northAmerica', x: 210, y: 200, adj: ['ontario','quebec','western_us','central_america'] },
  central_america: { name: 'Central America',  continent: 'northAmerica', x: 165, y: 255, adj: ['western_us','eastern_us','venezuela'] },
  greenland:       { name: 'Greenland',         continent: 'northAmerica', x: 320, y: 60,  adj: ['northwest','ontario','quebec','iceland'] },

  // South America
  venezuela:  { name: 'Venezuela',  continent: 'southAmerica', x: 225, y: 300, adj: ['central_america','peru','brazil'] },
  peru:       { name: 'Peru',       continent: 'southAmerica', x: 215, y: 355, adj: ['venezuela','brazil','argentina'] },
  brazil:     { name: 'Brazil',     continent: 'southAmerica', x: 275, y: 340, adj: ['venezuela','peru','argentina','north_africa'] },
  argentina:  { name: 'Argentina',  continent: 'southAmerica', x: 235, y: 415, adj: ['peru','brazil'] },

  // Europe
  iceland:           { name: 'Iceland',           continent: 'europe', x: 390, y: 90,  adj: ['greenland','great_britain','scandinavia'] },
  great_britain:     { name: 'Great Britain',     continent: 'europe', x: 390, y: 145, adj: ['iceland','western_europe','northern_europe','scandinavia'] },
  western_europe:    { name: 'Western Europe',    continent: 'europe', x: 390, y: 210, adj: ['great_britain','northern_europe','southern_europe','north_africa'] },
  northern_europe:   { name: 'Northern Europe',   continent: 'europe', x: 450, y: 165, adj: ['great_britain','western_europe','southern_europe','scandinavia','ukraine'] },
  scandinavia:       { name: 'Scandinavia',        continent: 'europe', x: 460, y: 100, adj: ['iceland','great_britain','northern_europe','ukraine'] },
  ukraine:           { name: 'Ukraine',            continent: 'europe', x: 520, y: 140, adj: ['scandinavia','northern_europe','southern_europe','afghanistan','middle_east','ural'] },
  southern_europe:   { name: 'Southern Europe',   continent: 'europe', x: 455, y: 215, adj: ['western_europe','northern_europe','ukraine','egypt','north_africa','middle_east'] },

  // Africa
  north_africa: { name: 'North Africa', continent: 'africa', x: 420, y: 295, adj: ['western_europe','southern_europe','egypt','east_africa','congo','brazil'] },
  egypt:        { name: 'Egypt',        continent: 'africa', x: 490, y: 270, adj: ['southern_europe','north_africa','east_africa','middle_east'] },
  east_africa:  { name: 'East Africa',  continent: 'africa', x: 510, y: 330, adj: ['egypt','north_africa','congo','south_africa','madagascar','middle_east'] },
  congo:        { name: 'Congo',        continent: 'africa', x: 460, y: 360, adj: ['north_africa','east_africa','south_africa'] },
  south_africa: { name: 'South Africa', continent: 'africa', x: 470, y: 420, adj: ['congo','east_africa','madagascar'] },
  madagascar:   { name: 'Madagascar',   continent: 'africa', x: 540, y: 400, adj: ['east_africa','south_africa'] },

  // Asia
  ural:        { name: 'Ural',         continent: 'asia', x: 595, y: 110, adj: ['ukraine','siberia','china','afghanistan'] },
  siberia:     { name: 'Siberia',      continent: 'asia', x: 660, y: 90,  adj: ['ural','yakutsk','irkutsk','mongolia','china'] },
  yakutsk:     { name: 'Yakutsk',      continent: 'asia', x: 730, y: 70,  adj: ['siberia','irkutsk','kamchatka'] },
  kamchatka:   { name: 'Kamchatka',    continent: 'asia', x: 800, y: 85,  adj: ['yakutsk','irkutsk','mongolia','japan','alaska'] },
  irkutsk:     { name: 'Irkutsk',      continent: 'asia', x: 720, y: 130, adj: ['siberia','yakutsk','kamchatka','mongolia'] },
  mongolia:    { name: 'Mongolia',     continent: 'asia', x: 730, y: 175, adj: ['siberia','irkutsk','kamchatka','japan','china'] },
  japan:       { name: 'Japan',        continent: 'asia', x: 810, y: 165, adj: ['kamchatka','mongolia'] },
  china:       { name: 'China',        continent: 'asia', x: 700, y: 210, adj: ['ural','siberia','mongolia','siam','india','afghanistan'] },
  india:       { name: 'India',        continent: 'asia', x: 640, y: 245, adj: ['china','siam','afghanistan','middle_east'] },
  siam:        { name: 'Siam',         continent: 'asia', x: 730, y: 265, adj: ['china','india','indonesia'] },
  middle_east: { name: 'Middle East',  continent: 'asia', x: 570, y: 235, adj: ['ukraine','southern_europe','egypt','east_africa','india','afghanistan'] },
  afghanistan: { name: 'Afghanistan',  continent: 'asia', x: 610, y: 190, adj: ['ukraine','ural','china','india','middle_east'] },

  // Australia
  indonesia:         { name: 'Indonesia',         continent: 'australia', x: 740, y: 340, adj: ['siam','new_guinea','western_australia'] },
  new_guinea:        { name: 'New Guinea',         continent: 'australia', x: 820, y: 330, adj: ['indonesia','western_australia','eastern_australia'] },
  western_australia: { name: 'Western Australia', continent: 'australia', x: 770, y: 405, adj: ['indonesia','new_guinea','eastern_australia'] },
  eastern_australia: { name: 'Eastern Australia', continent: 'australia', x: 840, y: 405, adj: ['new_guinea','western_australia'] },
};

// Card types for trading
const CARD_TYPES = ['infantry', 'cavalry', 'artillery', 'wild'];

// Card sets and their troop values
const CARD_TRADE_SETS = [
  { set: ['infantry','infantry','infantry'],      troops: 4  },
  { set: ['cavalry','cavalry','cavalry'],         troops: 6  },
  { set: ['artillery','artillery','artillery'],   troops: 8  },
  { set: ['infantry','cavalry','artillery'],      troops: 10 },
  { set: ['wild','wild','wild'],                  troops: 12 },
];

// Territory bonus — if you own the territory whose card you trade in
const TERRITORY_CARD_BONUS = 2;

// Player colors
const PLAYER_COLORS = [
  { name: 'Crimson',  hex: '#c0392b', light: '#e74c3c' },
  { name: 'Ocean',    hex: '#2471a3', light: '#3498db' },
  { name: 'Forest',   hex: '#1e8449', light: '#27ae60' },
  { name: 'Gold',     hex: '#b7950b', light: '#f1c40f' },
  { name: 'Violet',   hex: '#7d3c98', light: '#9b59b6' },
  { name: 'Slate',    hex: '#2e4057', light: '#5d6d7e' },
];

// Game phases in turn order
const PHASES = ['draft', 'attack', 'fortify'];

// Initial troop counts by player count
const INITIAL_TROOPS = { 2: 40, 3: 35, 4: 30, 5: 25, 6: 20 };

// Troops earned per turn = max(3, floor(territories_owned / 3))
function calcDraftTroops(territoriesOwned, continentsOwned) {
  let base = Math.max(3, Math.floor(territoriesOwned / 3));
  for (const cid of continentsOwned) {
    base += CONTINENTS[cid].bonus;
  }
  return base;
}

function getOwnedContinents(playerTerritories) {
  const owned = [];
  for (const [cid, cont] of Object.entries(CONTINENTS)) {
    if (cont.territories.every(t => playerTerritories.includes(t))) {
      owned.push(cid);
    }
  }
  return owned;
}

function rollDice(n) {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 6) + 1).sort((a, b) => b - a);
}

function resolveCombat(attackDice, defendDice) {
  // Returns { attackerLosses, defenderLosses }
  const pairs = Math.min(attackDice.length, defendDice.length);
  let attackerLosses = 0, defenderLosses = 0;
  for (let i = 0; i < pairs; i++) {
    if (attackDice[i] > defendDice[i]) defenderLosses++;
    else attackerLosses++;
  }
  return { attackerLosses, defenderLosses };
}

window.GAME = { CONTINENTS, TERRITORIES, CARD_TYPES, CARD_TRADE_SETS, PLAYER_COLORS, PHASES, INITIAL_TROOPS, calcDraftTroops, getOwnedContinents, rollDice, resolveCombat, TERRITORY_CARD_BONUS };
