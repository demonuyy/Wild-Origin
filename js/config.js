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

// Cantidad de casillas de la hotbar real (ver player.hotbar más abajo).
export const HOTBAR_SIZE = 6;

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
// `image`: ruta al ícono real del ítem (assets/images/items/). Se usa en vez
// del emoji de `icon` en toda la UI (hotbar, inventario, menú de crafteo);
// `icon` se conserva como fallback/alt por si a algún ítem futuro todavía no
// se le sumó el arte.
const IMG_BASE = 'assets/images/items/';
// `durability`: usos antes de romperse (ver damageTool en este archivo).
// Solo la tienen las herramientas que se USAN activamente (golpear con la
// lanza, talar con el hacha, minar con el pico); la mochila es pasiva y no
// se gasta, así que no tiene este campo.
export const ITEMS = {
  wood: { label: 'Madera', icon: '🌲', image: IMG_BASE + 'wood.png', stack: STACK_SIZE, category: 'resource' },
  stone: { label: 'Piedra', icon: '🪨', image: IMG_BASE + 'stone.png', stack: STACK_SIZE, category: 'resource' },
  // `hunger`: cuánta hambre restaura comer 1 unidad (ver consumeFood en
  // inventory.js). Ítems futuros de comida (v0.3+: carne cocida, etc.) solo
  // necesitan agregar su propio valor acá.
  berries: { label: 'Bayas', icon: '🍓', image: IMG_BASE + 'berries.png', stack: STACK_SIZE, category: 'food', hunger: 22 },
  spear: { label: 'Lanza', icon: '🔱', image: IMG_BASE + 'spear.png', stack: 1, category: 'tool', durability: 25 },
  axe: { label: 'Hacha', icon: '🪓', image: IMG_BASE + 'axe.png', stack: 1, category: 'tool', durability: 40 },
  pickaxe: { label: 'Pico', icon: '⛏️', image: IMG_BASE + 'pickaxe.png', stack: 1, category: 'tool', durability: 40 },
  backpack: { label: 'Mochila', icon: '🎒', image: IMG_BASE + 'backpack.png', stack: 1, category: 'tool' }
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
    // Hotbar real: HOTBAR_SIZE casillas, cada una null o un id de ITEMS que
    // el jugador ya posee. A diferencia de antes (6 acciones de crafteo fijas
    // hardcodeadas en el HTML), ahora solo puede haber acá ítems que el
    // jugador REALMENTE tiene, asignados a mano (arrastrando desde el
    // inventario) o automáticamente al craftear una herramienta nueva (ver
    // autoAssignHotbar). pruneHotbar() se encarga de vaciar una casilla si el
    // ítem que apuntaba se terminó (se craftea de nuevo, se come, etc.).
    hotbar: new Array(HOTBAR_SIZE).fill(null),
    // Posiciones FIJAS del panel de inventario: array indexado por slot,
    // cada posición vale el id de ITEMS que ocupa ese lugar exacto, o
    // null/undefined si está vacía. A diferencia del esquema viejo (una
    // lista de tipos que se reempaquetaba sola, sin huecos), acá cada
    // ítem se queda exactamente en el slot donde el jugador lo soltó,
    // dejando casillas vacías de por medio si así lo arrastró. Se
    // mantiene sincronizado con la cantidad real (state.player.inventory)
    // via syncInventorySlots(); moveInventorySlot() es lo único que
    // cambia una posición (arrastrar y soltar).
    invSlots: [],
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
  const isNew = !slot;
  if (slot) {
    slot.qty += qty;
  } else {
    const info = ITEMS[id];
    const entry = { id, qty };
    // Si el ítem tiene durability (lanza/hacha/pico), arranca al máximo.
    if (info && info.durability) entry.durability = info.durability;
    state.player.inventory.push(entry);
  }
  // Un ítem que el jugador no tenía todavía se asigna primero a la hotbar
  // (si queda alguna casilla libre) antes que nada más: son las casillas
  // que están siempre a la vista sin abrir el inventario, así que son las
  // primeras en llenarse. autoAssignHotbar ya no hace nada si la hotbar
  // está llena o el ítem ya estaba asignado (ver más abajo).
  if (isNew) autoAssignHotbar(id);
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

// ---------- Durabilidad de herramientas ----------
// Solo lanza/hacha/pico tienen `durability` en ITEMS (ver más arriba), así
// que solo ellas terminan con un campo `durability` en su slot de
// inventario (ver addItem). Como el juego nunca deja tener dos unidades de
// la misma herramienta a la vez (crafting.js: si ya la tenés, craftear la
// equipa en vez de duplicarla), no hace falta manejar varias instancias
// con desgaste independiente: hay un único slot por herramienta.
export function getDurability(id) {
  const slot = findSlot(id);
  return slot && typeof slot.durability === 'number' ? slot.durability : null;
}

export function maxDurability(id) {
  return (ITEMS[id] && ITEMS[id].durability) || null;
}

// Gasta `amount` usos de la herramienta (se llama después de un golpe que
// realmente conectó: talar, minar, o pegarle a algo con la lanza). Si llega
// a 0 se rompe: se saca del inventario entero (removeItem no alcanza
// porque no hay noción de "cantidad restante", es un objeto único que deja
// de existir) y se desequipa si la tenía puesta. pruneHotbar() (llamado en
// cada render de la hotbar) se encarga solo de vaciar la casilla que
// apuntaba a ella. Devuelve true si se rompió recién con este golpe, para
// que quien llama pueda avisarle al jugador con un mensaje distinto.
export function damageTool(id, amount = 1) {
  const slot = findSlot(id);
  if (!slot || typeof slot.durability !== 'number') return false;
  slot.durability = Math.max(0, slot.durability - amount);
  if (slot.durability <= 0) {
    state.player.inventory = state.player.inventory.filter(s => s !== slot);
    if (state.player.equippedTool === id) state.player.equippedTool = null;
    return true;
  }
  return false;
}

// Repara al máximo. Asume que quien llama (tryRepairTool en crafting.js) ya
// cobró el costo de reparación; acá solo se restaura el número.
export function repairTool(id) {
  const slot = findSlot(id);
  const max = maxDurability(id);
  if (!slot || !max) return;
  slot.durability = max;
}

// El inventario ya no tiene límite de capacidad: capFor() devuelve Infinity
// para que invTotal() >= capFor() nunca sea true (ver inventory.js). Se deja
// BASE_CAP/BACKPACK_BONUS declarados arriba (por si en el futuro se quiere
// volver a un límite) pero ya no se usan acá. El único límite real que queda
// es visual: cuántos slots entran en el panel de inventario (ver
// invSlotCount() en ui.js), que la mochila sigue agrandando.
export function capFor() {
  return Infinity;
}

// Solo cuenta ítems "pesados" (resource/food) contra la capacidad, igual que
// antes (las herramientas nunca ocuparon capacidad de inventario).
export function invTotal() {
  return state.player.inventory
    .filter(s => ITEMS[s.id] && ITEMS[s.id].category !== 'tool')
    .reduce((sum, s) => sum + s.qty, 0);
}

// ---------- Hotbar real (casillas asignables) ----------
// Único lugar donde se lee/escribe player.hotbar directamente, mismo
// criterio que addItem/removeItem para player.inventory.

// Vacía cualquier casilla cuyo ítem ya no se posea (se gastó, se craftea de
// nuevo desde cero, etc.). Se llama antes de cada render de la hotbar.
export function pruneHotbar() {
  state.player.hotbar = state.player.hotbar.map(id => (id && hasItem(id)) ? id : null);
}

// Asigna `id` a la casilla `index`. Si ese ítem ya estaba en otra casilla,
// la vieja queda vacía (un mismo ítem no puede estar duplicado en la
// hotbar, ya que la casilla apunta al TIPO de ítem, no a una unidad).
export function assignHotbar(index, id) {
  if (index < 0 || index >= state.player.hotbar.length) return;
  if (!hasItem(id)) return;
  const existing = state.player.hotbar.indexOf(id);
  if (existing !== -1) state.player.hotbar[existing] = null;
  state.player.hotbar[index] = id;
}

export function clearHotbarSlot(index) {
  if (index < 0 || index >= state.player.hotbar.length) return;
  state.player.hotbar[index] = null;
}

export function swapHotbarSlots(i, j) {
  if (i === j || i < 0 || j < 0 || i >= state.player.hotbar.length || j >= state.player.hotbar.length) return;
  const tmp = state.player.hotbar[i];
  state.player.hotbar[i] = state.player.hotbar[j];
  state.player.hotbar[j] = tmp;
}

// Se llama justo después de craftear una herramienta nueva (spear/axe/
// pickaxe/backpack en crafting.js) para que quede visible en la hotbar sin
// que el jugador tenga que arrastrarla a mano. Si ya está en la hotbar (por
// ejemplo se volvió a craftear) o no queda ninguna casilla libre, no hace
// nada.
export function autoAssignHotbar(id) {
  if (state.player.hotbar.includes(id)) return;
  const emptyIndex = state.player.hotbar.indexOf(null);
  if (emptyIndex !== -1) state.player.hotbar[emptyIndex] = id;
}

// ---------- Posiciones del panel de inventario ----------
// Cada posición de invSlots guarda { id, qty } (no solo el id): así dos
// casillas del MISMO ítem con cantidades distintas (ej. un stack de 25
// madera y otro de 3) son entidades separadas de verdad, y arrastrar una
// arriba de la otra las intercambia en vez de no hacer nada (ver
// moveInventorySlot). slotCount lo decide ui.js (invSlotCount(): 10 slots,
// 20 con mochila) y se le pasa acá para no importar ui.js desde config.js.
// Se llama cada vez que se arma la grilla (buildInventorySlots en ui.js),
// así que queda sincronizado con lo que el jugador realmente tiene:
//  - saca las casillas de cualquier id que ya no se posea (se gastó todo),
//  - si subió la cantidad de un id, primero RELLENA las casillas que ya
//    tenía asignadas y no estén al tope (respeta un stack partido a mano
//    en vez de juntarlo de nuevo) y recién si sobra abre casillas nuevas,
//  - si bajó la cantidad, descuenta empezando por la ÚLTIMA casilla
//    asignada (no toca la primera/principal mientras alcance con el resto).
// Ninguna posición ya ocupada que sigue haciendo falta se mueve de lugar:
// es lo que permite que un ítem se quede fijo donde el jugador lo dejó,
// con huecos vacíos de por medio si así lo arrastró.
export function syncInventorySlots(slotCount) {
  const slots = state.player.invSlots;
  while (slots.length < slotCount) slots.push(null);

  const owned = state.player.inventory.filter(s => s.qty > 0);
  const ownedIds = new Set(owned.map(s => s.id));
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] && !ownedIds.has(slots[i].id)) slots[i] = null;
  }

  for (const { id, qty: totalQty } of owned) {
    const info = ITEMS[id];
    const stackCap = info.category === 'tool' ? 1 : info.stack;
    const assigned = [];
    for (let i = 0; i < slots.length; i++) if (slots[i] && slots[i].id === id) assigned.push(i);
    const placedQty = assigned.reduce((sum, i) => sum + slots[i].qty, 0);
    let diff = totalQty - placedQty;

    if (diff > 0) {
      for (const i of assigned) {
        if (diff <= 0) break;
        const room = stackCap - slots[i].qty;
        if (room > 0) {
          const add = Math.min(room, diff);
          slots[i].qty += add;
          diff -= add;
        }
      }
      while (diff > 0) {
        const add = Math.min(stackCap, diff);
        const entry = { id, qty: add };
        const emptyIndex = slots.indexOf(null);
        if (emptyIndex !== -1) slots[emptyIndex] = entry; else slots.push(entry);
        diff -= add;
      }
    } else if (diff < 0) {
      let toRemove = -diff;
      for (let k = assigned.length - 1; k >= 0 && toRemove > 0; k--) {
        const i = assigned[k];
        const take = Math.min(slots[i].qty, toRemove);
        slots[i].qty -= take;
        toRemove -= take;
        if (slots[i].qty <= 0) slots[i] = null;
      }
    }
  }
}

// Mueve libremente lo que haya en `fromIndex` a `toIndex`: si el destino
// está vacío, el ítem queda exactamente ahí (y el origen pasa a estar
// vacío); si el destino tiene otro ítem (sea otro tipo, o el mismo tipo con
// otra cantidad, ej. 25 madera vs 3 madera), ambos intercambian posición
// tal cual estaban. Es el único lugar que escribe en invSlots a pedido del
// jugador (arrastrar y soltar en input.js).
export function moveInventorySlot(fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
  const slots = state.player.invSlots;
  while (slots.length <= Math.max(fromIndex, toIndex)) slots.push(null);
  const tmp = slots[fromIndex];
  slots[fromIndex] = slots[toIndex];
  slots[toIndex] = tmp;
}

export function isNightPhase(phase) {
  return phase > 0.58 && phase < 0.97;
}

if (typeof window !== 'undefined' && canvas) {
  window.addEventListener('resize', resize);
  resize();
}
