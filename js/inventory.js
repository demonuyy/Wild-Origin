import { state, capFor, invTotal, clamp, hasItem, addItem, removeItem, ITEMS } from './config.js';
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
  SoundFX.chop();
  pushLog(`Talaste madera (+${gained})`);
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
  SoundFX.mine();
  pushLog(`Picaste piedra (+${gained})`);
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
  SoundFX.berry();
  pushLog(`Recogiste bayas (+${gained})`);
  if (b.stock <= 0) b.regrowTimer = 26;
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
