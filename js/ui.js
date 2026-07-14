import { state, clamp, DAY_LENGTH, invTotal, capFor, STACK_SIZE } from './config.js';
import { SoundFX } from './audio.js';
import { RECIPES } from './recipes.js';

let hintTimeout = null;

// Costo/estado de cada acción de la hotbar, usado solo para pintar la UI
// (la validación real de recursos sigue viviendo en crafting.js). Los
// números de costo salen de recipes.js: acá solo se agrega la metadata que
// es específica de esta pantalla (qué flag de state.player indica "ya lo
// tengo", para lanza/hacha/pico qué valor de equippedTool corresponde, y el
// icono/tecla que también reutiliza el menú de crafteo completo (tecla C,
// ver toggleCraftMenu más abajo) para no repetir esta tabla dos veces.
const HOTBAR_CONFIG = {
  spear: { ...RECIPES.spear.cost, ownedKey: 'hasSpear', equipKey: 'spear', icon: '🔱', key: '1' },
  campfire: { ...RECIPES.campfire.cost, ownedKey: null, icon: '🔥', key: '2' },
  axe: { ...RECIPES.axe.cost, ownedKey: 'hasAxe', equipKey: 'axe', icon: '🪓', key: '3' },
  pickaxe: { ...RECIPES.pickaxe.cost, ownedKey: 'hasPickaxe', equipKey: 'pickaxe', icon: '⛏️', key: '4' },
  backpack: { ...RECIPES.backpack.cost, ownedKey: 'hasBackpack', icon: '🎒', key: '5' },
  shelter: { ...RECIPES.shelter.cost, ownedKey: null, icon: '⛺', key: '6' }
};

// Estado compartido (poseído / se puede craftear ahora / equipado) de una
// entrada de HOTBAR_CONFIG, usado tanto por updateHotbar() como por el menú
// de crafteo completo, para que ambos coincidan siempre.
function craftSlotStatus(action) {
  const cfg = HOTBAR_CONFIG[action];
  const owned = !!(cfg.ownedKey && state.player[cfg.ownedKey]);
  const affordable = state.player.wood >= cfg.wood && state.player.stone >= cfg.stone;
  const equipped = !!(cfg.equipKey && state.player.equippedTool === cfg.equipKey);
  return { cfg, owned, affordable, equipped };
}

export function pushLog(msg) {
  const logEl = document.getElementById('log');
  const line = document.createElement('div');
  line.className = 'logLine';
  line.textContent = msg;
  logEl.appendChild(line);
  requestAnimationFrame(() => line.classList.add('show'));
  setTimeout(() => {
    line.classList.remove('show');
    setTimeout(() => line.remove(), 500);
  }, 2600);
  while (logEl.children.length > 4) {
    logEl.removeChild(logEl.firstChild);
  }
}

export function showHint(text) {
  const el = document.getElementById('craftHint');
  el.innerHTML = text;
  el.classList.add('show');
  clearTimeout(hintTimeout);
  hintTimeout = setTimeout(() => el.classList.remove('show'), 1400);
}

// Cartel contextual persistente ("Talar (E)"), a diferencia de showHint() que
// es un toast que se autooculta: este se muestra mientras el jugador esté
// cerca y se oculta apenas deja de estarlo (ver updateInteractionPrompt en
// player.js).
let lastPromptText = null;
export function showInteractPrompt(text) {
  const el = document.getElementById('interactPrompt');
  if (lastPromptText !== text) {
    el.innerHTML = text;
    lastPromptText = text;
  }
  el.classList.add('show');
}

export function hideInteractPrompt() {
  const el = document.getElementById('interactPrompt');
  el.classList.remove('show');
  lastPromptText = null;
}

export function updateHotbar() {
  const slots = document.querySelectorAll('#hotbar .hotSlot[data-action]');
  slots.forEach(el => {
    if (!HOTBAR_CONFIG[el.dataset.action]) return;
    const { cfg, owned, affordable, equipped } = craftSlotStatus(el.dataset.action);
    el.classList.toggle('owned', owned);
    el.classList.toggle('affordable', !owned && affordable);
    el.classList.toggle('disabled', !owned && !affordable);
    // Hacha/pico: además de "poseído" importa si están en la mano, ya que
    // eso es lo que habilita talar/minar.
    el.classList.toggle('active', equipped);
    const costEl = el.querySelector('.hotCost');
    if (owned) {
      const label = cfg.equipKey ? (equipped ? 'En mano' : 'Guardado') : 'Equipado';
      if (costEl.textContent !== label) costEl.textContent = label;
    }
  });
}

