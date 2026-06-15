// ============================================================================
//  Bootstrap — wire up canvas, resume audio on first gesture, start the game.
// ============================================================================
import { Game } from './game.js';
import { sfx } from './audio.js';

const canvas = document.getElementById('game');
const game = new Game(canvas);

// unlock WebAudio on first interaction (browser autoplay policy)
function unlock() {
  sfx.resume();
  window.removeEventListener('keydown', unlock);
  window.removeEventListener('pointerdown', unlock);
}
window.addEventListener('keydown', unlock);
window.addEventListener('pointerdown', unlock);

// focus so keys register immediately
canvas.tabIndex = 0;
canvas.focus();
window.addEventListener('pointerdown', () => canvas.focus());

// --- fullscreen toggle ---
const frame = document.getElementById('frame');
const fsBtn = document.getElementById('fsBtn');
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    (frame.requestFullscreen || frame.webkitRequestFullscreen).call(frame);
  } else {
    (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  }
  canvas.focus();
}
fsBtn.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', () => {
  fsBtn.textContent = document.fullscreenElement ? '⛶ EXIT' : '⛶ FULLSCREEN';
  canvas.focus();
});

// --- controls overlay toggle ---
const helpBtn = document.getElementById('helpBtn');
const controls = document.getElementById('controls');
helpBtn.addEventListener('click', () => {
  controls.classList.toggle('hidden');
  canvas.focus();
});

game.start();

// expose for debugging
window.__game = game;
