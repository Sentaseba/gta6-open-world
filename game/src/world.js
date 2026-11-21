// The whole game state in one object, and the one step that advances it.
// Systems live in their own modules and work on this state; keeping the shape
// here means every module agrees on what a car, a pedestrian and the wanted
// level look like.
import { createCity } from './city.js';
import { createRandom } from './random.js';
import { createPlayer, updatePlayer } from './player.js';
import { createCars, tryEnterExit, updateCars } from './vehicles.js';
import { updateEffects } from './effects.js';
import { ACTION_INTERACT } from './input.js';
import { updateToasts } from './hud.js';

export function createWorld(seed, saved) {
  const rng = createRandom(seed);
  const city = createCity(rng);
  const state = {
    seed,
    rng,
    city,
    time: 0,
    player: createPlayer(city),
    cars: [],
    peds: [],
    wanted: { heat: 0, stars: 0, lastCrimeAt: -100, bustT: 0, hidden: false },
    mission: null,
    storyIndex: saved?.story ?? 0,
    cash: saved?.cash ?? 60,
    stats: { earned: saved?.earned ?? 0, stolen: 0, busted: 0, wasted: 0 },
    toasts: [],
    cues: [],
    crimeQueue: [],
    particles: [],
    skids: [],
    shake: 0,
    banner: null,
    over: null,
    cameraFocus: null,
  };
  createCars(state);
  return state;
}

/** Advance everything by one fixed step. `actions` are this frame's one-shot presses. */
export function stepWorld(state, input, actions, dt) {
  state.time += dt;
  if (actions & ACTION_INTERACT) tryEnterExit(state);
  updatePlayer(state, input, dt);
  updateCars(state, input, dt);
  updateEffects(state, dt);
  updateToasts(state, dt);
}
