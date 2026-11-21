// Solmar City — keyboard and mouse input.
// One object holds the whole input state; the simulation reads it, the
// renderer reads the mouse for aiming. Keys are tracked by `code` so
// WASD and the arrow keys both work, and the game never depends on
// the browser's key repeat.
const KEYMAP = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
  KeyE: 'enter',
  KeyF: 'punch',
  KeyR: 'reload',
  Digit1: 'fists',
  Digit2: 'pistol',
  KeyM: 'mute',
  KeyP: 'pause',
  Escape: 'pause',
  Space: 'handbrake',
  Enter: 'confirm',
};

export function createInput(canvas) {
  const input = {
    up: false,
    down: false,
    left: false,
    right: false,
    sprint: false,
    enter: false,
    punch: false,
    handbrake: false,
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    // Edge-triggered actions: set on keydown, cleared by the game
    // after it reads them once.
    pressed: {},
    wheel: 0,
  };

  function onKeyDown(event) {
    const name = KEYMAP[event.code];
    if (!name) return;
    if (['up', 'down', 'left', 'right', 'Space'].includes(event.code) || name === 'up') event.preventDefault();
    if (!input[name]) input.pressed[name] = true;
    input[name] = true;
    if (event.code === 'Space') event.preventDefault();
  }

  function onKeyUp(event) {
    const name = KEYMAP[event.code];
    if (!name) return;
    input[name] = false;
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = event.clientX - rect.left;
    input.mouseY = event.clientY - rect.top;
  }

  function onMouseDown(event) {
    if (event.button === 0) input.mouseDown = true;
  }

  function onMouseUp(event) {
    if (event.button === 0) input.mouseDown = false;
  }

  function onWheel(event) {
    input.wheel += event.deltaY;
  }

  function onBlur() {
    for (const key of ['up', 'down', 'left', 'right', 'sprint', 'handbrake']) input[key] = false;
    input.mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('wheel', onWheel, { passive: true });

  input.consume = function (name) {
    const was = !!input.pressed[name];
    input.pressed[name] = false;
    return was;
  };

  input.clearPressed = function () {
    input.pressed = {};
  };

  input.detach = function () {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mouseup', onMouseUp);
  };

  return input;
}
