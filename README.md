# gta6-open-world

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Sentaseba/gta6-open-world/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Sentaseba/gta6-open-world/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Coral Bay Heat** — a 2D open-world crime game in a sun-soaked island city.
You are Dario, fresh off the boat with $60 and a borrowed pair of shoes. Walk
the streets, drive anything with wheels, run jobs for Sol at the garage on
the east side — and when the stars start stacking up in the corner of the
screen, run.

Everything is drawn with canvas code at run time: no images, no fonts, no
audio files. The whole game is plain JavaScript modules under `game/src/`.

## Controls

| On foot | |
| --- | --- |
| Move | WASD or arrow keys |
| Sprint | Shift |
| Enter / exit a car, take a job, sell a car | E |
| Punch | F |

| Driving | |
| --- | --- |
| Steer and drive | WASD or arrow keys |
| Handbrake | Space |

| Anywhere | |
| --- | --- |
| Pause | P |
| Mute | M |

## How it plays

- **The city.** Seven avenues by five streets of shops, hotels and cafés,
  wrapped in beach and sea, with live traffic that follows lanes and
  junctions, and pedestrians who stroll, cross the road, and run when
  things get loud.
- **Work.** Sol's Garage (green blip on the minimap) always has something:
  a short story of five jobs — boosting cars, a timed delivery, one coupe
  that is far too hot to park — then courier runs for as long as you want
  them. Any car you drive into the garage's marked bay can be sold on the
  spot, priced by its condition.
- **The law.** Crimes the city sees — a witnessed theft, a crash, a
  knocked-down pedestrian — raise your heat. Heat becomes stars, stars
  become patrol cars, and patrol cars become a bust if they pin you on
  foot. Break their line of sight and stay quiet to cool off. Get busted
  and you wake up at the police station, lighter in the wallet; get wasted
  and it is the hospital.
- **Progress.** Cash, cars sold, jobs done and your best star count are
  kept between visits in the browser's local storage.

## Layout

```
game/index.html   the page: one canvas, the module bootstrap
game/src/         the game, one module per concern
  config.js       sizes, tuning and the palette
  city.js         the seeded island: roads, buildings, collision
  vehicles.js     traffic, parked cars and driving
  pedestrians.js  the people of Coral Bay
  police.js       crimes, heat, stars and the chase
  missions.js     Sol's jobs, courier runs and garage sales
  render.js       everything drawn in the world
  hud.js          bars, stars, objective, minimap, panels
  audio.js        procedural WebAudio: engine, siren, one radio song
  shots.js        the staged screenshot scenes
main.ts           builds the entry's output directory and dossier
serve.ts          a tiny static server for local play
vendor/           the harness library (makefun-game.ts), unmodified
```

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a browser. Click the game once so it has
keyboard focus, and press Enter.

Add `?seed=N` to the URL to play the same city layout every time, and
`?shot=chase&seed=N` (also `drive`, `foot`, `title`) to see the staged
screenshot scenes that the pictures in `screenshots/` were taken from.

---

<sub>Entered on [make.fun](https://make.fun/?ref=dsxkxxrr&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
