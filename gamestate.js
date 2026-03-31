// ============================================================
//  DOMINION — Game State Manager
//  Pure logic: state mutations, validation, serialization
// ============================================================

class GameState {
  constructor() {
    this.reset();
  }

  reset() {
    this.players = [];          // [{ id, name, color, troops, cards, alive }]
    this.territories = {};      // { id: { owner: playerId, troops: n } }
    this.turn = 0;              // index into players
    this.phase = 'draft';       // draft | attack | fortify
    this.round = 1;
    this.status = 'lobby';      // lobby | playing | ended
    this.winner = null;
    this.log = [];              // game event log
    this.pendingTrades = [];    // [{ from, to, offer: {troops,cards}, want: {troops,cards}, id }]
    this.alliances = [];        // [{ players: [id,id], round: n }]
    this.attackState = null;    // { from, to, attackDice, defendDice, result } — during animation
    this.cardDeck = [];
    this.nextCardTrade = 4;     // troops for next card set trade (increases each time)
    this.troopsToPlace = 0;     // during draft phase
    this.conqueredThisTurn = false; // earned a card this turn?
    this.fortifyUsed = false;
  }

  // ─── Setup ────────────────────────────────────────────────

  initPlayers(playerDefs) {
    // playerDefs: [{ id, name, colorIdx }]
    this.players = playerDefs.map((p, i) => ({
      id: p.id,
      name: p.name,
      color: GAME.PLAYER_COLORS[p.colorIdx ?? i],
      troops: 0,
      cards: [],
      alive: true,
    }));
  }

  distributeMap() {
    const ids = Object.keys(GAME.TERRITORIES);
    const shuffled = [...ids].sort(() => Math.random() - 0.5);
    const n = this.players.length;
    const startTroops = GAME.INITIAL_TROOPS[n] ?? 20;

    // Init all territories
    for (const id of ids) {
      this.territories[id] = { owner: null, troops: 0 };
    }

    // Round-robin assign
    shuffled.forEach((tid, i) => {
      const player = this.players[i % n];
      this.territories[tid] = { owner: player.id, troops: 1 };
      player.troops += 1;
    });

    // Give each player remaining troops to distribute
    for (const p of this.players) {
      const owned = this.getPlayerTerritories(p.id).length;
      p.troops = startTroops; // total pool; they spend during initial placement
    }

    // Auto-place remaining for simplicity (random on owned)
    for (const p of this.players) {
      const owned = this.getPlayerTerritories(p.id);
      let remaining = p.troops - owned.length;
      while (remaining > 0) {
        const tid = owned[Math.floor(Math.random() * owned.length)];
        this.territories[tid].troops++;
        remaining--;
      }
      p.troops = 0; // clear pool after placement
    }

    // Build card deck
    this.buildDeck();
    this.status = 'playing';
    this.startTurn();
  }

  buildDeck() {
    const tids = Object.keys(GAME.TERRITORIES);
    const types = ['infantry', 'cavalry', 'artillery'];
    this.cardDeck = [];
    tids.forEach((tid, i) => {
      this.cardDeck.push({ territory: tid, type: types[i % 3] });
    });
    // Add 2 wilds
    this.cardDeck.push({ territory: null, type: 'wild' });
    this.cardDeck.push({ territory: null, type: 'wild' });
    // Shuffle
    this.cardDeck.sort(() => Math.random() - 0.5);
  }

  drawCard(playerId) {
    if (this.cardDeck.length === 0) this.buildDeck();
    const card = this.cardDeck.pop();
    const p = this.getPlayer(playerId);
    if (p) p.cards.push(card);
    return card;
  }

  // ─── Turn Management ──────────────────────────────────────

  startTurn() {
    const p = this.currentPlayer();
    const owned = this.getPlayerTerritories(p.id);
    const continents = GAME.getOwnedContinents(owned);
    this.troopsToPlace = GAME.calcDraftTroops(owned.length, continents);
    this.phase = 'draft';
    this.conqueredThisTurn = false;
    this.fortifyUsed = false;
    this.attackState = null;
    this.addLog(`${p.name}'s turn — ${this.troopsToPlace} troops to draft`);
  }

