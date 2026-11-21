// Coral Bay itself: a road grid around city blocks on an island, generated
// once from the seed. Blocks hold buildings, parks, a parking lot and the
// named places the story needs (a garage, a safehouse, a hospital, a police
// station, the marina store). Everything the other systems need to know about
// the ground — where the roads are, what a circle would bump into — is
// answered here.
import { BUILDING_COLORS, ROAD, SIDEWALK, WORLD } from './config.js';
import { intRange, pick, range } from './random.js';

/** The dry land: sand and city. Outside this rectangle is water. */
export const LAND = {
  minX: WORLD.shore - 60,
  minY: WORLD.shore - 60,
  maxX: WORLD.width - WORLD.shore + 60,
  maxY: WORLD.height - WORLD.shore + 60,
};

const SHOP_NAMES = ['TACO PALMA', 'SURF SHACK', 'HOTEL BRISA', 'PHARMACY', 'BAKERY SOL', 'GYM 24H', 'DINER', 'BOOKS', 'BARBER', 'FLORIST'];

function roadCentres(limit) {
  const centres = [];
  for (let c = ROAD.first; c < limit - 300; c += ROAD.spacing) centres.push(c);
  return centres;
}

/** Which blocks hold which named place, by [column, row] in the block grid. */
const SPECIALS = {
  '0,3': 'garage',
  '5,0': 'safehouse',
  '2,0': 'hospital',
  '3,2': 'police',
  '5,2': 'marina',
  '0,1': 'plaza',
  '1,1': 'park',
  '4,3': 'park',
  '2,2': 'parking',
};

export function createCity(random) {
  const roadsX = roadCentres(WORLD.width);
  const roadsY = roadCentres(WORLD.height);
  const buildings = [];
  const parks = [];
  const blocks = [];
  const props = [];
  const parkingSlots = [];
  const locations = {};

  function addBuilding(x, y, w, h, floors, label) {
    buildings.push({ x, y, w, h, floors, color: pick(random, BUILDING_COLORS), label: label ?? null });
    return buildings[buildings.length - 1];
  }

  function addPalms(x, y, w, h, count) {
    for (let i = 0; i < count; i += 1) {
      props.push({ kind: 'palm', x: x + random() * w, y: y + random() * h });
    }
  }

  for (let col = 0; col < roadsX.length - 1; col += 1) {
    for (let row = 0; row < roadsY.length - 1; row += 1) {
      const bx = roadsX[col] + ROAD.width / 2;
      const by = roadsY[row] + ROAD.width / 2;
      const bw = ROAD.spacing - ROAD.width;
      const bh = bw;
      const kind = SPECIALS[`${col},${row}`] ?? 'buildings';
      blocks.push({ x: bx, y: by, w: bw, h: bh, kind });
      const lot = { x: bx + SIDEWALK, y: by + SIDEWALK, w: bw - SIDEWALK * 2, h: bh - SIDEWALK * 2 };

      if (kind === 'park') {
        parks.push({ x: bx + 8, y: by + 8, w: bw - 16, h: bh - 16 });
        addPalms(lot.x, lot.y, lot.w, lot.h, 9);
        continue;
      }
      if (kind === 'parking') {
        for (let s = 0; s < 6; s += 1) {
          parkingSlots.push({ x: lot.x + 40 + s * 56, y: lot.y + 60, angle: Math.PI / 2 });
          parkingSlots.push({ x: lot.x + 40 + s * 56, y: lot.y + lot.h - 60, angle: -Math.PI / 2 });
        }
        continue;
      }
      if (kind === 'garage' || kind === 'safehouse' || kind === 'hospital' || kind === 'police' || kind === 'marina' || kind === 'plaza') {
        const label = { garage: "SOL'S GARAGE", safehouse: 'CASA VISTA', hospital: 'BAY HOSPITAL', police: 'POLICE', marina: 'MARINA STORE', plaza: 'CAFÉ SOL' }[kind];
        const bw2 = kind === 'hospital' || kind === 'police' ? 240 : 190;
        const building = addBuilding(lot.x + 20, lot.y + 16, bw2, 150, kind === 'safehouse' ? 8 : 3, label);
        const door = { x: building.x + building.w / 2, y: building.y + building.h + 26 };
        if (kind === 'garage') {
          const zone = { x: lot.x + 16, y: lot.y + 210, w: 300, h: 130 };
          locations.garage = { x: zone.x + zone.w / 2, y: zone.y + zone.h / 2, zone, door };
          for (let s = 0; s < 3; s += 1) parkingSlots.push({ x: lot.x + 250 + s * 52, y: lot.y + 60, angle: Math.PI / 2 });
        } else if (kind === 'safehouse') locations.safehouse = { x: door.x, y: door.y + 14, door };
        else if (kind === 'hospital') locations.hospital = { x: door.x, y: door.y + 10, door };
        else if (kind === 'police') locations.police = { x: door.x, y: door.y + 10, door };
        else if (kind === 'marina') locations.marina = { x: door.x, y: door.y + 10, door };
        else if (kind === 'plaza') {
          addPalms(lot.x + 180, lot.y + 150, 150, 180, 5);
          locations.cafe = { x: door.x, y: door.y + 10, door };
        }
        continue;
      }

      // An ordinary block: four lots, most with a building, the odd one left
      // as a small parking court.
      const gap = 18;
      const subW = (lot.w - gap) / 2;
      const subH = (lot.h - gap) / 2;
      for (let sx = 0; sx < 2; sx += 1) {
        for (let sy = 0; sy < 2; sy += 1) {
          const lx = lot.x + sx * (subW + gap);
          const ly = lot.y + sy * (subH + gap);
          if (random() < 0.14) {
            parkingSlots.push({ x: lx + subW / 2, y: ly + subH / 2, angle: pick(random, [0, Math.PI / 2, Math.PI, -Math.PI / 2]) });
            continue;
          }
          const inset = range(random, 4, 16);
          const label = random() < 0.3 ? pick(random, SHOP_NAMES) : null;
          addBuilding(lx + inset, ly + inset, subW - inset * 2, subH - inset * 2, intRange(random, 2, 9), label);
        }
      }
      if (random() < 0.6) addPalms(bx + 6, by + 6, bw - 12, 12, 2);
    }
  }

  // A ring of palms along the beach.
  for (let x = WORLD.shore; x < WORLD.width - WORLD.shore; x += 150) {
    props.push({ kind: 'palm', x: x + range(random, -30, 30), y: WORLD.shore - 40 + range(random, -16, 16) });
    props.push({ kind: 'palm', x: x + range(random, -30, 30), y: WORLD.height - WORLD.shore + 40 + range(random, -16, 16) });
  }
  for (let y = WORLD.shore + 120; y < WORLD.height - WORLD.shore; y += 190) {
    props.push({ kind: 'palm', x: WORLD.shore - 40 + range(random, -16, 16), y });
    props.push({ kind: 'palm', x: WORLD.width - WORLD.shore + 40 + range(random, -16, 16), y });
  }

  return { roadsX, roadsY, buildings, parks, blocks, props, parkingSlots, locations };
}

