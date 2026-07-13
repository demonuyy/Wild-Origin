import { state, BACKPACK_BONUS } from './config.js';
import { SoundFX } from './audio.js';
import { pushLog, showHint, updateEquipUI } from './ui.js';
import { RECIPES, canAfford, payCost, costHint } from './recipes.js';

export function tryCraftSpear() {
  if (state.player.hasSpear) {
    showHint('Ya tenés una lanza');
    return;
  }
  if (canAfford(state.player, RECIPES.spear.cost)) {
    payCost(state.player, RECIPES.spear.cost);
    state.player.hasSpear = true;
    state.player.attackDamage = 26;
    state.player.attackRange = 46;
    updateEquipUI();
    SoundFX.craftOk();
    pushLog('Fabricaste una lanza');
  } else {
    SoundFX.craftFail();
    showHint(costHint('spear'));
  }
}

export function tryPlaceCampfire() {
  if (canAfford(state.player, RECIPES.campfire.cost)) {
    payCost(state.player, RECIPES.campfire.cost);
    state.campfires.push({ x: state.player.x, y: state.player.y, life: 220, pulse: 0 });
    SoundFX.craftOk();
    pushLog('Encendiste una fogata');
  } else {
    SoundFX.craftFail();
    showHint(costHint('campfire'));
  }
}

export function tryCraftAxe() {
  if (state.player.hasAxe) {
    tryEquipTool('axe');
    return;
  }
  if (canAfford(state.player, RECIPES.axe.cost)) {
    payCost(state.player, RECIPES.axe.cost);
    state.player.hasAxe = true;
    // Recién fabricada, queda directamente en la mano.
    state.player.equippedTool = 'axe';
    SoundFX.craftOk();
    updateEquipUI();
    pushLog('Fabricaste un hacha: ya la tenés en la mano, podés talar árboles');
  } else {
    SoundFX.craftFail();
    showHint(costHint('axe'));
  }
}

export function tryCraftPickaxe() {
  if (state.player.hasPickaxe) {
    tryEquipTool('pickaxe');
    return;
  }
  if (canAfford(state.player, RECIPES.pickaxe.cost)) {
    payCost(state.player, RECIPES.pickaxe.cost);
    state.player.hasPickaxe = true;
    // Recién fabricado, queda directamente en la mano.
    state.player.equippedTool = 'pickaxe';
    SoundFX.craftOk();
    updateEquipUI();
    pushLog('Fabricaste un pico: ya lo tenés en la mano, podés minar rocas');
  } else {
    SoundFX.craftFail();
    showHint(costHint('pickaxe'));
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
    SoundFX.equipClank();
    updateEquipUI();
    pushLog('Guardaste la herramienta');
  } else {
    state.player.equippedTool = tool;
    SoundFX.equipClank();
    updateEquipUI();
    pushLog(tool === 'axe' ? 'Hacha en mano' : 'Pico en mano');
  }
}

export function tryCraftBackpack() {
  if (state.player.hasBackpack) {
    showHint('Ya tenés una mochila');
    return;
  }
  if (canAfford(state.player, RECIPES.backpack.cost)) {
    payCost(state.player, RECIPES.backpack.cost);
    state.player.hasBackpack = true;
    SoundFX.craftOk();
    updateEquipUI();
    pushLog(`Fabricaste una mochila: capacidad +${BACKPACK_BONUS}`);
  } else {
    SoundFX.craftFail();
    showHint(costHint('backpack'));
  }
}

export function tryPlaceShelter() {
  if (canAfford(state.player, RECIPES.shelter.cost)) {
    payCost(state.player, RECIPES.shelter.cost);
    state.shelters.push({ x: state.player.x, y: state.player.y });
    SoundFX.craftOk();
    pushLog('Construiste un refugio: zona segura. "E" para dormir');
  } else {
    SoundFX.craftFail();
    showHint(costHint('shelter'));
  }
}