  endPhase() {
    if (this.phase === 'draft') {
      if (this.troopsToPlace > 0) return { error: 'Place all troops first' };
      this.phase = 'attack';
      this.addLog(`${this.currentPlayer().name} enters Attack phase`);
    } else if (this.phase === 'attack') {
      this.phase = 'fortify';
      // Award card if conquered a territory
      if (this.conqueredThisTurn) {
        this.drawCard(this.currentPlayer().id);
      }
      this.addLog(`${this.currentPlayer().name} enters Fortify phase`);
    } else if (this.phase === 'fortify') {
      this.nextTurn();
    }
    return { ok: true };
  }

  nextTurn() {
    let next = (this.turn + 1) % this.players.length;
    let tries = 0;
    while (!this.players[next].alive && tries < this.players.length) {
      next = (next + 1) % this.players.length;
      tries++;
    }
    if (tries >= this.players.length) {
      this.endGame(this.currentPlayer().id);
      return;
    }
    if (next <= this.turn) this.round++;
    this.turn = next;
    this.startTurn();
  }

  // ─── Draft Phase ──────────────────────────────────────────

  placeTroop(playerId, territoryId, count = 1) {
    if (this.phase !== 'draft') return { error: 'Not draft phase' };
    const p = this.currentPlayer();
    if (p.id !== playerId) return { error: 'Not your turn' };
    const t = this.territories[territoryId];
    if (!t || t.owner !== playerId) return { error: 'Not your territory' };
    if (this.troopsToPlace < count) return { error: 'Not enough troops' };
    t.troops += count;
    this.troopsToPlace -= count;
    return { ok: true };
  }

  // ─── Card Trading ─────────────────────────────────────────

  tradeCards(playerId, cardIndices) {
    if (this.phase !== 'draft') return { error: 'Trade cards during draft phase only' };
    const p = this.getPlayer(playerId);
    if (!p) return { error: 'Player not found' };
    if (cardIndices.length !== 3) return { error: 'Must select 3 cards' };

    const cards = cardIndices.map(i => p.cards[i]);
    if (cards.some(c => !c)) return { error: 'Invalid card selection' };

    // Check valid set
    const types = cards.map(c => c.type);
    const allSame = types.every(t => t === types[0] || t === 'wild');
    const allDiff = new Set(types.filter(t => t !== 'wild')).size === types.filter(t => t !== 'wild').length;
    const hasWild = types.includes('wild');
    
    let troops = 0;
    const sortedTypes = [...types].filter(t => t !== 'wild').sort();
    
    if (types.every(t => t === 'wild')) troops = 15;
    else if (types.filter(t => t === types.filter(t2 => t2 !== 'wild')[0] || t === 'wild').length === 3) troops = this.nextCardTrade;
    else if (allSame && !hasWild) troops = this.nextCardTrade;
    else if ((new Set(types).size === 3) || (hasWild && new Set(types.filter(t => t!=='wild')).size >= 1)) troops = this.nextCardTrade;
    else return { error: 'Not a valid set (need 3 of same, or one of each type)' };

    // Bonus if you own the territory on a traded card
    let bonus = 0;
    for (const card of cards) {
      if (card.territory && this.territories[card.territory]?.owner === playerId) {
        bonus += GAME.TERRITORY_CARD_BONUS;
        this.territories[card.territory].troops += GAME.TERRITORY_CARD_BONUS;
      }
    }

    // Remove cards
    const sorted = [...cardIndices].sort((a,b) => b - a);
    for (const i of sorted) p.cards.splice(i, 1);

    this.troopsToPlace += troops;
    this.nextCardTrade = Math.min(this.nextCardTrade + 2, 15);
    this.addLog(`${p.name} traded cards for ${troops} troops`);
    return { ok: true, troops, bonus };
  }

  // ─── Attack Phase ─────────────────────────────────────────

