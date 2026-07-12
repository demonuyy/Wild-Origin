import { rand } from './config.js';

const SoundFX = (function () {
  let actx = null;
  let master = null;
  let ambientBus = null;
  let dayGain = null;
  let nightGain = null;
  let volume = 0.7;
  let muted = false;
  let ambientStarted = false;
  let ambientActive = true;
  let currentDarkness = 0;

  function ensureCtx() {
    if (actx) return;
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain();
    master.gain.value = muted ? 0 : volume;
    master.connect(actx.destination);
    ambientBus = actx.createGain();
    ambientBus.gain.value = ambientActive ? 1 : 0;
    ambientBus.connect(master);
  }

  function noiseBuffer(dur) {
    const sr = actx.sampleRate;
    const buf = actx.createBuffer(1, Math.max(1, Math.floor(sr * dur)), sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function tone(freq, dur, type, vol, glideTo) {
    if (!actx) return;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, actx.currentTime);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), actx.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.3, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
    o.connect(g);
    g.connect(master);
    o.start();
    o.stop(actx.currentTime + dur + 0.03);
  }

  function noiseBurst(dur, filterType, filterFreq, vol) {
    if (!actx) return;
    const src = actx.createBufferSource();
    src.buffer = noiseBuffer(dur);
    const filt = actx.createBiquadFilter();
    filt.type = filterType || 'bandpass';
    filt.frequency.value = filterFreq || 1000;
    const g = actx.createGain();
    g.gain.setValueAtTime(vol || 0.3, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(master);
    src.start();
    src.stop(actx.currentTime + dur + 0.03);
  }

  function startAmbient() {
    if (ambientStarted) return;
    ambientStarted = true;
    dayGain = actx.createGain();
    dayGain.gain.value = 0.16;
    dayGain.connect(ambientBus);
    const daySrc = actx.createBufferSource();
    daySrc.buffer = noiseBuffer(2);
    daySrc.loop = true;
    const dayFilt = actx.createBiquadFilter();
    dayFilt.type = 'bandpass';
    dayFilt.frequency.value = 900;
    dayFilt.Q.value = 0.6;
    daySrc.connect(dayFilt);
    dayFilt.connect(dayGain);
    daySrc.start();

    nightGain = actx.createGain();
    nightGain.gain.value = 0;
    nightGain.connect(ambientBus);
    const nightSrc = actx.createBufferSource();
    nightSrc.buffer = noiseBuffer(2);
    nightSrc.loop = true;
    const nightFilt = actx.createBiquadFilter();
    nightFilt.type = 'lowpass';
    nightFilt.frequency.value = 280;
    nightSrc.connect(nightFilt);
    nightFilt.connect(nightGain);
    nightSrc.start();

    setInterval(() => {
      if (!actx || !ambientActive) return;
      if (currentDarkness < 0.3 && Math.random() < 0.5) tone(rand(1500, 2300), 0.12, 'sine', 0.05 * (1 - currentDarkness));
      if (currentDarkness > 0.5 && Math.random() < 0.3) tone(rand(170, 260), 0.5, 'sine', 0.06 * currentDarkness, rand(140, 190));
    }, 1500);
  }

  return {
    init() {
      ensureCtx();
      if (actx.state === 'suspended') actx.resume();
      startAmbient();
    },
    setVolume(v) { volume = v; if (master) master.gain.value = muted ? 0 : v; },
    setMuted(m) { muted = m; if (master) master.gain.value = muted ? 0 : volume; },
    setAmbientActive(active) {
      ambientActive = active;
      if (ambientBus) ambientBus.gain.setTargetAtTime(active ? 1 : 0, actx.currentTime, 0.25);
    },
    setDarkness(d) {
      currentDarkness = d;
      if (dayGain) dayGain.gain.setTargetAtTime(0.16 * (1 - d), actx.currentTime, 0.8);
      if (nightGain) nightGain.gain.setTargetAtTime(0.14 * d, actx.currentTime, 0.8);
    },
    chop() { noiseBurst(0.12, 'bandpass', 700, 0.35); tone(110, 0.1, 'sine', 0.2); },
    mine() { noiseBurst(0.08, 'highpass', 2500, 0.3); tone(600, 0.05, 'square', 0.1); },
    berry() { tone(rand(500, 700), 0.12, 'triangle', 0.2, rand(750, 900)); },
    drink() { noiseBurst(0.25, 'bandpass', 1800, 0.15); },
    eat() { noiseBurst(0.15, 'highpass', 1200, 0.25); },
    craftOk() { tone(440, 0.1, 'triangle', 0.25, 660); setTimeout(() => tone(660, 0.15, 'triangle', 0.22, 880), 90); },
    craftFail() { tone(180, 0.2, 'sawtooth', 0.2, 120); },
    wolfGrowl() { tone(90, 0.35, 'sawtooth', 0.18, 70); },
    wolfHit() { noiseBurst(0.12, 'bandpass', 1200, 0.3); },
    wolfDeath() { tone(300, 0.4, 'sawtooth', 0.25, 60); },
    playerHurt() { noiseBurst(0.2, 'lowpass', 500, 0.3); tone(150, 0.25, 'sine', 0.25, 80); },
    dayChime() { tone(660, 0.5, 'sine', 0.15, 880); },
    sleep() { tone(520, 0.3, 'sine', 0.15, 320); setTimeout(() => tone(320, 0.4, 'sine', 0.12, 220), 200); },
    gameOverSting() { tone(220, 1.2, 'sawtooth', 0.2, 55); },
    click() { tone(500, 0.08, 'triangle', 0.15); }
  };
})();

export { SoundFX };
