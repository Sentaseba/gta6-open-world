// Short-lived dressing: particles (sparks, dust, smoke, splashes of cash),
// skid marks and the camera shake. Everything ages out on its own and the
// pools are capped, so a long session cannot grow them without bound.
import { range } from './random.js';

const MAX_PARTICLES = 420;
const MAX_SKIDS = 700;

export function burst(state, x, y, color, count, speed, life, size) {
  for (let i = 0; i < count; i += 1) {
    if (state.particles.length >= MAX_PARTICLES) return;
    const angle = state.rng() * Math.PI * 2;
    const v = range(state.rng, speed * 0.3, speed);
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      t: range(state.rng, life * 0.5, life),
      life,
      size: range(state.rng, size * 0.6, size * 1.3),
      color,
      drag: 2.2,
      rise: 0,
    });
  }
}

/** Smoke: slow, growing, drifting up-screen. */
export function smoke(state, x, y, dark = false) {
  if (state.particles.length >= MAX_PARTICLES) return;
  state.particles.push({
    x: x + range(state.rng, -6, 6),
    y: y + range(state.rng, -6, 6),
    vx: range(state.rng, -12, 12),
    vy: range(state.rng, -30, -14),
    t: range(state.rng, 0.7, 1.4),
    life: 1.4,
    size: range(state.rng, 7, 13),
    color: dark ? 'rgba(40, 40, 44, 0.5)' : 'rgba(230, 230, 225, 0.45)',
    drag: 0.4,
    rise: 26,
  });
}

export function addSkid(state, x, y) {
  state.skids.push({ x, y, t: 9 });
  if (state.skids.length > MAX_SKIDS) state.skids.splice(0, state.skids.length - MAX_SKIDS);
}

export function shake(state, amount) {
  state.shake = Math.min(14, state.shake + amount);
}

export function updateEffects(state, dt) {
  for (const p of state.particles) {
    p.t -= dt;
    const drag = Math.max(0, 1 - p.drag * dt);
    p.vx *= drag;
    p.vy = p.vy * drag - p.rise * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  state.particles = state.particles.filter((p) => p.t > 0);
  for (const s of state.skids) s.t -= dt;
  state.skids = state.skids.filter((s) => s.t > 0);
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 26);
}
