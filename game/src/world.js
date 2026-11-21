// The whole game state in one object, and the one step that advances it.
// Systems live in their own modules and work on this state; keeping the shape
// here means every module agrees on what a car, a pedestrian and the wanted
// level look like.
import { PLAYER } from './config.js';
import { createCity } from './city.js';
import { createRandom } from './random.js';
import { createPlayer, updatePlayer } from './player.js';
import { createCars, tryEnterExit, updateCars } from './vehicles.js';
import { createPeds, updatePeds } from './pedestrians.js';
import { commitCrimes, updatePolice, updateStars, updateWanted } from './police.js';
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
    lastFine: 0,
    siren: false,
    policeSpawnT: 0,
    cameraFocus: null,
  };
  createCars(state);
  createPeds(state);
  return state;
}

/** Advance everything by one fixed step. `actions` are this frame's one-shot presses. */
export function stepWorld(state, input, actions, dt) {
  state.time += dt;
  if (state.over !== null) return;
  if (actions & ACTION_INTERACT) tryEnterExit(state);
  updatePlayer(state, input, actions, dt);
  updateCars(state, input, dt);
  updatePeds(state, dt);
  commitCrimes(state);
  updateWanted(state, dt);
  updatePolice(state, dt);
  updateEffects(state, dt);
  updateToasts(state, dt);
  if (state.player.health <= 0) {
    state.player.health = 0;
    state.over = 'wasted';
    state.lastFine = Math.min(state.cash, 200);
    state.stats.wasted += 1;
    state.cues.push('wasted');
  }
}

/**
 * After a bust or a hospital visit: pay the fine, lose the heat, and wake up
 * at the police station's door or the hospital's.
 */
export function respawn(state) {
  const place = state.over === 'busted' ? state.city.locations.police : state.city.locations.hospital;
  state.cash -= state.lastFine;
  if (state.player.car !== null) {
    state.player.car.mode = 'empty';
    state.player.car = null;
  }
  state.cars = state.cars.filter((car) => car.mode !== 'police');
  state.wanted.heat = 0;
  state.wanted.bustT = 0;
  updateStars(state);
  state.player.x = place.x;
  state.player.y = place.y;
  state.player.health = PLAYER.maxHealth;
  state.mission = null;
  state.over = null;
}
