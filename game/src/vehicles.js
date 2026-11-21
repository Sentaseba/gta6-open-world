// Cars: the parked ones waiting to be stolen, the traffic following its
// lanes, and the one the player is driving. Traffic drives the road grid —
// along a lane to the next junction, then straight on or a turn — and slows
// for whatever is in front of it. The player's car is an arcade drive:
// throttle, brake, handbrake, and collisions that cost health and paint.
import { CAR, CAR_KINDS, CAR_COLORS, ROAD, TRAFFIC } from './config.js';
import { collideCircle } from './city.js';
import { intRange, pick, range } from './random.js';
import { addSkid, burst, shake, smoke } from './effects.js';
import { toast } from './hud.js';

const KINDS = ['compact', 'sedan', 'sedan', 'sport', 'van'];

export function makeCar(x, y, angle, kind, mode, random) {
  return {
    x, y, angle,
    speed: 0,
    kind,
    color: kind === 'police' ? '#f2f4f6' : pick(random, CAR_COLORS),
    mode,
    health: CAR.maxHealth,
    route: null,
    honkT: 0,
    hitT: 0,
    stuckT: 0,
    stolenOnce: false,
  };
}

/** The lane offset from a road centre for a car on `axis` heading `dir`. */
function laneOffset(axis, dir) {
  return axis === 'x' ? -dir * ROAD.lane : dir * ROAD.lane;
}

/** Give a traffic car a fresh leg: along its road to the junction at `target`. */
function setLeg(city, car, axis, roadIndex, dir, targetIndex) {
  car.route = { axis, road: roadIndex, dir, target: targetIndex };
}

function spawnTraffic(state) {
  const { city, rng } = state;
  const axis = rng() < 0.5 ? 'x' : 'y';
  const roads = axis === 'x' ? city.roadsX : city.roadsY;
  const cross = axis === 'x' ? city.roadsY : city.roadsX;
  const road = intRange(rng, 0, roads.length - 1);
  const dir = rng() < 0.5 ? 1 : -1;
  const along = range(rng, 260, (axis === 'x' ? 2880 : 3840) - 260);
  const target = dir > 0 ? cross.length - 1 : 0;
  const offset = laneOffset(axis, dir);
  const x = axis === 'x' ? roads[road] + offset : along;
  const y = axis === 'x' ? along : roads[road] + offset;
  const angle = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
  const car = makeCar(x, y, angle, pick(rng, KINDS), 'traffic', rng);
  setLeg(city, car, axis, road, dir, target);
  car.speed = TRAFFIC.speed * range(rng, 0.8, 1);
  return car;
}

export function createCars(state) {
  const { city, rng } = state;
  for (const slot of city.parkingSlots) {
    if (rng() < 0.45) continue;
    const car = makeCar(slot.x, slot.y, slot.angle, pick(rng, KINDS), 'parked', rng);
    state.cars.push(car);
  }
  for (let i = 0; i < TRAFFIC.cars; i += 1) state.cars.push(spawnTraffic(state));
}

/** The point a routed car is steering for, a little past its junction. */
function routeTarget(city, car) {
  const { axis, road, dir, target } = car.route;
  if (axis === 'x') return { x: city.roadsX[road] + laneOffset(axis, dir), y: city.roadsY[target] };
  return { x: city.roadsX[target], y: city.roadsY[road] + laneOffset(axis, dir) };
}

function atJunction(city, car) {
  const target = routeTarget(city, car);
  return Math.hypot(target.x - car.x, target.y - car.y) < 26;
}

function chooseNextLeg(state, car) {
  const { city, rng } = state;
  const { axis, road, dir, target } = car.route;
  const alongRoads = axis === 'x' ? city.roadsY : city.roadsX;
  const straight = target + dir;
  if (rng() < 0.55 && straight >= 0 && straight < alongRoads.length) {
    setLeg(city, car, axis, road, dir, straight);
    return;
  }
  // Turn onto the road that crosses at this junction and head for its far end.
  const newAxis = axis === 'x' ? 'y' : 'x';
  const newDir = rng() < 0.5 ? 1 : -1;
  const newTargets = newAxis === 'y' ? city.roadsX : city.roadsY;
  let newTarget = newDir > 0 ? newTargets.length - 1 : 0;
  if (newTarget === road) newTarget = newDir > 0 ? 0 : newTargets.length - 1;
  setLeg(city, car, newAxis, target, newDir, newTarget);
}

/** Whatever is just ahead of a car: another car, or the player on foot. */
function obstacleAhead(state, car) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let nearest = null;
  let nearestDist = TRAFFIC.gap;
  for (const other of state.cars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const forward = dx * fx + dy * fy;
    if (forward < 6 || forward > nearestDist) continue;
    if (Math.abs(dx * -fy + dy * fx) > 24) continue;
    nearest = other;
    nearestDist = forward;
  }
  const player = state.player;
  if (player.car === null) {
    const dx = player.x - car.x;
    const dy = player.y - car.y;
    const forward = dx * fx + dy * fy;
    if (forward > 0 && forward < 52 && Math.abs(dx * -fy + dy * fx) < 20) return { dist: forward, speed: 0, blocks: 'player' };
  }
  return nearest === null ? null : { dist: nearestDist, speed: nearest.speed, blocks: 'car' };
}

