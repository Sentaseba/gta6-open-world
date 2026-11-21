// The player: Dario, on foot or behind the wheel. This module owns his body —
// position, facing, health, the walk and the punch. Driving lives in
// vehicles.js; this file decides which of the two he is doing.
import { PLAYER } from './config.js';
import { collideCircle } from './city.js';

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

export function updatePlayer(state, input, dt) {
  if (state.player.car === null) updateOnFoot(state, input, dt);
}
