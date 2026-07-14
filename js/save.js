import { state } from './config.js';

// ---------- Slots, versionado y backup ----------
// Antes había un solo slot fijo bajo la clave 'wildOriginSave' y ningún
// campo de versión: si el juego cambiaba la forma de los datos (nuevos
// campos en state.player, por ejemplo), no había forma de distinguir un
// guardado viejo de uno nuevo ni de migrarlo. Tampoco había backup: si
// saveGame() se cortaba a la mitad o el JSON quedaba corrupto por algún
// motivo, la partida se perdía entera.
//
// Ahora:
// - Cada slot vive bajo su propia clave ('wildOriginSave:slot1', etc.).
// - Cada guardado lleva un campo `version`; migrateSaveData() es el único
//   lugar donde hay que tocar algo cuando cambie la forma de los datos.
// - Antes de sobreescribir un slot, se guarda una copia de lo anterior como
//   backup; si el guardado nuevo resulta corrupto, loadGame() cae al backup
//   en vez de perder el progreso.
// - La partida vieja guardada bajo la clave legacy (sin slot) se seguye
//   leyendo de forma transparente la primera vez, así ninguna partida
//   anterior a este cambio se pierde.
const LEGACY_KEY = 'wildOriginSave';
const SLOT_PREFIX = 'wildOriginSave:';
const BACKUP_SUFFIX = ':backup';
const SAVE_VERSION = 3;

// Slot que usa hoy la UI (un único botón "Guardar partida" / "Continuar
// partida"). El resto del módulo ya soporta varios slots (saveGame('slot2'),
// etc.) para el día que se quiera un selector de partidas en el menú; no se
// cableó esa UI todavía para no tocar de más el título/menú de pausa.
export const DEFAULT_SLOT = 'slot1';
export const AVAILABLE_SLOTS = ['slot1', 'slot2', 'slot3'];

// Antes se llamaba a saveGame() en cada frame (~60 veces por segundo), lo que
// serializaba TODO el mundo cargado y bloqueaba el hilo principal cada vez más
// a medida que se exploraba. Ahora el autoguardado se throttlea a un
// intervalo fijo (ver tickAutosave) y el guardado manual (botón "Guardar
// partida") sigue disponible al toque via saveGame().
const AUTOSAVE_INTERVAL = 8;

function keyFor(slot) { return SLOT_PREFIX + slot; }
function backupKeyFor(slot) { return keyFor(slot) + BACKUP_SUFFIX; }

// Único lugar donde vive la lógica de "cómo pasar un guardado viejo a la
// forma actual".
function migrateSaveData(data) {
  let version = data.version || 1;
  if (version < 2) {
    version = 2;
  }
  if (version < 3) {
    // v3: el inventario dejó de ser campos sueltos en player (wood, stone,
    // berries, hasSpear, hasAxe, hasPickaxe, hasBackpack) para pasar a un
    // array real player.inventory = [{ id, qty }, ...] (ver ITEMS en
    // config.js). Reconstruimos ese array a partir de los campos viejos así
    // una partida guardada antes de este cambio conserva sus recursos y
    // herramientas en vez de perderlos.
    if (data.player && !Array.isArray(data.player.inventory)) {
      const p = data.player;
      const inventory = [];
      const carryOver = (id, qty) => { if (qty > 0) inventory.push({ id, qty }); };
      carryOver('wood', p.wood || 0);
      carryOver('stone', p.stone || 0);
      carryOver('berries', p.berries || 0);
      if (p.hasSpear) inventory.push({ id: 'spear', qty: 1 });
      if (p.hasAxe) inventory.push({ id: 'axe', qty: 1 });
      if (p.hasPickaxe) inventory.push({ id: 'pickaxe', qty: 1 });
      if (p.hasBackpack) inventory.push({ id: 'backpack', qty: 1 });
      p.inventory = inventory;
      delete p.wood;
      delete p.stone;
      delete p.berries;
      delete p.hasSpear;
      delete p.hasAxe;
      delete p.hasPickaxe;
      delete p.hasBackpack;
    }
    version = 3;
  }
  data.version = version;
  return data;
}