/** The junction a routed car is heading for. */
function junctionAhead(city, car) {
  const { axis, road, target } = car.route;
  return axis === 'x'
    ? { x: city.roadsX[road], y: city.roadsY[target] }
    : { x: city.roadsX[target], y: city.roadsY[road] };
}

/** True when another car is moving through the junction: approaching traffic waits. */
function junctionBusy(state, car, junction) {
  for (const other of state.cars) {
    if (other === car || other.mode === 'parked' || other.mode === 'wreck') continue;
    if (other.mode !== 'player' && Math.abs(other.speed) < 20) continue;
    if (Math.hypot(other.x - junction.x, other.y - junction.y) < 54) return true;
  }
  return false;
}

function updateTrafficCar(state, car, dt) {
  if (atJunction(state.city, car)) chooseNextLeg(state, car);
  const target = routeTarget(state.city, car);
  const lookX = target.x;
  const lookY = target.y;
  const desired = Math.atan2(lookY - car.y, lookX - car.x);
  let diff = desired - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-3.1 * dt, Math.min(3.1 * dt, diff));

  const obstacle = obstacleAhead(state, car);
  let wanted = TRAFFIC.speed;
  if (obstacle !== null) {
    wanted = obstacle.dist < 44 ? 0 : Math.min(wanted, obstacle.speed);
    if (wanted === 0 && car.speed > 4 && car.honkT <= 0) {
      car.honkT = range(state.rng, 1.4, 3.4);
      state.cues.push('honk');
    }
  }
  // Ease off near junctions, and wait at the crosswalk while one is busy.
  const junction = junctionAhead(state.city, car);
  const junctionDist = Math.hypot(junction.x - car.x, junction.y - car.y);
  if (junctionDist < 150) wanted = Math.min(wanted, 130);
  if (junctionDist > 42 && junctionDist < 78 && junctionBusy(state, car, junction)) wanted = 0;

  // A car boxed in for a while edges forward; one stuck far away rejoins elsewhere.
  if (car.speed < 8 && wanted === 0) car.stuckT += dt;
  else if (car.speed > 40) car.stuckT = 0;
  if (car.stuckT > 2.5 && obstacle !== null && obstacle.blocks === 'car') wanted = Math.max(wanted, 52);
  if (car.stuckT > 7 && Math.hypot(car.x - state.player.x, car.y - state.player.y) > 700) {
    const fresh = spawnTraffic(state);
    car.x = fresh.x;
    car.y = fresh.y;
    car.angle = fresh.angle;
    car.route = fresh.route;
    car.speed = fresh.speed;
    car.stuckT = 0;
    return;
  }
  if (car.honkT > 0) car.honkT -= dt;
  car.speed += Math.max(-420 * dt, Math.min(240 * dt, wanted - car.speed));
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  collideCircle(state.city, car, CAR.radius - 6);
}

/** Damage a car; at zero it becomes a smoking wreck. Returns the damage dealt. */
export function damageCar(state, car, amount, x, y) {
  car.health -= amount;
  car.hitT = 0.12;
  burst(state, x, y, '#ffd166', 7, 190, 0.4, 3);
  if (car.health <= 0 && car.mode !== 'wreck') {
    car.mode = 'wreck';
    car.speed = 0;
    car.wreckT = 0;
    burst(state, x, y, '#888888', 16, 120, 0.9, 6);
  }
  return amount;
}

function updatePlayerCar(state, input, dt) {
  const car = state.player.car;
  const stats = CAR_KINDS[car.kind];
  const throttle = input.held.up ? 1 : 0;
  const braking = input.held.down;
  const handbrake = input.held.brake;

  if (throttle) car.speed += stats.accel * dt;
  if (braking) car.speed -= (car.speed > 8 ? stats.brake : stats.accel * 0.7) * dt;
  car.speed -= car.speed * (handbrake ? 1.4 : 0.35) * dt;
  const top = handbrake ? stats.topSpeed * 0.6 : stats.topSpeed;
  car.speed = Math.max(-stats.reverse, Math.min(top, car.speed));

  const steerIn = (input.held.left ? -1 : 0) + (input.held.right ? 1 : 0);
  const speedFactor = Math.min(1, Math.abs(car.speed) / 130);
  const turn = steerIn * 1.9 * speedFactor * (handbrake ? 1.45 : 1) * Math.sign(car.speed || 1);
  car.angle += turn * dt;

  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;

  const hitWall = collideCircle(state.city, car, CAR.radius);
  if (hitWall && Math.abs(car.speed) > 90) {
    const impact = Math.abs(car.speed);
    damageCar(state, car, impact * 0.045, car.x, car.y);
    state.player.health -= impact * 0.012;
    state.cues.push('crash');
    shake(state, Math.min(9, impact / 60));
    car.speed = -car.speed * 0.24;
  } else if (hitWall) {
    car.speed *= 0.7;
  }

  if (handbrake && Math.abs(car.speed) > 160) {
    addSkid(state, car.x - Math.cos(car.angle) * 14 + Math.cos(car.angle + Math.PI / 2) * 9, car.y - Math.sin(car.angle) * 14 + Math.sin(car.angle + Math.PI / 2) * 9);
    addSkid(state, car.x - Math.cos(car.angle) * 14 - Math.cos(car.angle + Math.PI / 2) * 9, car.y - Math.sin(car.angle) * 14 - Math.sin(car.angle + Math.PI / 2) * 9);
  }
  if (car.health < 45 && state.time % 0.12 < dt) smoke(state, car.x, car.y, car.health < 20);
  state.player.x = car.x;
  state.player.y = car.y;
  state.player.angle = car.angle;
}

