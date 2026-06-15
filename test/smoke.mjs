// Headless smoke test: stub browser globals, drive the game through every
// state for many ticks, and assert nothing throws. Catches runtime/logic bugs
// that `node --check` can't (undefined refs, bad array access, NaN spirals).

const gradient = { addColorStop() {} };
const ctx = new Proxy({}, {
  get(_t, prop) {
    if (typeof prop === 'string' && prop.startsWith('create') && prop.endsWith('Gradient')) return () => gradient;
    if (prop === 'measureText') return () => ({ width: 10 });
    if (prop === 'canvas') return { width: 960, height: 540 };
    return () => {};
  },
  set() { return true; },
});

const fakeCanvas = {
  width: 960, height: 540, tabIndex: 0,
  getContext: () => ctx,
  focus() {}, addEventListener() {},
};

global.window = { addEventListener() {}, removeEventListener() {} };
global.document = { getElementById: () => fakeCanvas };
global.performance = { now: () => 0 };
global.requestAnimationFrame = () => 0;
global.AudioContext = undefined; // sfx disables itself gracefully

const { Game } = await import('../src/game.js');
const { input } = await import('../src/input.js');

let ticks = 0;
function run(n, label) {
  for (let i = 0; i < n; i++) { g.update(); g.render(); input.update(); ticks++; }
  // sanity: no NaN positions
  for (const f of g.fighters) {
    if (Number.isNaN(f.x) || Number.isNaN(f.y) || Number.isNaN(f.vx) || Number.isNaN(f.vy)) {
      throw new Error(`NaN in fighter ${f.char.id} during ${label}`);
    }
  }
}

const g = new Game(fakeCanvas);

// TITLE
run(60, 'title');
console.log('✓ title renders');

// SELECT (1P)
g.titleIndex = 0;
g.enterSelect();
run(30, 'select');
console.log('✓ select renders, mode=' + g.mode);

// BATTLE — lock cursor to start, then fight
g.beginBattle();
if (g.fighters.length !== 2) throw new Error('expected 2 fighters in 1P');
run(200, 'countdown+battle'); // through countdown into live combat
console.log('✓ battle runs, countdown done=' + (g.countdown === 0));

// Force combat resolution: drive AI + push P1 toward a KO repeatedly
g.fighters[0].damage = 250; // make P1 easy to launch
run(600, 'combat');
console.log('✓ 600 combat ticks, projectiles=' + g.projectiles.length);

// Force a KO directly to exercise die()/respawn/result paths
const p1 = g.fighters[0];
p1.stocks = 1;
p1.x = -500; // past left blast zone
run(5, 'forced-KO');
run(120, 'result');
console.log('✓ post-KO state=' + g.state + ' winner=' + (g.winner ? g.winner.char.id : 'none'));

// 2P path
g.state = 'TITLE'; g.titleIndex = 1; g.enterSelect();
if (g.selecting !== 2) throw new Error('2P should have 2 pickers');
g.beginBattle();
run(300, '2p-battle');
console.log('✓ 2P battle runs with ' + g.fighters.length + ' fighters');

console.log(`\nALL SMOKE TESTS PASSED (${ticks} ticks simulated)`);
