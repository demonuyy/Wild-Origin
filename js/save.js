import { state } from './config.js';

const SAVE_KEY = 'wildOriginSave';
// Antes se llamaba a saveGame() en cada frame (~60 veces por segundo), lo que
// serializaba TODO el mundo cargado y bloqueaba el hilo principal cada vez más
// a medida que se exploraba. Ahora el autoguardado se throttlea a un
// intervalo fijo (ver tickAutosave) y el guardado manual (botón "Guardar
// partida") sigue disponible al toque via saveGame().
const AUTOSAVE_INTERVAL = 8;

export function hasSavedGame() {
  return !!localStorage.getItem(SAVE_KEY);
}

export function saveGame() {
  const data = {
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
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
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

export function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
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
    return true;
  } catch {
    return false;
  }
}
