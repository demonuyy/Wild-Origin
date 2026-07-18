import { state, capFor, invTotal, clamp, hasItem, addItem, removeItem, countItem, ITEMS, damageTool, getDurability, setDurability, ACTION_SWING_DURATION } from './config.js';
import { SoundFX } from './audio.js';
import { pushLog, showHint } from './ui.js';
import { removeEntity, spawnGroundItem } from './world.js';

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

// Cadáver de un lobo/ciervo/conejo muerto (ver spawnCorpse en world.js). El
// lobo y el ciervo tienen dos etapas, cada una con su propio golpe de E:
//  1. 'fresh': primer desuelle, da carne + piel; el cadáver NO desaparece,
//     pasa a la etapa 'bones' (queda tirado, ahora como pura osamenta).
//  2. 'bones': junta los huesos y ahí sí se saca del mundo del todo.
// El conejo es la excepción: es chico y no deja piel ni huesos que valga la
// pena juntar aparte, así que se recolecta entero de un solo golpe (ver el
// caso especial dentro de harvestCorpse más abajo).
// A diferencia de talar/minar, no requiere ninguna herramienta equipada: se
// puede desollar y juntar los huesos a mano.
const CORPSE_YIELD = {
  wolf: { meat: [2, 3], hide: [1, 2], bone: [1, 2] },
  deer: { meat: [3, 5], hide: [1, 2], bone: [2, 3] },
  // El conejo no tiene etapa de piel/huesos (ver harvestCorpse): solo se usa
  // `meat` acá.
  rabbit: { meat: [1, 2] }
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
    // El conejo se recolecta entero de una: no hay piel/huesos que valga la
    // pena juntar en una segunda etapa como con lobo/ciervo.
    if (c.kind === 'rabbit') {
      removeEntity('corpses', c);
      state.player.actionAnim = ACTION_SWING_DURATION;
      SoundFX.pickup('rustle');
      pushLog(`Recogiste un conejo (+${meat} carne)`);
      return;
    }
    const hide = Math.min(rollYield(yields.hide), capFor() - invTotal());
    if (hide > 0) addItem('hide', hide);
    c.stage = 'bones';
    state.player.actionAnim = ACTION_SWING_DURATION;
    SoundFX.skinning();
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
    SoundFX.pickup('bone');
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
// Si el ítem tiene thirstPenalty/healthPenalty (ver raw_meat en config.js:
// comer carne cruda hace mal), se aplican acá también.
export function consumeFood(id) {
  const info = ITEMS[id];
  if (!info || info.category !== 'food' || !hasItem(id)) return;
  removeItem(id, 1);
  state.player.hunger = clamp(state.player.hunger + (info.hunger || 15), 0, 100);
  if (info.thirstPenalty) state.player.thirst = clamp(state.player.thirst - info.thirstPenalty, 0, 100);
  if (info.healthPenalty) state.player.health = clamp(state.player.health - info.healthPenalty, 0, 100);
  SoundFX.eat();
  if (info.thirstPenalty || info.healthPenalty) {
    pushLog(`Comiste ${info.label.toLowerCase()}... te cayó mal (-sed, -vida)`);
  } else {
    pushLog(`Comiste ${info.label.toLowerCase()}`);
  }
}

// Cocina 1 unidad de carne cruda en una fogata encendida (ver el tipo
// 'campfire' en findNearestInteractable, player.js). No hace falta chequear
// capacidad: convertir raw_meat -> cooked_meat no suma peso nuevo al
// inventario (1 unidad de comida por otra).
export function tryCookMeat() {
  if (!hasItem('raw_meat')) {
    SoundFX.craftFail();
    showHint('Necesitás carne cruda para cocinar');
    return;
  }
  removeItem('raw_meat', 1);
  addItem('cooked_meat', 1);
  state.player.actionAnim = ACTION_SWING_DURATION;
  SoundFX.cookMeat();
  pushLog('Cocinaste carne (+1 carne cocida)');
}

// Se mantiene el nombre histórico (se llama desde player.js/handleManualEat)
// para no tocar ese call site.
export function consumeBerry() {
  consumeFood('berries');
}

// ---------- Tirar / recoger del suelo ----------
// Se llama al soltar un ítem arrastrado FUERA de la hotbar/inventario (ver
// resolveDrop en input.js: si el punto donde se soltó no es ninguna casilla
// válida, se interpreta como "tirarlo al mundo"). `qty` es cuánto tirar de
// esa casilla puntual (un stack partido a mano puede ser menos que el total
// que se posee, ver dataset.qty en ui.js); nunca tira más de lo que
// realmente hay.
export function dropItem(id, qty) {
  const amount = Math.min(qty, countItem(id));
  if (amount <= 0) return;
  // Se lee ANTES de removeItem: si la cantidad llega a 0 el slot desaparece
  // del todo (junto con su durability), así que hay que guardarla antes.
  const durability = getDurability(id);
  removeItem(id, amount);
  // Si era la herramienta puesta en la mano, ya no se posee: mismo criterio
  // de "desequipar" que damageTool en config.js cuando una herramienta se
  // rompe del todo.
  if (state.player.equippedTool === id && !hasItem(id)) state.player.equippedTool = null;
  spawnGroundItem(state.player.x, state.player.y, id, amount, durability);
  SoundFX.drop();
  pushLog(`Tiraste ${ITEMS[id].label.toLowerCase()} al suelo`);
}

// Recoger un ítem tirado (ver findNearestInteractable/tryInteract en
// player.js, tipo 'groundItem'): a diferencia de talar/minar, no hace falta
// ninguna herramienta ni chequeo de capacidad (capFor() es infinita).
export function pickUpGroundItem(g) {
  addItem(g.id, g.qty);
  // addItem() arranca un slot nuevo siempre al máximo de durability (ver
  // config.js): si el ítem tirado tenía desgaste acumulado, se restaura ACÁ
  // para no "repararlo" gratis con solo tirarlo y levantarlo.
  if (typeof g.durability === 'number') setDurability(g.id, g.durability);
  removeEntity('groundItems', g);
  state.player.actionAnim = ACTION_SWING_DURATION;
  SoundFX.pickup('rustle');
  pushLog(`Recogiste ${ITEMS[g.id].label.toLowerCase()}${g.qty > 1 ? ` (+${g.qty})` : ''}`);
}
