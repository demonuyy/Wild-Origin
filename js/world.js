import { state, CHUNK_SIZE, rand, dist, clamp, ITEMS } from './config.js';

// ---------- Ruido de valor 2D (continuo, sin dependencias externas) ----------
// Define "biomas" suaves (zonas más boscosas, más rocosas, etc.) que son iguales
// sin importar en qué chunk se evalúen -> los biomas cruzan los bordes de los
// chunks sin costuras.
function makeNoise2D(seed) {
  function hash(x, y) {
    const s = Math.sin(x * 127.1 + y * 311.7 + seed) * 43758.5453123;
    return s - Math.floor(s);
  }
  function smooth(t) { return t * t * (3 - 2 * t); }
  return function (x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const v00 = hash(xi, yi), v10 = hash(xi + 1, yi);
    const v01 = hash(xi, yi + 1), v11 = hash(xi + 1, yi + 1);
    const u = smooth(xf), v = smooth(yf);
    const top = v00 + (v10 - v00) * u;
    const bottom = v01 + (v11 - v01) * u;
    return top + (bottom - top) * v;
  };
}

// ---------- PRNG determinístico por chunk ----------
// Cada chunk se genera siempre igual a partir de (semilla del mundo, cx, cy),
// así que se puede descargar y volver a cargar sin que cambie su contenido base.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function chunkSeed(worldSeed, cx, cy) {
  let h = (worldSeed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ cx, 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ cy, 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}

let forestNoise = null;
let rockNoise = null;
let bushNoise = null;
// Ruido de bioma: a diferencia de forestNoise/rockNoise/bushNoise (que
// deciden densidad de entidades dentro de un mismo tipo de terreno), este
// define ZONAS enteras de nieve, a mucha más escala (BIOME_NOISE_SCALE es
// ~13 veces más grande que NOISE_SCALE) para que las manchas de nieve sean
// regiones grandes y continuas, no un ruido fino salpicado.
let biomeNoise = null;
const NOISE_SCALE = 0.0035;
const BIOME_NOISE_SCALE = 0.00045;
// Banda de transición del ruido de bioma: por debajo de SNOW_LOW es
// "normal" del todo, por encima de SNOW_HIGH es nieve del todo, y en el
// medio se degrada suave (ver snowFactor) para que el borde del bioma no
// sea una línea dura.
const SNOW_LOW = 0.54;
const SNOW_HIGH = 0.62;
// Nunca hay nieve pegada al spawn (para que la partida arranque siempre en
// terreno templado); se atenúa gradualmente entre estos dos radios en vez
// de cortar de golpe al llegar a SPAWN_SAFE_R.
const SPAWN_SAFE_R = 500;
const SPAWN_FADE_R = 900;

// Cuánta "nieve" hay en una posición del mundo, de 0 (nada) a 1 (bioma de
// nieve pleno). La usan tanto la generación (generateChunk: decide qué
// entidades spawnean ahí) como el dibujado (drawGround, drawTree, drawRock,
// y el snowfall de pantalla en render.js), así que el mismo número maneja
// generación y visual — no hay dos fuentes de verdad para "dónde hay nieve".
export function snowFactor(x, y) {
  const spawnFade = clamp((dist(x, y, 0, 0) - SPAWN_SAFE_R) / (SPAWN_FADE_R - SPAWN_SAFE_R), 0, 1);
  if (spawnFade <= 0) return 0;
  const n = biomeNoise(x * BIOME_NOISE_SCALE, y * BIOME_NOISE_SCALE);
  const raw = clamp((n - SNOW_LOW) / (SNOW_HIGH - SNOW_LOW), 0, 1);
  return raw * spawnFade;
}

// Atajo booleano para donde solo importa adentro/afuera del bioma (spawnear
// o no cierta entidad), no el grado de transición.
export function isSnowBiome(x, y) {
  return snowFactor(x, y) > 0.5;
}

function chunkKeyOf(cx, cy) { return cx + ',' + cy; }

// Cantidad de paletas de color distintas por tipo de entidad (la variante
// puntual de cada una se sortea abajo, en generateChunk, y se guarda en su
// campo `variant`). Los arrays de paletas en sí viven junto a cada función
// drawX correspondiente (TREE_PALETTES en este archivo, WOLF_PALETTES en
// enemies.js, DEER_PALETTES en animals.js) para no crear un import
// circular entre world.js y esos dos módulos; si se agrega o saca una
// paleta de esos arrays, actualizar el número acá para que siga
// coincidiendo. Las rocas NO tienen variante de color (todas usan
// ROCK_PALETTE, una sola), solo de forma (ver ROCK_SHAPES).
const TREE_VARIANTS = 3;
const BUSH_VARIANTS = 2;
const WOLF_VARIANTS = 3;
const DEER_VARIANTS = 3;
// Paletas del conejo: ver RABBIT_PALETTES en animals.js (mismo criterio que
// WOLF_VARIANTS/DEER_VARIANTS de arriba: un solo lugar por módulo para no
// crear un import circular).
const RABBIT_VARIANTS = 2;
// Paletas del oso: ver BEAR_PALETTES en enemies.js (mismo criterio que
// WOLF_VARIANTS de arriba).
const BEAR_VARIANTS = 2;

// Cantidad de siluetas distintas por tipo de entidad (independiente del
// color): TREE_SHAPES en drawTree, ROCK_SHAPES en drawRock. Se sortea junto
// con `variant` en generateChunk y viaja en el campo `shape` de la entidad.
const TREE_SHAPES = 3;
const ROCK_SHAPES = 3;

// Siembra las funciones de ruido a partir de state.worldSeed. La usan tanto
// generateWorld() (mundo nuevo) como restoreChunksFromSave() (mundo cargado
// desde una partida guardada, que reutiliza la misma semilla).
function seedNoiseFromWorld() {
  forestNoise = makeNoise2D(state.worldSeed);
  rockNoise = makeNoise2D(state.worldSeed + 4321.7);
  bushNoise = makeNoise2D(state.worldSeed + 8765.3);
  biomeNoise = makeNoise2D(state.worldSeed + 2468.1);
}

// Reinicia el mundo: nueva semilla global. A partir de acá todo se genera
// "on demand" chunk por chunk según updateChunks().
export function generateWorld() {
  state.trees = [];
  state.rocks = [];
  state.bushes = [];
  state.ponds = [];
  state.campfires = [];
  state.shelters = [];
  state.wolves = [];
  state.deer = [];
  state.rabbits = [];
  state.bears = [];
  state.grassDecor = [];
  state.bloodDecals = [];
  state.rippleDecals = [];
  state.sticks = [];
  state.stones = [];
  state.corpses = [];
  state.chunkStore = {};
  state.loadedChunks = new Set();
  state.worldSeed = Math.floor(Math.random() * 1e9);
  seedNoiseFromWorld();
}

// Se llama después de restaurar una partida guardada (state.trees, state.wolves,
// etc. ya vienen poblados desde save.js). Reconstruye chunkStore/loadedChunks
// agrupando esas entidades por su chunkKey, para que updateChunks() pueda
// seguir cargando/descargando chunks sin duplicar ni perder nada, y siembra
// el ruido con la misma semilla guardada para que los chunks todavía no
// visitados generen contenido consistente con el resto del mundo.
export function restoreChunksFromSave() {
  seedNoiseFromWorld();
  state.chunkStore = {};
  const lists = {
    trees: state.trees, rocks: state.rocks, bushes: state.bushes, ponds: state.ponds,
    wolves: state.wolves, deer: state.deer, rabbits: state.rabbits, bears: state.bears, grassDecor: state.grassDecor,
    sticks: state.sticks, stones: state.stones
  };
  for (const [name, arr] of Object.entries(lists)) {
    for (const obj of arr) {
      const key = obj.chunkKey;
      if (!key) continue;
      if (!state.chunkStore[key]) {
        state.chunkStore[key] = { trees: [], rocks: [], bushes: [], ponds: [], wolves: [], deer: [], rabbits: [], bears: [], grassDecor: [], sticks: [], stones: [] };
      }
      state.chunkStore[key][name].push(obj);
    }
  }
  state.loadedChunks = new Set(Object.keys(state.chunkStore));
}

