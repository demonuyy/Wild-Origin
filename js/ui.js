import { state, clamp, DAY_LENGTH, invTotal, capFor, ITEMS, hasItem, countItem, HOTBAR_SIZE, pruneHotbar, syncInventorySlots, getDurability, maxDurability } from './config.js';
import { SoundFX } from './audio.js';
import { RECIPES } from './recipes.js';

let hintTimeout = null;

// Metadata de cada receta para el menú de crafteo completo (tecla C): a qué
// item de ITEMS corresponde para "ya lo tengo" vía hasItem(), qué valor de
// equippedTool corresponde para lanza/hacha/pico, y el icono. Los costos NO
// se repiten acá: salen siempre de RECIPES[action].cost.
// Antes esta tabla también describía la hotbar física (que mostraba SIEMPRE
// estas 6 recetas, se tuvieran o no). Ahora la hotbar es una barra real de
// ítems poseídos (ver renderHotbar más abajo) y esta tabla queda acotada al
// menú de crafteo completo. El click en una casilla siempre craftea (o
// equipa/guarda si ya está craftada) — no depende de ninguna tecla.
const CRAFT_CONFIG = {
  spear: { equipKey: 'spear', icon: '🔱', image: 'assets/images/items/spear.png' },
  campfire: { icon: '🔥', image: 'assets/images/items/campfire.png' },
  axe: { equipKey: 'axe', icon: '🪓', image: 'assets/images/items/axe.png' },
  pickaxe: { equipKey: 'pickaxe', icon: '⛏️', image: 'assets/images/items/pickaxe.png' },
  backpack: { icon: '🎒', image: 'assets/images/items/backpack.png' },
  shelter: { icon: '⛺', image: 'assets/images/items/shelter.png' }
};

// Una acción "se posee" si su propio id es un item craftable que el
// jugador ya tiene (spear/axe/pickaxe/backpack). campfire/shelter no son
// items del inventario (se colocan en el mundo), así que nunca están
// "poseídos" en este sentido: siempre se evalúan por costo.
function isOwnableAction(action) {
  return !!ITEMS[action];
}

function affordableFor(action) {
  const cost = RECIPES[action].cost;
  return Object.entries(cost).every(([id, qty]) => countItem(id) >= qty);
}

// Estado (poseído / se puede craftear ahora / equipado) de una entrada de
// CRAFT_CONFIG, usado por el menú de crafteo completo (tecla C).
function craftSlotStatus(action) {
  const cfg = CRAFT_CONFIG[action];
  const owned = isOwnableAction(action) && hasItem(action);
  const affordable = affordableFor(action);
  const equipped = !!(cfg.equipKey && state.player.equippedTool === action);
  const durability = owned ? getDurability(action) : null;
  return { cfg, owned, affordable, equipped, durability };
}

// Arma el HTML de un ícono de ítem/receta a partir de su `{ icon, image, label }`.
// Se usa en hotbar, inventario y menú de crafteo en vez de imprimir el emoji
// directo, así que agregar el `image` de un ítem nuevo alcanza para que
// aparezca con arte real en los tres lugares a la vez. Si todavía no tiene
// `image` (ítem sin arte propio), cae al emoji de `icon` como antes.
function itemIconHtml(info, className) {
  if (info.image) {
    return `<img class="${className}" src="${info.image}" alt="${info.label || ''}" draggable="false">`;
  }
  return `<span class="${className} emojiIcon">${info.icon}</span>`;
}

