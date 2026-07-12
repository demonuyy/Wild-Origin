import { rand } from './config.js';

// Rutas de los assets de audio reales (assets/audio/...). Cada categoría es
// una lista para poder elegir una al azar y que no suene siempre igual.
const ASSET_BASE = 'assets/audio/';
const SAMPLE_FILES = {
  axe: ['tools/axe_hit_1.wav', 'tools/axe_hit_2.wav', 'tools/axe_hit_3.wav', 'tools/axe_hit_4.wav', 'tools/axe_hit_5.wav'],
  pickaxe: ['tools/pickaxe_hit_1.wav', 'tools/pickaxe_hit_2.wav', 'tools/pickaxe_hit_3.wav', 'tools/pickaxe_hit_4.wav', 'tools/pickaxe_hit_5.wav'],
  crunch: ['player/crunch.1.wav', 'player/crunch.2.wav', 'player/crunch.3.wav', 'player/crunch.4.wav', 'player/crunch.5.wav', 'player/crunch.6.wav', 'player/crunch.7.wav'],
  drink: ['player/drink_1.wav', 'player/drink_2.wav', 'player/drink_3.wav'],
  footstepGrass: ['player/footstep_grass_000.ogg', 'player/footstep_grass_001.ogg', 'player/footstep_grass_002.ogg', 'player/footstep_grass_003.ogg', 'player/footstep_grass_004.ogg'],
  swish: ['player/swish-1.wav', 'player/swish-2.wav', 'player/swish-3.wav', 'player/swish-4.wav', 'player/swish-5.wav'],
  birdsLoop: ['ambient/birds_1.wav'],
  birdChirp: ['ambient/bird_2.wav'],
  crow: ['ambient/crow_caw.wav'],
  windLoop: ['ambient/wind_1.mp3']
};

