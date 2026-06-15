// ============================================================================
//  Input — keyboard state with edge detection (pressed-this-frame).
//  Call input.update() once at the END of each game tick to roll the buffers.
// ============================================================================

class Input {
  constructor() {
    this.down = new Set();      // keys currently held
    this.pressed = new Set();   // keys that went down since last update()
    this.released = new Set();  // keys that went up since last update()
    this._queueDown = new Set();
    this._queueUp = new Set();

    window.addEventListener('keydown', (e) => {
      // prevent page scroll on arrows / space
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (!this.down.has(e.code)) this._queueDown.add(e.code);
      this.down.add(e.code);
    });

    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
      this._queueUp.add(e.code);
    });

    // drop everything if the tab loses focus (avoids stuck keys)
    window.addEventListener('blur', () => {
      this.down.clear();
    });
  }

  // roll edge buffers — must run after all consumers have read them this frame
  update() {
    this.pressed = this._queueDown;
    this.released = this._queueUp;
    this._queueDown = new Set();
    this._queueUp = new Set();
  }

  isDown(code) { return this.down.has(code); }
  wasPressed(code) { return this.pressed.has(code); }
  wasReleased(code) { return this.released.has(code); }
}

export const input = new Input();
