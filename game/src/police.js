// Crime and punishment. Crimes the player commits land in a queue; this
// module decides which were witnessed, turns them into heat, and turns heat
// into stars. It also runs the police: cars that arrive from the edge of the
// action, chase by road when far and directly when close, and try to box the
// player in for an arrest rather than run him down.
import { CAR, HEAT, POLICE } from './config.js';
import { LAND, collideCircle, nearestRoad, randomRoadPoint } from './city.js';
import { range } from './random.js';
import { makeCar } from './vehicles.js';
import { panicNear } from './pedestrians.js';
import { toast } from './hud.js';

const CRIME_HEAT = {
  steal: HEAT.stealCar,
  hitPed: HEAT.hitPed,
  punch: HEAT.punchPed,
  hitPolice: HEAT.hitPolice,
  hitCar: HEAT.hitCar,
};

function witnessed(state, crime) {
  if (crime.kind === 'hitPolice') return true;
  for (const ped of state.peds) {
    if (ped.mode !== 'down' && Math.hypot(ped.x - crime.x, ped.y - crime.y) < HEAT.witnessRadius) return true;
  }
  for (const car of state.cars) {
    if (car.mode === 'police' && Math.hypot(car.x - crime.x, car.y - crime.y) < HEAT.witnessRadius + 160) return true;
  }
  return false;
}

/** Drain the crime queue into heat, and let the neighbourhood react. */
export function commitCrimes(state) {
  for (const crime of state.crimeQueue) {
    panicNear(state, crime.x, crime.y, 240);
    if (!witnessed(state, crime)) continue;
    const before = state.wanted.stars;
    state.wanted.heat += CRIME_HEAT[crime.kind] ?? 0;
    state.wanted.lastCrimeAt = state.time;
    updateStars(state);
    if (state.wanted.stars > before) {
      toast(state, `Wanted level ${state.wanted.stars}`, '#ff5147');
      state.cues.push('wanted');
    }
  }
  state.crimeQueue.length = 0;
}

export function updateStars(state) {
  let stars = 0;
  for (let i = 1; i < HEAT.starThresholds.length; i += 1) {
    if (state.wanted.heat >= HEAT.starThresholds[i]) stars = i;
  }
  state.wanted.stars = stars;
}

/** Heat cools only once the player is unseen and the area has gone quiet. */
export function updateWanted(state, dt) {
  const wanted = state.wanted;
  let seen = false;
  let near = false;
  for (const car of state.cars) {
    if (car.mode !== 'police') continue;
    const dist = Math.hypot(car.x - state.player.x, car.y - state.player.y);
    if (dist < POLICE.sightRadius) seen = true;
    if (dist < 1100) near = true;
  }
  wanted.hidden = !seen && wanted.stars > 0;
  if (wanted.hidden && !near && state.time - wanted.lastCrimeAt > HEAT.calmSeconds && wanted.heat > 0) {
    wanted.heat = Math.max(0, wanted.heat - HEAT.decayPerSecond * dt);
    updateStars(state);
  }
  state.siren = wanted.stars > 0 && seen;
}

/** A fresh unit arrives on a road a few blocks away, out of sight. */
function spawnPolice(state) {
  const angle = state.rng() * Math.PI * 2;
  const dist = range(state.rng, 680, 920);
  let x = Math.max(LAND.minX + 30, Math.min(LAND.maxX - 30, state.player.x + Math.cos(angle) * dist));
  let y = Math.max(LAND.minY + 30, Math.min(LAND.maxY - 30, state.player.y + Math.sin(angle) * dist));
  const near = nearestRoad(state.city, x, y);
  if (near.axis === 'x') x = near.centre;
  else y = near.centre;
  const car = makeCar(x, y, 0, 'police', 'police', state.rng);
  state.cars.push(car);
}

function chasePlayer(state, car, dt) {
  const player = state.player;
  const dx = player.x - car.x;
  const dy = player.y - car.y;
  const dist = Math.hypot(dx, dy);
  const desired = Math.atan2(dy, dx);
  let diff = desired - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-3.3 * dt, Math.min(3.3 * dt, diff));

  let wanted = 545;
  if (dist < 300) wanted = 380;
  if (player.car === null && dist < 110) wanted = Math.min(wanted, 120);
  if (player.car === null && dist < POLICE.bustRadius) wanted = 0;
  car.speed += Math.max(-640 * dt, Math.min(430 * dt, wanted - car.speed));
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const hitWall = collideCircle(state.city, car, CAR.radius);
  if (hitWall && Math.abs(car.speed) > 120) car.speed *= 0.4;

  // A unit stuck on a building gives up and a fresh one arrives instead.
  if (Math.abs(car.speed) < 26 && dist > 200) {
    car.stuckT += dt;
    if (car.stuckT > 2.6) {
      const point = randomRoadPoint(state.city, state.rng);
      if (Math.hypot(point.x - player.x, point.y - player.y) > 600) {
        car.x = point.x;
        car.y = point.y;
        car.stuckT = 0;
      }
    }
  } else car.stuckT = 0;
}

export function updatePolice(state, dt) {
  const wanted = state.wanted;
  const units = state.cars.filter((car) => car.mode === 'police');
  const desired = wanted.stars === 0 ? 0 : Math.min(1 + wanted.stars, POLICE.maxCars);

  state.policeSpawnT = (state.policeSpawnT ?? 0) - dt;
  if (units.length < desired && state.policeSpawnT <= 0) {
    spawnPolice(state);
    state.policeSpawnT = 1.1;
  }
  for (const car of units) {
    const dist = Math.hypot(car.x - state.player.x, car.y - state.player.y);
    if ((wanted.stars === 0 && dist > 620) || dist > POLICE.despawnFar) {
      state.cars.splice(state.cars.indexOf(car), 1);
      continue;
    }
    chasePlayer(state, car, dt);
  }

  // The arrest: close, on foot, and going nowhere.
  if (state.player.car === null && wanted.stars > 0 && state.over === null) {
    const near = units.some((car) => Math.hypot(car.x - state.player.x, car.y - state.player.y) < POLICE.bustRadius);
    if (near && Math.abs(state.player.speed) < 60) {
      wanted.bustT += dt;
      if (wanted.bustT >= POLICE.bustSeconds) {
        state.over = 'busted';
        state.lastFine = Math.min(state.cash, 150);
        state.stats.busted += 1;
      }
    } else {
      wanted.bustT = Math.max(0, wanted.bustT - dt * 1.6);
    }
  } else {
    wanted.bustT = Math.max(0, wanted.bustT - dt * 1.6);
  }
}