function generateChunk(cx, cy) {
  const key = chunkKeyOf(cx, cy);
  const rnd = mulberry32(chunkSeed(state.worldSeed, cx, cy));
  const crand = (a, b) => a + rnd() * (b - a);
  const ox = cx * CHUNK_SIZE, oy = cy * CHUNK_SIZE;
  const nearSpawn = (x, y) => dist(x, y, 0, 0) < 260;

  const trees = [], rocks = [], bushes = [], ponds = [], wolves = [], deer = [], rabbits = [], bears = [], grassDecor = [], sticks = [], stones = [];

  const tryPlace = (list, attempts, noiseFn, factory) => {
    for (let i = 0; i < attempts; i++) {
      const x = ox + crand(0, CHUNK_SIZE);
      const y = oy + crand(0, CHUNK_SIZE);
      if (nearSpawn(x, y)) continue;
      const n = noiseFn(x * NOISE_SCALE, y * NOISE_SCALE);
      const density = clamp((n - 0.32) * 2.2, 0, 1);
      if (rnd() > density) continue;
      const obj = factory(x, y);
      if (!obj) continue;
      obj.chunkKey = key;
      list.push(obj);
    }
  };

  // OJO: la fórmula de densidad de abajo acepta en promedio ~45% de los intentos
  // (no un 5-10% como parecería a simple vista), así que estos números ya están
  // calibrados para dar una densidad similar a la del mapa original por chunk.
  // Bajados un poco (18→14 / 9→7) respecto de antes: como ahora cada árbol/
  // roca ocupa mucho más lugar (ver `size` más abajo) y no hay ningún
  // sistema de separación mínima entre objetos, mantener la MISMA cantidad
  // que antes amontonaba demasiado follaje/piedra superpuesta.
  // `variant` elige la paleta de color (no aplica a rocas, que son todas del
  // mismo color) y `shape` elige la silueta, en drawTree/drawRock/drawBush
  // (ver TREE_PALETTES/ROCK_PALETTE/BUSH_PALETTES y TREE_SHAPES/ROCK_SHAPES
  // más abajo). Se deciden acá, una sola vez por entidad y a partir del rnd
  // determinístico del chunk, así que cada árbol/roca/arbusto se ve siempre
  // igual al recargar la zona.
  // En el bioma de nieve solo crecen coníferas (shape=1, la silueta de
  // pino) con su verde oscuro característico (variant=0): nada de las
  // otras dos siluetas/colores (álamo, otoñal), que no pegan con un bosque
  // nevado. Fuera del bioma sigue habiendo de las tres formas y colores.
  // Tamaño bien más grande que antes (antes crand(0.85,1.3) / crand(0.8,1.25)):
  // ahora un árbol/roca promedio ronda el doble de alto/ancho, para que se
  // sientan como el elemento dominante del paisaje en vez de decoración chica.
  tryPlace(trees, 14, forestNoise, (x, y) => (isSnowBiome(x, y)
    ? { x, y, hits: 3, maxHits: 3, size: crand(1.6, 2.3), sway: crand(0, Math.PI * 2), variant: 0, shape: 1 }
    : { x, y, hits: 3, maxHits: 3, size: crand(1.6, 2.3), sway: crand(0, Math.PI * 2), variant: Math.floor(rnd() * TREE_VARIANTS), shape: Math.floor(rnd() * TREE_SHAPES) }));
  tryPlace(rocks, 7, rockNoise, (x, y) => ({ x, y, hits: 4, maxHits: 4, size: crand(1.5, 2.1), shape: Math.floor(rnd() * ROCK_SHAPES) }));
  // Los arbustos con bayas no crecen en el bioma de nieve (hace demasiado
  // frío); tryPlace ya sortea (x,y) antes de llamar al factory, así que acá
  // alcanza con descartar el intento si cayó en zona nevada.
  tryPlace(bushes, 7, bushNoise, (x, y) => (isSnowBiome(x, y) ? null : { x, y, stock: 3, maxStock: 3, regrowTimer: 0, size: crand(0.85, 1.2), variant: Math.floor(rnd() * BUSH_VARIANTS) }));

  // Palos y piedras sueltos: no dependen del ruido de bosque/roca (se pueden
  // encontrar en cualquier parte) porque son el recurso inicial para poder
  // craftear hacha/pico antes de poder talar o minar.
  for (let i = 0; i < 5; i++) {
    if (rnd() < 0.5) {
      const x = ox + crand(0, CHUNK_SIZE);
      const y = oy + crand(0, CHUNK_SIZE);
      if (!nearSpawn(x, y)) sticks.push({ x, y, rot: crand(0, Math.PI * 2), chunkKey: key });
    }
  }
  for (let i = 0; i < 5; i++) {
    if (rnd() < 0.5) {
      const x = ox + crand(0, CHUNK_SIZE);
      const y = oy + crand(0, CHUNK_SIZE);
      if (!nearSpawn(x, y)) stones.push({ x, y, rot: crand(0, Math.PI * 2), chunkKey: key });
    }
  }

  if (rnd() < 0.35) {
    const x = ox + crand(100, CHUNK_SIZE - 100);
    const y = oy + crand(100, CHUNK_SIZE - 100);
    if (!nearSpawn(x, y)) ponds.push({ x, y, rw: crand(70, 130), rh: crand(50, 90), chunkKey: key });
  }
  if (rnd() < 0.55) {
    const x = ox + crand(0, CHUNK_SIZE);
    const y = oy + crand(0, CHUNK_SIZE);
    if (!nearSpawn(x, y)) {
      wolves.push({ x, y, health: 34, maxHealth: 34, speed: crand(95, 125), state: 'wander', wanderTarget: null, attackCd: 0, alertR: 110, chunkKey: key, variant: Math.floor(rnd() * WOLF_VARIANTS) });
    }
  }
  if (rnd() < 0.4) {
    const x = ox + crand(0, CHUNK_SIZE);
    const y = oy + crand(0, CHUNK_SIZE);
    // El ciervo (presa de bosque/pradera) no aparece en la nieve; el lobo sí
    // se dejó spawneando ahí arriba (predador de cualquier terreno).
    if (!nearSpawn(x, y) && !isSnowBiome(x, y)) deer.push({ x, y, speed: 110, health: 18, maxHealth: 18, wanderTarget: null, state: 'graze', grazeTimer: crand(2, 6), alertCd: 0, chunkKey: key, variant: Math.floor(rnd() * DEER_VARIANTS) });
  }
  // Conejos: más comunes que el ciervo/lobo (presa chica y abundante) y a
  // veces aparecen de a 2-3 juntos (una "camada"), a diferencia del resto de
  // los animales que siempre spawnean de a uno. Tampoco aparecen en la nieve.
  if (rnd() < 0.6) {
    const count = 1 + Math.floor(rnd() * 3);
    for (let i = 0; i < count; i++) {
      const x = ox + crand(0, CHUNK_SIZE);
      const y = oy + crand(0, CHUNK_SIZE);
      if (!nearSpawn(x, y) && !isSnowBiome(x, y)) {
        rabbits.push({ x, y, speed: crand(80, 100), health: 6, maxHealth: 6, wanderTarget: null, state: 'wander', chunkKey: key, variant: Math.floor(rnd() * RABBIT_VARIANTS) });
      }
    }
  }
  // Oso: solo en el bioma de nieve, y bastante más raro que el lobo (es un
  // encuentro peligroso de verdad, no algo con lo que te cruzás todo el
  // rato). Nada de manada como el lobo: siempre de a uno.
  if (rnd() < 0.12) {
    const x = ox + crand(0, CHUNK_SIZE);
    const y = oy + crand(0, CHUNK_SIZE);
    if (!nearSpawn(x, y) && isSnowBiome(x, y)) {
      bears.push({ x, y, health: 90, maxHealth: 90, speed: crand(70, 90), state: 'wander', wanderTarget: null, attackCd: 0, alertR: 130, chunkKey: key, variant: Math.floor(rnd() * BEAR_VARIANTS) });
    }
  }
  for (let i = 0; i < 22; i++) {
    const x = ox + crand(0, CHUNK_SIZE), y = oy + crand(0, CHUNK_SIZE);
    // El pasto decorativo no se dibuja sobre nieve (quedaría un tufo verde
    // asomando en medio de un suelo blanco); ahí simplemente no se planta.
    if (!isSnowBiome(x, y)) grassDecor.push({ x, y, s: crand(0.5, 1.3), rot: crand(0, Math.PI * 2), chunkKey: key });
  }

  const data = { trees, rocks, bushes, ponds, wolves, deer, rabbits, bears, grassDecor, sticks, stones };
  state.chunkStore[key] = data;
  return data;
}

