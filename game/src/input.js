// Keyboard and pointer input. Held keys are read as axes and flags each step;
// one-shot presses are queued as bits and taken once by the loop, so a press
// between two frames is never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_ATTACK = 8;
export const ACTION_MUTE = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const INTERACT = new Set(['KeyE']);
const ATTACK = new Set(['KeyF']);
const MUTE = new Set(['KeyM']);

export function createInput(target) {
  const held = { up: false, down: false, left: false, right: false, sprint: false, brake: false };
  let actions = 0;
  let pointer = null;

  function setHeld(code, value) {
    if (UP.has(code)) held.up = value;
    else if (DOWN.has(code)) held.down = value;
    else if (LEFT.has(code)) held.left = value;
    else if (RIGHT.has(code)) held.right = value;
    else if (code === 'ShiftLeft' || code === 'ShiftRight') held.sprint = value;
    else if (code === 'Space') held.brake = value;
    else return false;
    return true;
  }

  window.addEventListener('keydown', (event) => {
    if (setHeld(event.code, true)) {
      event.preventDefault();
      return;
    }
    if (event.repeat) return;
    if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (INTERACT.has(event.code)) actions |= ACTION_INTERACT;
    else if (ATTACK.has(event.code)) actions |= ACTION_ATTACK;
    else if (MUTE.has(event.code)) actions |= ACTION_MUTE;
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (setHeld(event.code, false)) event.preventDefault();
  });
  // A key released while the tab is hidden never sends keyup: drop everything on blur.
  window.addEventListener('blur', () => {
    held.up = held.down = held.left = held.right = held.sprint = held.brake = false;
  });
  target.addEventListener('pointerdown', (event) => {
    actions |= ACTION_CONFIRM | ACTION_ATTACK;
    pointer = { x: event.clientX, y: event.clientY };
  });
  target.addEventListener('pointermove', (event) => {
    pointer = { x: event.clientX, y: event.clientY };
  });

  return {
    held,
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The last pointer position in client pixels, or null if never seen. */
    pointer() {
      return pointer;
    },
  };
}
