// The whole game state in one object, and the one step that advances it.
// Systems live in their own modules and work on this state; keeping the shape
// here means every module agrees on what a car, a pedestrian and the wanted
// level look like.
import { createCity } from './city.js';
import { createRandom } from './random.js';
import { createPlayer, updatePlayer } from './player.js';
import { updateToasts } from './hud.js';

export function createWorld(seed, saved) {
  const rng = createRandom(seed);
  const city = createCity(rng);
  return {
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
    particles: [],
    skids: [],
    shake: 0,
    banner: null,
    over: null,
    cameraFocus: null,
  };
}

/** Advance everything by one fixed step. */
export function stepWorld(state, input, dt) {
  state.time += dt;
  updatePlayer(state, input, dt);
  updateToasts(state, dt);
}
