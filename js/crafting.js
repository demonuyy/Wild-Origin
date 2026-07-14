import { state, BACKPACK_BONUS, hasItem, addItem } from './config.js';
import { SoundFX } from './audio.js';
import { pushLog, showHint, updateEquipUI } from './ui.js';
import { RECIPES, canAfford, payCost, costHint } from './recipes.js';

export function tryCraftSpear() {
  if (hasItem('spear')) {
    tryEquipTool('spear');
    return;
  }
  if (canAfford(state.player, RECIPES.spear.cost)) {
    payCost(state.player, RECIPES.spear.cost);
    addItem('spear', 1);
    // Recién fabricada, queda directamente en la mano (mismo criterio que
    // hacha/pico). El bono de daño/alcance solo se aplica mientras está
    // equipada de verdad (ver tryAttack en player.js), no por tenerla
    // craftada nomás.
    state.player.equippedTool = 'spear';
    SoundFX.craftOk();
    updateEquipUI();
    pushLog('Fabricaste una lanza: ya la tenés en la mano');
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
  if (hasItem('axe')) {
    tryEquipTool('axe');
    return;
  }
  if (canAfford(state.player, RECIPES.axe.cost)) {
    payCost(state.player, RECIPES.axe.cost);
    addItem('axe', 1);
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
  if (hasItem('pickaxe')) {
    tryEquipTool('pickaxe');
    return;
  }
  if (canAfford(state.player, RECIPES.pickaxe.cost)) {
    payCost(state.player, RECIPES.pickaxe.cost);
    addItem('pickaxe', 1);
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

// Cambia qué herramienta/arma está "en la mano". Antes solo competían por
// ese lugar el hacha y el pico; ahora la lanza también, así que se puede
// craftear y después guardarla para tener las manos libres (antes, una vez
// crafteada, quedaba "puesta" para siempre sin poder sacársela). La mochila
// sigue sin necesitarlo (se lleva puesta siempre). Volver a equipar la que
// ya está en la mano la guarda.
const TOOL_LABEL = { axe: 'Hacha', pickaxe: 'Pico', spear: 'Lanza' };

export function tryEquipTool(tool) {
  if (!hasItem(tool)) return;
  if (state.player.equippedTool === tool) {
    state.player.equippedTool = null;
    SoundFX.equipClank();
    updateEquipUI();
    pushLog('Guardaste la herramienta');
  } else {
    state.player.equippedTool = tool;
    SoundFX.equipClank();
    updateEquipUI();
    pushLog(`${TOOL_LABEL[tool]} en mano`);
  }
}

export function tryCraftBackpack() {
  if (hasItem('backpack')) {
    showHint('Ya tenés una mochila');
    return;
  }
  if (canAfford(state.player, RECIPES.backpack.cost)) {
    payCost(state.player, RECIPES.backpack.cost);
    addItem('backpack', 1);
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