function readSlotRaw(slot) {
  return localStorage.getItem(keyFor(slot)) || (slot === DEFAULT_SLOT ? localStorage.getItem(LEGACY_KEY) : null);
}

export function hasSavedGame(slot = DEFAULT_SLOT) {
  return !!readSlotRaw(slot);
}

// Devuelve info liviana de cada slot (para un futuro selector de partidas),
// sin tener que reconstruir el mundo entero para saber si hay algo guardado.
export function listSaveSlots() {
  return AVAILABLE_SLOTS.map(slot => {
    const raw = readSlotRaw(slot);
    if (!raw) return { slot, exists: false };
    try {
      const data = JSON.parse(raw);
      return { slot, exists: true, dayCounter: data.dayCounter || 1, savedAt: data.savedAt || null };
    } catch {
      return { slot, exists: true, corrupted: true };
    }
  });
}

export function saveGame(slot = DEFAULT_SLOT) {
  const data = {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    player: { ...state.player },
    elapsed: state.elapsed,
    dayCounter: state.dayCounter,
    worldSeed: state.worldSeed,
    // Set no es serializable directo con JSON.stringify; se guarda como array.
    discoveredActions: [...state.discoveredActions],
    world: {
      trees: state.trees,
      rocks: state.rocks,
      bushes: state.bushes,
      ponds: state.ponds,
      campfires: state.campfires,
      shelters: state.shelters,
      wolves: state.wolves,
      deer: state.deer,
      grassDecor: state.grassDecor,
      sticks: state.sticks,
      stones: state.stones
    }
  };
  const key = keyFor(slot);
  try {
    const previous = localStorage.getItem(key);
    if (previous) localStorage.setItem(backupKeyFor(slot), previous);
    localStorage.setItem(key, JSON.stringify(data));
    // Ya migrado a la clave con slot: limpiamos la clave legacy para no
    // dejar dos copias dando vueltas.
    if (slot === DEFAULT_SLOT) localStorage.removeItem(LEGACY_KEY);
    return true;
  } catch (e) {
    console.warn('No se pudo guardar la partida', e);
    return false;
  }
}

let autosaveTimer = AUTOSAVE_INTERVAL;

// Se llama una vez por frame desde update(), pero solo escribe a localStorage
// cada AUTOSAVE_INTERVAL segundos.
export function tickAutosave(dt) {
  autosaveTimer -= dt;
  if (autosaveTimer <= 0) {
    autosaveTimer = AUTOSAVE_INTERVAL;
    saveGame();
  }
}

// Reinicia el conteo del autoguardado (por ejemplo al empezar/cargar una
// partida), para que no dispare un guardado a mitad de la transición.
export function resetAutosaveTimer() {
  autosaveTimer = AUTOSAVE_INTERVAL;
}

function applySaveData(data) {
  Object.assign(state.player, data.player);
  state.elapsed = data.elapsed || 0;
  state.dayCounter = data.dayCounter || 1;
  state.worldSeed = data.worldSeed || 0;
  state.discoveredActions = new Set(data.discoveredActions || []);
  state.trees = data.world?.trees || [];
  state.rocks = data.world?.rocks || [];
  state.bushes = data.world?.bushes || [];
  state.ponds = data.world?.ponds || [];
  state.campfires = data.world?.campfires || [];
  state.shelters = data.world?.shelters || [];
  state.wolves = data.world?.wolves || [];
  state.deer = data.world?.deer || [];
  state.grassDecor = data.world?.grassDecor || [];
  state.sticks = data.world?.sticks || [];
  state.stones = data.world?.stones || [];
}

export function loadGame(slot = DEFAULT_SLOT) {
  const raw = readSlotRaw(slot);
  if (!raw) return false;
  try {
    applySaveData(migrateSaveData(JSON.parse(raw)));
    return true;
  } catch (e) {
    console.warn('Guardado principal corrupto, probando con el backup', e);
    const backupRaw = localStorage.getItem(backupKeyFor(slot));
    if (!backupRaw) return false;
    try {
      applySaveData(migrateSaveData(JSON.parse(backupRaw)));
      return true;
    } catch (e2) {
      console.warn('El backup también está corrupto, no se puede recuperar la partida', e2);
      return false;
    }
  }
}
