// Work for Dario. Sol Ferreira runs the garage by the south-west shore and
// always has something that needs doing: five jobs that tell his story, then
// open-ended courier runs, and a standing offer — any car delivered to the
// garage is bought for cash, no questions asked. A mission is a list of
// steps; each step watches the world until it is done, and most steps put a
// marker on the map and a line on the HUD.
import { CAR_KINDS } from './config.js';
import { makeCar } from './vehicles.js';
import { toast } from './hud.js';
import { storeSave } from './save.js';

function banner(state, title, line) {
  state.banner = { title, line, t: 4.8 };
}

function pay(state, amount, why) {
  state.cash += amount;
  state.stats.earned += amount;
  toast(state, `+$${amount} — ${why}`, '#7ddc6a');
  state.cues.push('cash');
  storeSave(state);
}

function fail(state, why) {
  state.mission = null;
  state.marker = null;
  banner(state, 'Job failed', why);
  state.cues.push('fail');
}

const STORY = [
  {
    title: 'Wheels Up',
    intro: 'Sol: "Bring me a car, Dario. Any car. The garage, no questions."',
    reward: 150,
    steps: [
      { type: 'steal', text: 'Steal a car' },
      { type: 'deliverCar', place: 'garage', text: 'Deliver the car to Sol\'s Garage' },
    ],
  },
  {
    title: 'Special Delivery',
    intro: 'Sol: "Café Sol has a package. Take it to the marina store, quick."',
    reward: 220,
    steps: [
      { type: 'goto', place: 'cafe', foot: true, text: 'Pick up the package at Café Sol' },
      { type: 'goto', place: 'marina', time: 150, text: 'Deliver the package to the marina store' },
    ],
  },
  {
    title: 'Too Hot to Park',
    intro: 'Sol: "A sport coupe by the north shore. It will be hot. Lose the heat after."',
    reward: 300,
    steps: [
      { type: 'stealMarked', text: 'Steal the marked sports car' },
      { type: 'deliverCar', place: 'garage', text: 'Get the car to Sol\'s Garage' },
      { type: 'escape', text: 'Lose the police' },
    ],
  },
  {
    title: 'Bay Run',
    intro: 'Sol: "Five corners of my city, against the clock. Show me you know her."',
    reward: 350,
    steps: [
      { type: 'checkpoints', time: 170, text: 'Hit every checkpoint' },
    ],
  },
  {
    title: 'The Marina Job',
    intro: 'Sol: "The marina store safe. Five seconds inside. Then home, and we are rich."',
    reward: 600,
    steps: [
      { type: 'goto', place: 'marina', foot: true, text: 'Go to the marina store' },
      { type: 'hold', place: 'marina', seconds: 5, foot: true, text: 'Empty the safe — stay put' },
      { type: 'goto', place: 'safehouse', text: 'Get back to Casa Vista' },
    ],
  },
];

function placePoint(state, place) {
  const loc = state.city.locations[place];
  return { x: loc.x, y: loc.y };
}

function checkpoints(state) {
  const { roadsX, roadsY } = state.city;
  return [
    { x: roadsX[0], y: roadsY[0] },
    { x: roadsX[5], y: roadsY[0] },
    { x: roadsX[5], y: roadsY[3] },
    { x: roadsX[0], y: roadsY[3] },
    { x: roadsX[3], y: roadsY[1] },
  ];
}

function startMission(state, def) {
  state.mission = { def, stepIndex: 0, timeLeft: null, holdT: 0, car: null, checkIndex: 0 };
  banner(state, def.title, def.intro);
  state.cues.push('start');
  beginStep(state);
}

function beginStep(state) {
  const mission = state.mission;
  const step = mission.def.steps[mission.stepIndex];
  mission.timeLeft = step.time ?? null;
  mission.timeTotal = step.time ?? null;
  mission.holdT = 0;
  if (step.type === 'stealMarked') {
    // The hot coupe waits on the north shore, keys in.
    const x = state.city.roadsX[4] + 90;
    const y = state.city.roadsY[0] - 78;
    const car = makeCar(x, y, Math.PI, 'sport', 'parked', state.rng);
    car.missionCar = true;
    state.cars.push(car);
    mission.car = car;
  }
  if (step.type === 'checkpoints') mission.checkIndex = 0;
}

function stepTarget(state, step) {
  const mission = state.mission;
  switch (step.type) {
    case 'goto':
    case 'hold':
      return placePoint(state, step.place);
    case 'deliverCar': {
      const zone = state.city.locations.garage.zone;
      return { x: zone.x + zone.w / 2, y: zone.y + zone.h / 2 };
    }
    case 'stealMarked':
      return mission.car === null ? null : { x: mission.car.x, y: mission.car.y };
    case 'checkpoints':
      return checkpoints(state)[mission.checkIndex] ?? null;
    default:
      return null;
  }
}

function completeStep(state) {
  const mission = state.mission;
  mission.stepIndex += 1;
  if (mission.stepIndex >= mission.def.steps.length) {
    const reward = mission.def.reward;
    const title = mission.def.title;
    state.mission = null;
    state.marker = null;
    if (mission.def.story) {
      state.storyIndex += 1;
      storeSave(state);
    }
    pay(state, reward, title);
    banner(state, 'Job done', `${title} — $${reward}. Sol sends her regards.`);
    state.cues.push('success');
    return;
  }
  beginStep(state);
}

