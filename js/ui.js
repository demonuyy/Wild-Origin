import { state, clamp, DAY_LENGTH, invTotal, capFor } from './config.js';
import { SoundFX } from './audio.js';

let hintTimeout = null;

// Costo/estado de cada acción de la hotbar, usado solo para pintar la UI
// (la validación real de recursos sigue viviendo en crafting.js).
const HOTBAR_CONFIG = {
  spear: { wood: 4, stone: 2, ownedKey: 'hasSpear' },
  campfire: { wood: 6, stone: 0, ownedKey: null },
  axe: { wood: 5, stone: 3, ownedKey: 'hasAxe' },
  pickaxe: { wood: 5, stone: 3, ownedKey: 'hasPickaxe' },
  backpack: { wood: 8, stone: 4, ownedKey: 'hasBackpack' },
  shelter: { wood: 15, stone: 8, ownedKey: null }
};

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

export function updateHotbar() {
  const slots = document.querySelectorAll('#hotbar .hotSlot[data-action]');
  slots.forEach(el => {
    const cfg = HOTBAR_CONFIG[el.dataset.action];
    if (!cfg) return;
    const owned = cfg.ownedKey && state.player[cfg.ownedKey];
    const affordable = state.player.wood >= cfg.wood && state.player.stone >= cfg.stone;
    el.classList.toggle('owned', !!owned);
    el.classList.toggle('affordable', !owned && affordable);
    el.classList.toggle('disabled', !owned && !affordable);
    if (owned) {
      const costEl = el.querySelector('.hotCost');
      if (costEl.textContent !== 'Equipado') costEl.textContent = 'Equipado';
    }
  });
}

export function updateInventoryPanel() {
  document.getElementById('inv-wood').textContent = state.player.wood;
  document.getElementById('inv-stone').textContent = state.player.stone;
  document.getElementById('inv-berry').textContent = state.player.berries;
  document.getElementById('invPanelCap').textContent = `${invTotal()}/${capFor()}`;
  document.getElementById('equip-spear').classList.toggle('owned', state.player.hasSpear);
  document.getElementById('equip-axe').classList.toggle('owned', state.player.hasAxe);
  document.getElementById('equip-pick').classList.toggle('owned', state.player.hasPickaxe);
  document.getElementById('equip-pack').classList.toggle('owned', state.player.hasBackpack);
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
    updateInventoryPanel();
    SoundFX.click();
  }
}

export function closeInventory() {
  document.getElementById('invPanel').classList.remove('show');
}

// Mantiene el nombre histórico (ya se llama desde crafting.js/player.js tras
// cada craft) pero ahora refresca la hotbar y el panel de inventario.
export function updateEquipUI() {
  updateHotbar();
  if (isInventoryOpen()) updateInventoryPanel();
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
}

export function endGame() {
  state.gameOver = true;
  state.running = false;
  SoundFX.setAmbientActive(false);
  SoundFX.gameOverSting();
  document.getElementById('menuBtn').classList.add('hidden');
  document.getElementById('minimapWrap').classList.add('hidden');
  document.getElementById('hotbar').classList.add('hidden');
  closeInventory();
  document.getElementById('survivedText').textContent = `Sobreviviste ${state.dayCounter} día${state.dayCounter === 1 ? '' : 's'}`;
  document.getElementById('gameOver').style.display = 'block';
}

export function openPause() {
  if (!state.running || state.gameOver) return;
  state.paused = true;
  SoundFX.setAmbientActive(false);
  closeInventory();
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
  document.getElementById('title').classList.remove('hidden');
}

export function wireVolumeControls(sliderId, muteId) {
  const slider = document.getElementById(sliderId);
  const mute = document.getElementById(muteId);
  slider.addEventListener('input', () => SoundFX.setVolume(parseFloat(slider.value)));
  mute.addEventListener('change', () => SoundFX.setMuted(mute.checked));
}
