import { state, canvas, DAY_LENGTH, clamp } from './config.js';
import { SoundFX } from './audio.js';
import { generateWorld, updateChunks, restoreChunksFromSave, updateBloodDecals, updateRippleDecals } from './world.js';
import { updateDeer, updateRabbits } from './animals.js';
import { updateWolves } from './enemies.js';
import { resetPlayer, updatePlayer, updateInteractionPrompt } from './player.js';
import { pushLog, updateEquipUI, updateHUD, endGame, openPause, closePause, goToMainMenu, wireVolumeControls, showHint, openSettings, closeSettings } from './ui.js';
import { saveGame, loadGame, hasSavedGame, tickAutosave, resetAutosaveTimer } from './save.js';
import { render } from './render.js';
import { bindControls } from './input.js';

// game.js es ahora solo el "orquestador": arranca/reinicia partidas, corre
// el bucle principal y conecta los botones de menú. El renderizado vive en
// render.js y el binding de controles de juego (teclado/wheel/hotbar) en
// input.js; acá solo queda el binding de los MENÚS (title/pause/settings),
// que está atado a resetGame()/continueGame() definidas más abajo.

function resetGame() {
  resetPlayer();
  state.elapsed = 0;
  state.dayCounter = 1;
  state.gameOver = false;
  generateWorld();
  updateEquipUI();
  updateHUD();
  resetAutosaveTimer();
  SoundFX.setAmbientActive(true);
}

// Restaura la última partida guardada en localStorage. Si no hay ninguna (o
// está corrupta), cae de vuelta a una partida nueva.
function continueGame() {
  state.gameOver = false;
  const ok = loadGame();
  if (!ok) {
    resetGame();
    return;
  }
  restoreChunksFromSave();
  updateEquipUI();
  updateHUD();
  resetAutosaveTimer();
  SoundFX.setAmbientActive(true);
}

function refreshContinueButton() {
  const btn = document.getElementById('continueBtn');
  if (btn) btn.classList.toggle('hidden', !hasSavedGame());
}

function update(dt) {
  // Suaviza el zoom hacia el valor objetivo (fijado por la rueda del mouse).
  state.zoom += (state.targetZoom - state.zoom) * Math.min(1, dt * 8);

  state.elapsed += dt;
  if (state.elapsed >= state.dayCounter * DAY_LENGTH) {
    state.dayCounter++;
    SoundFX.dayChime();
    pushLog(`Comienza el día ${state.dayCounter}`);
  }

  updatePlayer(dt);
  updateInteractionPrompt();

  const viewW = canvas.width / state.zoom;
  const viewH = canvas.height / state.zoom;
  updateChunks(viewW, viewH);

  if (state.player.hunger <= 0 || state.player.thirst <= 0) {
    state.player.health = clamp(state.player.health - 3.2 * dt, 0, 100);
  }

  for (const b of state.bushes) {
    if (b.stock <= 0) {
      b.regrowTimer -= dt;
      if (b.regrowTimer <= 0) b.stock = b.maxStock;
    }
  }
  for (let i = state.campfires.length - 1; i >= 0; i--) {
    state.campfires[i].life -= dt;
    state.campfires[i].pulse += dt;
    if (state.campfires[i].life <= 0) state.campfires.splice(i, 1);
  }

  updateDeer(dt);
  updateRabbits(dt);
  updateWolves(dt);
  updateBloodDecals(dt);
  updateRippleDecals(dt);

  if (state.player.health <= 0) endGame();
  updateHUD();
  tickAutosave(dt);
}

function loop(now) {
  const dt = Math.min(0.05, (now - state.lastTime) / 1000);
  state.lastTime = now;
  if (state.running && !state.gameOver && !state.paused) {
    update(dt);
    render();
  }
  requestAnimationFrame(loop);
}

function bindUI() {
  document.getElementById('startBtn').addEventListener('click', () => {
    SoundFX.init();
    SoundFX.click();
    document.getElementById('title').classList.add('hidden');
    document.getElementById('menuBtn').classList.remove('hidden');
    document.getElementById('minimapWrap').classList.remove('hidden');
    document.getElementById('hotbar').classList.remove('hidden');
    resetGame();
    state.running = true;
    pushLog('El bosque te observa. Sobrevivé.');
  });
  document.getElementById('continueBtn').addEventListener('click', () => {
    SoundFX.init();
    SoundFX.click();
    document.getElementById('title').classList.add('hidden');
    document.getElementById('menuBtn').classList.remove('hidden');
    document.getElementById('minimapWrap').classList.remove('hidden');
    document.getElementById('hotbar').classList.remove('hidden');
    continueGame();
    state.running = true;
    pushLog('Partida cargada');
  });
  document.getElementById('saveBtn').addEventListener('click', () => {
    SoundFX.click();
    saveGame();
    pushLog('Partida guardada');
    showHint('Partida guardada ✓');
  });
  document.getElementById('restartBtn').addEventListener('click', () => {
    SoundFX.click();
    document.getElementById('gameOver').style.display = 'none';
    document.getElementById('menuBtn').classList.remove('hidden');
    document.getElementById('minimapWrap').classList.remove('hidden');
    document.getElementById('hotbar').classList.remove('hidden');
    resetGame();
    state.running = true;
  });
  document.getElementById('menuBtn').addEventListener('click', () => { SoundFX.click(); openPause(); });
  document.getElementById('resumeBtn').addEventListener('click', () => { SoundFX.click(); closePause(); });
  document.getElementById('pauseRestartBtn').addEventListener('click', () => {
    SoundFX.click();
    document.getElementById('pauseMenu').style.display = 'none';
    document.getElementById('hotbar').classList.remove('hidden');
    state.paused = false;
    resetGame();
    state.running = true;
  });
  document.getElementById('pauseMainMenuBtn').addEventListener('click', () => { SoundFX.click(); goToMainMenu(); refreshContinueButton(); });
  document.getElementById('settingsBtnTitle').addEventListener('click', () => openSettings('title'));
  document.getElementById('settingsBtnPause').addEventListener('click', () => openSettings('pause'));
  document.getElementById('settingsCloseBtn').addEventListener('click', () => closeSettings());

  wireVolumeControls('volumeSlider', 'muteToggle', v => SoundFX.setVolume(v), m => SoundFX.setMuted(m));
  wireVolumeControls('volumeSliderSfx', 'muteToggleSfx', v => SoundFX.setSfxVolume(v), m => SoundFX.setSfxMuted(m));
  wireVolumeControls('volumeSliderAmbient', 'muteToggleAmbient', v => SoundFX.setAmbientVolume(v), m => SoundFX.setAmbientMuted(m));
}

function init() {
  bindControls();
  bindUI();
  generateWorld();
  updateEquipUI();
  updateHUD();
  refreshContinueButton();
  requestAnimationFrame(loop);
}

init();
