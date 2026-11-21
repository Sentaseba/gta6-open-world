// The screenshot scenes behind ?shot=<name>. Each one sets the world up and
// plays the real rules forward for a fixed number of steps, so the frame is
// what a short game really looks like and the same seed always gives the
// same frame.
import { STEP } from './config.js';
import { stepWorld } from './world.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './hud.js';

const IDLE_INPUT = {
  held: { up: false, down: false, left: false, right: false, sprint: false, brake: false },
  takeActions: () => 0,
  pointer: () => null,
};

/** Set `world` to the named scene and return the screen to draw over it. */
export function stageShot(name, world) {
  if (name === 'play') {
    for (let i = 0; i < 4 / STEP; i += 1) stepWorld(world, IDLE_INPUT, 0, STEP);
    return { screen: SCREEN_PLAY };
  }
  world.cameraFocus = { x: world.city.roadsX[3], y: world.city.roadsY[2] };
  for (let i = 0; i < 3 / STEP; i += 1) stepWorld(world, IDLE_INPUT, 0, STEP);
  return { screen: SCREEN_TITLE };
}
