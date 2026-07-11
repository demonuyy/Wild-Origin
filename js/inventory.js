import { state, capFor, invTotal, clamp } from './config.js';
import { SoundFX } from './audio.js';
import { pushLog, showHint } from './ui.js';

export function collectTreeResource(t) {
  if (t.hits <= 0) return;
  if (invTotal() >= capFor()) {
    SoundFX.craftFail();
    showHint('Inventario lleno');
    return;
  }
  let gained = state.player.hasAxe ? Math.floor(Math.random() * 3) + 3 : Math.floor(Math.random() * 3) + 2;
  gained = Math.min(gained, capFor() - invTotal());
  state.player.wood += gained;
  t.hits -= state.player.hasAxe ? 2 : 1;
  SoundFX.chop();
  pushLog(`Talaste madera (+${gained})`);
  if (t.hits <= 0) {
    state.trees.splice(state.trees.indexOf(t), 1);
  }
}

export function collectRockResource(r) {
  if (r.hits <= 0) return;
  if (invTotal() >= capFor()) {
    SoundFX.craftFail();
    showHint('Inventario lleno');
    return;
  }
  let gained = state.player.hasPickaxe ? Math.floor(Math.random() * 2) + 3 : Math.floor(Math.random() * 2) + 2;
  gained = Math.min(gained, capFor() - invTotal());
  state.player.stone += gained;
  r.hits -= state.player.hasPickaxe ? 2 : 1;
  SoundFX.mine();
  pushLog(`Picaste piedra (+${gained})`);
  if (r.hits <= 0) {
    state.rocks.splice(state.rocks.indexOf(r), 1);
  }
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
