// ============================================================
//  DOMINION — Main Game Controller
// ============================================================

class GameController {
  constructor() {
    this.state = new GameState();
    this.renderer = null;
    this.sync = null;
    this.myPlayerId = null;
    this.myPlayerName = null;
    this.selectedTerritory = null;
    this.isHost = false;
    this.uiManager = null;
    this._animTimer = null;
    this._pendingAttack = null;
  }

  init(canvas, myPlayerId, myPlayerName) {
    this.myPlayerId = myPlayerId;
    this.myPlayerName = myPlayerName;
    this.renderer = new MapRenderer(canvas);
    this.renderer.fitToContainer();
    this.renderer.onTerritoryClick = (tid) => this.handleTerritoryClick(tid);
    this.renderer.onTerritoryHover = (tid) => this.handleTerritoryHover(tid);
    this.renderer.startAnimLoop(this.state, myPlayerId);

    window.addEventListener('resize', () => {
      this.renderer.fitToContainer();
    });
  }

  async connectMultiplayer(apiKey, roomCode) {
    this.sync = new AblySync(apiKey, roomCode, this.myPlayerId, this.myPlayerName);

    this.sync.onStateUpdate = (data) => {
      if (!this.isHost) {
        this.state.loadFrom(data.state);
        this.refreshUI();
      }
    };

    this.sync.onGameAction = (action) => {
      if (this.isHost) {
        this.processAction(action);
      }
    };

    this.sync.onChatMessage = (msg) => {
      if (this.uiManager) this.uiManager.addChat(msg);
    };

    this.sync.onPlayerJoin = (data) => {
      if (this.uiManager) this.uiManager.updateLobby(this.sync.members);
    };

    await this.sync.connect();

    // If we're the first in the room, we're host
    setTimeout(() => {
      this.isHost = this.sync.isHost;
      if (this.uiManager) this.uiManager.setHost(this.isHost);
    }, 500);
  }

  // ─── Action dispatch ──────────────────────────────────────

  // My action — send to host (or process directly if host)
  doAction(action) {
    if (this.isHost) {
      this.processAction({ ...action, from: this.myPlayerId });
    } else {
      this.sync?.sendAction(action);
    }
  }

  // Host processes all actions and broadcasts new state
  processAction(action) {
    let result;
    const { type, from } = action;

    switch (type) {
      case 'start_game': {
        // action.players: [{id,name,colorIdx}]
        this.state.initPlayers(action.players);
        this.state.distributeMap();
        result = { ok: true };
        break;
      }
      case 'place_troop': {
        result = this.state.placeTroop(from, action.territory, action.count || 1);
        break;
      }
      case 'end_phase': {
        const cp = this.state.currentPlayer();
        if (cp.id !== from) { result = { error: 'Not your turn' }; break; }
        result = this.state.endPhase();
        break;
      }
      case 'attack': {
        result = this.state.attack(from, action.from, action.to, action.numAttackers || 3);
        break;
      }
      case 'fortify': {
        result = this.state.fortify(from, action.from, action.to, action.troops);
        break;
      }
      case 'trade_cards': {
        result = this.state.tradeCards(from, action.cardIndices);
        break;
      }
      case 'propose_trade': {
        result = this.state.proposeTrade(from, action.to, action.offer);
        break;
      }
      case 'accept_trade': {
        result = this.state.acceptTrade(action.tradeId, from);
        break;
      }
      case 'reject_trade': {
        result = this.state.rejectTrade(action.tradeId, from);
        break;
      }
      case 'propose_alliance': {
        result = this.state.proposeAlliance(from, action.to);
        break;
      }
      case 'accept_alliance': {
        result = this.state.acceptAlliance(action.propId, from);
        break;
      }
      case 'break_alliance': {
        result = this.state.breakAlliance(from, action.with);
        break;
      }
    }

    if (result?.error) {
      console.warn('[Action Error]', result.error);
    }

    // Broadcast updated state
    if (this.sync) {
      this.sync.broadcastState(this.state);
    }

    this.refreshUI();
    return result;
  }

  // ─── Map interaction ──────────────────────────────────────

