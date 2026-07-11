import { state, clamp, DAY_LENGTH, invTotal, capFor } from './config.js';
import { SoundFX } from './audio.js';

let hintTimeout = null;

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

export function updateEquipUI() {
  const tools = [];
  if (state.player.hasAxe) tools.push('Hacha');
  if (state.player.hasPickaxe) tools.push('Pico');
  if (state.player.hasBackpack) tools.push('Mochila');
  const toolsText = tools.length ? tools.join(', ') : 'Ninguna';
  document.getElementById('equip').innerHTML = `Arma: <span id="weaponName">${state.player.hasSpear ? 'Lanza' : 'Manos'}</span> &nbsp;|&nbsp; Herramientas: ${toolsText}`;
}

export function updateHUD() {
  document.getElementById('bar-health').style.width = clamp(state.player.health, 0, 100) + '%';
  document.getElementById('bar-hunger').style.width = clamp(state.player.hunger, 0, 100) + '%';
  document.getElementById('bar-thirst').style.width = clamp(state.player.thirst, 0, 100) + '%';
  document.getElementById('bar-stam').style.width = clamp(state.player.stamina, 0, 100) + '%';
  document.getElementById('cnt-wood').textContent = state.player.wood;
  document.getElementById('cnt-stone').textContent = state.player.stone;
  document.getElementById('cnt-berry').textContent = state.player.berries;
  document.getElementById('invCap').textContent = `${invTotal()}/${capFor()}`;
  document.getElementById('dayCount').textContent = 'Día ' + state.dayCounter;
  const phase = (state.elapsed % DAY_LENGTH) / DAY_LENGTH;
  let label = '☀ Día';
  if (phase > 0.5 && phase < 0.62) label = '🌇 Atardecer';
  else if (phase >= 0.62 && phase < 0.95) label = '🌙 Noche';
  else if (phase >= 0.95 || phase < 0.08) label = '🌌 Madrugada';
  else if (phase >= 0.08 && phase < 0.15) label = '☀ Amanecer';
  document.getElementById('timeLabel').textContent = label;
}

export function endGame() {
  state.gameOver = true;
  state.running = false;
  SoundFX.gameOverSting();
  document.getElementById('menuBtn').classList.add('hidden');
  document.getElementById('minimapWrap').classList.add('hidden');
  document.getElementById('survivedText').textContent = `Sobreviviste ${state.dayCounter} día${state.dayCounter === 1 ? '' : 's'}`;
  document.getElementById('gameOver').style.display = 'block';
}

export function openPause() {
  if (!state.running || state.gameOver) return;
  state.paused = true;
  document.getElementById('pauseMenu').style.display = 'block';
}

export function closePause() {
  state.paused = false;
  document.getElementById('pauseMenu').style.display = 'none';
  state.lastTime = performance.now();
}

export function goToMainMenu() {
  state.paused = false;
  state.running = false;
  state.gameOver = false;
  document.getElementById('pauseMenu').style.display = 'none';
  document.getElementById('gameOver').style.display = 'none';
  document.getElementById('menuBtn').classList.add('hidden');
  document.getElementById('minimapWrap').classList.add('hidden');
  document.getElementById('title').classList.remove('hidden');
}

export function wireVolumeControls(sliderId, muteId) {
  const slider = document.getElementById(sliderId);
  const mute = document.getElementById(muteId);
  slider.addEventListener('input', () => SoundFX.setVolume(parseFloat(slider.value)));
  mute.addEventListener('change', () => SoundFX.setMuted(mute.checked));
}
