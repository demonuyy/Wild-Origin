export const DAY_LENGTH = 130;
export const BASE_CAP = 30;
export const BACKPACK_BONUS = 30;
// Cuánto se apila cada material/baya en un slot del inventario. Las
// herramientas nunca se apilan (siempre ocupan 1 slot entero).
export const STACK_SIZE = 25;

// Tamaño de cada "chunk" del mundo infinito (en unidades de mundo, como bloques de Minecraft
// pero mucho más grandes ya que acá no hay grilla de tiles). El mundo se genera y descarga
// en pedazos de este tamaño a medida que el jugador se mueve.
export const CHUNK_SIZE = 700;

// Límites del zoom de cámara (rueda del mouse). >1 acerca la vista, <1 la aleja.
export const ZOOM_MIN = 0.8;
export const ZOOM_MAX = 2.6;
export const ZOOM_DEFAULT = 1.6;

// Guardado con `typeof document !== 'undefined'` para que este módulo se
// pueda importar también desde Node (tests unitarios de crafting/inventory,
// que no tocan el canvas) sin necesitar un navegador real. En el navegador
// el comportamiento es exactamente el mismo de siempre.
export const canvas = typeof document !== 'undefined' ? document.getElementById('game') : null;
export const ctx = canvas ? canvas.getContext('2d') : null;

export const state = {
  running: false,
  gameOver: false,
  paused: false,
  elapsed: 0,
  dayCounter: 1,
  lastTime: performance.now(),
  keys: {},
  // Semilla del mundo actual: define de forma determinística qué genera cada chunk.
  worldSeed: 0,
  // Chunks actualmente cargados (Set de claves "cx,cy") y su contenido guardado
  // (para que un chunk descargado, al volver a visitarlo, no se regenere de cero).
  loadedChunks: new Set(),
  chunkStore: {},
  // Tipos de objeto ('tree', 'rock', 'bush', etc.) con los que el jugador ya
  // interactuó al menos una vez en esta partida. Se usa para dejar de mostrar
  // el cartel contextual ("Talar (E)") una vez que ya se aprendió la mecánica.
  discoveredActions: new Set(),
  zoom: ZOOM_DEFAULT,
  targetZoom: ZOOM_DEFAULT,
  trees: [],
  rocks: [],
  bushes: [],
  ponds: [],
  campfires: [],
  shelters: [],
  wolves: [],
  deer: [],
  grassDecor: [],
  // Manchas de sangre en el suelo (jugador o animal golpeado). No están
  // atadas a chunks como grassDecor: son efímeras (se van desvaneciendo
  // solas con updateBloodDecals) y no hace falta persistirlas al guardar.
  bloodDecals: [],
  // Palos y piedras sueltos, recolectables a mano sin ninguna herramienta.
  // Son el único recurso disponible hasta craftear hacha/pico, ya que talar
  // árboles y minar rocas requiere tener esa herramienta en la mano.
  sticks: [],
  stones: [],
  player: {
    x: 0,
    y: 0,
    dir: { x: 0, y: 1 },
    speed: 165,
    sprintMult: 1.7,
    health: 100,
    hunger: 100,
    thirst: 100,
    stamina: 100,
    wood: 0,
    stone: 0,
    berries: 0,
    hasSpear: false,
    hasAxe: false,
    hasPickaxe: false,
    hasBackpack: false,
    // Herramienta actualmente "en la mano" (null, 'axe' o 'pickaxe'). Tenerla
    // en la mano (no solo poseerla) es lo que habilita talar/minar.
    equippedTool: null,
    attackRange: 34,
    attackDamage: 12,
    attackCooldown: 0,
    hitFlash: 0,
    radius: 14
  }
};

export function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

export function rand(a, b) {
  return a + Math.random() * (b - a);
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function capFor() {
  return BASE_CAP + (state.player.hasBackpack ? BACKPACK_BONUS : 0);
}

export function invTotal() {
  return state.player.wood + state.player.stone + state.player.berries;
}

export function isNightPhase(phase) {
  return phase > 0.58 && phase < 0.97;
}

if (typeof window !== 'undefined' && canvas) {
  window.addEventListener('resize', resize);
  resize();
}
