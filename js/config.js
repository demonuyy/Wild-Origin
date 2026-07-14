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

// Registro central de ítems. Antes cada material/herramienta vivía como un
// campo suelto en state.player (player.wood, player.hasAxe, etc.) repetido
// en crafting.js/inventory.js/ui.js/save.js. Ahora player.inventory es un
// array de slots { id, qty } y ESTE es el único lugar que describe cómo se
// llama, qué ícono tiene y cuánto se apila cada ítem. Agregar un ítem nuevo
// (carne, hierro, etc. del roadmap v0.3+) es agregar una entrada acá.
//
// category:
//  - 'resource' / 'food': se apilan hasta `stack` y cuentan para invTotal()/capFor().
//  - 'tool': nunca se apilan (stack: 1), no ocupan capacidad de inventario
//    (igual que antes: las herramientas nunca sumaban a invTotal()).
export const ITEMS = {
  wood: { label: 'Madera', icon: '🌲', stack: STACK_SIZE, category: 'resource' },
  stone: { label: 'Piedra', icon: '🪨', stack: STACK_SIZE, category: 'resource' },
  berries: { label: 'Bayas', icon: '🍓', stack: STACK_SIZE, category: 'food' },
  spear: { label: 'Lanza', icon: '🔱', stack: 1, category: 'tool' },
  axe: { label: 'Hacha', icon: '🪓', stack: 1, category: 'tool' },
  pickaxe: { label: 'Pico', icon: '⛏️', stack: 1, category: 'tool' },
  backpack: { label: 'Mochila', icon: '🎒', stack: 1, category: 'tool' }
};

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
  // Ondas al vadear una laguna, tanto del jugador como de los animales (ver
  // isInWater/maybeSpawnWaterRipple en world.js). Mismo criterio que
  // bloodDecals: efímeras, se desvanecen solas y no se persisten al guardar.
  rippleDecals: [],
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
    // Cooldown (en segundos) que arranca al llegar a 0 de energía: mientras
    // esté activo, no se puede volver a correr aunque la energía ya se haya
    // recuperado. Ver STAMINA_COOLDOWN en player.js.
    staminaCooldown: 0,
    // Se resetea a 4 cada vez que el jugador corre: mientras no llegue a 0,
    // la energía no se regenera (aunque ya se haya soltado shift/parado).
    staminaRegenDelay: 0,
    // Ítems reales: array de slots { id, qty }, ver ITEMS más arriba para
    // la metadata (label/icono/stack/categoría) de cada id posible. Antes
    // esto eran campos sueltos (wood/stone/berries/hasAxe/...); usar
    // addItem/removeItem/hasItem/countItem en vez de tocar este array a mano.
    inventory: [],
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

// ---------- Inventario genérico ----------
// Único lugar donde se lee/escribe player.inventory directamente; el resto
// del código (crafting.js, inventory.js, player.js, recipes.js, ui.js) usa
// estas funciones en vez de andar buscando el slot a mano.
function findSlot(id) {
  return state.player.inventory.find(s => s.id === id);
}

export function countItem(id) {
  const slot = findSlot(id);
  return slot ? slot.qty : 0;
}

export function hasItem(id) {
  return countItem(id) > 0;
}

export function addItem(id, qty) {
  if (qty <= 0) return;
  const slot = findSlot(id);
  if (slot) slot.qty += qty;
  else state.player.inventory.push({ id, qty });
}

export function removeItem(id, qty) {
  if (qty <= 0) return;
  const slot = findSlot(id);
  if (!slot) return;
  slot.qty -= qty;
  if (slot.qty <= 0) {
    state.player.inventory = state.player.inventory.filter(s => s !== slot);
  }
}

export function capFor() {
  return BASE_CAP + (hasItem('backpack') ? BACKPACK_BONUS : 0);
}

// Solo cuenta ítems "pesados" (resource/food) contra la capacidad, igual que
// antes (las herramientas nunca ocuparon capacidad de inventario).
export function invTotal() {
  return state.player.inventory
    .filter(s => ITEMS[s.id] && ITEMS[s.id].category !== 'tool')
    .reduce((sum, s) => sum + s.qty, 0);
}

export function isNightPhase(phase) {
  return phase > 0.58 && phase < 0.97;
}

if (typeof window !== 'undefined' && canvas) {
  window.addEventListener('resize', resize);
  resize();
}