// ---------- Menú de crafteo completo (tecla C) ----------
// Muestra TODAS las recetas de RECIPES a la vez (a diferencia de la hotbar,
// que ya las tiene siempre visibles pero mezcladas con el resto del HUD).
// Se arma dinámicamente desde HOTBAR_CONFIG/RECIPES así que una receta nueva
// (v0.3+: horno, arco...) aparece acá solo con agregarla a esas dos tablas,
// sin tocar este archivo.
function renderCraftGrid() {
  const grid = document.getElementById('craftGrid');
  grid.innerHTML = '';
  for (const action of Object.keys(HOTBAR_CONFIG)) {
    const { cfg, owned, affordable, equipped } = craftSlotStatus(action);
    const el = document.createElement('div');
    el.className = 'craftSlot';
    el.dataset.action = action;
    el.classList.toggle('owned', owned);
    el.classList.toggle('affordable', !owned && affordable);
    el.classList.toggle('disabled', !owned && !affordable);
    el.classList.toggle('active', equipped);
    const costParts = [];
    if (cfg.wood) costParts.push(`${cfg.wood}🌲`);
    if (cfg.stone) costParts.push(`${cfg.stone}🪨`);
    const statusLabel = owned ? (cfg.equipKey ? (equipped ? 'En mano' : 'Guardado') : 'Equipado') : costParts.join(' ');
    el.innerHTML = `<span class="craftIcon">${cfg.icon}</span>` +
      `<span class="craftName">${RECIPES[action].label}</span>` +
      `<span class="craftCost">${statusLabel}</span>` +
      `<span class="craftKey">${cfg.key}</span>`;
    grid.appendChild(el);
  }
}

export function updateCraftMenu() {
  renderCraftGrid();
}

export function isCraftMenuOpen() {
  return document.getElementById('craftPanel').classList.contains('show');
}

export function toggleCraftMenu(force) {
  if (!state.running || state.gameOver) return;
  const el = document.getElementById('craftPanel');
  const show = force !== undefined ? force : !el.classList.contains('show');
  el.classList.toggle('show', show);
  if (show) {
    // Mismo criterio que toggleInventory(): un solo panel modal a la vez.
    if (isInventoryOpen()) closeInventory();
    updateCraftMenu();
    SoundFX.bagOpen();
  } else {
    SoundFX.bagClose();
  }
}

export function closeCraftMenu() {
  const el = document.getElementById('craftPanel');
  if (el.classList.contains('show')) SoundFX.bagClose();
  el.classList.remove('show');
}

// ---------- Inventario en grilla (5 columnas x 2 filas = 10 slots) ----------
// Los materiales/bayas siguen viviendo como contadores simples en state.player
// (wood/stone/berries), igual que antes: acá solo se "parten" en stacks de
// STACK_SIZE para mostrarlos. Las herramientas (no se apilan) ocupan un slot
// entero cada una, solo si el jugador la tiene.
const INV_SLOT_COUNT = 10;
const ITEM_INFO = {
  wood: { icon: '🌲', name: 'Madera', stackable: true },
  stone: { icon: '🪨', name: 'Piedra', stackable: true },
  berries: { icon: '🍓', name: 'Bayas', stackable: true },
  spear: { icon: '🔱', name: 'Lanza', stackable: false },
  axe: { icon: '🪓', name: 'Hacha', stackable: false },
  pickaxe: { icon: '⛏️', name: 'Pico', stackable: false },
  backpack: { icon: '🎒', name: 'Mochila', stackable: false }
};

function buildInventorySlots() {
  const slots = [];
  const materials = [['wood', state.player.wood], ['stone', state.player.stone], ['berries', state.player.berries]];
  for (const [type, amount] of materials) {
    let remaining = amount;
    while (remaining > 0) {
      slots.push({ type, count: Math.min(STACK_SIZE, remaining) });
      remaining -= STACK_SIZE;
    }
  }
  const tools = [['spear', state.player.hasSpear], ['axe', state.player.hasAxe], ['pickaxe', state.player.hasPickaxe], ['backpack', state.player.hasBackpack]];
  for (const [type, owned] of tools) {
    if (owned) slots.push({ type, count: 1 });
  }
  while (slots.length < INV_SLOT_COUNT) slots.push(null);
  return slots.slice(0, INV_SLOT_COUNT);
}

// Se evita reconstruir la grilla si nada cambió desde el último render: además
// de ser más barato, es lo que permite arrastrar un item sin que el propio
// refresco por-frame de la UI borre el elemento a mitad del drag.
let lastInvSignature = null;

function renderInventoryGrid() {
  const slots = buildInventorySlots();
  const signature = JSON.stringify(slots) + '|' + state.player.equippedTool;
  if (signature === lastInvSignature) return;
  lastInvSignature = signature;

  const grid = document.getElementById('invGrid2');
  grid.innerHTML = '';
  for (const item of slots) {
    const el = document.createElement('div');
    el.className = 'invSlot2';
    if (!item) {
      el.classList.add('empty');
      grid.appendChild(el);
      continue;
    }
    const info = ITEM_INFO[item.type];
    el.classList.add('filled');
    if (!info.stackable) {
      el.classList.add('toolSlot');
      if (state.player.equippedTool === item.type) el.classList.add('active');
    }
    el.title = info.name;
    el.innerHTML = `<span class="invIcon2">${info.icon}</span>` + (info.stackable ? `<span class="stackCount">${item.count}</span>` : '');
    el.draggable = true;
    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', item.type);
      e.dataTransfer.effectAllowed = 'move';
      el.classList.add('dragging');
    });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));
    grid.appendChild(el);
  }
}

