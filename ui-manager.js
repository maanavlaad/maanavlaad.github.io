// ============================================================
//  DOMINION — UI Manager
//  Paper-themed DOM panels, sidebar, modals
// ============================================================

class UIManager {
  constructor(controller) {
    this.ctrl = controller;
    this.chatMessages = [];
    this._diceAnimating = false;
  }

  // ─── Main refresh ─────────────────────────────────────────

  refresh(state, myId) {
    this.updatePlayerCards(state, myId);
    this.updatePhaseBar(state, myId);
    this.updateTurnIndicator(state, myId);
    this.updateScoreboard(state, myId);
    this.checkPendingProposals(state, myId);
    this.updateDraftCounter(state, myId);
    if (state.status === 'ended') this.showVictory(state);
    if (state.attackState && !this._diceAnimating) {
      this.showDiceResult(state.attackState);
    }
  }

  // ─── Lobby ────────────────────────────────────────────────

  showLobby(roomCode, isHost) {
    document.getElementById('lobby').style.display = 'flex';
    document.getElementById('game-area').style.display = 'none';
    document.getElementById('room-code-display').textContent = roomCode.toUpperCase();
  }

  updateLobby(members) {
    const list = document.getElementById('lobby-players');
    if (!list) return;
    list.innerHTML = '';
    members.forEach((m, i) => {
      const li = document.createElement('div');
      li.className = 'lobby-player';
      const color = GAME.PLAYER_COLORS[i % GAME.PLAYER_COLORS.length];
      li.innerHTML = `
        <span class="player-dot" style="background:${color.hex}"></span>
        <span>${m.data?.name || m.clientId}</span>
        ${i === 0 ? '<span class="host-badge">HOST</span>' : ''}
      `;
      list.appendChild(li);
    });
    document.getElementById('player-count').textContent = `${members.length}/6 players`;
  }

  setHost(isHost) {
    const btn = document.getElementById('start-btn');
    if (btn) btn.style.display = isHost ? 'block' : 'none';
    const msg = document.getElementById('waiting-msg');
    if (msg) msg.textContent = isHost ? 'Start the game when ready!' : 'Waiting for host to start...';
  }

  hideLobby() {
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('game-area').style.display = 'flex';
  }

  // ─── Phase bar ────────────────────────────────────────────

  updatePhaseBar(state, myId) {
    const bar = document.getElementById('phase-bar');
    if (!bar) return;
    const cp = state.currentPlayer();
    const isMyTurn = cp?.id === myId;
    const phase = state.phase;

    bar.innerHTML = `
      <div class="phase-step ${phase==='draft'?'active':'done'}">✦ Draft</div>
      <div class="phase-arrow">›</div>
      <div class="phase-step ${phase==='attack'?'active':phase==='fortify'||phase===null?'done':''}">⚔ Attack</div>
      <div class="phase-arrow">›</div>
      <div class="phase-step ${phase==='fortify'?'active':''}">⛺ Fortify</div>
    `;

    const actions = document.getElementById('action-buttons');
    if (!actions) return;
    actions.innerHTML = '';

    if (!isMyTurn) return;

    if (phase === 'draft') {
      const troopsLeft = state.troopsToPlace;
      if (troopsLeft === 0) {
        actions.appendChild(this._btn('End Draft →', () => this.ctrl.doAction({ type: 'end_phase' }), 'primary'));
      }
      if (cp.cards.length >= 3) {
        actions.appendChild(this._btn('Trade Cards', () => this.showCardTradePanel(state, myId), 'secondary'));
      }
    } else if (phase === 'attack') {
      actions.appendChild(this._btn('End Attack →', () => {
        this.ctrl.deselect();
        this.ctrl.doAction({ type: 'end_phase' });
      }, 'primary'));
    } else if (phase === 'fortify') {
      actions.appendChild(this._btn('End Turn →', () => {
        this.ctrl.deselect();
        this.ctrl.doAction({ type: 'end_phase' });
      }, 'primary'));
    }
  }