  attack(playerId, fromId, toId, numAttackers) {
    if (this.phase !== 'attack') return { error: 'Not attack phase' };
    const p = this.currentPlayer();
    if (p.id !== playerId) return { error: 'Not your turn' };
    const from = this.territories[fromId];
    const to = this.territories[toId];
    if (!from || from.owner !== playerId) return { error: 'Must attack from your territory' };
    if (!to || to.owner === playerId) return { error: 'Must attack enemy territory' };
    if (!GAME.TERRITORIES[fromId].adj.includes(toId)) return { error: 'Not adjacent' };
    if (from.troops < 2) return { error: 'Need at least 2 troops to attack' };
    if (this.isAlly(playerId, to.owner)) return { error: 'Cannot attack an ally' };

    const attackers = Math.min(numAttackers, from.troops - 1, 3);
    const defenders = Math.min(to.troops, 2);

    const aDice = GAME.rollDice(attackers).sort((a,b)=>b-a);
    const dDice = GAME.rollDice(defenders).sort((a,b)=>b-a);
    const { attackerLosses, defenderLosses } = GAME.resolveCombat(aDice, dDice);

    from.troops -= attackerLosses;
    to.troops -= defenderLosses;

    let conquered = false;
    if (to.troops <= 0) {
      const defenderPlayer = this.getPlayer(to.owner);
      const prevOwner = to.owner;
      to.owner = playerId;
      to.troops = attackers - attackerLosses;
      from.troops -= (attackers - attackerLosses);
      conquered = true;
      this.conqueredThisTurn = true;

      // Check if defender is eliminated
      if (this.getPlayerTerritories(prevOwner).length === 0) {
        const defeated = this.getPlayer(prevOwner);
        defeated.alive = false;
        // Attacker gets all defeated player's cards
        p.cards.push(...defeated.cards);
        defeated.cards = [];
        this.addLog(`${defeated.name} has been eliminated by ${p.name}!`);
      }

      // Check win condition
      const totalTerr = Object.keys(GAME.TERRITORIES).length;
      if (this.getPlayerTerritories(playerId).length === totalTerr) {
        this.endGame(playerId);
      }
    }

    this.attackState = { fromId, toId, aDice, dDice, attackerLosses, defenderLosses, conquered };
    this.addLog(`${p.name} attacks ${GAME.TERRITORIES[toId].name}: [${aDice}] vs [${dDice}] → A-${attackerLosses}, D-${defenderLosses}${conquered?' CONQUERED':''}`);
    return { ok: true, ...this.attackState };
  }

  // ─── Fortify Phase ────────────────────────────────────────

  fortify(playerId, fromId, toId, troops) {
    if (this.phase !== 'fortify') return { error: 'Not fortify phase' };
    if (this.fortifyUsed) return { error: 'Already fortified this turn' };
    const p = this.currentPlayer();
    if (p.id !== playerId) return { error: 'Not your turn' };
    const from = this.territories[fromId];
    const to = this.territories[toId];
    if (!from || from.owner !== playerId) return { error: 'Source not yours' };
    if (!to || to.owner !== playerId) return { error: 'Dest not yours' };
    if (from.troops - troops < 1) return { error: 'Must leave at least 1 troop' };
    if (!this.pathExists(playerId, fromId, toId)) return { error: 'No connected path' };

    from.troops -= troops;
    to.troops += troops;
    this.fortifyUsed = true;
    this.addLog(`${p.name} fortified ${troops} troops from ${GAME.TERRITORIES[fromId].name} to ${GAME.TERRITORIES[toId].name}`);
    return { ok: true };
  }

  pathExists(playerId, fromId, toId) {
    if (fromId === toId) return true;
    const visited = new Set();
    const queue = [fromId];
    while (queue.length) {
      const cur = queue.shift();
      if (cur === toId) return true;
      visited.add(cur);
      for (const adj of GAME.TERRITORIES[cur].adj) {
        if (!visited.has(adj) && this.territories[adj]?.owner === playerId) {
          queue.push(adj);
        }
      }
    }
    return false;
  }

  // ─── Trading (between players) ────────────────────────────

  proposeTrade(fromId, toId, offer) {
    // offer: { troops: n }   (simplified troop trading)
    const from = this.getPlayer(fromId);
    const to = this.getPlayer(toId);
    if (!from || !to) return { error: 'Invalid players' };
    if (offer.troops > 0 && this.getPlayerTerritories(fromId).length === 0) return { error: 'No territories' };

    const trade = {
      id: Date.now() + Math.random(),
      from: fromId,
      to: toId,
      offer,
      status: 'pending',
    };
    this.pendingTrades.push(trade);
    this.addLog(`${from.name} proposed a trade to ${to.name}`);
    return { ok: true, tradeId: trade.id };
  }

