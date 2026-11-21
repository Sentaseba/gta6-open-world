// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer and HUD paint what is there. The game moves between four screens:
// title, play, paused and over.
//
// ?seed=N fixes the city and traffic. ?shot=title|chase|drive|foot (with
// &seed=N) stages a screenshot scene instead of running the loop, paints it
// and sets window.__shotReady.
import { STEP } from './config.js';
import { createWorld, respawn, stepWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer } from './render.js';
import { createHud, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './hud.js';
import { loadSave, storeSave } from './save.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

/** Nobody at the keys: used to keep the city alive behind the title screen. */
const IDLE_INPUT = {
  held: { up: false, down: false, left: false, right: false, sprint: false, brake: false },
  takeActions: () => 0,
  pointer: () => null,
};

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const saved = loadSave();
const world = createWorld(seed, saved);
const renderer = createRenderer(canvas);
const hud = createHud();

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.drawWorld(world);
    hud.draw(renderer.ctx, renderer.view, world, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const audio = createAudio();
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();

  // Sound starts on the first gesture, as browsers require.
  window.addEventListener('keydown', () => audio.unlock(), { once: true });
  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });

  function announce(message) {
    status.textContent = message;
  }

  function startRun() {
    if (world.over !== null) respawn(world);
    screen = SCREEN_PLAY;
    announce('Playing.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) announce(audio.toggleMute() ? 'Muted.' : 'Sound on.');
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startRun();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    return actions;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen === SCREEN_PLAY || screen === SCREEN_TITLE) {
      // Behind the title the city lives on, driven by nobody.
      const active = screen === SCREEN_PLAY;
      let stepActions = active ? actions : 0;
      while (accumulator >= STEP) {
        stepWorld(world, active ? input : IDLE_INPUT, stepActions, STEP);
        stepActions = 0;
        accumulator -= STEP;
        if (active && world.over !== null) {
          screen = SCREEN_OVER;
          storeSave(world);
          announce(world.over === 'busted' ? 'Busted.' : 'Wasted.');
          break;
        }
      }
    } else {
      accumulator = 0;
    }
    audio.update(world, screen !== SCREEN_PLAY);
    renderer.drawWorld(world);
    hud.draw(renderer.ctx, renderer.view, world, screen);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Coral Bay Heat. Press Enter or click to play.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
