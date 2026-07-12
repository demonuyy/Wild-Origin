import { state, BACKPACK_BONUS } from './config.js';
import { SoundFX } from './audio.js';
import { pushLog, showHint, updateEquipUI } from './ui.js';

export function tryCraftSpear() {
  if (state.player.hasSpear) {
    showHint('Ya tenés una lanza');
    return;
  }
  if (state.player.wood >= 4 && state.player.stone >= 2) {
    state.player.wood -= 4;
    state.player.stone -= 2;
    state.player.hasSpear = true;
    state.player.attackDamage = 26;
    state.player.attackRange = 46;
    updateEquipUI();
    SoundFX.craftOk();
    pushLog('Fabricaste una lanza');
  } else {
    SoundFX.craftFail();
    showHint('<b>Lanza</b>Necesitás 4 madera y 2 piedra');
  }
}

export function tryPlaceCampfire() {
  if (state.player.wood >= 6) {
    state.player.wood -= 6;
    state.campfires.push({ x: state.player.x, y: state.player.y, life: 220, pulse: 0 });
    SoundFX.craftOk();
    pushLog('Encendiste una fogata');
  } else {
    SoundFX.craftFail();
    showHint('<b>Fogata</b>Necesitás 6 madera');
  }
}

export function tryCraftAxe() {
  if (state.player.hasAxe) {
    tryEquipTool('axe');
    return;
  }
  if (state.player.wood >= 5 && state.player.stone >= 3) {
    state.player.wood -= 5;
    state.player.stone -= 3;
    state.player.hasAxe = true;
    // Recién fabricada, queda directamente en la mano.
    state.player.equippedTool = 'axe';
    SoundFX.craftOk();
    updateEquipUI();
    pushLog('Fabricaste un hacha: ya la tenés en la mano, podés talar árboles');
  } else {
    SoundFX.craftFail();
    showHint('<b>Hacha</b>Necesitás 5 madera y 3 piedra');
  }
}

export function tryCraftPickaxe() {
  if (state.player.hasPickaxe) {
    tryEquipTool('pickaxe');
    return;
  }
  if (state.player.wood >= 5 && state.player.stone >= 3) {
    state.player.wood -= 5;
    state.player.stone -= 3;
    state.player.hasPickaxe = true;
    // Recién fabricado, queda directamente en la mano.
    state.player.equippedTool = 'pickaxe';
    SoundFX.craftOk();
    updateEquipUI();
    pushLog('Fabricaste un pico: ya lo tenés en la mano, podés minar rocas');
  } else {
    SoundFX.craftFail();
    showHint('<b>Pico</b>Necesitás 5 madera y 3 piedra');
  }
}

// Cambia qué herramienta está "en la mano". Solo el hacha y el pico compiten
// por ese lugar (la lanza y la mochila no lo necesitan). Volver a equipar la
// que ya está en la mano la guarda (deja las manos libres).
export function tryEquipTool(tool) {
  const owned = tool === 'axe' ? state.player.hasAxe : state.player.hasPickaxe;
  if (!owned) return;
  if (state.player.equippedTool === tool) {
    state.player.equippedTool = null;
    SoundFX.click();
    updateEquipUI();
    pushLog('Guardaste la herramienta');
  } else {
    state.player.equippedTool = tool;
    SoundFX.click();
    updateEquipUI();
    pushLog(tool === 'axe' ? 'Hacha en mano' : 'Pico en mano');
  }
}

export function tryCraftBackpack() {
  if (state.player.hasBackpack) {
    showHint('Ya tenés una mochila');
    return;
  }
  if (state.player.wood >= 8 && state.player.stone >= 4) {
    state.player.wood -= 8;
    state.player.stone -= 4;
    state.player.hasBackpack = true;
    SoundFX.craftOk();
    updateEquipUI();
    pushLog(`Fabricaste una mochila: capacidad +${BACKPACK_BONUS}`);
  } else {
    SoundFX.craftFail();
    showHint('<b>Mochila</b>Necesitás 8 madera y 4 piedra');
  }
}

export function tryPlaceShelter() {
  if (state.player.wood >= 15 && state.player.stone >= 8) {
    state.player.wood -= 15;
    state.player.stone -= 8;
    state.shelters.push({ x: state.player.x, y: state.player.y });
    SoundFX.craftOk();
    pushLog('Construiste un refugio: zona segura. "E" para dormir');
  } else {
    SoundFX.craftFail();
    showHint('<b>Refugio</b>Necesitás 15 madera y 8 piedra');
  }
}
