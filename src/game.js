// ============================================================================
//  Game — state machine (TITLE → SELECT → BATTLE → RESULT), HUD, menus, loop.
// ============================================================================
import { GAME, STAGE, RULES, CHARACTERS, CONTROLS, getCharacter } from './config.js';
import { input } from './input.js';
import { sfx } from './audio.js';
import { Particles } from './particles.js';
import { Stage } from './stage.js';
import { Fighter } from './fighter.js';
import { AIController } from './ai.js';

const PLAYER_COLORS = ['#4fd2ff', '#ff5d8f', '#ffd23f', '#6dff8f'];
const PLAYER_LABELS = ['P1', 'P2', 'CPU', 'CPU'];

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    this.state = 'TITLE';
    this.mode = '1P';            // '1P' | '2P'
    this.stocks = RULES.DEFAULT_STOCKS;
    this.titleIndex = 0;         // 0=1P,1=2P
    this.t = 0;

    this.stage = new Stage();
    this.particles = new Particles();
    this.shakeAmt = 0;

    // select-screen state
    this.cursors = [];           // {idx, locked}
    this.selecting = 1;          // how many human pickers

    // battle state
    this.fighters = [];
    this.ais = [];
    this.projectiles = [];
    this.countdown = 0;
    this.winner = null;
    this.resultTimer = 0;

    this.world = {
      platforms: STAGE.platforms,
      particles: this.particles,
      projectiles: this.projectiles,
      fighters: this.fighters,
      sfx,
      shake: (a) => { this.shakeAmt = Math.max(this.shakeAmt, a); },
    };

    this._raf = null;
    this._acc = 0;
    this._last = 0;
  }

  start() {
    this._last = performance.now();
    const loop = (now) => {
      this._raf = requestAnimationFrame(loop);
      const step = 1000 / GAME.FPS;
      this._acc += Math.min(now - this._last, 100);
      this._last = now;
      while (this._acc >= step) {
        this.update();
        input.update();
        this._acc -= step;
      }
      this.render();
    };
    this._raf = requestAnimationFrame(loop);
  }

  // ==========================================================================
  //  UPDATE
  // ==========================================================================
  update() {
    this.t++;
    this.stage.update();
    if (this.shakeAmt > 0) this.shakeAmt *= 0.85;

    switch (this.state) {
      case 'TITLE': this.updateTitle(); break;
      case 'SELECT': this.updateSelect(); break;
      case 'BATTLE': this.updateBattle(); break;
      case 'RESULT': this.updateResult(); break;
    }
    this.particles.update();
  }

  updateTitle() {
    const c1 = CONTROLS.p1;
    if (input.wasPressed(c1.up) || input.wasPressed('ArrowUp')) { this.titleIndex = (this.titleIndex + 1) % 2; sfx.select(); }
    if (input.wasPressed(c1.down) || input.wasPressed('ArrowDown')) { this.titleIndex = (this.titleIndex + 1) % 2; sfx.select(); }
    if (input.wasPressed(c1.left) || input.wasPressed('ArrowLeft')) { this.stocks = Math.max(1, this.stocks - 1); sfx.select(); }
    if (input.wasPressed(c1.right) || input.wasPressed('ArrowRight')) { this.stocks = Math.min(9, this.stocks + 1); sfx.select(); }
    if (input.wasPressed('Digit1')) { this.titleIndex = 0; this.enterSelect(); }
    if (input.wasPressed('Digit2')) { this.titleIndex = 1; this.enterSelect(); }
    if (input.wasPressed('Enter') || input.wasPressed('Space')) this.enterSelect();
  }

  enterSelect() {
    sfx.start();
    this.mode = this.titleIndex === 0 ? '1P' : '2P';
    this.selecting = this.mode === '2P' ? 2 : 1;
    this.cursors = [];
    for (let i = 0; i < this.selecting; i++) {
      this.cursors.push({ idx: i === 0 ? 0 : 1, locked: false });
    }
    this.state = 'SELECT';
  }

  updateSelect() {
    if (input.wasPressed('Escape')) { sfx.back(); this.state = 'TITLE'; return; }

    const schemes = [CONTROLS.p1, CONTROLS.p2];
    const cols = 4;
    for (let i = 0; i < this.cursors.length; i++) {
      const cur = this.cursors[i];
      const sc = schemes[i];
      if (cur.locked) {
        if (input.wasPressed(sc.special) || input.wasPressed(sc.shield)) { cur.locked = false; sfx.back(); }
        continue;
      }
      let moved = false;
      if (input.wasPressed(sc.right)) { cur.idx = (cur.idx + 1) % CHARACTERS.length; moved = true; }
      if (input.wasPressed(sc.left)) { cur.idx = (cur.idx - 1 + CHARACTERS.length) % CHARACTERS.length; moved = true; }
      if (input.wasPressed(sc.down)) { cur.idx = (cur.idx + cols) % CHARACTERS.length; moved = true; }
      if (input.wasPressed(sc.up)) { cur.idx = (cur.idx - cols + CHARACTERS.length) % CHARACTERS.length; moved = true; }
      if (moved) sfx.select();
      if (input.wasPressed(sc.light) || input.wasPressed(sc.heavy)) { cur.locked = true; sfx.start(); }
    }

    // ready when all human cursors locked
    if (this.cursors.length && this.cursors.every((c) => c.locked)) {
      this.beginBattle();
    }
  }

  beginBattle() {
    const picks = [];
    for (const c of this.cursors) picks.push(CHARACTERS[c.idx].id);
    // fill CPU slot(s) for 1P
    if (this.mode === '1P') {
      let cpu = Math.floor((this.t * 7) % CHARACTERS.length);
      if (CHARACTERS[cpu].id === picks[0]) cpu = (cpu + 1) % CHARACTERS.length;
      picks.push(CHARACTERS[cpu].id);
    }

    this.fighters.length = 0;
    this.ais.length = 0;
    this.projectiles.length = 0;
    this.particles.list.length = 0;

    for (let i = 0; i < picks.length; i++) {
      const ch = getCharacter(picks[i]);
      const spawn = { ...STAGE.spawns[i % STAGE.spawns.length] };
      spawn.x -= 17;
      const f = new Fighter(ch, i, spawn, this.stocks, PLAYER_COLORS[i]);
      const isHuman = i < this.selecting;
      f.isHuman = isHuman;
      f.label = isHuman ? `P${i + 1}` : 'CPU';
      this.fighters.push(f);
      if (!isHuman) this.ais.push(new AIController(f, 0.7));
    }

    this.countdown = 180; // 3s of "3..2..1..GO"
    this.winner = null;
    this.state = 'BATTLE';
  }

  updateBattle() {
    if (input.wasPressed('Escape')) { sfx.back(); this.state = 'TITLE'; return; }

    if (this.countdown > 0) {
      this.countdown--;
      // let characters settle / fall to ground but no control yet
      for (const f of this.fighters) {
        f.update(frozenIntent(), this.world);
      }
      this.stepProjectiles();
      return;
    }

    for (const f of this.fighters) {
      if (f.dead) continue;
      let intent;
      if (f.isHuman) {
        intent = humanIntent(CONTROLS[`p${f.playerIndex + 1}`]);
      } else {
        const ai = this.ais.find((a) => a.f === f);
        intent = ai ? ai.think(this.world) : frozenIntent();
      }
      f.update(intent, this.world);
    }
    this.stepProjectiles();

    // win check
    const alive = this.fighters.filter((f) => !f.dead);
    if (alive.length <= 1 && this.fighters.length > 1) {
      this.winner = alive[0] || null;
      this.resultTimer = 0;
      this.state = 'RESULT';
      sfx.start();
    }
  }

  stepProjectiles() {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      this.projectiles[i].update(this.world);
      if (this.projectiles[i].dead) this.projectiles.splice(i, 1);
    }
  }

  updateResult() {
    this.resultTimer++;
    // keep KO particles flying a moment
    if (this.resultTimer > 30) {
      if (input.wasPressed('Enter') || input.wasPressed('Space') || input.wasPressed(CONTROLS.p1.light)) {
        sfx.start();
        this.beginBattle(); // rematch same picks
      }
      if (input.wasPressed('Escape')) { sfx.back(); this.state = 'TITLE'; }
    }
  }

  // ==========================================================================
  //  RENDER
  // ==========================================================================
  render() {
    const ctx = this.ctx;
    ctx.save();
    // screen shake
    if (this.shakeAmt > 0.5 && (this.state === 'BATTLE' || this.state === 'RESULT')) {
      const dx = (Math.random() - 0.5) * this.shakeAmt;
      const dy = (Math.random() - 0.5) * this.shakeAmt;
      ctx.translate(dx, dy);
    }

    this.stage.drawBg(ctx);

    switch (this.state) {
      case 'TITLE': this.renderTitle(ctx); break;
      case 'SELECT': this.renderSelect(ctx); break;
      case 'BATTLE': this.renderBattle(ctx); break;
      case 'RESULT': this.renderBattle(ctx); this.renderResult(ctx); break;
    }
    ctx.restore();
  }

  renderBattle(ctx) {
    this.stage.drawPlatforms(ctx);
    for (const p of this.projectiles) p.draw(ctx);
    for (const f of this.fighters) f.draw(ctx);
    this.particles.draw(ctx);
    this.drawHUD(ctx);

    if (this.countdown > 0) {
      const n = Math.ceil((this.countdown - 30) / 50);
      let txt = n > 0 ? String(n) : 'GO!';
      if (this.countdown <= 30) txt = 'GO!';
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = 'bold 90px monospace';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1d3a8a'; ctx.lineWidth = 10;
      ctx.strokeText(txt, GAME.WIDTH / 2, GAME.HEIGHT / 2 + 10);
      ctx.fillStyle = txt === 'GO!' ? '#ffd23f' : '#ffffff';
      ctx.fillText(txt, GAME.WIDTH / 2, GAME.HEIGHT / 2 + 10);
      ctx.restore();
    }
  }

  drawHUD(ctx) {
    const n = this.fighters.length;
    const boxW = 150, gap = 18;
    const totalW = n * boxW + (n - 1) * gap;
    let x = (GAME.WIDTH - totalW) / 2;
    const y = GAME.HEIGHT - 64;

    for (let i = 0; i < n; i++) {
      const f = this.fighters[i];
      // panel
      ctx.fillStyle = 'rgba(10,6,24,0.78)';
      ctx.fillRect(x, y, boxW, 56);
      ctx.strokeStyle = f.accentColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 0.5, y + 0.5, boxW - 1, 55);

      // portrait swatch
      ctx.fillStyle = f.char.palette.body;
      ctx.fillRect(x + 6, y + 6, 28, 28);
      ctx.fillStyle = f.char.palette.trim;
      ctx.fillRect(x + 6, y + 22, 28, 6);
      ctx.fillStyle = f.char.palette.eye;
      ctx.fillRect(x + 22, y + 12, 4, 5);
      ctx.fillRect(x + 28, y + 12, 4, 5);

      // name + label
      ctx.textAlign = 'left';
      ctx.fillStyle = f.accentColor;
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`${f.label} ${f.char.name}`, x + 40, y + 16);

      // damage %
      const pct = Math.floor(f.damage);
      const dmgColor = damageColor(f.damage);
      ctx.fillStyle = f.dead ? '#555' : dmgColor;
      ctx.font = 'bold 26px monospace';
      ctx.fillText(f.dead ? 'OUT' : `${pct}%`, x + 40, y + 44);

      // stock icons
      for (let s = 0; s < f.stocks; s++) {
        ctx.fillStyle = f.char.palette.body;
        ctx.fillRect(x + boxW - 14 - s * 12, y + 8, 8, 8);
      }
      x += boxW + gap;
    }
  }

  // ---- TITLE ----
  renderTitle(ctx) {
    ctx.textAlign = 'center';
    const cx = GAME.WIDTH / 2;
    const bob = Math.sin(this.t * 0.05) * 6;

    // big title with chunky outline so it pops over the bright sky
    ctx.font = 'bold 64px monospace';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1d3a8a'; ctx.lineWidth = 8;
    ctx.strokeText('MEME SMASH', cx, 150 + bob);
    ctx.fillStyle = '#ffd23f';
    ctx.fillText('MEME SMASH', cx, 150 + bob);

    ctx.fillStyle = '#1f8a4c';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('★ ONCHAIN BRAWLER · POWERED BY PUMP ★', cx, 188 + bob);

    const opts = ['1 PLAYER  (vs CPU)', '2 PLAYERS'];
    for (let i = 0; i < opts.length; i++) {
      const sel = i === this.titleIndex;
      ctx.font = `bold ${sel ? 30 : 24}px monospace`;
      const prefix = sel ? '▶ ' : '   ';
      if (sel) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.strokeText(prefix + opts[i], cx, 290 + i * 50); }
      ctx.fillStyle = sel ? '#ff5d2e' : '#41547c';
      ctx.fillText(prefix + opts[i], cx, 290 + i * 50);
    }

    ctx.fillStyle = '#1d3a8a';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`STOCKS: ◀ ${this.stocks} ▶`, cx, 410);

    ctx.fillStyle = '#41547c';
    ctx.font = '14px monospace';
    ctx.fillText('W/S or ↑/↓ select  ·  A/D or ←/→ stocks  ·  ENTER to start', cx, 470);
    ctx.fillText('(or press 1 / 2)', cx, 492);
  }

  // ---- SELECT ----
  renderSelect(ctx) {
    ctx.textAlign = 'center';
    const cx = GAME.WIDTH / 2;
    ctx.font = 'bold 34px monospace';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 6;
    ctx.strokeText('CHOOSE YOUR FIGHTER', cx, 70);
    ctx.fillStyle = '#1d3a8a';
    ctx.fillText('CHOOSE YOUR FIGHTER', cx, 70);

    const cols = 4, rows = 2;
    const cw = 150, ch = 130, gx = 18, gy = 18;
    const gridW = cols * cw + (cols - 1) * gx;
    const startX = (GAME.WIDTH - gridW) / 2;
    const startY = 110;

    for (let i = 0; i < CHARACTERS.length; i++) {
      const col = i % cols, row = Math.floor(i / cols);
      const x = startX + col * (cw + gx);
      const y = startY + row * (ch + gy);
      const c = CHARACTERS[i];

      ctx.fillStyle = 'rgba(255,255,255,0.78)';
      ctx.fillRect(x, y, cw, ch);
      ctx.strokeStyle = '#9bb8da'; ctx.lineWidth = 2;
      ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);

      // big portrait
      this.drawPortrait(ctx, c, x + cw / 2, y + 18, 2.2);

      ctx.fillStyle = '#1d3a8a';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(c.name, x + cw / 2, y + ch - 26);
      ctx.fillStyle = '#5a6b8c';
      ctx.font = '10px monospace';
      ctx.fillText(c.blurb.slice(0, 22), x + cw / 2, y + ch - 10);
    }

    // cursors
    for (let i = 0; i < this.cursors.length; i++) {
      const cur = this.cursors[i];
      const col = cur.idx % cols, row = Math.floor(cur.idx / cols);
      const x = startX + col * (cw + gx);
      const y = startY + row * (ch + gy);
      ctx.strokeStyle = PLAYER_COLORS[i];
      ctx.lineWidth = cur.locked ? 5 : 3;
      const pad = i === 1 ? 4 : 0;
      ctx.strokeRect(x - 2 + pad, y - 2 + pad, cw + 4 - pad * 2, ch + 4 - pad * 2);
      ctx.fillStyle = PLAYER_COLORS[i];
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(cur.locked ? `P${i + 1} ✓` : `P${i + 1}`, x + 4, y + 14);
      ctx.textAlign = 'center';
    }

    ctx.fillStyle = '#41547c';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    const hint = this.mode === '2P'
      ? 'P1: WASD move, F confirm, H back  ·  P2: arrows move, . confirm, , back'
      : 'WASD/arrows move  ·  F confirm  ·  H back  ·  ESC menu';
    ctx.fillText(hint, cx, GAME.HEIGHT - 24);
  }

  drawPortrait(ctx, c, cx, top, scale) {
    const p = c.palette;
    const w = 30 * scale, h = 40 * scale;
    const x = cx - w / 2, y = top;
    ctx.fillStyle = p.body;
    ctx.fillRect(x, y + 8, w, h - 8);
    ctx.fillRect(x + 6, y, w - 12, 14);
    ctx.fillStyle = p.trim;
    ctx.fillRect(x + 6, y + h * 0.55, w - 12, 6);
    ctx.fillStyle = p.eye;
    ctx.fillRect(x + w - 20, y + 6, 6, 7);
    ctx.fillRect(x + w - 11, y + 6, 6, 7);
    ctx.fillStyle = p.accent;
    ctx.fillRect(x, y + 8, 7, h - 8);
  }

  // ---- RESULT ----
  renderResult(ctx) {
    if (this.resultTimer < 30) return;
    ctx.fillStyle = 'rgba(6,3,16,0.72)';
    ctx.fillRect(0, 0, GAME.WIDTH, GAME.HEIGHT);
    ctx.textAlign = 'center';
    const cx = GAME.WIDTH / 2;

    if (this.winner) {
      ctx.fillStyle = this.winner.accentColor;
      ctx.font = 'bold 22px monospace';
      ctx.fillText(`${this.winner.label} WINS`, cx, 150);
      this.drawPortrait(ctx, this.winner.char, cx, 180, 3);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 48px monospace';
      ctx.fillText(this.winner.char.name + '!', cx, 360);
    } else {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 48px monospace';
      ctx.fillText('DRAW!', cx, 280);
    }

    const blink = Math.floor(this.t / 30) % 2 === 0;
    if (blink) {
      ctx.fillStyle = '#ffd23f';
      ctx.font = 'bold 18px monospace';
      ctx.fillText('ENTER = REMATCH      ESC = MENU', cx, 440);
    }
  }
}

// ---- intent helpers --------------------------------------------------------
function humanIntent(sc) {
  return {
    moveX: (input.isDown(sc.right) ? 1 : 0) - (input.isDown(sc.left) ? 1 : 0),
    up: input.isDown(sc.up),
    down: input.isDown(sc.down),
    jump: input.wasPressed(sc.up),
    light: input.wasPressed(sc.light),
    heavy: input.wasPressed(sc.heavy),
    special: input.wasPressed(sc.special),
    shield: input.isDown(sc.shield),
    dropTap: input.wasPressed(sc.down),
  };
}

function frozenIntent() {
  return { moveX: 0, up: false, down: false, jump: false, light: false, heavy: false, special: false, shield: false, dropTap: false };
}

function damageColor(d) {
  const t = Math.min(1, d / 150);
  const r = Math.round(120 + t * 135);
  const g = Math.round(230 - t * 200);
  const b = Math.round(90 - t * 70);
  return `rgb(${r},${g},${b})`;
}
