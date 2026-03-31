// ============================================================
//  DOMINION — Ably Multiplayer Sync
// ============================================================

class AblySync {
  constructor(apiKey, roomCode, playerId, playerName) {
    this.apiKey = apiKey;
    this.roomCode = roomCode;
    this.playerId = playerId;
    this.playerName = playerName;
    this.ably = null;
    this.channel = null;
    this.presenceChannel = null;
    this.isHost = false;
    this.onStateUpdate = null;
    this.onChatMessage = null;
    this.onPlayerJoin = null;
    this.onPlayerLeave = null;
    this.onGameAction = null;
    this.members = [];
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ably = new Ably.Realtime({ key: this.apiKey, clientId: this.playerId });
      this.ably.connection.on('connected', () => {
        this.channel = this.ably.channels.get(`dominion:${this.roomCode}`);
        this._subscribeChannels();
        resolve();
      });
      this.ably.connection.on('failed', reject);
      this.ably.connection.on('disconnected', () => console.warn('Ably disconnected'));
    });
  }

  _subscribeChannels() {
    // Game state sync (host broadcasts full state)
    this.channel.subscribe('state', msg => {
      if (this.onStateUpdate) this.onStateUpdate(msg.data);
    });

    // Game actions (any player can send actions to host)
    this.channel.subscribe('action', msg => {
      if (this.onGameAction) this.onGameAction(msg.data);
    });

    // Chat
    this.channel.subscribe('chat', msg => {
      if (this.onChatMessage) this.onChatMessage(msg.data);
    });

    // Trade/alliance proposals
    this.channel.subscribe('proposal', msg => {
      if (this.onGameAction) this.onGameAction({ type: 'proposal', ...msg.data });
    });

    // Presence for lobby
    this.channel.presence.subscribe('enter', m => {
      if (!this.members.find(x => x.clientId === m.clientId)) {
        this.members.push({ clientId: m.clientId, data: m.data });
      }
      if (this.onPlayerJoin) this.onPlayerJoin(m.data);
    });
    this.channel.presence.subscribe('leave', m => {
      this.members = this.members.filter(x => x.clientId !== m.clientId);
      if (this.onPlayerLeave) this.onPlayerLeave(m.data);
    });

    // Enter presence
    this.channel.presence.enter({ name: this.playerName, id: this.playerId });

    // Get current members
    this.channel.presence.get((err, members) => {
      if (!err) {
        this.members = members.map(m => ({ clientId: m.clientId, data: m.data }));
        // First member to join is host
        if (members.length === 1) this.isHost = true;
        if (this.onPlayerJoin) members.forEach(m => this.onPlayerJoin(m.data));
      }
    });
  }

  // Broadcast full game state (host only)
  broadcastState(gameState) {
    if (!this.channel) return;
    this.channel.publish('state', { state: gameState.serialize(), from: this.playerId });
  }

  // Send a game action (non-host players)
  sendAction(action) {
    if (!this.channel) return;
    this.channel.publish('action', { ...action, from: this.playerId, ts: Date.now() });
  }

  sendChat(text) {
    if (!this.channel) return;
    this.channel.publish('chat', {
      text,
      from: this.playerId,
      name: this.playerName,
      ts: Date.now(),
    });
  }

  sendProposal(proposal) {
    if (!this.channel) return;
    this.channel.publish('proposal', { ...proposal, from: this.playerId });
  }

  disconnect() {
    if (this.ably) {
      this.channel?.presence.leave();
      this.ably.close();
    }
  }
}

window.AblySync = AblySync;