/** Where the next job is offered, when none is running. */
function offerPoint(state) {
  if (state.storyIndex < STORY.length) return { ...placePoint(state, 'garage'), label: '!' };
  return { ...placePoint(state, 'cafe'), label: '$' };
}

export function updateMissions(state, dt) {
  const player = state.player;
  if (state.mission === null) {
    const offer = offerPoint(state);
    state.marker = { x: offer.x, y: offer.y, color: '#ffb52e', label: offer.label };
    state.objective = state.storyIndex < STORY.length ? 'See Sol at the garage for work' : 'Courier work at Café Sol — or sell Sol a car';
    if (Math.hypot(player.x - offer.x, player.y - offer.y) < 44) {
      if (state.storyIndex < STORY.length) {
        const def = { ...STORY[state.storyIndex], story: true };
        startMission(state, def);
      } else {
        startMission(state, makeCourier(state));
      }
    }
    return;
  }

  const mission = state.mission;
  const step = mission.def.steps[mission.stepIndex];
  state.objective = step.text;

  if (mission.timeLeft !== null) {
    mission.timeLeft -= dt;
    state.missionTime = mission.timeLeft;
    state.missionTimeTotal = mission.timeTotal;
    if (mission.timeLeft <= 0) {
      fail(state, 'Out of time. The offer still stands — try again.');
      return;
    }
  } else {
    state.missionTime = null;
    state.missionTimeTotal = null;
  }

  const target = stepTarget(state, step);
  state.marker = target === null ? null : { x: target.x, y: target.y, color: '#ffb52e', label: step.type === 'checkpoints' ? `${mission.checkIndex + 1}` : '»' };

  const inRadius = target !== null && Math.hypot(player.x - target.x, player.y - target.y) < (step.type === 'deliverCar' ? 86 : 40);
  switch (step.type) {
    case 'steal':
      if (player.car !== null) {
        mission.car = player.car;
        completeStep(state);
      }
      break;
    case 'stealMarked':
      if (player.car === mission.car && mission.car !== null) {
        state.wanted.heat += 45;
        state.wanted.lastCrimeAt = state.time;
        toast(state, 'It is very hot. Move!', '#ff5147');
        completeStep(state);
      }
      break;
    case 'deliverCar':
      if (inRadius && player.car !== null && (mission.car === null || player.car === mission.car)) {
        const delivered = player.car;
        state.cars.splice(state.cars.indexOf(delivered), 1);
        player.car = null;
        player.x = target.x;
        player.y = target.y + 60;
        completeStep(state);
      }
      break;
    case 'goto':
      if (inRadius && (!step.foot || player.car === null)) completeStep(state);
      break;
    case 'hold':
      if (inRadius && player.car === null) {
        mission.holdT += dt;
        state.objective = `${step.text} (${Math.ceil(step.seconds - mission.holdT)})`;
        if (mission.holdT >= step.seconds) {
          state.wanted.heat += 80;
          state.wanted.lastCrimeAt = state.time;
          state.cues.push('alarm');
          completeStep(state);
        }
      } else mission.holdT = Math.max(0, mission.holdT - dt);
      break;
    case 'checkpoints':
      if (inRadius) {
        mission.checkIndex += 1;
        state.cues.push('checkpoint');
        if (mission.checkIndex >= checkpoints(state).length) completeStep(state);
      }
      break;
    case 'escape':
      state.marker = null;
      if (state.wanted.stars === 0) completeStep(state);
      break;
    default:
      break;
  }
}

/** A repeatable courier job between two named places. */
function makeCourier(state) {
  const places = ['cafe', 'marina', 'hospital', 'safehouse', 'police'];
  const from = places[Math.floor(state.rng() * places.length)];
  let to = places[Math.floor(state.rng() * places.length)];
  if (to === from) to = places[(places.indexOf(from) + 2) % places.length];
  const a = placePoint(state, from);
  const b = placePoint(state, to);
  const dist = Math.hypot(a.x - b.x, a.y - b.y);
  const names = { cafe: 'Café Sol', marina: 'the marina store', hospital: 'Bay Hospital', safehouse: 'Casa Vista', police: 'the police station' };
  return {
    title: 'Courier Run',
    intro: `A parcel at ${names[from]} needs to reach ${names[to]}.`,
    reward: Math.round(50 + dist / 14),
    story: false,
    steps: [
      { type: 'goto', place: from, foot: true, text: `Pick up the parcel at ${names[from]}` },
      { type: 'goto', place: to, time: Math.round(dist / 9 + 45), text: `Deliver it to ${names[to]}` },
    ],
  };
}

/**
 * The garage's standing offer, checked before the enter/exit key does its
 * usual work: behind the wheel inside the delivery bay, E sells the car.
 * Returns true when the key press was spent here.
 */
export function garageSale(state) {
  const player = state.player;
  if (player.car === null) return false;
  const step = state.mission?.def.steps[state.mission.stepIndex];
  if (step?.type === 'deliverCar') return false;
  const zone = state.city.locations.garage.zone;
  const car = player.car;
  if (car.kind === 'police' || Math.abs(car.speed) > 40) return false;
  if (player.x < zone.x || player.x > zone.x + zone.w || player.y < zone.y || player.y > zone.y + zone.h) return false;
  const value = Math.round(CAR_KINDS[car.kind].value * (0.35 + 0.65 * (car.health / 100)));
  state.cars.splice(state.cars.indexOf(car), 1);
  player.car = null;
  player.x = zone.x + zone.w / 2;
  player.y = zone.y + zone.h + 30;
  pay(state, value, 'Sol moves another one');
  return true;
}
