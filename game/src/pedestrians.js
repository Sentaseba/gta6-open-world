// The people of Coral Bay. They stroll the sidewalk around their block, cross
// at the corners to the next block, run from trouble, and fall down when
// trouble finds them. A pedestrian the player's car touches is a crime; one a
// traffic car approaches steps out of the way.
import { PEDS } from './config.js';
import { collideCircle } from './city.js';
import { intRange, pick, range } from './random.js';

const SHIRTS = ['#ffd166', '#ef476f', '#06d6a0', '#118ab2', '#f78c6b', '#c77dff', '#90be6d', '#f9f6f2'];
const SKIN = ['#f2c094', '#c68642', '#8d5524', '#ffdbac', '#e0ac69'];

function blockCorners(block) {
  const inset = 14;
  return [
    { x: block.x + inset, y: block.y + inset },
    { x: block.x + block.w - inset, y: block.y + inset },
    { x: block.x + block.w - inset, y: block.y + block.h - inset },
    { x: block.x + inset, y: block.y + block.h - inset },
  ];
}

function makePed(state, block) {
  const corner = intRange(state.rng, 0, 3);
  const point = blockCorners(block)[corner];
  return {
    x: point.x + range(state.rng, -6, 6),
    y: point.y + range(state.rng, -6, 6),
    angle: 0,
    block,
    corner,
    mode: 'walk',
    hp: 100,
    downT: 0,
    fleeT: 0,
    threat: null,
    color: pick(state.rng, SHIRTS),
    skin: pick(state.rng, SKIN),
    phase: range(state.rng, 0, 6),
  };
}

export function createPeds(state) {
  const blocks = state.city.blocks;
  for (let i = 0; i < PEDS.count; i += 1) {
    state.peds.push(makePed(state, blocks[intRange(state.rng, 0, blocks.length - 1)]));
  }
}

/** Send every pedestrian near a point running from it. */
export function panicNear(state, x, y, radius) {
  for (const ped of state.peds) {
    if (ped.mode === 'down') continue;
    if (Math.hypot(ped.x - x, ped.y - y) > radius) continue;
    ped.mode = 'flee';
    ped.fleeT = range(state.rng, 2, 4.5);
    ped.threat = { x, y };
  }
}

export function knockDown(state, ped, crimeKind) {
  ped.mode = 'down';
  ped.downT = range(state.rng, 5, 9);
  ped.hp = 100;
  if (crimeKind !== null) state.crimeQueue.push({ kind: crimeKind, x: ped.x, y: ped.y });
}

function walkTarget(state, ped) {
  const corners = blockCorners(ped.block);
  const target = corners[ped.corner];
  if (Math.hypot(target.x - ped.x, target.y - ped.y) > 12) return target;
  // At a corner: mostly carry on round the block, sometimes cross to the next.
  if (state.rng() < 0.3) {
    const blocks = state.city.blocks;
    const options = blocks.filter((b) => b !== ped.block
      && Math.abs(b.x - ped.block.x) + Math.abs(b.y - ped.block.y) <= 512 + 104 + 4);
    if (options.length > 0) {
      ped.block = pick(state.rng, options);
      const next = blockCorners(ped.block);
      let best = 0;
      let bestDist = Infinity;
      next.forEach((point, i) => {
        const d = Math.hypot(point.x - ped.x, point.y - ped.y);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      ped.corner = best;
      return next[best];
    }
  }
  ped.corner = (ped.corner + 1) % 4;
  return corners[ped.corner];
}

function movePed(state, ped, tx, ty, speed, dt) {
  const dx = tx - ped.x;
  const dy = ty - ped.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) return;
  ped.angle = Math.atan2(dy, dx);
  ped.x += (dx / dist) * Math.min(speed * dt, dist);
  ped.y += (dy / dist) * Math.min(speed * dt, dist);
  ped.phase += dt * (speed / 9);
  collideCircle(state.city, ped, 10);
}

function checkCars(state, ped) {
  for (const car of state.cars) {
    if (car.mode === 'wreck' || Math.abs(car.speed) < 40) continue;
    const dist = Math.hypot(car.x - ped.x, car.y - ped.y);
    if (dist > 30) continue;
    if (car.mode === 'player') {
      knockDown(state, ped, 'hitPed');
      car.speed *= 0.55;
      state.player.health -= 2;
      state.cues.push('thud');
      return;
    }
    if (car.mode === 'traffic' || car.mode === 'police') {
      // A dodge: jump sideways, then run a moment.
      const away = Math.atan2(ped.y - car.y, ped.x - car.x);
      ped.x += Math.cos(away) * 22;
      ped.y += Math.sin(away) * 22;
      ped.mode = 'flee';
      ped.fleeT = 1.6;
      ped.threat = { x: car.x, y: car.y };
      return;
    }
  }
}

export function updatePeds(state, dt) {
  for (const ped of state.peds) {
    if (ped.mode === 'down') {
      ped.downT -= dt;
      if (ped.downT <= 0) {
        ped.mode = 'flee';
        ped.fleeT = 2.4;
        ped.threat = { x: state.player.x, y: state.player.y };
      }
      continue;
    }
    if (ped.mode === 'flee' && ped.threat !== null) {
      ped.fleeT -= dt;
      const away = Math.atan2(ped.y - ped.threat.y, ped.x - ped.threat.x);
      movePed(state, ped, ped.x + Math.cos(away) * 90, ped.y + Math.sin(away) * 90, PEDS.runSpeed, dt);
      if (ped.fleeT <= 0) ped.mode = 'walk';
    } else {
      const target = walkTarget(state, ped);
      movePed(state, ped, target.x, target.y, PEDS.walkSpeed, dt);
    }
    checkCars(state, ped);
  }
}
