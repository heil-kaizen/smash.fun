# MEME SMASH — Onchain Brawler

A 2D pixel platform fighter (Super Smash Bros–style: damage %, knockback,
stocks, ring-outs) built in vanilla HTML5 Canvas + ES modules. No build step,
no dependencies. Designed as a web game for a pump.fun launch.

The roster is **meme-themed placeholders** drawn procedurally — swap in real
sprite art later without touching engine code (see "Adding real art" below).

## Run it locally

It uses ES modules, so it must be served over HTTP (not opened as a file).

```bash
# from this folder
python3 -m http.server 8080
# then open http://127.0.0.1:8080
```

Or use the helper script:

```bash
./start.sh
```

## Controls

| Action        | Player 1      | Player 2          |
|---------------|---------------|-------------------|
| Move / Jump   | `WASD`        | Arrow keys        |
| Drop / Fastfall | `S`         | `↓`               |
| Light attack  | `F`           | `.`               |
| Smash (heavy) | `G`           | `/`               |
| Special       | `H`           | `,`               |
| Shield        | `R`           | `Right-Shift`     |

Smash + ↑ / ↓ gives up-smash / down-smash. `ESC` returns to the menu.

## Gameplay

- Hit opponents to raise their **damage %**. Higher % = they fly farther.
- Knock a fighter past the **blast zone** (off screen) to take a **stock**.
- Last fighter with stocks remaining **wins**.
- Modes: **1 Player** (vs CPU) and **2 Player** local. Stocks configurable (1–9).

## Roster (placeholders)

DOGE · PEPE · CHAD · WOJAK · SHIBA · TROLL · PUMP · NYAN — each has distinct
weight, speed, jump, damage, and a special (projectile or dash).

## Adding real meme art later

Characters are fully data-driven in `src/config.js`. Two ways to bring in art:

1. **Sprite sheets (recommended):** drop `assets/sprites/<id>.png` and set
   `sprite: 'assets/sprites/<id>.png'` on that character. Then extend
   `Fighter.draw()` in `src/fighter.js` to blit the sheet (a hook is already
   there — currently it falls back to `drawPlaceholder`).
2. **Tweak placeholders:** edit each character's `palette` colors and stats.

To add/remove fighters, just edit the `CHARACTERS` array — the select grid,
HUD, and AI all adapt automatically.

## Project layout

```
index.html        shell + on-page control legend
styles.css        crisp pixel scaling
src/config.js     constants, physics, roster, stage, controls  ← main tuning
src/input.js      keyboard w/ edge detection
src/audio.js      procedural WebAudio SFX (no asset files)
src/particles.js  hit sparks / dust / KO bursts
src/fighter.js    Fighter + Projectile (movement, combat, KO)
src/ai.js         CPU controller
src/stage.js      background + platform rendering
src/game.js       state machine, HUD, menus, game loop
src/main.js       bootstrap
test/smoke.mjs    headless logic smoke test (node test/smoke.mjs)
```