/** Car against car: push apart, trade speed, pay for it in damage. */
function collideCars(state) {
  const cars = state.cars;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distSq = dx * dx + dy * dy;
      const min = CAR.radius * 2 - 8;
      if (distSq > min * min || distSq === 0) continue;
      const dist = Math.sqrt(distSq);
      const push = (min - dist) / 2;
      const nx = dx / dist;
      const ny = dy / dist;
      if (a.mode !== 'parked' && a.mode !== 'wreck') { a.x -= nx * push; a.y -= ny * push; }
      if (b.mode !== 'parked' && b.mode !== 'wreck') { b.x += nx * push; b.y += ny * push; }
      // Traffic brushes past traffic without harm; only a shunt involving the
      // player's car costs anyone anything.
      const closing = (a.speed * Math.cos(a.angle) - b.speed * Math.cos(b.angle)) * nx
        + (a.speed * Math.sin(a.angle) - b.speed * Math.sin(b.angle)) * ny;
      if (closing > 120 && (a.mode === 'player' || b.mode === 'player')) {
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        damageCar(state, a, closing * 0.03, midX, midY);
        damageCar(state, b, closing * 0.03, midX, midY);
        state.cues.push('crash');
        shake(state, Math.min(8, closing / 70));
        state.player.health -= closing * 0.008;
      }
      const swap = (a.speed + b.speed) / 2;
      if (a.mode !== 'parked' && a.mode !== 'wreck') a.speed = swap * 0.8;
      if (b.mode !== 'parked' && b.mode !== 'wreck') b.speed = swap * 0.8;
    }
  }
}

/** E near a car: climb in. E behind the wheel, nearly stopped: climb out. */
export function tryEnterExit(state) {
  const player = state.player;
  if (player.car !== null) {
    const car = player.car;
    if (Math.abs(car.speed) > 70) return;
    car.mode = car.health > 0 ? 'empty' : 'wreck';
    player.car = null;
    player.x = car.x + Math.cos(car.angle - Math.PI / 2) * 34;
    player.y = car.y + Math.sin(car.angle - Math.PI / 2) * 34;
    collideCircle(state.city, player, 13);
    state.cues.push('door');
    return;
  }
  let best = null;
  let bestDist = 56;
  for (const car of state.cars) {
    if (car.mode !== 'parked' && car.mode !== 'empty') continue;
    const dist = Math.hypot(car.x - player.x, car.y - player.y);
    if (dist < bestDist) { best = car; bestDist = dist; }
  }
  if (best === null) return;
  best.mode = 'player';
  best.speed = 0;
  player.car = best;
  player.x = best.x;
  player.y = best.y;
  state.cues.push('door');
  if (!best.stolenOnce) {
    best.stolenOnce = true;
    state.stats.stolen += 1;
    state.crimeQueue.push({ kind: 'steal', x: best.x, y: best.y });
    toast(state, 'Car stolen', '#ffb52e');
  }
}

/** Keep traffic spread out: a car that ends up far from the action rejoins near it. */
function recycleTraffic(state, dt) {
  const focus = state.player;
  for (const car of state.cars) {
    if (car.mode === 'wreck') {
      // Wrecks are towed away after a while and the slot rejoins as traffic.
      car.wreckT = (car.wreckT ?? 0) + dt;
      if (car.wreckT < 40) continue;
      const fresh = spawnTraffic(state);
      Object.assign(car, fresh, { mode: 'traffic', health: CAR.maxHealth });
      continue;
    }
    if (car.mode !== 'traffic') continue;
    if (Math.hypot(car.x - focus.x, car.y - focus.y) < 1500) continue;
    const fresh = spawnTraffic(state);
    car.x = fresh.x;
    car.y = fresh.y;
    car.angle = fresh.angle;
    car.route = fresh.route;
    car.speed = fresh.speed;
  }
}

export function updateCars(state, input, dt) {
  for (const car of state.cars) {
    if (car.hitT > 0) car.hitT -= dt;
    if (car.mode === 'traffic') updateTrafficCar(state, car, dt);
  }
  if (state.player.car !== null) updatePlayerCar(state, input, dt);
  collideCars(state);
  recycleTraffic(state, dt);
}
