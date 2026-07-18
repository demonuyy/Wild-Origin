import { rand, state, dist } from './config.js';

// Rutas de los assets de audio reales (assets/audio/...). Cada categoría es
// una lista para poder elegir una al azar y que no suene siempre igual.
const ASSET_BASE = 'assets/audio/';
const SAMPLE_FILES = {
  axe: ['tools/axe_hit_1.wav', 'tools/axe_hit_2.wav', 'tools/axe_hit_3.wav', 'tools/axe_hit_4.wav', 'tools/axe_hit_5.wav'],
  pickaxe: ['tools/pickaxe_hit_1.wav', 'tools/pickaxe_hit_2.wav', 'tools/pickaxe_hit_3.wav', 'tools/pickaxe_hit_4.wav', 'tools/pickaxe_hit_5.wav'],
  crunch: ['player/crunch.1.wav', 'player/crunch.2.wav', 'player/crunch.3.wav', 'player/crunch.4.wav', 'player/crunch.5.wav', 'player/crunch.6.wav', 'player/crunch.7.wav'],
  drink: ['player/drink_1.wav', 'player/drink_2.wav', 'player/drink_3.wav'],
  footstepGrass: ['player/footstep_grass_000.ogg', 'player/footstep_grass_001.ogg', 'player/footstep_grass_002.ogg', 'player/footstep_grass_003.ogg', 'player/footstep_grass_004.ogg'],
  // Pasos del jugador al vadear una laguna (ver isInWater en world.js).
  footstepWater: ['player/splash_1.wav', 'player/splash_2.wav'],
  swish: ['player/swish-1.wav', 'player/swish-2.wav', 'player/swish-3.wav', 'player/swish-4.wav', 'player/swish-5.wav'],
  playerHurt: ['player/player_hurt_1.wav', 'player/player_hurt_2.wav', 'player/player_hurt_3.wav', 'player/player_hurt_4.wav'],
  playerDead: ['player/player_dead.wav'],
  // Jadeo del jugador cuando la energía llega a cero y entra en cooldown de
  // recuperación (ver STAMINA_COOLDOWN en player.js).
  fatigue: ['player/player_fatigue_1.wav', 'player/player_fatigue_2.wav'],
  birdsLoop: ['ambient/birds_1.wav'],
  birdChirp: ['ambient/bird_2.wav'],
  crow: ['ambient/crow_caw.wav'],
  windLoop: ['ambient/wind_1.mp3'],
  // Fauna: antes solo se usaban tonos sintetizados para lobos y nada para
  // ciervos. Ahora usamos los samples reales de assets/audio/animals/.
  wolfGrowl: ['animals/wolf_growl_1.wav'],
  wolfAttack: ['animals/wolf_atack_1.wav', 'animals/wolf_atack_2.wav', 'animals/wolf_atack_3.wav'],
  wolfHurt: ['animals/wolf_hurt_1.wav', 'animals/wolf_hurt_2.wav'],
  wolfDead: ['animals/wolf_dead_1.wav', 'animals/wolf_dead_2.wav'],
  wolfHowl: ['animals/wolf_howl_1.wav', 'animals/wolf_howl_2.wav', 'animals/wolf_howl_3.wav'],
  deerGrunt: ['animals/deer_grunt.wav'],
  deerSnort: ['animals/deer_snort.wav'],
  deerHurt: ['animals/deer_hurt_1.wav', 'animals/deer_hurt_2.wav', 'animals/deer_hurt_3.wav'],
  deerDead: ['animals/deer_dead _1.wav'],
  // Conejo: antes reusaba deerHurt/deerDead como placeholder (ver hitRabbit
  // en animals.js) porque no había samples propios todavía.
  rabbitHurt: ['animals/rabbit_hurt_1.wav', 'animals/rabbit_hurt_2.wav'],
  rabbitDead: ['animals/rabbit_dead_1.wav', 'animals/rabbit_dead_2.wav'],
  footstepAnimal: ['animals/footstep_animal_1.wav', 'animals/footstep_animal_2.wav', 'animals/footstep_animal_3.wav', 'animals/footstep_animal_4.wav', 'animals/footstep_animal_5.wav', 'animals/footstep_animal_6.wav'],
  // Recolección a mano: antes un mismo tono synth para palos y piedras sueltas.
  // Ahora un rustle de arbusto/pasto para palos y un golpe de roca para piedras.
  pickupRustle: ['items/pickup_rustle_1.wav', 'items/pickup_rustle_2.wav', 'items/pickup_rustle_3.wav', 'items/pickup_rustle_4.wav', 'items/pickup_rustle_5.wav'],
  pickupRock: ['items/pickup_rock_1.wav', 'items/pickup_rock_2.wav'],
  // Juntar huesos, primera etapa de desuelle (carne+piel) de lobo/ciervo, y
  // tirar un ítem al suelo (ver harvestCorpse/dropItem en inventory.js).
  // Antes las tres reusaban pickupRustle/pickupRock como placeholder.
  pickupBone: ['items/pickup_bone_1.wav', 'items/pickup_bone_2.wav'],
  skinning: ['items/skinning.wav'],
  drop: ['items/drop.wav'],
  // Cocinar carne en la fogata (ver tryCookMeat en inventory.js). Antes
  // reusaba craftOk() como placeholder.
  cookMeat: ['items/meat_sear.wav'],
  // UI: abrir/cerrar inventario y equipar herramienta (se reutiliza el sample
  // de cota de malla como "clank" genérico de equipar, no hay uno más específico).
  bagOpen: ['ui/open_bag.wav'],
  bagClose: ['ui/close_bag.wav'],
  equipClank: ['ui/chainmail1.wav', 'ui/chainmail2.wav'],
  // Crafteo de un ítem en la mano (lanza/hacha/pico/antorcha/mochila) vs.
  // construir algo en el mundo (fogata/refugio). Antes ambos casos sonaban
  // con el mismo tono sintetizado de craftOk().
  craft: ['ui/craft.wav'],
  building: ['ui/building.wav']
};