  updateTurnIndicator(state, myId) {
    const el = document.getElementById('turn-indicator');
    if (!el) return;
    const cp = state.currentPlayer();
    if (!cp) return;
    const isMe = cp.id === myId;
    el.innerHTML = `
      <span class="turn-dot" style="background:${cp.color.hex}"></span>
      <span>${isMe ? '⭐ YOUR TURN' : cp.name + "'s Turn"}</span>
      <span class="round-badge">Round ${state.round}</span>
    `;
    el.className = `turn-indicator ${isMe ? 'my-turn' : ''}`;
  }

  updateDraftCounter(state, myId) {
    const el = document.getElementById('draft-counter');
    if (!el) return;
    const cp = state.currentPlayer();
    const isMyTurn = cp?.id === myId;
    if (state.phase === 'draft' && isMyTurn && state.troopsToPlace > 0) {
      el.style.display = 'flex';
      el.textContent = `Click your territories to place ${state.troopsToPlace} troop${state.troopsToPlace!==1?'s':''}`;
    } else {
      el.style.display = 'none';
    }
  }

  // ─── Scoreboard ───────────────────────────────────────────

  updateScoreboard(state, myId) {
    const sb = document.getElementById('scoreboard');
    if (!sb) return;
    sb.innerHTML = '';
    for (const p of state.players) {
      const terrs = state.getPlayerTerritories?.(p.id)?.length ?? 0;
      const troops = Object.values(state.territories || {})
        .filter(t => t.owner === p.id)
        .reduce((s, t) => s + t.troops, 0);
      const conts = GAME.getOwnedContinents(state.getPlayerTerritories?.(p.id) ?? []);
      const allies = state.alliances.filter(a => a.players.includes(p.id) && a.players.includes(myId));

      const row = document.createElement('div');
      row.className = `score-row ${p.id === myId ? 'me' : ''} ${!p.alive ? 'dead' : ''}`;
      row.innerHTML = `
        <span class="score-dot" style="background:${p.color.hex}"></span>
        <span class="score-name">${p.name}${p.id===myId?' (You)':''}${!p.alive?' ✗':''}</span>
        <span class="score-terr">${terrs}🗺</span>
        <span class="score-troops">${troops}⚔</span>
        ${allies.length && p.id !== myId ? '<span class="ally-badge">🤝</span>' : ''}
        ${p.id !== myId && p.alive ? this._diplomacyBtns(p, state, myId) : ''}
      `;
      sb.appendChild(row);
    }
  }

  _diplomacyBtns(player, state, myId) {
    const isAlly = state.isAlly(myId, player.id);
    if (isAlly) {
      return `<button class="mini-btn danger" onclick="window.gc.doAction({type:'break_alliance',with:'${player.id}'})">Break</button>`;
    }
    return `
      <button class="mini-btn" onclick="window.gc.doAction({type:'propose_alliance',to:'${player.id}'})">🤝</button>
      <button class="mini-btn" onclick="window.uiMgr.showTradeOffer('${player.id}','${player.name}')">📦</button>
    `;
  }

  // ─── Cards ────────────────────────────────────────────────

  updatePlayerCards(state, myId) {
    const player = state.getPlayer?.(myId);
    if (!player) return;
    const el = document.getElementById('my-cards');
    if (!el) return;
    if (!player.cards.length) {
      el.innerHTML = '<span class="no-cards">No cards</span>';
      return;
    }
    el.innerHTML = player.cards.map((c, i) => `
      <div class="card ${c.type}" title="${c.territory ? GAME.TERRITORIES[c.territory]?.name : 'Wild'}">
        <div class="card-icon">${c.type==='infantry'?'👣':c.type==='cavalry'?'🐴':c.type==='artillery'?'💣':'★'}</div>
        <div class="card-type">${c.type}</div>
      </div>
    `).join('');
  }

