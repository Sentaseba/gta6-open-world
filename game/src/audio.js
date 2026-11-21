// Every sound is made at run time with oscillators and filtered noise —
// there are no audio files. The engine and the siren are continuous voices
// whose pitch and volume follow the game; everything else is a short cue the
// world queues by name. A tiny bass-and-hat loop plays underneath, because
// Coral Bay has a radio station and it only plays one song.
export function createAudio() {
  let ac = null;
  let master = null;
  let noiseBuffer = null;
  let engine = null;
  let siren = null;
  let muted = false;
  let musicStep = 0;
  let nextNote = 0;

  function unlock() {
    if (ac !== null) {
      if (ac.state === 'suspended') ac.resume();
      return;
    }
    const AC = window.AudioContext ?? window.webkitAudioContext;
    if (AC === undefined) return;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(ac.destination);
    noiseBuffer = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;

    engine = { osc: ac.createOscillator(), gain: ac.createGain() };
    engine.osc.type = 'sawtooth';
    engine.gain.gain.value = 0;
    const engineFilter = ac.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engine.osc.connect(engineFilter).connect(engine.gain).connect(master);
    engine.osc.start();

    siren = { osc: ac.createOscillator(), gain: ac.createGain() };
    siren.osc.type = 'square';
    siren.gain.gain.value = 0;
    const sirenFilter = ac.createBiquadFilter();
    sirenFilter.type = 'bandpass';
    sirenFilter.frequency.value = 800;
    sirenFilter.Q.value = 2;
    siren.osc.connect(sirenFilter).connect(siren.gain).connect(master);
    siren.osc.start();
  }

  function tone(freq, dur, type = 'sine', vol = 0.2, slideTo = null, delay = 0) {
    if (ac === null) return;
    const t0 = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, freq, vol, type = 'lowpass', delay = 0) {
    if (ac === null) return;
    const t0 = ac.currentTime + delay;
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const filter = ac.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter).connect(gain).connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  const CUES = {
    door: () => { tone(120, 0.08, 'square', 0.14); tone(80, 0.1, 'square', 0.1, null, 0.05); },
    honk: () => tone(392, 0.17, 'square', 0.05),
    crash: () => { noise(0.28, 480, 0.5); tone(58, 0.22, 'sine', 0.4, 30); },
    thud: () => tone(85, 0.15, 'sine', 0.5, 38),
    swing: () => noise(0.06, 2600, 0.07, 'highpass'),
    punch: () => { noise(0.07, 900, 0.28, 'bandpass'); tone(150, 0.07, 'sine', 0.2, 70); },
    cash: () => { tone(988, 0.09, 'sine', 0.15); tone(1319, 0.16, 'sine', 0.15, null, 0.07); },
    wanted: () => { tone(196, 0.14, 'square', 0.11); tone(147, 0.22, 'square', 0.11, null, 0.13); },
    alarm: () => { for (let i = 0; i < 3; i += 1) tone(1240, 0.09, 'square', 0.08, null, i * 0.13); },
    checkpoint: () => { tone(784, 0.1, 'sine', 0.14); tone(1046, 0.15, 'sine', 0.14, null, 0.08); },
    start: () => tone(82, 0.32, 'sawtooth', 0.07, 220),
    success: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'triangle', 0.14, null, i * 0.09)); },
    fail: () => { [330, 262, 196].forEach((f, i) => tone(f, 0.18, 'triangle', 0.13, null, i * 0.13)); },
    wasted: () => tone(220, 0.8, 'triangle', 0.18, 52),
  };

  // An eight-step bass line in A minor, and the chords it leans on.
  const BASS = [55, 0, 55, 55, 65.41, 0, 55, 0, 49, 0, 49, 49, 61.74, 0, 73.42, 0];
  const STEP_SECONDS = 0.21;

  function music() {
    while (nextNote < ac.currentTime + 0.3) {
      const step = musicStep % 16;
      const delay = Math.max(0, nextNote - ac.currentTime);
      const bass = BASS[step];
      if (bass > 0) tone(bass, 0.19, 'triangle', 0.16, null, delay);
      if (step % 2 === 1) noise(0.03, 7000, 0.025, 'highpass', delay);
      if (step === 0) {
        const root = musicStep % 32 < 16 ? 220 : 196;
        tone(root, 1.6, 'sine', 0.035, null, delay);
        tone(root * 1.5, 1.6, 'sine', 0.028, null, delay);
      }
      musicStep += 1;
      nextNote += STEP_SECONDS;
    }
  }

  /** Play the world's queued cues and steer the continuous voices. */
  function update(state, onMenu) {
    if (ac === null) return;
    for (const cue of state.cues) {
      if (CUES[cue] !== undefined) CUES[cue]();
    }
    state.cues.length = 0;

    const car = state.player.car;
    const driving = car !== null && state.over === null && !onMenu;
    engine.gain.gain.setTargetAtTime(driving ? 0.045 : 0, ac.currentTime, 0.09);
    if (driving) engine.osc.frequency.setTargetAtTime(42 + Math.abs(car.speed) * 0.34, ac.currentTime, 0.06);
    siren.gain.gain.setTargetAtTime(state.siren && !onMenu ? 0.03 : 0, ac.currentTime, 0.12);
    if (state.siren) siren.osc.frequency.value = Math.floor(ac.currentTime * 1.7) % 2 === 0 ? 715 : 545;

    if (nextNote === 0) nextNote = ac.currentTime + 0.1;
    if (!muted) music();
  }

  function toggleMute() {
    muted = !muted;
    if (master !== null) master.gain.value = muted ? 0 : 0.55;
    return muted;
  }

  return { unlock, update, toggleMute };
}
