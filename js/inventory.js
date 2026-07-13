import { state, capFor, invTotal, clamp } from './config.js';
import { SoundFX } from './audio.js';
import { pushLog, showHint } from './ui.js';
import { removeEntity } from './world.js';

export function collectTreeResource(t) {
  if (t.hits <= 0) return;
  // Talar requiere el hacha, y no alcanza con tenerla craftada: tiene que
  // estar equipada ("en la mano") en ese momento.
  if (!state.player.hasAxe) {
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
  state.player.wood += gained;
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
  if (!state.player.hasPickaxe) {
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
  state.player.stone += gained;
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
  state.player.wood += 1;
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
  state.player.stone += 1;
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
  state.player.berries += gained;
  b.stock--;
  SoundFX.berry();
  pushLog(`Recogiste bayas (+${gained})`);
  if (b.stock <= 0) b.regrowTimer = 26;
}

export function consumeBerry() {
  state.player.berries--;
  state.player.hunger = clamp(state.player.hunger + 22, 0, 100);
  SoundFX.eat();
  pushLog('Comiste bayas');
}
