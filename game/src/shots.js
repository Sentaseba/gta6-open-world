// The screenshot scenes behind ?shot=title|chase|drive|foot. Each one stages
// a moment — a chase, a delivery run, a pickup on foot — and then plays the
// real rules forward with a simple autopilot at the keys, so the frame is
// what a short game really looks like and the same seed always gives the
// same frame.
import { STEP } from './config.js';
import { stepWorld } from './world.js';
import { makeCar } from './vehicles.js';
import { updateStars } from './police.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './hud.js';

function makeInput() {
  return {
    held: { up: false, down: false, left: false, right: false, sprint: false, brake: false },
    takeActions: () => 0,
    pointer: () => null,
  };
}

function angleDiff(a, b) {
  let diff = a - b;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

/** Steer the player's car toward a point, the way a careful player would. */
function driveToward(input, car, tx, ty) {
  const diff = angleDiff(Math.atan2(ty - car.y, tx - car.x), car.angle);
  input.held.left = diff < -0.1;
  input.held.right = diff > 0.1;
  input.held.up = Math.abs(diff) < 0.9;
  input.held.down = false;
  input.held.brake = Math.abs(diff) > 1.8 && Math.abs(car.speed) > 200;
}

/** Walk the player toward a point. */
function walkToward(input, player, tx, ty) {
  const dx = tx - player.x;
  const dy = ty - player.y;
  input.held.left = dx < -8;
  input.held.right = dx > 8;
  input.held.up = dy < -8;
  input.held.down = dy > 8;
  input.held.sprint = Math.hypot(dx, dy) > 130;
}

function putPlayerInCar(world, kind, x, y, angle) {
  const car = makeCar(x, y, angle, kind, 'player', world.rng);
  car.stolenOnce = true;
  world.cars.push(car);
  world.player.car = car;
  world.player.x = x;
  world.player.y = y;
  world.player.angle = angle;
  return car;
}

function run(world, input, seconds, steer) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (steer) steer();
    stepWorld(world, input, 0, STEP);
  }
}

/** The cover: four stars, three units, and Dario's coupe running east. */
function stageChase(world) {
  const { roadsX, roadsY } = world.city;
  const input = makeInput();
  const lane = roadsY[1] + 26;
  const car = putPlayerInCar(world, 'sport', roadsX[0] + 80, lane, 0);
  car.speed = 400;
  const units = [
    makeCar(roadsX[0] - 60, lane, 0, 'police', 'police', world.rng),
    makeCar(roadsX[0] - 160, lane - 52, 0, 'police', 'police', world.rng),
    makeCar(roadsX[0] - 120, lane + 58, 0, 'police', 'police', world.rng),
  ];
  for (const unit of units) {
    unit.speed = 360;
    world.cars.push(unit);
  }
  world.wanted.heat = 132;
  world.wanted.lastCrimeAt = 0;
  updateStars(world);
  world.cash = 340;
  run(world, input, 3.8, () => driveToward(input, car, roadsX[6], lane));
  return { screen: SCREEN_PLAY };
}

/** A courier run down the coast road, parcel in the boot, clock running. */
function stageDrive(world) {
  const { roadsX, roadsY } = world.city;
  const input = makeInput();
  const car = putPlayerInCar(world, 'sedan', roadsX[5] - 26, roadsY[0] + 190, Math.PI / 2);
  car.speed = 260;
  world.cash = 485;
  world.storyIndex = 5;
  world.mission = {
    def: {
      title: 'Courier Run',
      reward: 185,
      story: false,
      steps: [
        { type: 'goto', place: 'cafe', foot: true, text: 'Pick up the parcel at Café Sol' },
        { type: 'goto', place: 'marina', time: 140, text: 'Deliver it to the marina store' },
      ],
    },
    stepIndex: 1,
    timeLeft: 97,
    timeTotal: 140,
    holdT: 0,
    car: null,
    checkIndex: 0,
  };
  run(world, input, 5.2, () => driveToward(input, car, roadsX[5] - 26, roadsY[3]));
  return { screen: SCREEN_PLAY };
}

/** On foot in the plaza, walking the last yards to a pickup. */
function stageFoot(world) {
  const input = makeInput();
  const cafe = world.city.locations.cafe;
  world.player.x = cafe.x - 150;
  world.player.y = cafe.y + 120;
  world.cash = 210;
  world.storyIndex = 1;
  world.mission = {
    def: {
      title: 'Special Delivery',
      reward: 220,
      story: true,
      steps: [
        { type: 'goto', place: 'cafe', foot: true, text: 'Pick up the package at Café Sol' },
        { type: 'goto', place: 'marina', time: 150, text: 'Deliver the package to the marina store' },
      ],
    },
    stepIndex: 0,
    timeLeft: null,
    timeTotal: null,
    holdT: 0,
    car: null,
    checkIndex: 0,
  };
  run(world, input, 3.4, () => walkToward(input, world.player, cafe.x - 52, cafe.y + 6));
  return { screen: SCREEN_PLAY };
}

/** The title, over downtown at midday. */
function stageTitle(world) {
  const input = makeInput();
  world.cameraFocus = { x: world.city.roadsX[3], y: world.city.roadsY[2] };
  run(world, input, 3, null);
  return { screen: SCREEN_TITLE };
}

/** Set `world` to the named scene and return the screen to draw over it. */
export function stageShot(name, world) {
  switch (name) {
    case 'chase': return stageChase(world);
    case 'drive': return stageDrive(world);
    case 'foot': return stageFoot(world);
    default: return stageTitle(world);
  }
}
