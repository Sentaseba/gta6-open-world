// Everything drawn over the world in view space: the health and cash readout,
// wanted stars, the mission objective and banner, toasts, the minimap, and
// the full-screen panels (title, pause, and the two ways a run ends).
import { FONT, PALETTE, PLAYER, POLICE, VIEW, WORLD } from './config.js';
import { LAND } from './city.js';

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

  function drawObjective(ctx, state) {
    if (state.objective === '') return;
    let label = state.objective;
    if (state.missionTime !== null) {
      const left = Math.max(0, Math.ceil(state.missionTime));
      label += ` · ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    }
    ctx.font = `bold 19px ${FONT}`;
    const w = ctx.measureText(label).width + 36;
    const x = (VIEW.width - w) / 2;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(x, 14, w, 34);
    text(ctx, label, VIEW.width / 2, 38, 19, PALETTE.text, 'center');
    if (state.missionTime !== null && state.missionTimeTotal !== null) {
      const fraction = Math.max(0, state.missionTime / state.missionTimeTotal);
      ctx.fillStyle = fraction < 0.25 ? PALETTE.danger : PALETTE.accent;
      ctx.fillRect(x, 48, w * fraction, 4);
    }
  }

  function drawBanner(ctx, state) {
    const banner = state.banner;
    if (banner === null) return;
    ctx.globalAlpha = Math.min(1, banner.t / 0.7);
    const w = 780;
    const x = (VIEW.width - w) / 2;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(x, 64, w, 92);
    ctx.fillStyle = PALETTE.accent;
    ctx.fillRect(x, 64, w, 4);
    text(ctx, banner.title, VIEW.width / 2, 102, 27, PALETTE.accent, 'center');
    text(ctx, banner.line, VIEW.width / 2, 136, 18, '#e8eef2', 'center', 'normal');
    ctx.globalAlpha = 1;
  }

  function drawMinimap(ctx, state) {
    const w = 208;
    const h = 156;
    const x = VIEW.width - w - 16;
    const y = VIEW.height - h - 16;
    const sx = w / WORLD.width;
    const sy = h / WORLD.height;
    const px = (wx) => x + wx * sx;
    const py = (wy) => y + wy * sy;
    ctx.fillStyle = 'rgba(10, 18, 24, 0.78)';
    ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
    ctx.fillStyle = PALETTE.waterDeep;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#ddd5bd';
    ctx.fillRect(px(LAND.minX), py(LAND.minY), (LAND.maxX - LAND.minX) * sx, (LAND.maxY - LAND.minY) * sy);
    ctx.strokeStyle = PALETTE.road;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (const cx of state.city.roadsX) { ctx.moveTo(px(cx), py(LAND.minY)); ctx.lineTo(px(cx), py(LAND.maxY)); }
    for (const cy of state.city.roadsY) { ctx.moveTo(px(LAND.minX), py(cy)); ctx.lineTo(px(LAND.maxX), py(cy)); }
    ctx.stroke();
    const dot = (wx, wy, color, r) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px(wx), py(wy), r, 0, Math.PI * 2);
      ctx.fill();
    };
    dot(state.city.locations.garage.x, state.city.locations.garage.y, '#39d353', 3.4);
    dot(state.city.locations.safehouse.x, state.city.locations.safehouse.y, '#ffffff', 3);
    dot(state.city.locations.hospital.x, state.city.locations.hospital.y, '#ff8fa3', 3);
    for (const car of state.cars) {
      if (car.mode === 'police') dot(car.x, car.y, Math.floor(state.time * 3) % 2 ? '#5b8cff' : '#ff5147', 3);
    }
    if (state.marker !== null) {
      dot(state.marker.x, state.marker.y, '#ffb52e', 3.6 + Math.sin(state.time * 5) * 1.1);
    }
    const player = state.player;
    dot(player.x, player.y, '#ffffff', 4);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px(player.x), py(player.y));
    ctx.lineTo(px(player.x) + Math.cos(player.angle) * 9, py(player.y) + Math.sin(player.angle) * 9);
    ctx.stroke();
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
    drawObjective(ctx, state);
    drawBanner(ctx, state);
    drawBust(ctx, state);
    drawMinimap(ctx, state);
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

/** Age the toasts and the banner; called once a step by the world. */
export function updateToasts(state, dt) {
  for (const item of state.toasts) item.t -= dt;
  state.toasts = state.toasts.filter((item) => item.t > 0);
  if (state.banner !== null) {
    state.banner.t -= dt;
    if (state.banner.t <= 0) state.banner = null;
  }
}