  acceptTrade(tradeId, playerId) {
    const trade = this.pendingTrades.find(t => t.id === tradeId);
    if (!trade || trade.to !== playerId) return { error: 'Trade not found' };
    if (trade.status !== 'pending') return { error: 'Trade already resolved' };

    // Transfer troops: from sends troops to a random "to" territory
    const fromPlayer = this.getPlayer(trade.from);
    if (trade.offer.troops > 0) {
      const fromTerrs = this.getPlayerTerritories(trade.from);
      const toTerrs = this.getPlayerTerritories(trade.to);
      if (fromTerrs.length && toTerrs.length) {
        // Remove from most populated from-territory
        const src = fromTerrs.reduce((a,b) => this.territories[a].troops > this.territories[b].troops ? a : b);
        const dst = toTerrs[0];
        const actual = Math.min(trade.offer.troops, this.territories[src].troops - 1);
        if (actual > 0) {
          this.territories[src].troops -= actual;
          this.territories[dst].troops += actual;
          this.addLog(`Trade: ${fromPlayer.name} sent ${actual} troops to ${this.getPlayer(trade.to).name}`);
        }
      }
    }

    trade.status = 'accepted';
    return { ok: true };
  }

  rejectTrade(tradeId, playerId) {
    const trade = this.pendingTrades.find(t => t.id === tradeId);
    if (!trade || trade.to !== playerId) return { error: 'Trade not found' };
    trade.status = 'rejected';
    return { ok: true };
  }

  // ─── Alliances ────────────────────────────────────────────

  proposeAlliance(fromId, toId) {
    if (this.isAlly(fromId, toId)) return { error: 'Already allied' };
    const existing = this.pendingTrades.find(t =>
      t.type === 'alliance' && ((t.from === fromId && t.to === toId) || (t.from === toId && t.to === fromId)) && t.status === 'pending'
    );
    if (existing) return { error: 'Alliance proposal already pending' };
    const prop = { id: Date.now() + Math.random(), type: 'alliance', from: fromId, to: toId, status: 'pending' };
    this.pendingTrades.push(prop);
    this.addLog(`${this.getPlayer(fromId).name} proposed alliance to ${this.getPlayer(toId).name}`);
    return { ok: true, propId: prop.id };
  }

  acceptAlliance(propId, playerId) {
    const prop = this.pendingTrades.find(t => t.id === propId && t.type === 'alliance');
    if (!prop || prop.to !== playerId) return { error: 'Not found' };
    prop.status = 'accepted';
    this.alliances.push({ players: [prop.from, prop.to], round: this.round });
    this.addLog(`${this.getPlayer(prop.from).name} and ${this.getPlayer(playerId).name} formed an alliance!`);
    return { ok: true };
  }

  breakAlliance(p1, p2) {
    this.alliances = this.alliances.filter(a => !(a.players.includes(p1) && a.players.includes(p2)));
    this.addLog(`Alliance between ${this.getPlayer(p1).name} and ${this.getPlayer(p2).name} broken!`);
  }

  isAlly(p1, p2) {
    return this.alliances.some(a => a.players.includes(p1) && a.players.includes(p2));
  }

  // ─── Helpers ──────────────────────────────────────────────

  currentPlayer() { return this.players[this.turn]; }
  getPlayer(id)   { return this.players.find(p => p.id === id); }
  getPlayerTerritories(playerId) {
    return Object.entries(this.territories).filter(([,t]) => t.owner === playerId).map(([id]) => id);
  }

  addLog(msg) {
    this.log.push({ msg, turn: this.turn, round: this.round, time: Date.now() });
    if (this.log.length > 100) this.log.shift();
  }

  endGame(winnerId) {
    this.status = 'ended';
    this.winner = winnerId;
    this.addLog(`🏆 ${this.getPlayer(winnerId).name} has conquered the world!`);
  }

  serialize() {
    return JSON.stringify({
      players: this.players,
      territories: this.territories,
      turn: this.turn,
      phase: this.phase,
      round: this.round,
      status: this.status,
      winner: this.winner,
      log: this.log.slice(-20),
      pendingTrades: this.pendingTrades,
      alliances: this.alliances,
      cardDeck: this.cardDeck,
      nextCardTrade: this.nextCardTrade,
      troopsToPlace: this.troopsToPlace,
      conqueredThisTurn: this.conqueredThisTurn,
      fortifyUsed: this.fortifyUsed,
      attackState: this.attackState,
    });
  }

  loadFrom(data) {
    const d = typeof data === 'string' ? JSON.parse(data) : data;
    Object.assign(this, d);
  }
}

window.GameState = GameState;
