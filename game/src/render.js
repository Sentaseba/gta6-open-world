// Drawing the world: island, roads, buildings, palms and the people and cars
// in it. The camera follows the player (or a focus the screenshot scenes set)
// and everything is culled to the view. HUD and menus live in hud.js; this
// file never draws text over the world except building signs.
import { FONT, PALETTE, PLAYER, ROAD, VIEW, WORLD } from './config.js';
import { LAND } from './city.js';

/** Darken (f < 1) or lighten (f > 1) a #rrggbb colour. */
export function shade(hex, f) {
  const n = Number.parseInt(hex.slice(1), 16);
  const channel = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  const r = channel((n >> 16) & 255);
  const g = channel((n >> 8) & 255);
  const b = channel(n & 255);
  return `rgb(${r}, ${g}, ${b})`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const camera = { x: WORLD.width / 2, y: WORLD.height / 2 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function visible(state) {
    const focus = state.cameraFocus ?? state.player;
    camera.x = Math.max(VIEW.width / 2 - 140, Math.min(WORLD.width - VIEW.width / 2 + 140, focus.x));
    camera.y = Math.max(VIEW.height / 2 - 110, Math.min(WORLD.height - VIEW.height / 2 + 110, focus.y));
    return {
      left: camera.x - VIEW.width / 2 - 90,
      top: camera.y - VIEW.height / 2 - 90,
      right: camera.x + VIEW.width / 2 + 90,
      bottom: camera.y + VIEW.height / 2 + 90,
    };
  }

  function drawGround(state, box) {
    ctx.fillStyle = PALETTE.waterDeep;
    ctx.fillRect(box.left, box.top, box.right - box.left, box.bottom - box.top);
    ctx.fillStyle = PALETTE.water;
    const band = 46;
    for (let y = Math.floor(box.top / band) * band; y < box.bottom; y += band) {
      if ((y / band) % 2 === 0) ctx.fillRect(box.left, y, box.right - box.left, band / 2);
    }
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(LAND.minX, LAND.minY, LAND.maxX - LAND.minX, LAND.maxY - LAND.minY);
    const gx = state.city.roadsX[0] - ROAD.width / 2 - 84;
    const gy = state.city.roadsY[0] - ROAD.width / 2 - 84;
    const gw = state.city.roadsX[state.city.roadsX.length - 1] - state.city.roadsX[0] + ROAD.width + 168;
    const gh = state.city.roadsY[state.city.roadsY.length - 1] - state.city.roadsY[0] + ROAD.width + 168;
    ctx.fillStyle = PALETTE.cityGround;
    ctx.fillRect(gx, gy, gw, gh);
    for (const park of state.city.parks) {
      ctx.fillStyle = PALETTE.grass;
      ctx.fillRect(park.x, park.y, park.w, park.h);
      ctx.fillStyle = PALETTE.parkPath;
      ctx.fillRect(park.x, park.y + park.h / 2 - 9, park.w, 18);
      ctx.fillRect(park.x + park.w / 2 - 9, park.y, 18, park.h);
    }
  }

  function drawRoads(state, box) {
    const city = state.city;
    const half = ROAD.width / 2;
    ctx.fillStyle = PALETTE.road;
    for (const cx of city.roadsX) ctx.fillRect(cx - half, box.top, ROAD.width, box.bottom - box.top);
    for (const cy of city.roadsY) ctx.fillRect(box.left, cy - half, box.right - box.left, ROAD.width);
    ctx.strokeStyle = PALETTE.roadEdge;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const cx of city.roadsX) {
      ctx.moveTo(cx - half + 3, box.top);
      ctx.lineTo(cx - half + 3, box.bottom);
      ctx.moveTo(cx + half - 3, box.top);
      ctx.lineTo(cx + half - 3, box.bottom);
    }
    for (const cy of city.roadsY) {
      ctx.moveTo(box.left, cy - half + 3);
      ctx.lineTo(box.right, cy - half + 3);
      ctx.moveTo(box.left, cy + half - 3);
      ctx.lineTo(box.right, cy + half - 3);
    }
    ctx.stroke();
    // Centre dashes, skipped inside intersections.
    ctx.fillStyle = PALETTE.laneDash;
    for (const cx of city.roadsX) {
      for (let y = Math.floor(box.top / 52) * 52; y < box.bottom; y += 52) {
        if (city.roadsY.some((cy) => Math.abs(y - cy) < half + 16)) continue;
        ctx.fillRect(cx - 2, y, 4, 28);
      }
    }
    for (const cy of city.roadsY) {
      for (let x = Math.floor(box.left / 52) * 52; x < box.right; x += 52) {
        if (city.roadsX.some((cx) => Math.abs(x - cx) < half + 16)) continue;
        ctx.fillRect(x, cy - 2, 28, 4);
      }
    }
    // Crosswalks on each approach to an intersection.
    ctx.fillStyle = PALETTE.crosswalk;
    for (const cx of city.roadsX) {
      for (const cy of city.roadsY) {
        if (cx < box.left - 160 || cx > box.right + 160 || cy < box.top - 160 || cy > box.bottom + 160) continue;
        for (let s = -42; s <= 42; s += 14) {
          ctx.fillRect(cx + s - 4, cy - half - 24, 8, 18);
          ctx.fillRect(cx + s - 4, cy + half + 6, 8, 18);
          ctx.fillRect(cx - half - 24, cy + s - 4, 18, 8);
          ctx.fillRect(cx + half + 6, cy + s - 4, 18, 8);
        }
      }
    }
  }

  function drawBlocks(state, box) {
    for (const block of state.city.blocks) {
      if (block.x + block.w < box.left || block.x > box.right || block.y + block.h < box.top || block.y > box.bottom) continue;
      if (block.kind === 'park') continue;
      ctx.fillStyle = block.kind === 'parking' ? '#8f8c84' : PALETTE.sidewalk;
      ctx.fillRect(block.x - 5, block.y - 5, block.w + 10, block.h + 10);
    }
  }

  function drawBuilding(b) {
    const lift = b.floors * 7;
    ctx.fillStyle = PALETTE.shadow;
    ctx.fillRect(b.x + 10, b.y + 14, b.w, b.h);
    ctx.fillStyle = shade(b.color, 0.82);
    ctx.fillRect(b.x, b.y - lift, b.w, b.h + lift);
    // Windows on the front wall.
    ctx.fillStyle = 'rgba(255, 244, 190, 0.75)';
    const rows = Math.min(b.floors, 6);
    for (let r = 0; r < rows; r += 1) {
      const wy = b.y + b.h - lift + 8 + r * (lift / Math.max(rows, 1));
      if (wy > b.y + b.h - 8) break;
      for (let wx = b.x + 10; wx < b.x + b.w - 12; wx += 22) ctx.fillRect(wx, wy, 10, 6);
    }
    ctx.fillStyle = shade(b.color, 1.12);
    ctx.fillRect(b.x, b.y - lift, b.w, b.h);
    ctx.strokeStyle = 'rgba(90, 70, 40, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 7, b.y - lift + 7, b.w - 14, b.h - 14);
    if (b.label) {
      ctx.fillStyle = 'rgba(40, 34, 24, 0.72)';
      ctx.font = `bold 15px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.label, b.x + b.w / 2, b.y - lift + b.h / 2);
    }
  }

  function drawBuildings(state, box) {
    for (const b of state.city.buildings) {
      if (b.x + b.w < box.left || b.x > box.right || b.y + b.h < box.top || b.y - 70 > box.bottom) continue;
      drawBuilding(b);
    }
  }

  function drawPalms(state, box) {
    for (const prop of state.city.props) {
      if (prop.x < box.left || prop.x > box.right || prop.y < box.top || prop.y > box.bottom) continue;
      ctx.strokeStyle = PALETTE.palmTrunk;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(prop.x, prop.y);
      ctx.lineTo(prop.x + 3, prop.y - 13);
      ctx.stroke();
      ctx.fillStyle = PALETTE.palmLeaf;
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + prop.x;
        ctx.beginPath();
        ctx.ellipse(prop.x + 3 + Math.cos(a) * 11, prop.y - 15 + Math.sin(a) * 5, 12, 4.5, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawPlayer(state) {
    const player = state.player;
    if (player.car !== null) return;
    const bob = player.speed > 0 ? Math.sin(player.stepPhase) * 1.6 : 0;
    ctx.fillStyle = PALETTE.shadow;
    ctx.beginPath();
    ctx.ellipse(player.x, player.y + 10, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff7847';
    ctx.beginPath();
    ctx.arc(player.x, player.y + bob, PLAYER.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c094';
    ctx.beginPath();
    ctx.arc(player.x, player.y + bob - 2, 7.5, 0, Math.PI * 2);
    ctx.fill();
    // A cap brim showing the way he faces.
    ctx.strokeStyle = '#173f5f';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y + bob - 2);
    ctx.lineTo(player.x + Math.cos(player.angle) * 13, player.y + bob - 2 + Math.sin(player.angle) * 13);
    ctx.stroke();
  }

  /** Paint the world for this frame. The HUD is drawn separately, in view space. */
  function drawWorld(state) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#12333d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const box = visible(state);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x + (VIEW.width / 2 - camera.x) * view.scale, view.y + (VIEW.height / 2 - camera.y) * view.scale);
    drawGround(state, box);
    drawBlocks(state, box);
    drawRoads(state, box);
    drawBuildings(state, box);
    drawPalms(state, box);
    drawPlayer(state);
  }

  resize();
  window.addEventListener('resize', resize);
  return { canvas, ctx, view, camera, drawWorld };
}
