import { state, hasItem, addItem, ITEMS, autoAssignHotbar, getDurability, maxDurability, repairTool } from './config.js';
import { SoundFX } from './audio.js';
import { pushLog, showHint, updateEquipUI } from './ui.js';
import { RECIPES, canAfford, payCost, costHint, repairCost, repairHint } from './recipes.js';
import { consumeFood } from './inventory.js';

export function tryCraftSpear() {
  if (hasItem('spear')) {
    tryEquipTool('spear');
    return;
  }
  if (canAfford(state.player, RECIPES.spear.cost)) {
    payCost(state.player, RECIPES.spear.cost);
    addItem('spear', 1);
    autoAssignHotbar('spear');
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
    autoAssignHotbar('axe');
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
    autoAssignHotbar('pickaxe');
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

export function tryCraftTorch() {
  if (hasItem('torch')) {
    tryEquipTool('torch');
    return;
  }
  if (canAfford(state.player, RECIPES.torch.cost)) {
    payCost(state.player, RECIPES.torch.cost);
    addItem('torch', 1);
    autoAssignHotbar('torch');
    // Recién fabricada, queda directamente en la mano (mismo criterio que
    // el resto de las herramientas).
    state.player.equippedTool = 'torch';
    SoundFX.craftOk();
    updateEquipUI();
    pushLog('Fabricaste una antorcha: ya la tenés en la mano, ilumina de noche');
  } else {
    SoundFX.craftFail();
    showHint(costHint('torch'));
  }
}

// Cambia qué herramienta/arma está "en la mano". Antes solo competían por
// ese lugar el hacha y el pico; ahora la lanza y la antorcha también, así
// que se puede craftear y después guardarla para tener las manos libres
// (antes, una vez crafteada, quedaba "puesta" para siempre sin poder
// sacársela). La mochila sigue sin necesitarlo (se lleva puesta siempre).
// Volver a equipar la que ya está en la mano la guarda.
const TOOL_LABEL = { axe: 'Hacha', pickaxe: 'Pico', spear: 'Lanza', torch: 'Antorcha' };

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
    autoAssignHotbar('backpack');
    SoundFX.craftOk();
    updateEquipUI();
    pushLog('Fabricaste una mochila: más espacio en el inventario');
  } else {
    SoundFX.craftFail();
    showHint(costHint('backpack'));
  }
}

// Punto de entrada único para "usar" un ítem que ya se posee, ya sea
// clickeado desde una casilla de la hotbar o desde el panel de inventario
// (ver input.js). Qué significa "usar" depende de la categoría en ITEMS:
// una herramienta se equipa/guarda, una comida se come, y un recurso
// suelto (madera/piedra) no tiene una acción directa -solo sirve para
// craftear-, así que se avisa en vez de no hacer nada silenciosamente.
export function useItem(id) {
  const info = ITEMS[id];
  if (!info || !hasItem(id)) return;
  if (info.category === 'tool') {
    tryEquipTool(id);
  } else if (info.category === 'food') {
    consumeFood(id);
  } else {
    SoundFX.craftFail();
    showHint(`${info.label} es un material: usalo para craftear (tecla C)`);
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

// ---------- Reparar herramientas ----------
// Solo tiene sentido para lanza/hacha/pico/antorcha (las únicas con
// `durability` en ITEMS, ver config.js); id llega desde el botón de reparar
// del menú de crafteo (ver renderCraftGrid/CRAFT_ACTIONS en ui.js/input.js),
// que ya se encarga de no mostrarlo si no aplica.
export function tryRepairTool(id) {
  const max = maxDurability(id);
  if (!hasItem(id) || !max) return;
  const current = getDurability(id);
  if (current >= max) {
    showHint('Ya está en perfecto estado');
    return;
  }
  const cost = repairCost(id);
  if (canAfford(state.player, cost)) {
    payCost(state.player, cost);
    repairTool(id);
    SoundFX.craftOk();
    pushLog(`Reparaste ${ITEMS[id].label.toLowerCase()}`);
  } else {
    SoundFX.craftFail();
    showHint(repairHint(id));
  }
}