function attachChunk(key) {
  const [cx, cy] = key.split(',').map(Number);
  const data = state.chunkStore[key] || generateChunk(cx, cy);
  state.trees.push(...data.trees);
  state.rocks.push(...data.rocks);
  state.bushes.push(...data.bushes);
  state.ponds.push(...data.ponds);
  state.wolves.push(...data.wolves);
  state.deer.push(...data.deer);
  state.rabbits.push(...data.rabbits);
  state.bears.push(...data.bears);
  state.grassDecor.push(...data.grassDecor);
  state.sticks.push(...data.sticks);
  state.stones.push(...data.stones);
  state.loadedChunks.add(key);
}

function detachChunk(key) {
  state.trees = state.trees.filter(o => o.chunkKey !== key);
  state.rocks = state.rocks.filter(o => o.chunkKey !== key);
  state.bushes = state.bushes.filter(o => o.chunkKey !== key);
  state.ponds = state.ponds.filter(o => o.chunkKey !== key);
  state.wolves = state.wolves.filter(o => o.chunkKey !== key);
  state.deer = state.deer.filter(o => o.chunkKey !== key);
  state.rabbits = state.rabbits.filter(o => o.chunkKey !== key);
  state.bears = state.bears.filter(o => o.chunkKey !== key);
  state.grassDecor = state.grassDecor.filter(o => o.chunkKey !== key);
  state.sticks = state.sticks.filter(o => o.chunkKey !== key);
  state.stones = state.stones.filter(o => o.chunkKey !== key);
  state.loadedChunks.delete(key);
}

// Quita permanentemente una entidad (árbol talado del todo, lobo muerto, etc.)
// tanto de la lista activa como del chunk guardado, para que no reaparezca al
// volver a esa zona.
export function removeEntity(listName, obj) {
  const arr = state[listName];
  const i = arr.indexOf(obj);
  if (i !== -1) arr.splice(i, 1);
  const chunk = state.chunkStore[obj.chunkKey];
  if (chunk) {
    const arr2 = chunk[listName];
    const j = arr2.indexOf(obj);
    if (j !== -1) arr2.splice(j, 1);
  }
}

// Carga los chunks necesarios para cubrir lo que se ve en pantalla (según el
// zoom actual) y descarga los que quedaron lejos. Se llama en cada frame.
export function updateChunks(viewW, viewH) {
  const pcx = Math.floor(state.player.x / CHUNK_SIZE);
  const pcy = Math.floor(state.player.y / CHUNK_SIZE);
  // Se limita el radio máximo aunque el jugador aleje mucho el zoom, para no
  // disparar la cantidad de objetos activos (y por lo tanto el costo por frame).
  const radius = Math.min(4, Math.ceil(Math.max(viewW, viewH) / CHUNK_SIZE / 2) + 1);

  const needed = new Set();
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      needed.add(chunkKeyOf(pcx + dx, pcy + dy));
    }
  }

  for (const key of needed) {
    if (!state.loadedChunks.has(key)) attachChunk(key);
  }

  const unloadRadius = radius + 1;
  for (const key of [...state.loadedChunks]) {
    if (needed.has(key)) continue;
    const [kcx, kcy] = key.split(',').map(Number);
    if (Math.abs(kcx - pcx) > unloadRadius || Math.abs(kcy - pcy) > unloadRadius) {
      detachChunk(key);
    }
  }
}

// ---------- Dibujo ----------

// "Sello" de la mancha de nieve: un canvas chico dibujado UNA sola vez (la
// primera vez que hace falta) con el gradiente radial ya cocinado adentro.
// Antes cada celda de la grilla de abajo creaba su propio
// createRadialGradient() Y lo rellenaba con ctx.arc()+fill() en CADA frame;
// una vez que el jugador entraba al bioma, la gran mayoría de las celdas
// visibles dejaban de "saltearse" (amt<=0.03) y pasaban a pagar ese costo
// todas juntas, frame tras frame — eso era el lag. Con el sello ya
// pre-renderizado, pintar una mancha es un simple drawImage() con
// globalAlpha (un blit barato), no un cálculo de gradiente nuevo.
let snowStamp = null;
function getSnowStamp(radius) {
  if (snowStamp) return snowStamp;
  const size = radius * 2;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const sctx = c.getContext('2d');
  const g = sctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
  g.addColorStop(0, 'rgba(228,238,242,0.85)');
  g.addColorStop(0.7, 'rgba(228,238,242,0.5)');
  g.addColorStop(1, 'rgba(228,238,242,0)');
  sctx.fillStyle = g;
  sctx.beginPath();
  sctx.arc(radius, radius, radius, 0, Math.PI * 2);
  sctx.fill();
  snowStamp = c;
  return c;
}

// Nieve del bioma: se pinta ENCIMA del pasto en manchas grandes y
// superpuestas (no como una capa aparte con un borde recto) usando
// snowFactor() en cada punto de muestreo, así el límite entre bioma nevado
// y pasto se ve degradado en vez de una línea dura. Cada mancha es el
// sello de arriba estampado con drawImage(), con la intensidad de
// snowFactor() aplicada como transparencia (globalAlpha) en vez de estar
// horneada en el sello — así un mismo sello sirve para cualquier valor de
// snowFactor entre 0 y 1.
// SNOW_STEP/SNOW_R: cuanto más chico el radio respecto del paso, menos se
// superponen las manchas vecinas y más barato sale pintarlas (el costo real
// es el ÁREA de overdraw, no la cantidad de celdas) — pero necesitan seguir
// superponiéndose lo suficiente como para no dejar huecos visibles incluso
// con el jitter de abajo. Antes (210/260) el radio era bastante más grande
// de lo que hacía falta para eso: cada punto de pantalla terminaba cubierto
// por varias manchas superpuestas de más, y ESE overdraw (no la cantidad de
// manchas en sí) era el lag notorio al entrar al bioma de nieve.
const SNOW_STEP = 240;
const SNOW_R = 200;

