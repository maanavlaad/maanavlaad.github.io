// ============================================================
//  DOMINION — Map Renderer
//  Draws territories as styled circles on a world map canvas
// ============================================================

class MapRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.hoveredTerritory = null;
    this.selectedTerritory = null;
    this.attackable = [];  // territories currently attackable
    this.fortifiable = []; // territories currently fortifiable
    this.draftable = [];   // territories where you can place troops
    this.onTerritoryClick = null;
    this.onTerritoryHover = null;
    this._bindEvents();
    this.RADIUS = 22;
  }

  _bindEvents() {
    this.canvas.addEventListener('mousemove', e => {
      const { x, y } = this._canvasPos(e);
      const tid = this._hitTest(x, y);
      if (tid !== this.hoveredTerritory) {
        this.hoveredTerritory = tid;
        this.canvas.style.cursor = tid ? 'pointer' : 'default';
        if (this.onTerritoryHover) this.onTerritoryHover(tid);
      }
    });

    this.canvas.addEventListener('click', e => {
      const { x, y } = this._canvasPos(e);
      const tid = this._hitTest(x, y);
      if (tid && this.onTerritoryClick) this.onTerritoryClick(tid);
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hoveredTerritory = null;
      this.canvas.style.cursor = 'default';
    });
  }

  _canvasPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
      y: (e.clientY - rect.top)  * (this.canvas.height / rect.height),
    };
  }

  _hitTest(x, y) {
    const R = this.RADIUS + 4;
    for (const [tid, tdata] of Object.entries(GAME.TERRITORIES)) {
      const tx = tdata.x * this.scale + this.offsetX;
      const ty = tdata.y * this.scale + this.offsetY;
      const dx = x - tx, dy = y - ty;
      if (dx*dx + dy*dy <= R*R) return tid;
    }
    return null;
  }

  render(gameState, myPlayerId) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Draw ocean / parchment background
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, '#c8d8c0');
    bgGrad.addColorStop(1, '#a8c4b0');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Subtle grid
    ctx.strokeStyle = 'rgba(0,0,0,0.05)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx < W; gx += 40) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
    }
    for (let gy = 0; gy < H; gy += 40) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
    }

    // Draw continent region backgrounds
    this._drawContinentBGs(ctx, gameState);

    // Draw adjacency lines
    this._drawConnections(ctx, gameState);

    // Draw territories
    for (const [tid, tdef] of Object.entries(GAME.TERRITORIES)) {
      const tstate = gameState.territories[tid];
      if (!tstate) continue;
      const tx = tdef.x * this.scale + this.offsetX;
      const ty = tdef.y * this.scale + this.offsetY;

      const owner = gameState.players.find(p => p.id === tstate.owner);
      const ownerColor = owner ? owner.color.hex : '#888';
      const ownerLight = owner ? owner.color.light : '#aaa';

      const isSelected  = this.selectedTerritory === tid;
      const isHovered   = this.hoveredTerritory === tid;
      const isAttackable = this.attackable.includes(tid);
      const isFortifiable = this.fortifiable.includes(tid);
      const isDraftable = this.draftable.includes(tid);
      const isMyTerritory = tstate.owner === myPlayerId;
      const isMine = tstate.owner === myPlayerId;

      const R = this.RADIUS;

      // Shadow
      ctx.beginPath();
      ctx.arc(tx + 3, ty + 3, R, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fill();

      // Pulse ring for attackable / draftable targets
      if (isAttackable || isDraftable || isFortifiable) {
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 300);
        ctx.beginPath();
        ctx.arc(tx, ty, R + 6 + pulse * 4, 0, Math.PI * 2);
        ctx.strokeStyle = isAttackable ? 'rgba(220,50,50,0.7)' :
                          isDraftable  ? 'rgba(50,200,50,0.7)' : 'rgba(80,120,255,0.7)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // Territory circle fill
      const grad = ctx.createRadialGradient(tx - R*0.3, ty - R*0.3, R*0.1, tx, ty, R);
      grad.addColorStop(0, ownerLight);
      grad.addColorStop(1, ownerColor);
      ctx.beginPath();
      ctx.arc(tx, ty, R, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Border
      ctx.strokeStyle = isSelected ? '#fff' : 'rgba(0,0,0,0.5)';
      ctx.lineWidth = isSelected ? 3 : 1.5;
      ctx.stroke();

      // White inner ring if selected
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(tx, ty, R - 4, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Troop count
      ctx.font = `bold ${tstate.troops >= 10 ? 11 : 13}px 'MedievalSharp', serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 3;
      ctx.fillText(tstate.troops, tx, ty);
      ctx.shadowBlur = 0;

      // Territory name (below circle)
      if (isHovered || isSelected) {
        ctx.font = '10px Georgia, serif';
        ctx.fillStyle = '#1a0e00';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const label = GAME.TERRITORIES[tid].name;
        // Draw background
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(255,240,200,0.85)';
        ctx.fillRect(tx - tw/2 - 3, ty + R + 3, tw + 6, 14);
        ctx.fillStyle = '#1a0e00';
        ctx.fillText(label, tx, ty + R + 4);
      }
    }

    // Draw attack/fortify arrows if in those phases
    if (this.selectedTerritory && this.hoveredTerritory &&
        this.hoveredTerritory !== this.selectedTerritory) {
      const from = GAME.TERRITORIES[this.selectedTerritory];
      const to   = GAME.TERRITORIES[this.hoveredTerritory];
      if (from && to) {
        const fx = from.x * this.scale + this.offsetX;
        const fy = from.y * this.scale + this.offsetY;
        const tx2 = to.x * this.scale + this.offsetX;
        const ty2 = to.y * this.scale + this.offsetY;
        this._drawArrow(ctx, fx, fy, tx2, ty2, this.attackable.includes(this.hoveredTerritory) ? '#e74c3c' : '#3498db');
      }
    }
  }

  _drawContinentBGs(ctx, gameState) {
    for (const [cid, cont] of Object.entries(GAME.CONTINENTS)) {
      const terrs = cont.territories.map(tid => GAME.TERRITORIES[tid]).filter(Boolean);
      if (!terrs.length) continue;

      // Get bounding box
      const xs = terrs.map(t => t.x * this.scale + this.offsetX);
      const ys = terrs.map(t => t.y * this.scale + this.offsetY);
      const minX = Math.min(...xs) - 35, maxX = Math.max(...xs) + 35;
      const minY = Math.min(...ys) - 35, maxY = Math.max(...ys) + 35;

      ctx.fillStyle = cont.color + '22';
      ctx.strokeStyle = cont.color + '55';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(minX, minY, maxX - minX, maxY - minY, 12);
      ctx.fill();
      ctx.stroke();

      // Continent label
      const cx = (minX + maxX) / 2;
      ctx.font = '10px Georgia, serif';
      ctx.fillStyle = cont.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`${cont.name} (+${cont.bonus})`, cx, minY + 4);
    }
  }

  _drawConnections(ctx, gameState) {
    const drawn = new Set();
    for (const [tid, tdef] of Object.entries(GAME.TERRITORIES)) {
      for (const adj of tdef.adj) {
        const key = [tid, adj].sort().join('-');
        if (drawn.has(key)) continue;
        drawn.add(key);

        const adjDef = GAME.TERRITORIES[adj];
        if (!adjDef) continue;

        const fx = tdef.x * this.scale + this.offsetX;
        const fy = tdef.y * this.scale + this.offsetY;
        const tx2 = adjDef.x * this.scale + this.offsetX;
        const ty2 = adjDef.y * this.scale + this.offsetY;

        // Draw dashed line for cross-map connections (distance > 400)
        const dist = Math.hypot(tx2-fx, ty2-fy);
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(tx2, ty2);
        ctx.strokeStyle = 'rgba(80,50,20,0.15)';
        ctx.lineWidth = 1;
        if (dist > 350) ctx.setLineDash([4, 6]);
        else ctx.setLineDash([]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  _drawArrow(ctx, x1, y1, x2, y2, color) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const R = this.RADIUS + 5;
    const sx = x1 + Math.cos(angle) * R;
    const sy = y1 + Math.sin(angle) * R;
    const ex = x2 - Math.cos(angle) * R;
    const ey = y2 - Math.sin(angle) * R;

    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Arrowhead
    const headLen = 10;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - headLen * Math.cos(angle - Math.PI/6), ey - headLen * Math.sin(angle - Math.PI/6));
    ctx.lineTo(ex - headLen * Math.cos(angle + Math.PI/6), ey - headLen * Math.sin(angle + Math.PI/6));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  setHighlights({ attackable = [], fortifiable = [], draftable = [] }) {
    this.attackable  = attackable;
    this.fortifiable = fortifiable;
    this.draftable   = draftable;
  }

  fitToContainer() {
    const container = this.canvas.parentElement;
    const W = container.clientWidth;
    const H = container.clientHeight;

    // World map spans x: 60-860, y: 55-440
    const mapW = 860, mapH = 450;
    const scaleX = W / mapW;
    const scaleY = H / mapH;
    this.scale = Math.min(scaleX, scaleY) * 0.95;
    this.offsetX = (W - mapW * this.scale) / 2;
    this.offsetY = (H - mapH * this.scale) / 2;

    this.canvas.width  = W;
    this.canvas.height = H;
  }

  startAnimLoop(gameState, myPlayerId) {
    const loop = () => {
      this.render(gameState, myPlayerId);
      this._animFrame = requestAnimationFrame(loop);
    };
    loop();
  }

  stopAnimLoop() {
    if (this._animFrame) cancelAnimationFrame(this._animFrame);
  }
}

window.MapRenderer = MapRenderer;