export function updateInventoryPanel() {
  document.getElementById('invPanelCap').textContent = `${invTotal()}/${capFor()}`;
  renderInventoryGrid();
}

export function isInventoryOpen() {
  return document.getElementById('invPanel').classList.contains('show');
}

export function toggleInventory(force) {
  if (!state.running || state.gameOver) return;
  const el = document.getElementById('invPanel');
  const show = force !== undefined ? force : !el.classList.contains('show');
  el.classList.toggle('show', show);
  if (show) {
    if (isCraftMenuOpen()) closeCraftMenu();
    updateInventoryPanel();
    SoundFX.bagOpen();
  } else {
    SoundFX.bagClose();
  }
}

export function closeInventory() {
  const el = document.getElementById('invPanel');
  if (el.classList.contains('show')) SoundFX.bagClose();
  el.classList.remove('show');
}

// Mantiene el nombre histórico (ya se llama desde crafting.js/player.js tras
// cada craft) pero ahora refresca la hotbar y el panel de inventario.
export function updateEquipUI() {
  updateHotbar();
  if (isInventoryOpen()) updateInventoryPanel();
  if (isCraftMenuOpen()) updateCraftMenu();
}

export function updateHUD() {
  document.getElementById('bar-health').style.width = clamp(state.player.health, 0, 100) + '%';
  document.getElementById('bar-hunger').style.width = clamp(state.player.hunger, 0, 100) + '%';
  document.getElementById('bar-thirst').style.width = clamp(state.player.thirst, 0, 100) + '%';
  document.getElementById('bar-stam').style.width = clamp(state.player.stamina, 0, 100) + '%';
  document.getElementById('dayCount').textContent = 'Día ' + state.dayCounter;
  const phase = (state.elapsed % DAY_LENGTH) / DAY_LENGTH;
  let label = '☀ Día';
  if (phase > 0.5 && phase < 0.62) label = '🌇 Atardecer';
  else if (phase >= 0.62 && phase < 0.95) label = '🌙 Noche';
  else if (phase >= 0.95 || phase < 0.08) label = '🌌 Madrugada';
  else if (phase >= 0.08 && phase < 0.15) label = '☀ Amanecer';
  document.getElementById('timeLabel').textContent = label;
  updateHotbar();
  if (isInventoryOpen()) updateInventoryPanel();
  if (isCraftMenuOpen()) updateCraftMenu();
}

export function endGame() {
  state.gameOver = true;
  state.running = false;
  SoundFX.setAmbientActive(false);
  SoundFX.playerDeath();
  SoundFX.gameOverSting();
  hideInteractPrompt();
  document.getElementById('menuBtn').classList.add('hidden');
  document.getElementById('minimapWrap').classList.add('hidden');
  document.getElementById('hotbar').classList.add('hidden');
  closeInventory();
  closeCraftMenu();
  document.getElementById('survivedText').textContent = `Sobreviviste ${state.dayCounter} día${state.dayCounter === 1 ? '' : 's'}`;
  document.getElementById('gameOver').style.display = 'block';
}

export function openPause() {
  if (!state.running || state.gameOver) return;
  state.paused = true;
  SoundFX.setAmbientActive(false);
  closeInventory();
  closeCraftMenu();
  hideInteractPrompt();
  document.getElementById('pauseMenu').style.display = 'block';
}

export function closePause() {
  state.paused = false;
  SoundFX.setAmbientActive(true);
  document.getElementById('pauseMenu').style.display = 'none';
  state.lastTime = performance.now();
}

let settingsReturnTo = null;

export function openSettings(from) {
  settingsReturnTo = from;
  SoundFX.click();
  if (from === 'title') {
    document.getElementById('title').classList.add('hidden');
  } else {
    document.getElementById('pauseMenu').style.display = 'none';
  }
  document.getElementById('settingsPanel').style.display = 'block';
}

export function closeSettings() {
  SoundFX.click();
  document.getElementById('settingsPanel').style.display = 'none';
  if (settingsReturnTo === 'title') {
    document.getElementById('title').classList.remove('hidden');
  } else {
    document.getElementById('pauseMenu').style.display = 'block';
  }
}

export function goToMainMenu() {
  state.paused = false;
  state.running = false;
  state.gameOver = false;
  SoundFX.setAmbientActive(false);
  document.getElementById('pauseMenu').style.display = 'none';
  document.getElementById('settingsPanel').style.display = 'none';
  document.getElementById('gameOver').style.display = 'none';
  document.getElementById('menuBtn').classList.add('hidden');
  document.getElementById('minimapWrap').classList.add('hidden');
  document.getElementById('hotbar').classList.add('hidden');
  closeInventory();
  closeCraftMenu();
  document.getElementById('title').classList.remove('hidden');
}

export function wireVolumeControls(sliderId, muteId, onVolume, onMute) {
  const slider = document.getElementById(sliderId);
  const mute = document.getElementById(muteId);
  slider.addEventListener('input', () => onVolume(parseFloat(slider.value)));
  mute.addEventListener('change', () => onMute(mute.checked));
}
