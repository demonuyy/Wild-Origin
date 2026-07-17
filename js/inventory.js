import { state, capFor, invTotal, clamp, hasItem, addItem, removeItem, ITEMS, damageTool, ACTION_SWING_DURATION } from './config.js';
import { SoundFX } from './audio.js';
import { pushLog, showHint } from './ui.js';
import { removeEntity } from './world.js';

export function collectTreeResource(t) {
  if (t.hits <= 0) return;
  // Talar requiere el hacha, y no alcanza con tenerla craftada: tiene que
  // estar equipada ("en la mano") en ese momento.
  if (!hasItem('axe')) {
    SoundFX.craftFail();
    showHint('Necesitás un <b>hacha</b> para talar árboles');
    return;
  }
  if (state.player.equippedTool !== 'axe') {
    SoundFX.craftFail();
    showHint('Equipá el hacha (tecla 3) para talar');
    return;
  }
  if (invTotal() >= capFor()) {
    SoundFX.craftFail();
    showHint('Inventario lleno');
    return;
  }
  let gained = Math.floor(Math.random() * 3) + 3;
  gained = Math.min(gained, capFor() - invTotal());
  addItem('wood', gained);
  t.hits -= 2;
  state.player.actionAnim = ACTION_SWING_DURATION;
  SoundFX.chop();
  pushLog(`Talaste madera (+${gained})`);
  // El hacha se gasta con cada golpe, se haya talado el árbol entero o no.
  if (damageTool('axe', 1)) {
    SoundFX.craftFail();
    pushLog('El hacha se rompió');
  }
  if (t.hits <= 0) {
    removeEntity('trees', t);
  }
}

export function collectRockResource(r) {
  if (r.hits <= 0) return;
  // Minar requiere el pico equipado en la mano, no solo poseído.
  if (!hasItem('pickaxe')) {
    SoundFX.craftFail();
    showHint('Necesitás un <b>pico</b> para minar rocas');
    return;
  }
  if (state.player.equippedTool !== 'pickaxe') {
    SoundFX.craftFail();
    showHint('Equipá el pico (tecla 4) para minar');
    return;
  }
  if (invTotal() >= capFor()) {
    SoundFX.craftFail();
    showHint('Inventario lleno');
    return;
  }
  let gained = Math.floor(Math.random() * 2) + 3;
  gained = Math.min(gained, capFor() - invTotal());
  addItem('stone', gained);
  r.hits -= 2;
  state.player.actionAnim = ACTION_SWING_DURATION;
  SoundFX.mine();
  pushLog(`Picaste piedra (+${gained})`);
  // El pico se gasta con cada golpe, se haya roto la roca entera o no.
  if (damageTool('pickaxe', 1)) {
    SoundFX.craftFail();
    pushLog('El pico se rompió');
  }
  if (r.hits <= 0) {
    removeEntity('rocks', r);
  }
}

// Recolección a mano, sin ninguna herramienta: la única forma de conseguir
// los primeros recursos para poder craftear el hacha y el pico.
export function collectStick(s) {
  if (invTotal() >= capFor()) {
    SoundFX.craftFail();
    showHint('Inventario lleno');
    return;
  }
  addItem('wood', 1);
  state.player.actionAnim = ACTION_SWING_DURATION;
  SoundFX.pickup('rustle');
  pushLog('Recogiste un palo (+1)');
  removeEntity('sticks', s);
}

export function collectStone(s) {
  if (invTotal() >= capFor()) {
    SoundFX.craftFail();
    showHint('Inventario lleno');
    return;
  }
  addItem('stone', 1);
  state.player.actionAnim = ACTION_SWING_DURATION;
  SoundFX.pickup('rock');
  pushLog('Recogiste una piedra (+1)');
  removeEntity('stones', s);
}

export function collectBushResource(b) {
  if (b.stock <= 0) {
    showHint('Ese arbusto está agotado');
    return;
  }
  if (invTotal() >= capFor()) {
    SoundFX.craftFail();
    showHint('Inventario lleno');
    return;
  }
  const gained = 1;
  addItem('berries', gained);
  b.stock--;
  state.player.actionAnim = ACTION_SWING_DURATION;
  SoundFX.berry();
  pushLog(`Recogiste bayas (+${gained})`);
  if (b.stock <= 0) b.regrowTimer = 26;
}

// Cadáver de un lobo/ciervo muerto (ver spawnCorpse en world.js). Tiene dos
// etapas, cada una con su propio golpe de E:
//  1. 'fresh': primer desuelle, da carne + piel; el cadáver NO desaparece,
//     pasa a la etapa 'bones' (queda tirado, ahora como pura osamenta).
//  2. 'bones': junta los huesos y ahí sí se saca del mundo del todo.
// A diferencia de talar/minar, no requiere ninguna herramienta equipada: se
// puede desollar y juntar los huesos a mano.
const CORPSE_YIELD = {
  wolf: { meat: [2, 3], hide: [1, 2], bone: [1, 2] },
  deer: { meat: [3, 5], hide: [1, 2], bone: [2, 3] }
};

function rollYield([min, max]) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function harvestCorpse(c) {
  const yields = CORPSE_YIELD[c.kind] || CORPSE_YIELD.wolf;
  if (c.stage === 'fresh') {
    if (invTotal() >= capFor()) {
      SoundFX.craftFail();
      showHint('Inventario lleno');
      return;
    }
    const meat = Math.min(rollYield(yields.meat), capFor() - invTotal());
    addItem('raw_meat', meat);
    const hide = Math.min(rollYield(yields.hide), capFor() - invTotal());
    if (hide > 0) addItem('hide', hide);
    c.stage = 'bones';
    state.player.actionAnim = ACTION_SWING_DURATION;
    SoundFX.pickup('rustle');
    pushLog(`Desollaste ${c.kind === 'wolf' ? 'el lobo' : 'el ciervo'} (+${meat} carne, +${hide} piel)`);
  } else {
    if (invTotal() >= capFor()) {
      SoundFX.craftFail();
      showHint('Inventario lleno');
      return;
    }
    const bone = Math.min(rollYield(yields.bone), capFor() - invTotal());
    addItem('bone', bone);
    state.player.actionAnim = ACTION_SWING_DURATION;
    SoundFX.pickup('rock');
    pushLog(`Juntaste huesos (+${bone})`);
    removeEntity('corpses', c);
  }
}

// Come 1 unidad de cualquier ítem categoría 'food' (antes esto era solo
// consumeBerry con el valor de hambre hardcodeado; ahora ese valor sale de
// ITEMS[id].hunger, así que un ítem de comida nuevo del roadmap v0.3+
// -carne cocida, etc.- no necesita tocar este archivo). Usado tanto desde
// la hotbar/inventario (click, ver useItem en crafting.js) como desde el
// atajo de teclado Q (ver handleManualEat en player.js).
export function consumeFood(id) {
  const info = ITEMS[id];
  if (!info || info.category !== 'food' || !hasItem(id)) return;
  removeItem(id, 1);
  state.player.hunger = clamp(state.player.hunger + (info.hunger || 15), 0, 100);
  SoundFX.eat();
  pushLog(`Comiste ${info.label.toLowerCase()}`);
}

// Se mantiene el nombre histórico (se llama desde player.js/handleManualEat)
// para no tocar ese call site.
export function consumeBerry() {
  consumeFood('berries');
}
