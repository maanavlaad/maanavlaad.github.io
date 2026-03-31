# Dominion — World Conquest

A multiplayer RISK-style browser game with trading, alliances, and live chat.

## Files

```
index.html        — Main game (lobby + game in one page)
assets.js         — All sprite images embedded as base64 (auto-generated)
gamedata.js       — Territory map, continents, rules constants
gamestate.js      — Pure game logic: state mutations, combat, alliances, trading
map.js            — Canvas map renderer with animated highlights
ably-sync.js      — Ably realtime multiplayer sync layer
ui-manager.js     — DOM panels: scoreboard, modals, chat, dice, cards
game-controller.js — Wires everything together, handles input
```

## Deploying to GitHub Pages

1. Push all files to your GitHub repo (e.g. `maanavlaad.github.io/dominion/`)
2. Enable GitHub Pages (Settings → Pages → main branch)
3. Visit `https://maanavlaad.github.io/dominion/`

## How to Play

1. **Create Room** — Enter your name + Ably API key → get a 6-character room code
2. **Share the code** — Friends enter it on the Join screen
3. **Host clicks Start** — Map distributes territories randomly
4. **Turn order** — Draft → Attack → Fortify
   - **Draft**: Click your territories to place troops. Trade card sets for bonus troops.
   - **Attack**: Click a source territory (yours, 2+ troops), then an adjacent enemy.
   - **Fortify**: Move troops along connected friendly territory paths.
5. **Win** by conquering all 42 territories

## Diplomacy

- **Alliances** — Click 🤝 on a player in the scoreboard. Allies can't attack each other.
- **Trading** — Click 📦 to offer troops to another player.
- **Break Alliance** — Click "Break" next to an ally's name.

## Card System

- Earn 1 card each turn you conquer a territory
- Trade 3 cards for bonus draft troops:
  - 3 of same type: escalating value (4, 6, 8... up to 15)
  - One of each type: same escalating value
  - Owning the territory on a traded card: +2 troops on that territory

## Multiplayer Architecture

- **Host** (first player to join) owns the authoritative game state
- All player actions are sent to host via Ably channel `dominion:{roomCode}`
- Host validates, mutates state, broadcasts full serialized state to all clients
- Chat messages go through the same channel, rendered for all

## Get an Ably Key

Free tier at https://ably.com — create an app, copy the API key.
