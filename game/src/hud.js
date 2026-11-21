// Everything drawn over the world in view space: the health and cash readout,
// toasts and banners, and the full-screen panels (title, pause, and the two
// ways a run ends). The minimap lives here too.
import { FONT, PALETTE, PLAYER, POLICE, VIEW } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

function bar(ctx, x, y, w, h, fraction, color) {
  ctx.fillStyle = 'rgba(10, 16, 22, 0.65)';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, fraction)), h);
}

function text(ctx, value, x, y, size, color, align = 'left', weight = 'bold') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

function panel(ctx, title, lines, prompt, accent = PALETTE.accent) {
  const w = 640;
  const h = 150 + lines.length * 30 + 60;
  const x = (VIEW.width - w) / 2;
  const y = (VIEW.height - h) / 2;
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = accent;
  ctx.fillRect(x, y, w, 5);
  text(ctx, title, VIEW.width / 2, y + 74, 44, PALETTE.text, 'center');
  lines.forEach((line, i) => text(ctx, line, VIEW.width / 2, y + 122 + i * 30, 20, '#cfd8de', 'center', 'normal'));
  text(ctx, prompt, VIEW.width / 2, y + h - 26, 21, accent, 'center');
}

export function createHud() {
  function drawStatus(ctx, state) {
    const health = state.player.health / PLAYER.maxHealth;
    bar(ctx, 22, 20, 210, 15, health, health > 0.3 ? PALETTE.cash : PALETTE.danger);
    text(ctx, `$${state.cash}`, 22, 68, 30, PALETTE.cash);
    if (state.player.car) {
      const carHealth = state.player.car.health / 100;
      bar(ctx, 22, 82, 150, 9, carHealth, '#9fb7c9');
      text(ctx, 'CAR', 178, 91, 13, '#9fb7c9');
    }
  }

  function drawToasts(ctx, state) {
    state.toasts.forEach((toast, i) => {
      ctx.globalAlpha = Math.min(1, toast.t / 0.6);
      text(ctx, toast.text, VIEW.width / 2, 108 + i * 30, 22, toast.color, 'center');
      ctx.globalAlpha = 1;
    });
  }

  function star(ctx, cx, cy, r, filled, alpha) {
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const radius = i % 2 === 0 ? r : r * 0.45;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const x = cx + Math.cos(a) * radius;
      const y = cy + Math.sin(a) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.globalAlpha = alpha;
    if (filled) {
      ctx.fillStyle = PALETTE.accent;
      ctx.fill();
    } else {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawStars(ctx, state) {
    const stars = state.wanted.stars;
    if (stars === 0) return;
    // While the law is losing him, the stars blink out one by one.
    const blink = state.wanted.hidden && Math.floor(state.time * 2.4) % 2 === 0;
    for (let i = 0; i < 5; i += 1) {
      const filled = i < stars;
      star(ctx, VIEW.width - 34 - (4 - i) * 34, 36, 14, filled, filled && blink ? 0.35 : 0.95);
    }
  }

  function drawBust(ctx, state) {
    const bustT = state.wanted.bustT;
    if (bustT <= 0.03 || state.player.car !== null) return;
    const fraction = Math.min(1, bustT / POLICE.bustSeconds);
    text(ctx, 'BUSTED', VIEW.width / 2, 148, 24, PALETTE.danger, 'center');
    bar(ctx, VIEW.width / 2 - 130, 158, 260, 12, fraction, PALETTE.danger);
  }

  /** Paint the overlay for the current screen. World first, then this. */
  function draw(ctx, view, state, screen) {
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      ctx.fillStyle = 'rgba(10, 20, 28, 0.45)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      panel(ctx, 'CORAL BAY HEAT', [
        'An open-world crime spree in a sun-soaked island city.',
        'Walk it, drive it, steal it — just do not get caught.',
        '',
        'Move WASD · Sprint Shift · Enter car / use E · Punch F',
        'Drive WASD · Handbrake Space · Pause P · Mute M',
      ], 'Press Enter or click to play');
      return;
    }
    drawStatus(ctx, state);
    drawStars(ctx, state);
    drawBust(ctx, state);
    drawToasts(ctx, state);
    if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = 'rgba(10, 20, 28, 0.4)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      panel(ctx, 'Paused', ['The bay will wait for you.'], 'Press P to keep playing');
    } else if (screen === SCREEN_OVER) {
      ctx.fillStyle = 'rgba(10, 20, 28, 0.5)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      const busted = state.over === 'busted';
      panel(ctx, busted ? 'BUSTED' : 'WASTED', [
        busted ? 'The Coral Bay PD walk you out the side door.' : 'You wake up in Bay Hospital, lighter of pocket.',
        busted ? `Fine $${state.lastFine}` : `Hospital bill $${state.lastFine}`,
        '',
        `Cash $${state.cash} · Cars stolen ${state.stats.stolen} · Earned $${state.stats.earned}`,
      ], 'Press Enter to carry on', PALETTE.danger);
    }
  }

  return { draw };
}

/** Push a short-lived message onto the toast stack. */
export function toast(state, message, color = PALETTE.text) {
  state.toasts.push({ text: message, color, t: 2.6 });
  if (state.toasts.length > 4) state.toasts.shift();
}

/** Age the toasts; called once a step by the world. */
export function updateToasts(state, dt) {
  for (const item of state.toasts) item.t -= dt;
  state.toasts = state.toasts.filter((item) => item.t > 0);
}