/** True when (x, y) is on a road, with `pad` widening the bands. */
export function isOnRoad(city, x, y, pad = 0) {
  const half = ROAD.width / 2 + pad;
  for (const cx of city.roadsX) if (Math.abs(x - cx) <= half) return true;
  for (const cy of city.roadsY) if (Math.abs(y - cy) <= half) return true;
  return false;
}

/** The nearest road centre line to a point: { axis, index, centre, distance }. */
export function nearestRoad(city, x, y) {
  let best = { axis: 'x', index: 0, centre: city.roadsX[0], distance: Infinity };
  city.roadsX.forEach((centre, index) => {
    const distance = Math.abs(x - centre);
    if (distance < best.distance) best = { axis: 'x', index, centre, distance };
  });
  city.roadsY.forEach((centre, index) => {
    const distance = Math.abs(y - centre);
    if (distance < best.distance) best = { axis: 'y', index, centre, distance };
  });
  return best;
}

/**
 * Push a circle (body.x, body.y, radius) out of every building and back onto
 * the land. Returns true when it touched anything.
 */
export function collideCircle(city, body, radius) {
  let hit = false;
  if (body.x < LAND.minX + radius) { body.x = LAND.minX + radius; hit = true; }
  if (body.x > LAND.maxX - radius) { body.x = LAND.maxX - radius; hit = true; }
  if (body.y < LAND.minY + radius) { body.y = LAND.minY + radius; hit = true; }
  if (body.y > LAND.maxY - radius) { body.y = LAND.maxY - radius; hit = true; }
  for (const b of city.buildings) {
    if (body.x + radius < b.x || body.x - radius > b.x + b.w || body.y + radius < b.y || body.y - radius > b.y + b.h) continue;
    const nearX = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const nearY = Math.max(b.y, Math.min(body.y, b.y + b.h));
    const dx = body.x - nearX;
    const dy = body.y - nearY;
    const distSq = dx * dx + dy * dy;
    if (distSq > radius * radius) continue;
    hit = true;
    if (distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      body.x = nearX + (dx / dist) * radius;
      body.y = nearY + (dy / dist) * radius;
    } else {
      // Centre inside the building: leave by the shallowest side.
      const left = body.x - b.x;
      const right = b.x + b.w - body.x;
      const top = body.y - b.y;
      const bottom = b.y + b.h - body.y;
      const min = Math.min(left, right, top, bottom);
      if (min === left) body.x = b.x - radius;
      else if (min === right) body.x = b.x + b.w + radius;
      else if (min === top) body.y = b.y - radius;
      else body.y = b.y + b.h + radius;
    }
  }
  return hit;
}

/** A point on a random road, away from the edges of the map. */
export function randomRoadPoint(city, random) {
  if (random() < 0.5) {
    const cx = pick(random, city.roadsX);
    return { x: cx + range(random, -ROAD.lane, ROAD.lane), y: range(random, 300, WORLD.height - 300) };
  }
  const cy = pick(random, city.roadsY);
  return { x: range(random, 300, WORLD.width - 300), y: cy + range(random, -ROAD.lane, ROAD.lane) };
}
