// The player: Dario, on foot or behind the wheel. This module owns his body —
// position, facing, health, the walk and the punch. Driving lives in
// vehicles.js; this file decides which of the two he is doing.
import { PLAYER } from './config.js';
import { collideCircle } from './city.js';
import { ACTION_ATTACK } from './input.js';
import { knockDown } from './pedestrians.js';
import { burst } from './effects.js';

export function createPlayer(city) {
  const start = city.locations.safehouse;
  return {
    x: start.x,
    y: start.y,
    angle: Math.PI / 2,
    speed: 0,
    health: PLAYER.maxHealth,
    car: null,
    punchT: 0,
    punchCooldown: 0,
    hurtT: 0,
    stepPhase: 0,
  };
}

/** Turn an angle toward a target by at most `amount`, the short way round. */
export function turnToward(angle, target, amount) {
  let diff = target - angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) <= amount) return target;
  return angle + Math.sign(diff) * amount;
}

function updateOnFoot(state, input, dt) {
  const player = state.player;
  const dx = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
  const dy = (input.held.down ? 1 : 0) - (input.held.up ? 1 : 0);
  const moving = dx !== 0 || dy !== 0;
  const sprinting = input.held.sprint;
  const speed = moving ? (sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed) : 0;

  if (moving) {
    const target = Math.atan2(dy, dx);
    player.angle = turnToward(player.angle, target, PLAYER.turnRate * dt);
    const length = Math.hypot(dx, dy);
    player.x += (dx / length) * speed * dt;
    player.y += (dy / length) * speed * dt;
    player.stepPhase += dt * (sprinting ? 13 : 10);
  }
  player.speed = speed;
  collideCircle(state.city, player, PLAYER.radius);

  if (player.punchCooldown > 0) player.punchCooldown -= dt;
  if (player.punchT > 0) player.punchT -= dt;
  if (player.hurtT > 0) player.hurtT -= dt;
}

/** A swing at whoever is in front of him. Three good hits put a person down. */
function punch(state) {
  const player = state.player;
  player.punchT = 0.16;
  player.punchCooldown = PLAYER.punchCooldown;
  state.cues.push('swing');
  for (const ped of state.peds) {
    if (ped.mode === 'down') continue;
    const dx = ped.x - player.x;
    const dy = ped.y - player.y;
    if (Math.hypot(dx, dy) > PLAYER.punchRange) continue;
    let diff = Math.atan2(dy, dx) - player.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > PLAYER.punchArc) continue;
    ped.hp -= PLAYER.punchDamage;
    ped.x += Math.cos(player.angle) * 9;
    ped.y += Math.sin(player.angle) * 9;
    burst(state, ped.x, ped.y, '#ffffff', 4, 130, 0.25, 2.5);
    state.cues.push('punch');
    if (ped.hp <= 0) {
      knockDown(state, ped, 'punch');
    } else {
      ped.mode = 'flee';
      ped.fleeT = 2.6;
      ped.threat = { x: player.x, y: player.y };
      state.crimeQueue.push({ kind: 'punch', x: ped.x, y: ped.y });
    }
  }
}

export function updatePlayer(state, input, actions, dt) {
  const player = state.player;
  if (player.car === null) {
    updateOnFoot(state, input, dt);
    if ((actions & ACTION_ATTACK) !== 0 && player.punchCooldown <= 0) punch(state);
  }
  if (player.health > 0 && player.health < PLAYER.maxHealth) {
    player.health = Math.min(PLAYER.maxHealth, player.health + 2 * dt);
  }
}