  showCardTradePanel(state, myId) {
    const player = state.getPlayer(myId);
    if (!player || player.cards.length < 3) return;

    const existing = document.getElementById('card-trade-modal');
    if (existing) existing.remove();

    const selected = [];
    const modal = document.createElement('div');
    modal.id = 'card-trade-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal paper-panel">
        <div class="modal-title">📜 Trade Cards for Troops</div>
        <p class="modal-hint">Select 3 cards: 3 of same type OR one of each type</p>
        <div class="card-grid" id="trade-card-grid">
          ${player.cards.map((c, i) => `
            <div class="card ${c.type} selectable" data-idx="${i}" onclick="window.uiMgr._toggleCardSelect(this,${i})">
              <div class="card-icon">${c.type==='infantry'?'👣':c.type==='cavalry'?'🐴':c.type==='artillery'?'💣':'★'}</div>
              <div class="card-type">${c.type}</div>
              ${c.territory ? `<div class="card-terr">${GAME.TERRITORIES[c.territory]?.name??''}</div>`:''}
            </div>
          `).join('')}
        </div>
        <div id="trade-selection-info">Select 3 cards</div>
        <div class="modal-actions">
          <button class="btn-paper" onclick="window.uiMgr._confirmCardTrade()">Trade!</button>
          <button class="btn-paper secondary" onclick="document.getElementById('card-trade-modal').remove()">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    this._selectedCardIndices = [];
  }

  _toggleCardSelect(el, idx) {
    if (!this._selectedCardIndices) this._selectedCardIndices = [];
    const i = this._selectedCardIndices.indexOf(idx);
    if (i >= 0) {
      this._selectedCardIndices.splice(i, 1);
      el.classList.remove('selected');
    } else if (this._selectedCardIndices.length < 3) {
      this._selectedCardIndices.push(idx);
      el.classList.add('selected');
    }
    const info = document.getElementById('trade-selection-info');
    if (info) info.textContent = `Selected: ${this._selectedCardIndices.length}/3`;
  }

  _confirmCardTrade() {
    if (!this._selectedCardIndices || this._selectedCardIndices.length !== 3) {
      alert('Select exactly 3 cards'); return;
    }
    this.ctrl.doAction({ type: 'trade_cards', cardIndices: this._selectedCardIndices });
    document.getElementById('card-trade-modal')?.remove();
    this._selectedCardIndices = [];
  }

  // ─── Attack panel ─────────────────────────────────────────

  showAttackPanel(fromId) {
    const el = document.getElementById('attack-hint');
    if (!el) return;
    const t = this.ctrl.state.territories[fromId];
    const name = GAME.TERRITORIES[fromId]?.name ?? fromId;
    el.innerHTML = `<b>${name}</b> selected (${t?.troops} troops)<br><span class="hint">Click an enemy territory to attack</span>`;
    el.style.display = 'block';
  }

  hideAttackPanel() {
    const el = document.getElementById('attack-hint');
    if (el) el.style.display = 'none';
  }

  showAttackConfirm(fromId, toId, maxDice, onConfirm) {
    const existing = document.getElementById('attack-modal');
    if (existing) existing.remove();

    const fromName = GAME.TERRITORIES[fromId]?.name;
    const toName   = GAME.TERRITORIES[toId]?.name;
    const toTerr   = this.ctrl.state.territories[toId];
    const toOwner  = this.ctrl.state.getPlayer(toTerr?.owner);

    const modal = document.createElement('div');
    modal.id = 'attack-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal paper-panel">
        <div class="modal-title">⚔ Attack!</div>
        <div class="attack-info">
          <div class="attack-from">${fromName}</div>
          <div class="attack-arrow">→</div>
          <div class="attack-to">${toName}<br><small style="color:${toOwner?.color.hex}">${toOwner?.name}</small></div>
        </div>
        <div class="dice-select">
          <label>Attack with:</label>
          <div class="dice-btns">
            ${Array.from({length:maxDice},(_, i) => `
              <button class="dice-btn ${i+1===maxDice?'selected':''}" 
                onclick="document.querySelectorAll('.dice-btn').forEach(b=>b.classList.remove('selected'));this.classList.add('selected');window._attackDice=${i+1}">
                ${i+1} 🎲
              </button>
            `).join('')}
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-paper danger" onclick="
            const d = window._attackDice||${maxDice};
            document.getElementById('attack-modal').remove();
            window._attackConfirmCb(d);
          ">ATTACK!</button>
          <button class="btn-paper secondary" onclick="document.getElementById('attack-modal').remove()">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    window._attackDice = maxDice;
    window._attackConfirmCb = onConfirm;
  }