const SoundFX = (function () {
  let actx = null;
  let master = null;
  let sfxBus = null;
  let ambientBus = null;
  let nightGain = null;
  let windGain = null;

  // Volumen/mute de cada canal, controlables por separado desde Ajustes.
  let masterVolume = 0.7, masterMuted = false;
  let sfxVolume = 1, sfxMuted = false;
  let ambientVolume = 1, ambientMuted = false;
  // Además del control manual, el ambiente se silencia solo al pausar/ir al menú.
  let ambientActive = true;

  let ambientStarted = false;
  let currentDarkness = 0;
  // Qué tan alejado está el zoom de cámara (0 = zoom normal/cercano, 1 =
  // zoom mínimo/lo más alejado posible). Sube el viento un poco, como si al
  // alejar la vista se escuchara más el ambiente abierto.
  let currentZoomFog = 0;
  const buffers = {};
  let samplesLoading = false;

  function applyMasterGain() { if (master) master.gain.value = masterMuted ? 0 : masterVolume; }
  function applySfxGain() { if (sfxBus) sfxBus.gain.value = sfxMuted ? 0 : sfxVolume; }
  function applyAmbientGain() {
    if (!ambientBus) return;
    const target = (ambientMuted ? 0 : ambientVolume) * (ambientActive ? 1 : 0);
    ambientBus.gain.setTargetAtTime(target, actx.currentTime, 0.25);
  }
  // Combina de noche (currentDarkness) y de cámara alejada (currentZoomFog)
  // en un único gain de viento, para no pisarse entre setDarkness y setZoomFog.
  function applyWindGain() {
    if (!windGain) return;
    const target = 0.3 + currentDarkness * 0.18 + currentZoomFog * 0.22;
    windGain.gain.setTargetAtTime(target, actx.currentTime, 0.6);
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
          if (!res.ok) throw new Error(`HTTP ${res.status} en ${ASSET_BASE + f}`);
          const arr = await res.arrayBuffer();
          return await actx.decodeAudioData(arr);
        } catch (e) {
          console.warn('No se pudo cargar el audio', f, e);
          return null;
        }
      }));
      buffers[key] = loaded.filter(Boolean);
      // Resumen por categoría: si acá aparece "0/N" para alguna categoría,
      // esa categoría siempre va a caer al sonido sintetizado de respaldo
      // (revisar el warning de arriba con el nombre de archivo exacto que falló).
      if (buffers[key].length < files.length) {
        console.warn(`Audio "${key}": ${buffers[key].length}/${files.length} samples cargados`);
      }
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

  // Antes los sonidos de fauna (gruñidos, aullidos, mordidas...) sonaban al
  // mismo volumen sin importar dónde estuviera esa criatura respecto al
  // jugador — con varios chunks cargados a la vez, eso hacía que se
  // escucharan todo el tiempo aunque el animal estuviera lejísimos fuera de
  // pantalla. HEAR_R es más o menos lo que entra en cámara con el zoom por
  // defecto; HOWL_R es un poco más porque un aullido se supone que se oye
  // desde más lejos que un gruñido.
  const HEAR_R = 700;
  const HOWL_R = 1050;

  // Devuelve un multiplicador de volumen 0..1 según qué tan lejos está (x, y)
  // del jugador (1 = está al lado, 0 = fuera del radio de audición). Si no se
  // pasan coordenadas (sonidos de UI/jugador/ambiente) siempre devuelve 1.
  function hearFactor(x, y, r = HEAR_R) {
    if (x === undefined || y === undefined) return 1;
    const d = dist(state.player.x, state.player.y, x, y);
    if (d >= r) return 0;
    return 1 - d / r;
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
    // Antes había acá un lecho sintetizado de día (ruido filtrado en banda,
    // sonaba a viento artificial) que se sumaba al sample real de viento.
    // Se sacó: de día solo queda windLoop (el .mp3 real de assets/audio/).
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

    windGain = actx.createGain();
    windGain.gain.value = 0.3; // el viento suena de día Y de noche, un poco más fuerte de noche
    windGain.connect(ambientBus);

    preloadSamples().then(() => {
      if (buffers.windLoop && buffers.windLoop[0]) {
        const src = actx.createBufferSource();
        src.buffer = buffers.windLoop[0];
        src.loop = true;
        src.connect(windGain);
        src.start();
      }
    });

    // Pajaritos/cuervos sueltos. OJO: antes 'birdsLoop' (ambient/birds_1.wav)
    // sonaba en loop CONTINUO e infinito por su cuenta, aparte de este
    // temporizador — por eso se escuchaba muchísimo más seguido que el
    // cuervo. Ahora birdsLoop entra acá como una opción más de "pájaro" y
    // comparte exactamente la misma frecuencia de disparo que el cuervo
    // (50/50 entre pájaro y cuervo cada vez que toca).
    setInterval(() => {
      if (!actx || !ambientActive) return;
      if (currentDarkness < 0.3 && Math.random() < 0.08) {
        const useCrow = Math.random() < 0.5;
        const birdKey = Math.random() < 0.5 ? 'birdChirp' : 'birdsLoop';
        const played = playRandom(useCrow ? 'crow' : birdKey, {
          vol: (useCrow ? 0.35 : 0.5) * (1 - currentDarkness),
          rateJitter: 0.08,
          bus: ambientBus
        });
        if (!played) tone(rand(1500, 2300), 0.12, 'sine', 0.05 * (1 - currentDarkness));
      }
      if (currentDarkness > 0.5 && Math.random() < 0.3) {
        tone(rand(170, 260), 0.5, 'sine', 0.06 * currentDarkness, rand(140, 190));
      }
    }, 10000);
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
      if (nightGain) nightGain.gain.setTargetAtTime(0.14 * d, actx.currentTime, 0.8);
      applyWindGain();
    },
    // t: 0 (zoom normal/cercano) a 1 (zoom mínimo, cámara lo más alejada
    // posible). Llamado desde render() cada frame junto con la niebla visual.
    setZoomFog(t) {
      currentZoomFog = Math.max(0, Math.min(1, t));
      applyWindGain();
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
    berry() {
      if (!playRandom('pickupRustle', { vol: 0.35, rateJitter: 0.1 })) {
        tone(rand(500, 700), 0.12, 'triangle', 0.2, rand(750, 900));
      }
    },
    // kind: 'rock' para piedras sueltas, 'bone' para juntar huesos de un
    // cadáver (ver harvestCorpse en inventory.js), cualquier otra cosa (o
    // nada) para palos/rustle genérico. Cae al tono sintetizado si el
    // sample no cargó.
    pickup(kind) {
      const key = kind === 'rock' ? 'pickupRock' : kind === 'bone' ? 'pickupBone' : 'pickupRustle';
      if (!playRandom(key, { vol: 0.35, rateJitter: 0.1 })) {
        tone(rand(340, 420), 0.09, 'triangle', 0.18, rand(260, 320));
      }
    },
    // Primer desuelle de un cadáver de lobo/ciervo (carne + piel), ver
    // harvestCorpse en inventory.js. Distinto de pickup('bone'), que es la
    // segunda etapa (juntar los huesos).
    skinning() {
      if (!playRandom('skinning', { vol: 0.4, rateJitter: 0.06 })) {
        noiseBurst(0.18, 'lowpass', 900, 0.25);
      }
    },
    // Tirar un ítem al suelo (click derecho, o arrastrarlo afuera de los
    // paneles, ver dropItem en inventory.js).
    drop() {
      if (!playRandom('drop', { vol: 0.35, rateJitter: 0.1 })) {
        tone(rand(280, 340), 0.1, 'triangle', 0.18, rand(180, 220));
      }
    },
    // Cocinar carne cruda en la fogata (ver tryCookMeat en inventory.js).
    cookMeat() {
      if (!playRandom('cookMeat', { vol: 0.4, rateJitter: 0.05 })) {
        noiseBurst(0.3, 'highpass', 3000, 0.15);
      }
    },
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
    // water: true mientras el jugador vadea una laguna (ver isInWater en
    // world.js) — usa los splashes en vez del pasto normal.
    footstep(intensity = 1, water = false) {
      if (water) {
        if (!playRandom('footstepWater', { vol: 0.28 * intensity, rateJitter: 0.1 })) {
          noiseBurst(0.1, 'bandpass', 1000, 0.15 * intensity);
        }
        return;
      }
      playRandom('footstepGrass', { vol: 0.16 * intensity, rateJitter: 0.12 });
    },
    attackSwing() {
      if (!playRandom('swish', { vol: 0.3, rateJitter: 0.1 })) {
        tone(300, 0.08, 'sine', 0.1, 180);
      }
    },
    // Crafteo de un ítem que termina en la mano/inventario (lanza, hacha,
    // pico, antorcha, mochila). Ver building() para levantar algo en el
    // mundo (fogata, refugio), que suena distinto.
    craftOk() {
      if (!playRandom('craft', { vol: 0.45, rateJitter: 0.05 })) {
        tone(440, 0.1, 'triangle', 0.25, 660);
        setTimeout(() => tone(660, 0.15, 'triangle', 0.22, 880), 90);
      }
    },
    craftFail() { tone(180, 0.2, 'sawtooth', 0.2, 120); },
    // Levantar algo en el mundo: fogata, refugio (ver tryPlaceCampfire/
    // tryPlaceShelter en crafting.js). Antes reusaba craftOk().
    building() {
      if (!playRandom('building', { vol: 0.5, rateJitter: 0.04 })) {
        tone(220, 0.12, 'triangle', 0.25, 330);
        setTimeout(() => tone(160, 0.2, 'triangle', 0.2, 110), 100);
      }
    },
    // Gruñido de aviso al entrar en modo persecución. x,y = posición del lobo.
    wolfGrowl(x, y) {
      const f = hearFactor(x, y);
      if (f <= 0) return;
      if (!playRandom('wolfGrowl', { vol: 0.4 * f, rateJitter: 0.05 })) tone(90, 0.35, 'sawtooth', 0.18 * f, 70);
    },
    // Mordida del lobo al morder al jugador (distinto del quejido de dolor).
    wolfAttack(x, y) {
      const f = hearFactor(x, y);
      if (f <= 0) return;
      if (!playRandom('wolfAttack', { vol: 0.45 * f, rateJitter: 0.08 })) noiseBurst(0.1, 'bandpass', 900, 0.3 * f);
    },
    // Quejido del lobo al recibir un golpe del jugador.
    wolfHit(x, y) {
      const f = hearFactor(x, y);
      if (f <= 0) return;
      if (!playRandom('wolfHurt', { vol: 0.75 * f, rateJitter: 0.08 })) noiseBurst(0.12, 'bandpass', 1200, 0.3 * f);
    },
    wolfDeath(x, y) {
      const f = hearFactor(x, y);
      if (f <= 0) return;
      if (!playRandom('wolfDead', { vol: 0.8 * f, rateJitter: 0.05 })) tone(300, 0.4, 'sawtooth', 0.25 * f, 60);
    },
    // Aullido ambiental nocturno, no ligado a la persecución del jugador.
    // Radio más grande (HOWL_R) porque un aullido se oye desde más lejos.
    wolfHowl(x, y) {
      const f = hearFactor(x, y, HOWL_R);
      if (f <= 0) return;
      playRandom('wolfHowl', { vol: 0.42 * f, rateJitter: 0.04, bus: ambientBus });
    },
    // Ciervo pastando tranquilo. x,y = posición del ciervo.
    deerGrunt(x, y) {
      const f = hearFactor(x, y);
      if (f > 0) playRandom('deerGrunt', { vol: 0.22 * f, rateJitter: 0.06 });
    },
    // Ciervo alertado, justo antes de salir corriendo.
    deerSnort(x, y) {
      const f = hearFactor(x, y);
      if (f > 0) playRandom('deerSnort', { vol: 0.35 * f, rateJitter: 0.05 });
    },
    deerHurt(x, y) {
      const f = hearFactor(x, y);
      if (f <= 0) return;
      if (!playRandom('deerHurt', { vol: 0.4 * f, rateJitter: 0.08 })) noiseBurst(0.12, 'bandpass', 1400, 0.25 * f);
    },
    deerDeath(x, y) {
      const f = hearFactor(x, y);
      if (f <= 0) return;
      if (!playRandom('deerDead', { vol: 0.4 * f, rateJitter: 0.04 })) tone(260, 0.35, 'sawtooth', 0.2 * f, 90);
    },
    // Conejo golpeado/muerto. Antes reusaban deerHurt/deerDead como
    // placeholder (ver hitRabbit en animals.js); volumen más bajo que el
    // ciervo porque es una presa mucho más chica.
    rabbitHurt(x, y) {
      const f = hearFactor(x, y);
      if (f <= 0) return;
      if (!playRandom('rabbitHurt', { vol: 0.35 * f, rateJitter: 0.08 })) noiseBurst(0.08, 'bandpass', 1600, 0.2 * f);
    },
    rabbitDeath(x, y) {
      const f = hearFactor(x, y);
      if (f <= 0) return;
      if (!playRandom('rabbitDead', { vol: 0.35 * f, rateJitter: 0.05 })) tone(320, 0.2, 'sawtooth', 0.15 * f, 100);
    },
    // Pisadas de animal (lobo persiguiendo, ciervo huyendo), más grave/discreto
    // que el paso del jugador. x,y = posición del animal.
    footstepAnimal(x, y, intensity = 1) {
      const f = hearFactor(x, y);
      if (f > 0) playRandom('footstepAnimal', { vol: 0.12 * intensity * f, rateJitter: 0.15 });
    },
    playerHurt() {
      if (!playRandom('playerHurt', { vol: 0.5, rateJitter: 0.06 })) {
        noiseBurst(0.2, 'lowpass', 500, 0.3);
        tone(150, 0.25, 'sine', 0.25, 80);
      }
    },
    playerDeath() {
      if (!playRandom('playerDead', { vol: 0.55 })) tone(220, 1.2, 'sawtooth', 0.2, 55);
    },
    // Jadeo de agotamiento: suena una sola vez, justo cuando la energía llega
    // a cero y arranca el cooldown de 5s antes de poder volver a correr.
    fatigue() {
      if (!playRandom('fatigue', { vol: 0.55, rateJitter: 0.05 })) {
        tone(200, 0.3, 'sawtooth', 0.18, 90);
      }
    },
    dayChime() { tone(660, 0.5, 'sine', 0.15, 880); },
    sleep() { tone(520, 0.3, 'sine', 0.15, 320); setTimeout(() => tone(320, 0.4, 'sine', 0.12, 220), 200); },
    gameOverSting() { tone(220, 1.2, 'sawtooth', 0.2, 55); },
    click() { tone(500, 0.08, 'triangle', 0.15); },
    // Abrir/cerrar el panel de inventario (antes usaban click() genérico).
    bagOpen() { if (!playRandom('bagOpen', { vol: 0.4 })) tone(500, 0.08, 'triangle', 0.15); },
    bagClose() { if (!playRandom('bagClose', { vol: 0.4 })) tone(400, 0.08, 'triangle', 0.12); },
    // Cambiar la herramienta "en la mano" (antes usaba click() genérico).
    equipClank() { if (!playRandom('equipClank', { vol: 0.35, rateJitter: 0.05 })) tone(500, 0.08, 'triangle', 0.15); }
  };
})();

export { SoundFX };