  handleTerritoryClick(tid) {
    if (this.state.status !== 'playing') return;
    const phase = this.state.phase;
    const cp = this.state.currentPlayer();
    const isMyTurn = cp?.id === this.myPlayerId;

    if (phase === 'draft' && isMyTurn) {
      const t = this.state.territories[tid];
      if (t?.owner === this.myPlayerId && this.state.troopsToPlace > 0) {
        this.doAction({ type: 'place_troop', territory: tid, count: 1 });
      }
      return;
    }

    if (phase === 'attack' && isMyTurn) {
      const t = this.state.territories[tid];
      if (!this.selectedTerritory) {
        // Select source
        if (t?.owner === this.myPlayerId && t.troops >= 2) {
          this.selectedTerritory = tid;
          this.renderer.selectedTerritory = tid;
          this._updateAttackHighlights();
          this.uiManager?.showAttackPanel(tid);
        }
      } else {
        if (tid === this.selectedTerritory) {
          // Deselect
          this.deselect();
        } else if (t?.owner !== this.myPlayerId && this.renderer.attackable.includes(tid)) {
          // Attack!
          const from = this.selectedTerritory;
          const fromTerr = this.state.territories[from];
          const maxDice = Math.min(fromTerr.troops - 1, 3);
          this.uiManager?.showAttackConfirm(from, tid, maxDice, (numAttackers) => {
            this.doAction({ type: 'attack', from, to: tid, numAttackers });
            this.deselect();
          });
        } else if (t?.owner === this.myPlayerId && t.troops >= 2) {
          // Switch source
          this.selectedTerritory = tid;
          this.renderer.selectedTerritory = tid;
          this._updateAttackHighlights();
          this.uiManager?.showAttackPanel(tid);
        }
      }
      return;
    }

    if (phase === 'fortify' && isMyTurn && !this.state.fortifyUsed) {
      const t = this.state.territories[tid];
      if (!this.selectedTerritory) {
        if (t?.owner === this.myPlayerId && t.troops >= 2) {
          this.selectedTerritory = tid;
          this.renderer.selectedTerritory = tid;
          this._updateFortifyHighlights();
        }
      } else {
        if (tid === this.selectedTerritory) {
          this.deselect();
        } else if (t?.owner === this.myPlayerId && this.renderer.fortifiable.includes(tid)) {
          const from = this.selectedTerritory;
          const max = this.state.territories[from].troops - 1;
          this.uiManager?.showFortifyPanel(from, tid, max, (troops) => {
            this.doAction({ type: 'fortify', from, to: tid, troops });
            this.deselect();
          });
        }
      }
    }
  }

  handleTerritoryHover(tid) {
    // Could show tooltip; handled in renderer
  }

  deselect() {
    this.selectedTerritory = null;
    this.renderer.selectedTerritory = null;
    this.renderer.setHighlights({});
    this.uiManager?.hideAttackPanel();
  }

  _updateAttackHighlights() {
    if (!this.selectedTerritory) return;
    const adj = GAME.TERRITORIES[this.selectedTerritory].adj;
    const attackable = adj.filter(tid => {
      const t = this.state.territories[tid];
      return t && t.owner !== this.myPlayerId && !this.state.isAlly(this.myPlayerId, t.owner);
    });
    this.renderer.setHighlights({ attackable });
  }

  _updateFortifyHighlights() {
    if (!this.selectedTerritory) return;
    const myTerrs = this.state.getPlayerTerritories(this.myPlayerId);
    const fortifiable = myTerrs.filter(tid =>
      tid !== this.selectedTerritory &&
      this.state.pathExists(this.myPlayerId, this.selectedTerritory, tid)
    );
    this.renderer.setHighlights({ fortifiable });
  }

  // ─── Chat ─────────────────────────────────────────────────

  sendChat(text) {
    if (!text.trim()) return;
    this.sync?.sendChat(text);
    // Also show locally
    if (this.uiManager) {
      this.uiManager.addChat({ text, from: this.myPlayerId, name: this.myPlayerName, ts: Date.now() });
    }
  }

  // ─── UI refresh ───────────────────────────────────────────

  refreshUI() {
    if (this.uiManager) this.uiManager.refresh(this.state, this.myPlayerId);
  }

  startGame(playerList) {
    // playerList: [{id, name, colorIdx}]
    this.doAction({ type: 'start_game', players: playerList });
  }
}

window.GameController = GameController;