  showDiceResult(attackState) {
    this._diceAnimating = true;
    const existing = document.getElementById('dice-modal');
    if (existing) existing.remove();

    const { aDice, dDice, attackerLosses, defenderLosses, conquered, fromId, toId } = attackState;
    const fromName = GAME.TERRITORIES[fromId]?.name ?? fromId;
    const toName   = GAME.TERRITORIES[toId]?.name ?? toId;

    const modal = document.createElement('div');
    modal.id = 'dice-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal paper-panel dice-result-modal">
        <div class="modal-title">🎲 Battle Result</div>
        <div class="battle-summary">${fromName} → ${toName}</div>
        <div class="dice-row">
          <div class="dice-group attacker">
            <div class="dice-label" style="color:#e74c3c">Attacker 🗡</div>
            <div class="dice-faces">${aDice.map(d=>`<div class="die red">${d}</div>`).join('')}</div>
          </div>
          <div class="dice-vs">VS</div>
          <div class="dice-group defender">
            <div class="dice-label" style="color:#3498db">Defender 🛡</div>
            <div class="dice-faces">${dDice.map(d=>`<div class="die blue">${d}</div>`).join('')}</div>
          </div>
        </div>
        <div class="losses">
          <span style="color:#e74c3c">Attacker loses: ${attackerLosses}</span>
          &nbsp;|&nbsp;
          <span style="color:#3498db">Defender loses: ${defenderLosses}</span>
        </div>
        ${conquered ? '<div class="conquered-banner">🏴 TERRITORY CONQUERED!</div>' : ''}
        <button class="btn-paper" onclick="document.getElementById('dice-modal').remove();window.uiMgr._diceAnimating=false;">OK</button>
      </div>
    `;
    document.body.appendChild(modal);

    setTimeout(() => {
      modal.remove();
      this._diceAnimating = false;
    }, 4000);
  }

  // ─── Fortify ──────────────────────────────────────────────

  showFortifyPanel(fromId, toId, maxTroops, onConfirm) {
    const existing = document.getElementById('fortify-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'fortify-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal paper-panel">
        <div class="modal-title">⛺ Fortify</div>
        <div class="fortify-info">Move troops from <b>${GAME.TERRITORIES[fromId]?.name}</b> to <b>${GAME.TERRITORIES[toId]?.name}</b></div>
        <div class="slider-row">
          <input type="range" id="fortify-slider" min="1" max="${maxTroops}" value="${Math.floor(maxTroops/2)}"
            oninput="document.getElementById('fortify-val').textContent=this.value">
          <span id="fortify-val">${Math.floor(maxTroops/2)}</span> troops
        </div>
        <div class="modal-actions">
          <button class="btn-paper" onclick="
            const n=parseInt(document.getElementById('fortify-slider').value);
            document.getElementById('fortify-modal').remove();
            window._fortifyCb(n);
          ">Move Troops</button>
          <button class="btn-paper secondary" onclick="document.getElementById('fortify-modal').remove()">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    window._fortifyCb = onConfirm;
  }

  // ─── Trade offers ─────────────────────────────────────────

  showTradeOffer(toId, toName) {
    const existing = document.getElementById('trade-offer-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'trade-offer-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal paper-panel">
        <div class="modal-title">📦 Trade with ${toName}</div>
        <div class="trade-row">
          <label>Offer troops:</label>
          <input type="number" id="trade-troops" min="0" max="20" value="3" class="paper-input">
        </div>
        <div class="modal-actions">
          <button class="btn-paper" onclick="
            const troops=parseInt(document.getElementById('trade-troops').value)||0;
            document.getElementById('trade-offer-modal').remove();
            window.gc.doAction({type:'propose_trade',to:'${toId}',offer:{troops}});
          ">Send Offer</button>
          <button class="btn-paper secondary" onclick="document.getElementById('trade-offer-modal').remove()">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  checkPendingProposals(state, myId) {
    const myProposals = state.pendingTrades.filter(t => t.to === myId && t.status === 'pending');
    for (const prop of myProposals) {
      if (document.getElementById(`proposal-${prop.id}`)) continue;
      const fromPlayer = state.getPlayer(prop.from);
      if (!fromPlayer) continue;

      const el = document.createElement('div');
      el.id = `proposal-${prop.id}`;
      el.className = 'proposal-toast paper-panel';

      if (prop.type === 'alliance') {
        el.innerHTML = `
          <b>${fromPlayer.name}</b> wants to form an alliance!
          <div class="toast-actions">
            <button class="btn-paper small" onclick="
              window.gc.doAction({type:'accept_alliance',propId:${prop.id}});
              document.getElementById('proposal-${prop.id}').remove();
            ">Accept</button>
            <button class="btn-paper secondary small" onclick="
              document.getElementById('proposal-${prop.id}').remove();
            ">Decline</button>
          </div>
        `;
      } else {
        const troops = prop.offer?.troops ?? 0;
        el.innerHTML = `
          <b>${fromPlayer.name}</b> offers <b>${troops} troops</b>!
          <div class="toast-actions">
            <button class="btn-paper small" onclick="
              window.gc.doAction({type:'accept_trade',tradeId:${prop.id}});
              document.getElementById('proposal-${prop.id}').remove();
            ">Accept</button>
            <button class="btn-paper secondary small" onclick="
              window.gc.doAction({type:'reject_trade',tradeId:${prop.id}});
              document.getElementById('proposal-${prop.id}').remove();
            ">Decline</button>
          </div>
        `;
      }

      document.getElementById('proposals-area').appendChild(el);
      setTimeout(() => el.remove(), 30000);
    }
  }

  // ─── Chat ─────────────────────────────────────────────────

  addChat(msg) {
    this.chatMessages.push(msg);
    const list = document.getElementById('chat-messages');
    if (!list) return;
    const el = document.createElement('div');
    el.className = 'chat-msg';
    const playerColor = this.ctrl.state.getPlayer?.(msg.from)?.color.hex ?? '#666';
    el.innerHTML = `<span class="chat-name" style="color:${playerColor}">${msg.name}:</span> ${this._escHtml(msg.text)}`;
    list.appendChild(el);
    list.scrollTop = list.scrollHeight;
    if (list.children.length > 100) list.removeChild(list.firstChild);
  }

  // ─── Victory ──────────────────────────────────────────────

  showVictory(state) {
    if (document.getElementById('victory-screen')) return;
    const winner = state.getPlayer(state.winner);
    if (!winner) return;
    const screen = document.createElement('div');
    screen.id = 'victory-screen';
    screen.className = 'victory-overlay';
    screen.innerHTML = `
      <div class="victory-panel paper-panel">
        <div class="victory-crown">👑</div>
        <div class="victory-title">WORLD DOMINATION!</div>
        <div class="victory-player" style="color:${winner.color.hex}">${winner.name}</div>
        <div class="victory-subtitle">has conquered every territory!</div>
        <button class="btn-paper" onclick="location.reload()">Play Again</button>
      </div>
    `;
    document.body.appendChild(screen);
  }

  // ─── Helpers ──────────────────────────────────────────────

  _btn(label, onClick, type = 'primary') {
    const b = document.createElement('button');
    b.className = `btn-paper ${type}`;
    b.textContent = label;
    b.onclick = onClick;
    return b;
  }

  _escHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
}

window.UIManager = UIManager;