// Hash determinístico (mismo truco "seno gigante" de siempre para esto):
// nada de Math.random(), porque necesita dar EL MISMO número cada vez que
// se pinta la misma celda (cx,cy) — si no, cada mancha titilaría de tamaño
// y posición de un frame a otro en vez de quedar quieta.
function cellHash(a, b) {
  const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

// Nieve del bioma: se pinta ENCIMA del pasto en manchas grandes y
// superpuestas (no como una capa aparte con un borde recto) usando
// snowFactor() en cada punto de muestreo, así el límite entre bioma nevado
// y pasto se ve degradado en vez de una línea dura. Cada mancha es el
// sello de arriba estampado con drawImage(), con la intensidad de
// snowFactor() aplicada como transparencia (globalAlpha) en vez de estar
// horneada en el sello — así un mismo sello sirve para cualquier valor de
// snowFactor entre 0 y 1.
// Sin el jitter/escala de acá abajo, al estar todas las manchas centradas
// justo en la grilla y con el mismo tamaño, se notaba clarísimo el patrón
// repetido (una fila tras otra de círculos idénticos). Cada celda corre su
// centro un poco al azar (determinístico por celda) y varía el tamaño, así
// se rompe la regularidad sin agregar ni un solo drawImage() más.
function drawSnowGround(ctx, cam, viewW, viewH) {
  const stamp = getSnowStamp(SNOW_R);
  const jitter = SNOW_STEP * 0.38;
  const snowStartCx = Math.floor(cam.x / SNOW_STEP) - 1;
  const snowEndCx = Math.floor((cam.x + viewW) / SNOW_STEP) + 1;
  const snowStartCy = Math.floor(cam.y / SNOW_STEP) - 1;
  const snowEndCy = Math.floor((cam.y + viewH) / SNOW_STEP) + 1;
  for (let cx = snowStartCx; cx <= snowEndCx; cx++) {
    for (let cy = snowStartCy; cy <= snowEndCy; cy++) {
      const wx = cx * SNOW_STEP, wy = cy * SNOW_STEP;
      const amt = snowFactor(wx, wy);
      if (amt <= 0.03) continue;
      const jx = (cellHash(cx, cy) - 0.5) * 2 * jitter;
      const jy = (cellHash(cx + 91.7, cy - 13.3) - 0.5) * 2 * jitter;
      const scale = 0.8 + cellHash(cx - 47.2, cy + 71.9) * 0.55;
      const size = SNOW_R * 2 * scale;
      const px = wx - cam.x + jx, py = wy - cam.y + jy;
      ctx.globalAlpha = amt;
      ctx.drawImage(stamp, px - size / 2, py - size / 2, size, size);
      ctx.globalAlpha = 1;
    }
  }
}

export function drawGround(ctx, canvas, cam) {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#2a4527');
  grad.addColorStop(1, '#16281a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Manchas de textura del suelo, en una grilla infinita (cada celda tiene un
  // offset pseudoaleatorio propio) para que no haga falta un WORLD_W/H fijo.
  const TILE = 260;
  const startCx = Math.floor(cam.x / TILE) - 1;
  const endCx = Math.floor((cam.x + canvas.width) / TILE) + 1;
  const startCy = Math.floor(cam.y / TILE) - 1;
  const endCy = Math.floor((cam.y + canvas.height) / TILE) + 1;
  const tones = ['rgba(70,110,55,0.10)', 'rgba(30,55,35,0.14)', 'rgba(90,120,60,0.08)'];
  for (let cx = startCx; cx <= endCx; cx++) {
    for (let cy = startCy; cy <= endCy; cy++) {
      const s = Math.sin(cx * 127.1 + cy * 311.7 + 17.3) * 43758.5453;
      const ox = (s - Math.floor(s)) * TILE;
      const s2 = Math.sin(cx * 269.5 + cy * 183.3 + 91.7) * 43758.5453;
      const oy = (s2 - Math.floor(s2)) * TILE;
      const s3 = Math.sin(cx * 51.7 + cy * 419.3 + 3.1) * 43758.5453;
      const tone = tones[Math.floor((s3 - Math.floor(s3)) * tones.length)];
      const px = cx * TILE + ox - cam.x;
      const py = cy * TILE + oy - cam.y;
      ctx.fillStyle = tone;
      ctx.beginPath();
      ctx.ellipse(px, py, 100, 56, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Segunda capa, más fina: motas sueltas de pasto (no manchas grandes como
  // arriba) para que de cerca el suelo no se vea tan liso. Cada mota es
  // chiquita (radio 1-2), así que aunque haya bastantes por pantalla el
  // costo real de pintarlas es mínimo (poca área cada una).
  const SPECK_TILE = 74;
  const speckTones = ['rgba(150,185,110,0.16)', 'rgba(25,45,25,0.18)', 'rgba(200,210,140,0.1)'];
  const sStartCx = Math.floor(cam.x / SPECK_TILE) - 1;
  const sEndCx = Math.floor((cam.x + canvas.width) / SPECK_TILE) + 1;
  const sStartCy = Math.floor(cam.y / SPECK_TILE) - 1;
  const sEndCy = Math.floor((cam.y + canvas.height) / SPECK_TILE) + 1;
  for (let cx = sStartCx; cx <= sEndCx; cx++) {
    for (let cy = sStartCy; cy <= sEndCy; cy++) {
      const h1 = cellHash(cx, cy);
      // Casi un tercio de las celdas se saltea del todo: si TODAS tuvieran
      // mota, se notaría como otra grilla regular (el mismo problema que ya
      // tuvo la nieve), y acá no hace falta cobertura completa.
      if (h1 < 0.32) continue;
      const h2 = cellHash(cx + 15.3, cy - 8.7);
      const h3 = cellHash(cx - 22.1, cy + 4.4);
      const px = cx * SPECK_TILE + h2 * SPECK_TILE - cam.x;
      const py = cy * SPECK_TILE + h3 * SPECK_TILE - cam.y;
      ctx.fillStyle = speckTones[Math.floor(h1 * speckTones.length) % speckTones.length];
      ctx.beginPath();
      ctx.ellipse(px, py, 1.4 + h2 * 1.2, 0.8 + h3 * 0.6, h2 * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawSnowGround(ctx, cam, canvas.width, canvas.height);
}

export function drawGrassDecor(ctx, cam, viewW, viewH) {
  for (const g of state.grassDecor) {
    const sx = g.x - cam.x;
    const sy = g.y - cam.y;
    if (sx < -20 || sx > viewW + 20 || sy < -20 || sy > viewH + 20) continue;
    const sway = Math.sin(state.elapsed * 1.6 + g.x * 0.02) * 3;
    ctx.strokeStyle = g.s > 0.9 ? 'rgba(140,175,110,0.55)' : 'rgba(95,130,80,0.5)';
    ctx.lineWidth = 1.6 * g.s;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(g.rot);
    for (const off of [-2, 0, 2]) {
      ctx.beginPath();
      ctx.moveTo(off * g.s, 0);
      ctx.quadraticCurveTo(off * g.s + sway * 0.3, -5 * g.s, off * g.s + sway, -9 * g.s);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ---------- Manchas de sangre ----------
// Se generan cuando el jugador o un animal reciben daño (ver hitDeer en
// animals.js, tryAttack en player.js y el mordisco del lobo en enemies.js).
// No están atadas a chunks: son puramente decorativas, se van desvaneciendo
// solas y se descartan por completo al reiniciar el mundo.
const BLOOD_MAX = 220;

function makeDrop(x, y) {
  const life = rand(30, 48);
  return {
    x, y,
    r: rand(2, 4.5),
    squash: rand(0.55, 0.9),
    rot: rand(0, Math.PI * 2),
    life,
    maxLife: life
  };
}

// amount = cuántas gotitas sueltas alrededor del punto de impacto (más para
// una muerte, menos para un golpe que solo hiere).
export function spawnBlood(x, y, amount = 3) {
  for (let i = 0; i < amount; i++) {
    state.bloodDecals.push(makeDrop(x + rand(-9, 9), y + rand(-5, 10)));
  }
  // Cap simple para que una partida larga con muchas peleas no acumule
  // manchas sin límite: se descartan primero las más viejas.
  if (state.bloodDecals.length > BLOOD_MAX) {
    state.bloodDecals.splice(0, state.bloodDecals.length - BLOOD_MAX);
  }
}

// Llamado una vez por frame desde update() en game.js. Las manchas se van
// desvaneciendo (ver alpha en drawBloodDecals) y desaparecen del todo cuando
// su vida llega a 0.
export function updateBloodDecals(dt) {
  for (let i = state.bloodDecals.length - 1; i >= 0; i--) {
    const b = state.bloodDecals[i];
    b.life -= dt;
    if (b.life <= 0) state.bloodDecals.splice(i, 1);
  }
}

export function drawBloodDecals(ctx, cam, viewW, viewH) {
  for (const b of state.bloodDecals) {
    const sx = b.x - cam.x;
    const sy = b.y - cam.y;
    if (sx < -20 || sx > viewW + 20 || sy < -20 || sy > viewH + 20) continue;
    // Se desvanece en el último tercio de vida en vez de cortar en seco.
    const fade = clamp(b.life / (b.maxLife * 0.4), 0, 1);
    const alpha = 0.5 * fade;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(b.rot);
    ctx.fillStyle = `rgba(96,10,10,${alpha})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, b.r, b.r * b.squash, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(140,20,18,${alpha * 0.6})`;
    ctx.beginPath();
    ctx.ellipse(-b.r * 0.2, -b.r * 0.2, b.r * 0.4, b.r * 0.4 * b.squash, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ---------- Cadáveres ----------
// A diferencia de las manchas de sangre/ondas de arriba, un cadáver NO es
// decorativo ni se desvanece solo: queda tirado hasta que el jugador lo
// desuella (ver harvestCorpse en inventory.js) y junta los huesos. Tampoco
// está atado a un chunk (no hace falta streaming para algo tan acotado), así
// que sobrevive sin problema a que esa zona se descargue y se vuelva a
// cargar. `spawnCorpse` es lo único que lo crea, llamado desde tryAttack en
// player.js (lobo) y hitDeer en animals.js (ciervo) en el momento en que la
// vida del animal llega a 0, en vez de borrarlo del todo con removeEntity.
const MAX_CORPSES = 24;

// kind: 'wolf' | 'deer'. `variant` es la misma paleta de color que ya tenía
// el animal vivo (ver WOLF_VARIANTS/DEER_VARIANTS): así el cadáver se ve
// como "ese" lobo/ciervo puntual y no un genérico gris para todos.
export function spawnCorpse(x, y, kind, variant) {
  state.corpses.push({ x, y, kind, variant: variant || 0, stage: 'fresh' });
  // Cap simple, mismo criterio que blood/rippleDecals: si se pasa el
  // límite, se descarta el más viejo primero. En la práctica casi no debería
  // dispararse (24 cadáveres sin desollar a la vez es mucha cacería
  // acumulada), pero evita que una partida rarísima crezca sin techo.
  if (state.corpses.length > MAX_CORPSES) {
    state.corpses.splice(0, state.corpses.length - MAX_CORPSES);
  }
}

// ---------- Ítems tirados al suelo ----------
// Igual criterio que MAX_CORPSES arriba: tope simple para que una partida
// muy larga tirando cosas no acumule entidades sin techo.
const MAX_GROUND_ITEMS = 40;

// Llamado desde dropItem() en inventory.js. Un pequeño offset aleatorio
// (en vez de la posición exacta del jugador) evita que tirar varias cosas
// seguidas las apile todas exactamente superpuestas. `durability` es
// opcional (undefined para ítems sin desgaste, ver ITEMS en config.js) y
// viaja con el ítem para que recogerlo no lo "repare" gratis.
export function spawnGroundItem(x, y, id, qty, durability) {
  const entry = { x: x + rand(-10, 10), y: y + rand(-10, 10), id, qty };
  if (typeof durability === 'number') entry.durability = durability;
  state.groundItems.push(entry);
  if (state.groundItems.length > MAX_GROUND_ITEMS) {
    state.groundItems.splice(0, state.groundItems.length - MAX_GROUND_ITEMS);
  }
}

// Cache de <img> para poder dibujar el ícono real de cada ítem en el mundo
// (canvas), reusando los mismos PNG que ya se cargan como <img> en la UI
// (ver ITEMS[id].image en config.js). Un ítem sin `image` (herramientas
// viejas sin sprite, si las hubiera) simplemente no dibuja nada hasta que
// se le agregue una.
const groundIconCache = {};
function getGroundIcon(path) {
  let img = groundIconCache[path];
  if (!img) {
    img = new Image();
    img.src = path;
    groundIconCache[path] = img;
  }
  return img;
}

// Mismo criterio de color que devuelven WOLF_PALETTES/DEER_PALETTES, pero
// apagado (más gris, menos saturado) para que se lea como un cuerpo sin
// vida y no como el animal parado. No se importa directamente de
// animals.js/enemies.js para no crear un import circular (esos dos módulos
// ya importan DE world.js); en cambio esta es una paleta chica, propia,
// pensada solo para el cadáver.
const CORPSE_PALETTES = {
  wolf: [
    { fur: '#5c5b52', belly: '#7a786c' },
    { fur: '#3c332a', belly: '#544940' },
    { fur: '#948e7c', belly: '#b0aa96' }
  ],
  deer: [
    { fur: '#8a6d4c', belly: '#a68a63' },
    { fur: '#6e5236', belly: '#8a6c48' },
    { fur: '#a3855c', belly: '#c0a378' }
  ],
  rabbit: [
    { fur: '#8a8072', belly: '#a89c8c' },
    { fur: '#5c4632', belly: '#7a604a' }
  ],
  bear: [
    { fur: '#5c4126', belly: '#7a5c3a' },
    { fur: '#d8d4c4', belly: '#eeece0' }
  ]
};

export function drawCorpse(c, cam, ctx) {
  const sx = c.x - cam.x;
  const sy = c.y - cam.y;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(sx, sy + 4, 16, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  if (c.stage === 'bones') {
    // Segunda etapa: ya se sacó carne y piel, solo queda un montoncito de
    // huesos cruzados a la espera de que los junten.
    ctx.strokeStyle = '#e8e2d0';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    [[-8, -3, 7, 3], [-7, 4, 8, -4], [-2, -6, 3, 6]].forEach(([x1, y1, x2, y2]) => {
      ctx.beginPath();
      ctx.moveTo(sx + x1, sy + y1);
      ctx.lineTo(sx + x2, sy + y2);
      ctx.stroke();
    });
    ctx.fillStyle = '#d8d0ba';
    [[-8, -3], [7, 3], [-7, 4], [8, -4], [-2, -6], [3, 6]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.ellipse(sx + x, sy + y, 2, 1.4, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    return;
  }

  // Primera etapa: el animal entero, tirado de costado (silueta echada, no
  // parada) — un óvalo de cuerpo apoyado + cabeza caída al ras del piso, en
  // vez de reusar la pose de pie de drawWolf/drawDeer.
  const pal = (CORPSE_PALETTES[c.kind] || CORPSE_PALETTES.wolf)[c.variant] || CORPSE_PALETTES.wolf[0];
  const big = c.kind === 'bear' ? 2 : (c.kind === 'deer' ? 1 : 0);
  const small = c.kind === 'rabbit';
  const bodyRx = big === 2 ? 19 : (big === 1 ? 15 : (small ? 8 : 12)), bodyRy = big === 2 ? 11 : (big === 1 ? 8 : (small ? 5 : 7));
  ctx.fillStyle = pal.fur;
  ctx.beginPath();
  ctx.ellipse(sx, sy, bodyRx, bodyRy, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pal.belly;
  ctx.beginPath();
  ctx.ellipse(sx - 1, sy + bodyRy * 0.35, bodyRx * 0.7, bodyRy * 0.45, 0.15, 0, Math.PI * 2);
  ctx.fill();
  // Cabeza apoyada, caída hacia un costado.
  ctx.fillStyle = pal.fur;
  ctx.beginPath();
  ctx.ellipse(sx + bodyRx * 0.85, sy + 2, big === 2 ? 7.5 : (big ? 6 : 5), big === 2 ? 5.5 : (big ? 4 : 3.5), 0.5, 0, Math.PI * 2);
  ctx.fill();
  // Ojo cerrado: una rayita, no un puntito, para que se note que no está
  // parado/alerta.
  ctx.strokeStyle = 'rgba(20,15,10,0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx + bodyRx * 0.85 - 2, sy + 1);
  ctx.lineTo(sx + bodyRx * 0.85 + 2, sy + 2);
  ctx.stroke();
  // Patas caídas, sin flexión (a diferencia de las patas del animal vivo).
  ctx.strokeStyle = pal.belly;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  [-1, 1].forEach(side => {
    ctx.beginPath();
    ctx.moveTo(sx - bodyRx * 0.3, sy + bodyRy * 0.5 * side);
    ctx.lineTo(sx - bodyRx * 0.9, sy + (bodyRy * 0.5 + 4) * side);
    ctx.stroke();
  });
}

// Ítem tirado al suelo (ver spawnGroundItem arriba / dropItem en
// inventory.js): sombra + el ícono real del ítem (mismo PNG que la UI) +
// un numerito si hay más de 1. Si el ícono todavía no terminó de cargar
// (primer frame en que aparece), se dibuja solo la sombra ese frame nomás;
// no hace falta esperar nada especial, el próximo frame ya lo encuentra
// cacheado y completo.
export function drawGroundItem(g, cam, ctx) {
  const sx = g.x - cam.x;
  const sy = g.y - cam.y;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(sx, sy + 5, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  const info = ITEMS[g.id];
  if (info && info.image) {
    const img = getGroundIcon(info.image);
    if (img.complete && img.naturalWidth > 0) {
      const w = 18, h = 18 * (img.naturalHeight / img.naturalWidth);
      ctx.drawImage(img, sx - w / 2, sy - h / 2, w, h);
    }
  }
  if (g.qty > 1) {
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 3;
    ctx.strokeText(String(g.qty), sx + 7, sy + 10);
    ctx.fillText(String(g.qty), sx + 7, sy + 10);
  }
}

// Devuelve true si (x,y) cae dentro del óvalo de una laguna (no del halo de
// orilla, la forma real de agua). Vive acá (junto con el resto de la lógica
// de lagunas) porque tanto el jugador (updatePlayer, para frenarlo al vadear)
// como los animales (updateDeer/updateWolves, para las ondas al cruzar el
// agua) la necesitan.
export function isInWater(x, y) {
  return state.ponds.some(p => {
    // Congelada en el bioma de nieve: es hielo sólido, no agua — se camina
    // encima normal, sin frenar ni dejar ondas (ver maybeSpawnWaterRipple).
    if (isSnowBiome(p.x, p.y)) return false;
    const dx = (x - p.x) / p.rw;
    const dy = (y - p.y) / p.rh;
    return dx * dx + dy * dy < 1;
  });
}

// Genera una onda si (x,y) está en el agua, con una cadencia propia por
// entidad (guardada en entity._rippleTimer) independiente de cualquier
// timer de sonido/pasos que ya tenga esa entidad. Así cubre parejo tanto al
// jugador como a ciervos/lobos sin duplicar esta lógica en cada uno.
export function maybeSpawnWaterRipple(entity, dt) {
  if (!isInWater(entity.x, entity.y)) {
    entity._rippleTimer = 0;
    return;
  }
  entity._rippleTimer = (entity._rippleTimer || 0) - dt;
  if (entity._rippleTimer <= 0) {
    spawnRipple(entity.x, entity.y + 6);
    entity._rippleTimer = 0.32;
  }
}

// ---------- Ondas al vadear el agua ----------
// Se generan cuando el jugador camina dentro de una laguna (ver isInWater
// y el cadenciador de footstep en updatePlayer, en player.js: usa el mismo
// timer que ya dispara el sonido de chapoteo, así el anillo aparece
// exactamente en cada "paso" dentro del agua). Mismo patrón que las
// manchas de sangre de arriba: no atadas a chunks, se desvanecen solas y
// no se persisten al guardar.
const RIPPLE_MAX = 40;

function makeRipple(x, y) {
  const life = rand(0.5, 0.7);
  return { x, y, life, maxLife: life, maxR: rand(13, 19) };
}

// Un anillo por paso dentro del agua; lo llama updatePlayer() en player.js.
export function spawnRipple(x, y) {
  state.rippleDecals.push(makeRipple(x, y));
  if (state.rippleDecals.length > RIPPLE_MAX) {
    state.rippleDecals.splice(0, state.rippleDecals.length - RIPPLE_MAX);
  }
}

export function updateRippleDecals(dt) {
  for (let i = state.rippleDecals.length - 1; i >= 0; i--) {
    const r = state.rippleDecals[i];
    r.life -= dt;
    if (r.life <= 0) state.rippleDecals.splice(i, 1);
  }
}

// Se dibuja DESPUÉS de drawPonds (ver render.js) para que el anillo quede
// sobre la superficie del agua y no debajo, a diferencia de drawBloodDecals
// que va antes (esas sí van "en el pasto", debajo de todo).
export function drawRippleDecals(ctx, cam, viewW, viewH) {
  for (const r of state.rippleDecals) {
    const sx = r.x - cam.x;
    const sy = r.y - cam.y;
    if (sx < -30 || sx > viewW + 30 || sy < -30 || sy > viewH + 30) continue;
    // El anillo crece y se desvanece a la vez: chico y opaco al nacer,
    // grande y transparente justo antes de desaparecer.
    const t = 1 - r.life / r.maxLife;
    const radius = r.maxR * t;
    const alpha = 0.55 * (1 - t);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(1, 0.5); // achatado, misma perspectiva top-down que el óvalo de la laguna
    ctx.strokeStyle = `rgba(214,232,236,${alpha})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

export function drawPonds(ctx, cam, viewW, viewH) {
  for (const p of state.ponds) {
    const sx = p.x - cam.x;
    const sy = p.y - cam.y;
    if (sx < -150 || sx > viewW + 150 || sy < -150 || sy > viewH + 150) continue;
    const frozen = isSnowBiome(p.x, p.y);

    // Orilla: halo de barro/pasto húmedo (agua normal) o de nieve amontonada
    // contra el borde del hielo (congelada) — incluso el halo cambia, no
    // solo el cuerpo de la laguna.
    const shoreG = ctx.createRadialGradient(sx, sy, Math.max(p.rw, p.rh) * 0.7, sx, sy, Math.max(p.rw, p.rh) * 1.25);
    if (frozen) {
      shoreG.addColorStop(0, 'rgba(226,236,240,0.55)');
      shoreG.addColorStop(1, 'rgba(226,236,240,0)');
    } else {
      shoreG.addColorStop(0, 'rgba(35,45,25,0.35)');
      shoreG.addColorStop(1, 'rgba(35,45,25,0)');
    }
    ctx.fillStyle = shoreG;
    ctx.beginPath();
    ctx.ellipse(sx, sy + 4, p.rw * 1.25, p.rh * 1.25, 0, 0, Math.PI * 2);
    ctx.fill();

    if (frozen) {
      // Hielo: chato y quieto (nada de shimmer ni ondas animadas, es sólido),
      // con un par de grietas fijas por laguna en vez de las franjas de olas.
      // El hash es el mismo truco determinístico que ya usa drawSnowGround
      // (misma laguna → misma forma de grietas siempre, no titila).
      ctx.fillStyle = 'rgba(10,18,20,0.28)';
      ctx.beginPath();
      ctx.ellipse(sx + 5, sy + 7, p.rw, p.rh, 0, 0, Math.PI * 2);
      ctx.fill();

      const iceG = ctx.createRadialGradient(sx - p.rw * 0.25, sy - p.rh * 0.25, 4, sx, sy, p.rw);
      iceG.addColorStop(0, '#eef6f8');
      iceG.addColorStop(0.6, '#bdd8de');
      iceG.addColorStop(1, '#8fadb6');
      ctx.fillStyle = iceG;
      ctx.beginPath();
      ctx.ellipse(sx, sy, p.rw, p.rh, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(sx, sy, p.rw, p.rh, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1.2;
      const h1 = cellHash(p.x, p.y), h2 = cellHash(p.x + 33.1, p.y - 12.4);
      for (let i = 0; i < 3; i++) {
        const a = (h1 + i * 0.71) * Math.PI * 2;
        const len = p.rw * (0.5 + cellHash(p.x + i * 7.3, p.y + i * 4.1) * 0.4);
        const cx0 = sx + (h2 - 0.5) * p.rw * 0.6;
        const cy0 = sy + (cellHash(p.y, p.x + i) - 0.5) * p.rh * 0.6;
        ctx.beginPath();
        ctx.moveTo(cx0 - Math.cos(a) * len * 0.5, cy0 - Math.sin(a) * len * 0.5);
        ctx.lineTo(cx0 + Math.cos(a) * len * 0.5, cy0 + Math.sin(a) * len * 0.5);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.ellipse(sx, sy, p.rw * 0.55, p.rh * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      continue;
    }

    ctx.fillStyle = 'rgba(15,22,16,0.35)';
    ctx.beginPath();
    ctx.ellipse(sx + 6, sy + 8, p.rw, p.rh, 0, 0, Math.PI * 2);
    ctx.fill();

    const wg = ctx.createRadialGradient(sx - p.rw * 0.2, sy - p.rh * 0.2, 4, sx, sy, p.rw);
    wg.addColorStop(0, '#6fb0c2');
    wg.addColorStop(0.6, '#3f7488');
    wg.addColorStop(1, '#22404e');
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.ellipse(sx, sy, p.rw, p.rh, 0, 0, Math.PI * 2);
    ctx.fill();

    // Reflejo/brillo que se mueve lentamente con el tiempo, y un par de
    // franjas de ondas para dar sensación de agua viva.
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(sx, sy, p.rw, p.rh, 0, 0, Math.PI * 2);
    ctx.clip();
    const shimmer = Math.sin(state.elapsed * 0.9) * p.rw * 0.18;
    const gloss = ctx.createRadialGradient(sx + shimmer, sy - p.rh * 0.3, 2, sx + shimmer, sy - p.rh * 0.3, p.rw * 0.5);
    gloss.addColorStop(0, 'rgba(255,255,255,0.35)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gloss;
    ctx.beginPath();
    ctx.ellipse(sx + shimmer, sy - p.rh * 0.3, p.rw * 0.5, p.rh * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 2; i++) {
      const wy = sy - p.rh * 0.2 + i * p.rh * 0.5 + Math.sin(state.elapsed * 1.3 + i) * 3;
      ctx.beginPath();
      ctx.moveTo(sx - p.rw * 0.6, wy);
      ctx.quadraticCurveTo(sx, wy + 4, sx + p.rw * 0.6, wy);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// Paletas de árbol (ver TREE_VARIANTS en generateChunk, más arriba): cada
// una define el degradé del tronco (3 paradas) y el degradé de cada copa de
// follaje (3 paradas: luz/medio/sombra). El índice de `t.variant` elige cuál
// usar; se sortea una sola vez por árbol al generarlo, así que un mismo
// árbol nunca cambia de paleta entre frames.
const TREE_PALETTES = [
  { trunk: ['#3a2a1c', '#5a4530', '#3a2a1c'], leaf: ['#4f7a42', '#33532c', '#22391e'] }, // pino de bosque (original)
  { trunk: ['#4a3826', '#6d5236', '#4a3826'], leaf: ['#6e9750', '#4c7539', '#345423'] }, // álamo/verde claro
  { trunk: ['#4c3220', '#70502f', '#4c3220'], leaf: ['#af7d3c', '#8c5c26', '#6b4318'] }  // otoñal
];

export function drawTree(t, cam, ctx) {
  const sx = t.x - cam.x;
  const sy = t.y - cam.y;
  const s = t.size;
  const wind = Math.sin(state.elapsed * 0.9 + t.sway) * 3.5 * s;
  const pal = TREE_PALETTES[t.variant || 0] || TREE_PALETTES[0];
  const shape = t.shape || 0;
  // Cada silueta ajusta alto/ancho de tronco y armado del follaje; el color
  // (pal) es independiente y se aplica igual sobre cualquiera de las tres.
  const trunkH = shape === 1 ? 30 * s : shape === 2 ? 20 * s : 26 * s;
  const trunkTopY = shape === 1 ? -8 * s : shape === 2 ? -3 * s : -6 * s;
  const canopyY = shape === 1 ? -16 * s : shape === 2 ? -16 * s : -22 * s;

  // Sombra proyectada, un poco alargada para dar sensación de altura.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(sx + 4, sy + 6, (shape === 2 ? 23 : 19) * s, 7 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tronco con luz lateral (gradiente) y un par de líneas de corteza.
  const trunkG = ctx.createLinearGradient(sx - 4 * s, 0, sx + 4 * s, 0);
  trunkG.addColorStop(0, pal.trunk[0]);
  trunkG.addColorStop(0.5, pal.trunk[1]);
  trunkG.addColorStop(1, pal.trunk[2]);
  ctx.fillStyle = trunkG;
  ctx.fillRect(sx - 4 * s, sy + trunkTopY, 8 * s, trunkH);
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx - 1.5 * s, sy + trunkTopY + 1 * s);
  ctx.lineTo(sx - 1.5 * s, sy + trunkTopY + trunkH - 6 * s);
  ctx.stroke();

  // Follaje: la silueta cambia según `shape`, el degradé de color según `pal`.
  ctx.save();
  ctx.translate(sx, sy + canopyY);
  ctx.rotate(wind * 0.01);

  const leafFill = (bx, by, r) => {
    const fg = ctx.createRadialGradient(bx - r * 0.35, by - r * 0.35, r * 0.15, bx, by, r);
    fg.addColorStop(0, pal.leaf[0]);
    fg.addColorStop(0.55, pal.leaf[1]);
    fg.addColorStop(1, pal.leaf[2]);
    return fg;
  };

  if (shape === 1) {
    // Conífera: pino alto y angosto, tres capas triangulares apiladas con
    // bastante superposición entre sí (y con el tronco) para que no quede
    // ningún hueco entre niveles ni un espacio flotando sobre el tronco.
    const tiers = [
      { apex: -6 * s, base: 12 * s, halfW: 15 * s },   // capa de abajo, la más ancha, se mete sobre el tronco
      { apex: -20 * s, base: -4 * s, halfW: 11 * s },  // capa del medio
      { apex: -34 * s, base: -16 * s, halfW: 7 * s }   // capa de arriba, la más angosta
    ];
    for (const tier of tiers) {
      const bx = wind;
      ctx.fillStyle = leafFill(bx, (tier.apex + tier.base) / 2, tier.halfW * 1.15);
      ctx.beginPath();
      ctx.moveTo(bx, tier.apex);
      ctx.lineTo(bx - tier.halfW, tier.base);
      ctx.lineTo(bx + tier.halfW, tier.base);
      ctx.closePath();
      ctx.fill();
    }
  } else if (shape === 2) {
    // Copa ancha (roble/latifoliada): una copa grande y baja con dos lóbulos
    // laterales, más ancha que alta a diferencia de las otras dos.
    const blobs = [
      { x: 0, y: 4 * s, r: 24 * s },
      { x: -18 * s, y: 2 * s, r: 15 * s },
      { x: 18 * s, y: 2 * s, r: 15 * s },
      { x: 0, y: -10 * s, r: 14 * s }
    ];
    for (const bl of blobs) {
      const bx = bl.x + wind;
      ctx.fillStyle = leafFill(bx, bl.y, bl.r);
      ctx.beginPath();
      ctx.arc(bx, bl.y, bl.r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Original: copa redonda de bosque, cuatro blobs superpuestos.
    const blobs = [
      { x: 0, y: 2 * s, r: 22 * s },
      { x: -12 * s, y: -6 * s, r: 16 * s },
      { x: 13 * s, y: -4 * s, r: 15 * s },
      { x: 2 * s, y: -16 * s, r: 13 * s }
    ];
    for (const bl of blobs) {
      const bx = bl.x + wind;
      ctx.fillStyle = leafFill(bx, bl.y, bl.r);
      ctx.beginPath();
      ctx.arc(bx, bl.y, bl.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Dusting de nieve sobre la copa: no es un campo guardado en el árbol, se
  // decide en el momento a partir de su posición (mismo criterio que ya
  // usa el musgo de las rocas más abajo) — así que un árbol "sabe" si está
  // nevado sin que generateChunk tenga que marcarlo de antemano.
  if (isSnowBiome(t.x, t.y)) {
    ctx.save();
    ctx.translate(sx, sy + canopyY);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.ellipse(wind * 0.4, -6 * s, 13 * s, 5.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(wind * 0.5 - 9 * s, 1 * s, 7 * s, 3.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(wind * 0.3 + 9 * s, -1 * s, 6 * s, 3 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (t.hits < t.maxHits) {
    ctx.strokeStyle = 'rgba(203,216,195,0.5)';
    ctx.strokeRect(sx - 16, sy - 40, 32 * (t.hits / t.maxHits), 4);
  }
}

// Color único de roca: ya no varía por instancia (antes tenía 3 paletas,
// ahora todas usan esta). La variedad visual entre rocas viene de la forma
// (ver ROCK_SHAPES en generateChunk y `shape` más abajo), no del color.
const ROCK_PALETTE = ['#98978c', '#75746a', '#4c4b44'];

// Siluetas de roca: cada una define el polígono principal, un polígono de
// brillo más chico (la cara que pega la luz) y el semieje del óvalo de
// sombra proyectada. `shape` elige cuál usar; se sortea una sola vez por
// roca al generarla.
function rockShapePoints(shape, s) {
  if (shape === 1) {
    // Roca redondeada, en forma de bulto (más puntos = silueta más curva),
    // baja y compacta, sin ningún pico hacia arriba.
    return {
      body: [[-12, 7], [-13, -2], [-7, -9], [2, -11], [9, -7], [13, -1], [10, 7], [2, 10], [-5, 10]],
      highlight: [[-7, -9], [2, -11], [-2, -3]],
      shadowRx: 15, shadowRy: 6
    };
  }
  if (shape === 2) {
    // Roca plana y ancha.
    return {
      body: [[-18, 6], [-14, -4], [-2, -9], [10, -7], [18, 2], [12, 9], [-6, 10]],
      highlight: [[-14, -4], [-2, -9], [4, -3]],
      shadowRx: 19, shadowRy: 6
    };
  }
  // Original: bloque angular de tamaño medio.
  return {
    body: [[-14, 4], [-8, -10], [4, -14], [14, -2], [8, 8]],
    highlight: [[-8, -10], [4, -14], [-2, -4]],
    shadowRx: 16, shadowRy: 6
  };
}

export function drawRock(r, cam, ctx) {
  const sx = r.x - cam.x;
  const sy = r.y - cam.y;
  const s = r.size;
  const shp = rockShapePoints(r.shape || 0, s);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(sx + 2, sy + 6, shp.shadowRx * s, shp.shadowRy * s, 0, 0, Math.PI * 2);
  ctx.fill();

  const rg = ctx.createLinearGradient(sx - 14 * s, sy - 14 * s, sx + 10 * s, sy + 8 * s);
  rg.addColorStop(0, ROCK_PALETTE[0]);
  rg.addColorStop(0.5, ROCK_PALETTE[1]);
  rg.addColorStop(1, ROCK_PALETTE[2]);
  ctx.fillStyle = rg;
  ctx.beginPath();
  shp.body.forEach(([px, py], i) => {
    const fn = i === 0 ? 'moveTo' : 'lineTo';
    ctx[fn](sx + px * s, sy + py * s);
  });
  ctx.closePath();
  ctx.fill();

  // Líneas de fractura sutiles.
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx - 6 * s, sy - 4 * s);
  ctx.lineTo(sx + 2 * s, sy + 3 * s);
  ctx.moveTo(sx - 1 * s, sy - 9 * s);
  ctx.lineTo(sx + 5 * s, sy - 3 * s);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  shp.highlight.forEach(([px, py], i) => {
    const fn = i === 0 ? 'moveTo' : 'lineTo';
    ctx[fn](sx + px * s, sy + py * s);
  });
  ctx.closePath();
  ctx.fill();

  // Musgo: solo en algunas rocas (determinístico según su posición, no
  // cambia entre frames) y nunca en el bioma de nieve (no crece musgo con
  // este frío).
  if (!isSnowBiome(r.x, r.y) && ((r.x * 12.9898 + r.y * 78.233) % 1 + 1) % 1 > 0.6) {
    ctx.fillStyle = 'rgba(90,120,55,0.55)';
    ctx.beginPath();
    ctx.ellipse(sx - 6 * s, sy + 2 * s, 5 * s, 3 * s, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Nieve encima de la roca (misma idea que el dusting del árbol: se decide
  // en el momento según la posición, no es un campo guardado).
  if (isSnowBiome(r.x, r.y)) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.ellipse(sx - 3 * s, sy - 9 * s, 9 * s, 4 * s, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(sx + 5 * s, sy - 4 * s, 5 * s, 2.5 * s, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Palo suelto en el piso: recolectable a mano, sin necesitar ninguna herramienta.
export function drawStick(s, cam, ctx) {
  const sx = s.x - cam.x;
  const sy = s.y - cam.y;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(s.rot);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(0, 3, 11, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  const stickG = ctx.createLinearGradient(-9, 0, 9, 0);
  stickG.addColorStop(0, '#3a2a1c');
  stickG.addColorStop(0.5, '#6c5238');
  stickG.addColorStop(1, '#3a2a1c');
  ctx.strokeStyle = stickG;
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-9, 0);
  ctx.lineTo(9, 0);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-4, -1);
  ctx.lineTo(2, 1);
  ctx.stroke();
  ctx.restore();
}

// Piedra suelta en el piso: recolectable a mano, sin necesitar ninguna herramienta.
export function drawStone(s, cam, ctx) {
  const sx = s.x - cam.x;
  const sy = s.y - cam.y;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(sx, sy + 3, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(s.rot);
  const rg = ctx.createLinearGradient(-6, -5, 5, 4);
  rg.addColorStop(0, '#98978c');
  rg.addColorStop(0.5, '#75746a');
  rg.addColorStop(1, '#4c4b44');
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.moveTo(-6, 2);
  ctx.lineTo(-3, -4);
  ctx.lineTo(3, -5);
  ctx.lineTo(6, 0);
  ctx.lineTo(2, 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.moveTo(-3, -4);
  ctx.lineTo(3, -5);
  ctx.lineTo(0, -1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Paletas de arbusto (ver BUSH_VARIANTS en generateChunk): verde de bosque
// (original) y un tono más seco/amarillento para dar variedad de matorral.
const BUSH_PALETTES = [
  ['#4d6d3f', '#2c4225'],
  ['#6b7a3a', '#404f1e']
];

export function drawBush(b, cam, ctx) {
  const sx = b.x - cam.x;
  const sy = b.y - cam.y;
  const s = b.size;
  const pal = BUSH_PALETTES[b.variant || 0] || BUSH_PALETTES[0];
  const wind = Math.sin(state.elapsed * 1.4 + b.x * 0.05) * 1.4;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(sx, sy + 5, 14 * s, 6 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  [[0, 0], [-8, 3], [8, 3]].forEach(([ox, oy], i) => {
    const bx = sx + ox * s + wind * (i === 0 ? 0.4 : 1);
    const by = sy + oy * s - 6 * s;
    const r = 10 * s;
    const bg = ctx.createRadialGradient(bx - r * 0.3, by - r * 0.3, r * 0.1, bx, by, r);
    bg.addColorStop(0, pal[0]);
    bg.addColorStop(1, pal[1]);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
  });
  if (b.stock > 0) {
    for (let i = 0; i < b.stock; i++) {
      const berryX = sx - 6 * s + i * 6 * s + wind * 0.6;
      const berryY = sy - 8 * s;
      ctx.fillStyle = '#8f281f';
      ctx.beginPath();
      ctx.arc(berryX, berryY, 2.4 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,200,180,0.6)';
      ctx.beginPath();
      ctx.arc(berryX - 0.7 * s, berryY - 0.7 * s, 0.8 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