// Barrita fina de durabilidad para lanza/hacha/pico (las únicas con
// `durability` en ITEMS, ver config.js). Devuelve '' para cualquier otro
// ítem (recursos, comida, mochila), así que se puede llamar siempre sin
// chequear antes. El color baja de verde a amarillo a rojo a medida que se
// gasta, igual criterio que las barras de vida/hambre del HUD.
function durabilityBarHtml(id) {
  const max = maxDurability(id);
  if (!max) return '';
  const current = getDurability(id);
  const pct = clamp((current / max) * 100, 0, 100);
  const level = pct > 50 ? 'high' : pct > 20 ? 'mid' : 'low';
  return `<div class="durabilityBar"><div class="durabilityFill ${level}" style="width:${pct}%"></div></div>`;
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

// ---------- Hotbar real ----------
// A diferencia de antes (6 acciones de crafteo siempre visibles, se tuviera
// o no el material), esta hotbar solo muestra HOTBAR_SIZE casillas con lo
// que el jugador REALMENTE tiene asignado (ver player.hotbar en config.js).
// Craftear sigue viviendo enteramente en el menú de crafteo (tecla C, más
// abajo); esta barra es sólo para USAR lo que ya se posee: click para
// equipar una herramienta o comer, y arrastrar para reordenar/asignar
// (ver el delegado de drag&drop en input.js).
//
// Igual criterio que renderInventoryGrid(): se evita reconstruir el DOM si
// nada cambió, así un drag en curso no se corta por el refresco por-frame.
let lastHotbarSignature = null;

function renderHotbar() {
  pruneHotbar();
  // La firma tiene que incluir la CANTIDAD de cada ítem asignado, no solo
  // qué id está en cada casilla: si ya tenías madera asignada y recolectás
  // más, el array de ids no cambia, así que sin esto el cartelito de
  // cantidad se quedaba pegado en el número viejo hasta que algo más
  // (equipar, asignar otra casilla) forzara un re-render.
  const counts = state.player.hotbar.map(id => (id ? countItem(id) : 0)).join(',');
  const durabilities = state.player.hotbar.map(id => (id ? getDurability(id) : '')).join(',');
  const signature = JSON.stringify(state.player.hotbar) + '|' + state.player.equippedTool + '|' + counts + '|' + durabilities;
  if (signature === lastHotbarSignature) return;
  lastHotbarSignature = signature;

  const bar = document.getElementById('hotbarSlots');
  bar.innerHTML = '';
  for (let i = 0; i < HOTBAR_SIZE; i++) {
    const id = state.player.hotbar[i];
    const el = document.createElement('div');
    el.className = 'hotSlot';
    el.dataset.slotIndex = String(i);
    if (!id) {
      el.classList.add('emptySlot');
      el.innerHTML = `<span class="hotKey">${i + 1}</span>`;
      bar.appendChild(el);
      continue;
    }
    const info = ITEMS[id];
    const stackable = info.category !== 'tool';
    const equipped = info.category === 'tool' && state.player.equippedTool === id;
    el.classList.add('filled');
    el.classList.toggle('active', equipped);
    el.dataset.itemId = id;
    el.title = info.label;
    const statusText = info.category === 'tool' ? (equipped ? 'En mano' : 'Guardado') : '';
    // La hotbar es UNA sola casilla por tipo (no reparte en varios stacks
    // como el panel de inventario), así que el número que muestra respeta
    // el mismo tope de stack que en cualquier otro lado: nunca más de
    // `info.stack` aunque el jugador tenga más cantidad guardada.
    const shownCount = Math.min(countItem(id), info.stack);
    el.innerHTML = itemIconHtml(info, 'hotIcon') +
      `<span class="hotKey">${i + 1}</span>` +
      durabilityBarHtml(id) +
      (statusText ? `<span class="hotCost">${statusText}</span>` : '') +
      (stackable ? `<span class="stackCount">${shownCount}</span>` : '');
    bar.appendChild(el);
  }
}

export function updateHotbar() {
  renderHotbar();
}

// ---------- Menú de crafteo completo (tecla C) ----------
// Muestra TODAS las recetas de RECIPES a la vez (a diferencia de la hotbar,
// que ya las tiene siempre visibles pero mezcladas con el resto del HUD).
// Se arma dinámicamente desde CRAFT_CONFIG/RECIPES así que una receta nueva
// (v0.3+: horno, arco...) aparece acá solo con agregarla a esas dos tablas,
// sin tocar este archivo.
// Antes esta función reconstruía TODO el grid (innerHTML = '') en cada
// llamada, y updateCraftMenu()/updateEquipUI() la llaman en cada frame
// mientras el panel está abierto (~60 veces por segundo). Eso destruía y
// recreaba la casilla clickeada a mitad de un click real (mousedown y
// mouseup podían caer en dos frames distintos, con dos elementos DOM
// distintos de por medio), así que el clic nunca llegaba a completarse.
// Mismo criterio que ya tenían renderHotbar()/renderInventoryGrid(): si el
// estado relevante no cambió desde el último render, no se toca el DOM.
let lastCraftSignature = null;

function renderCraftGrid() {
  const signature = Object.keys(CRAFT_CONFIG)
    .map(action => JSON.stringify(craftSlotStatus(action)))
    .join('|');
  if (signature === lastCraftSignature) return;
  lastCraftSignature = signature;

  const grid = document.getElementById('craftGrid');
  grid.innerHTML = '';
  for (const action of Object.keys(CRAFT_CONFIG)) {
    const { cfg, owned, affordable, equipped, durability } = craftSlotStatus(action);
    const el = document.createElement('div');
    el.className = 'craftSlot';
    el.dataset.action = action;
    el.classList.toggle('owned', owned);
    el.classList.toggle('affordable', !owned && affordable);
    el.classList.toggle('disabled', !owned && !affordable);
    el.classList.toggle('active', equipped);
    const costParts = Object.entries(RECIPES[action].cost)
      .filter(([, qty]) => qty)
      .map(([id, qty]) => `${qty}${ITEMS[id] ? itemIconHtml(ITEMS[id], 'costIcon') : ''}`);
    const statusLabel = owned ? (cfg.equipKey ? (equipped ? 'En mano' : 'Guardado') : 'Equipado') : costParts.join(' ');
    const max = maxDurability(action);
    // Botón de reparar: solo aparece si el ítem tiene durability, ya está
    // craftéado, y no está al tope. Es un elemento con su propia clase
    // (repairBtn) para que input.js lo distinga del resto de la casilla y
    // no dispare también el equipar/guardar (ver el listener delegado).
    const repairBtnHtml = owned && max && durability < max
      ? '<div class="repairBtn" title="Reparar">🔧</div>'
      : '';
    el.innerHTML = itemIconHtml(cfg, 'craftIcon') +
      `<span class="craftName">${RECIPES[action].label}</span>` +
      (owned && max ? durabilityBarHtml(action) : '') +
      `<span class="craftCost">${statusLabel}${owned && max ? ` (${durability}/${max})` : ''}</span>` +
      repairBtnHtml;
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
  if (!state.running || state.gameOver || state.paused) return;
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

// ---------- Inventario en grilla (5 columnas x 2 filas = 10 slots, o 4 filas
// = 20 slots con mochila) ----------
// player.inventory ya es un array real de { id, qty } (ver ITEMS en
// config.js): acá solo se "parten" los apilables en stacks de ITEMS[id].stack
// para mostrarlos. Las herramientas (stack: 1) siempre ocupan un slot entero.
const INV_BASE_ROWS = 2;
const INV_BACKPACK_ROWS = 2; // filas extra al tener la mochila (ver hasItem('backpack'))
const INV_COLS = 5;

function invSlotCount() {
  const rows = INV_BASE_ROWS + (hasItem('backpack') ? INV_BACKPACK_ROWS : 0);
  return rows * INV_COLS;
}

function buildInventorySlots() {
  const slotCount = invSlotCount();
  // Sincroniza invSlots con lo que el jugador realmente tiene ANTES de
  // leerlo: agrega/saca casillas de stack según subió o bajó la cantidad,
  // sin tocar las posiciones que siguen siendo válidas (ver config.js).
  syncInventorySlots(slotCount);
  const invSlots = state.player.invSlots;
  const slots = [];
  for (let i = 0; i < slotCount; i++) {
    const entry = invSlots[i];
    slots.push(entry ? { type: entry.id, count: entry.qty } : null);
  }
  return slots;
}

// Se evita reconstruir la grilla si nada cambió desde el último render: además
// de ser más barato, es lo que permite arrastrar un item sin que el propio
// refresco por-frame de la UI borre el elemento a mitad del drag.
let lastInvSignature = null;

function renderInventoryGrid() {
  const slots = buildInventorySlots();
  const expanded = hasItem('backpack');
  const durabilities = slots.map(s => (s ? getDurability(s.type) : '')).join(',');
  const signature = JSON.stringify(slots) + '|' + state.player.equippedTool + '|' + expanded + '|' + durabilities;
  if (signature === lastInvSignature) return;
  lastInvSignature = signature;

  const grid = document.getElementById('invGrid2');
  grid.classList.toggle('expanded', expanded);
  grid.innerHTML = '';
  slots.forEach((item, i) => {
    const el = document.createElement('div');
    el.className = 'invSlot2';
    el.dataset.slotIndex = i;
    if (!item) {
      el.classList.add('empty');
      grid.appendChild(el);
      return;
    }
    const info = ITEMS[item.type];
    const stackable = info.category !== 'tool';
    el.classList.add('filled');
    if (!stackable) {
      el.classList.add('toolSlot');
      if (state.player.equippedTool === item.type) el.classList.add('active');
    }
    el.title = info.label;
    el.dataset.itemId = item.type;
    el.innerHTML = itemIconHtml(info, 'invIcon2') + durabilityBarHtml(item.type) +
      (stackable ? `<span class="stackCount">${item.count}</span>` : '');
    grid.appendChild(el);
  });
}

export function updateInventoryPanel() {
  const cap = capFor();
  document.getElementById('invPanelCap').textContent = `${invTotal()}/${cap === Infinity ? '∞' : cap}`;
  renderInventoryGrid();
}

export function isInventoryOpen() {
  return document.getElementById('invPanel').classList.contains('show');
}

export function toggleInventory(force) {
  if (!state.running || state.gameOver || state.paused) return;
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