const SoundFX = (function () {
  let actx = null;
  let master = null;
  let sfxBus = null;
  let ambientBus = null;
  let dayGain = null;
  let nightGain = null;
  let birdsGain = null;
  let windGain = null;

  // Volumen/mute de cada canal, controlables por separado desde Ajustes.
  let masterVolume = 0.7, masterMuted = false;
  let sfxVolume = 1, sfxMuted = false;
  let ambientVolume = 1, ambientMuted = false;
  // Además del control manual, el ambiente se silencia solo al pausar/ir al menú.
  let ambientActive = true;

  let ambientStarted = false;
  let currentDarkness = 0;
  const buffers = {};
  let samplesLoading = false;

  function applyMasterGain() { if (master) master.gain.value = masterMuted ? 0 : masterVolume; }
  function applySfxGain() { if (sfxBus) sfxBus.gain.value = sfxMuted ? 0 : sfxVolume; }
  function applyAmbientGain() {
    if (!ambientBus) return;
    const target = (ambientMuted ? 0 : ambientVolume) * (ambientActive ? 1 : 0);
    ambientBus.gain.setTargetAtTime(target, actx.currentTime, 0.25);
  }

  function ensureCtx() {
    if (actx) return;
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain();
    master.connect(actx.destination);
    sfxBus = actx.createGain();
    sfxBus.connect(master);
    ambientBus = actx.createGain();
    ambientBus.connect(master);
    applyMasterGain();
    applySfxGain();
    applyAmbientGain();
  }

  // Descarga y decodifica todos los assets de assets/audio/ una sola vez.
  // Si un archivo falla (404, formato no soportado, etc.) simplemente queda
  // afuera de la lista y esa categoría cae al sonido sintetizado de respaldo.
  async function preloadSamples() {
    if (samplesLoading) return;
    samplesLoading = true;
    await Promise.all(Object.entries(SAMPLE_FILES).map(async ([key, files]) => {
      const loaded = await Promise.all(files.map(async (f) => {
        try {
          const res = await fetch(ASSET_BASE + f);
          const arr = await res.arrayBuffer();
          return await actx.decodeAudioData(arr);
        } catch (e) {
          console.warn('No se pudo cargar el audio', f, e);
          return null;
        }
      }));
      buffers[key] = loaded.filter(Boolean);
    }));
  }

  function playBuffer(buf, { vol = 0.4, rateJitter = 0.06, bus } = {}) {
    if (!actx || !buf) return false;
    const src = actx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 1 + (Math.random() * 2 - 1) * rateJitter;
    const g = actx.createGain();
    g.gain.value = vol;
    src.connect(g);
    g.connect(bus || sfxBus);
    src.start();
    return true;
  }

  // Reproduce una variación al azar de la categoría pedida. Devuelve false si
  // todavía no hay ningún sample cargado (para poder caer al sonido sintetizado).
  function playRandom(key, opts) {
    const list = buffers[key];
    if (!list || !list.length) return false;
    return playBuffer(list[Math.floor(Math.random() * list.length)], opts);
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
    g.connect(sfxBus);
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
    g.connect(sfxBus);
    src.start();
    src.stop(actx.currentTime + dur + 0.03);
  }

  function startAmbient() {
    if (ambientStarted) return;
    ambientStarted = true;
    // Lecho sintetizado (siempre suena, sin esperar a que carguen los assets).
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

    // Pájaros y viento como buses propios conectados directo al ambientBus
    // (NO en cadena con dayGain/nightGain), para que su volumen no quede
    // pisado por lo bajo que está el lecho sintetizado.
    birdsGain = actx.createGain();
    birdsGain.gain.value = 0.55;
    birdsGain.connect(ambientBus);

    windGain = actx.createGain();
    windGain.gain.value = 0.3; // el viento suena de día Y de noche, un poco más fuerte de noche
    windGain.connect(ambientBus);

    preloadSamples().then(() => {
      if (buffers.birdsLoop && buffers.birdsLoop[0]) {
        const src = actx.createBufferSource();
        src.buffer = buffers.birdsLoop[0];
        src.loop = true;
        src.connect(birdsGain);
        src.start();
      }
      if (buffers.windLoop && buffers.windLoop[0]) {
        const src = actx.createBufferSource();
        src.buffer = buffers.windLoop[0];
        src.loop = true;
        src.connect(windGain);
        src.start();
      }
    });

    setInterval(() => {
      if (!actx || !ambientActive) return;
      if (currentDarkness < 0.3 && Math.random() < 0.5) {
        const useCrow = Math.random() < 0.35;
        const played = playRandom(useCrow ? 'crow' : 'birdChirp', {
          vol: (useCrow ? 0.35 : 0.5) * (1 - currentDarkness),
          rateJitter: 0.08,
          bus: ambientBus
        });
        if (!played) tone(rand(1500, 2300), 0.12, 'sine', 0.05 * (1 - currentDarkness));
      }
      if (currentDarkness > 0.5 && Math.random() < 0.3) {
        tone(rand(170, 260), 0.5, 'sine', 0.06 * currentDarkness, rand(140, 190));
      }
    }, 1500);
  }

  return {
    init() {
      ensureCtx();
      if (actx.state === 'suspended') actx.resume();
      startAmbient();
    },
    // Volumen general (afecta todo).
    setVolume(v) { masterVolume = v; applyMasterGain(); },
    setMuted(m) { masterMuted = m; applyMasterGain(); },
    // Efectos: pasos, golpes de hacha/pico, ataques, comer, beber, UI, etc.
    setSfxVolume(v) { sfxVolume = v; applySfxGain(); },
    setSfxMuted(m) { sfxMuted = m; applySfxGain(); },
    // Ambiente: pájaros, viento, murmullo de día/noche.
    setAmbientVolume(v) { ambientVolume = v; applyAmbientGain(); },
    setAmbientMuted(m) { ambientMuted = m; applyAmbientGain(); },
    // Silenciado automático del ambiente al pausar/ir al menú (se combina con
    // el control manual de arriba, no lo reemplaza).
    setAmbientActive(active) { ambientActive = active; applyAmbientGain(); },
    setDarkness(d) {
      currentDarkness = d;
      if (dayGain) dayGain.gain.setTargetAtTime(0.16 * (1 - d), actx.currentTime, 0.8);
      if (nightGain) nightGain.gain.setTargetAtTime(0.14 * d, actx.currentTime, 0.8);
      if (birdsGain) birdsGain.gain.setTargetAtTime(0.55 * (1 - d * 0.85), actx.currentTime, 0.8);
      if (windGain) windGain.gain.setTargetAtTime(0.3 + d * 0.18, actx.currentTime, 0.8);
    },
    chop() {
      if (!playRandom('axe', { vol: 0.4, rateJitter: 0.08 })) {
        noiseBurst(0.12, 'bandpass', 700, 0.35);
        tone(110, 0.1, 'sine', 0.2);
      }
    },
    mine() {
      if (!playRandom('pickaxe', { vol: 0.4, rateJitter: 0.08 })) {
        noiseBurst(0.08, 'highpass', 2500, 0.3);
        tone(600, 0.05, 'square', 0.1);
      }
    },
    berry() { tone(rand(500, 700), 0.12, 'triangle', 0.2, rand(750, 900)); },
    drink() {
      if (!playRandom('drink', { vol: 0.5, rateJitter: 0.05 })) {
        noiseBurst(0.25, 'bandpass', 1800, 0.15);
      }
    },
    eat() {
      if (!playRandom('crunch', { vol: 0.45, rateJitter: 0.08 })) {
        noiseBurst(0.15, 'highpass', 1200, 0.25);
      }
    },
    footstep(intensity = 1) {
      playRandom('footstepGrass', { vol: 0.16 * intensity, rateJitter: 0.12 });
    },
    attackSwing() {
      if (!playRandom('swish', { vol: 0.3, rateJitter: 0.1 })) {
        tone(300, 0.08, 'sine', 0.1, 180);
      }
    },
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
