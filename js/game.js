import { state, ctx, canvas, DAY_LENGTH, ZOOM_MIN, ZOOM_MAX, resize, rand, dist, clamp, isNightPhase } from './config.js';
import { SoundFX } from './audio.js';
import { generateWorld, updateChunks, restoreChunksFromSave, drawGround, drawGrassDecor, drawPonds, drawTree, drawRock, drawBush, drawStick, drawStone } from './world.js';
import { updateDeer, drawDeer } from './animals.js';
import { updateWolves, drawWolf } from './enemies.js';
import { resetPlayer, tryInteract, tryAttack, updatePlayer, updateInteractionPrompt, handleManualEat } from './player.js';
import { tryCraftSpear, tryPlaceCampfire, tryCraftAxe, tryCraftPickaxe, tryCraftBackpack, tryPlaceShelter, tryEquipTool } from './crafting.js';
import { drawCampfire, drawShelter } from './building.js';
import { pushLog, showHint, updateEquipUI, updateHUD, endGame, openPause, closePause, goToMainMenu, wireVolumeControls, toggleInventory, closeInventory, isInventoryOpen, openSettings, closeSettings } from './ui.js';
import { saveGame, loadGame, hasSavedGame, tickAutosave, resetAutosaveTimer } from './save.js';

// El minimapa es infinito como el mundo: no hay un WORLD_W/H para escalar,
// así que se centra siempre en el jugador y muestra una ventana fija a su alrededor.
const MINIMAP_RANGE = 1800; // unidades de mundo visibles a cada lado del jugador

function renderMinimap(cam, viewW, viewH) {
  const mc = document.getElementById('minimap');
  const mctx = mc.getContext('2d');
  const W = mc.width;
  const H = mc.height;
  const scale = W / (MINIMAP_RANGE * 2);
  const px = state.player.x, py = state.player.y;
  const toMap = (wx, wy) => [W / 2 + (wx - px) * scale, H / 2 + (wy - py) * scale];

  mctx.clearRect(0, 0, W, H);
  mctx.fillStyle = '#1c2e1a';
  mctx.fillRect(0, 0, W, H);

  mctx.fillStyle = '#3d6b7a';
  for (const p of state.ponds) { const [mx, my] = toMap(p.x, p.y); mctx.beginPath(); mctx.arc(mx, my, 2.2, 0, Math.PI * 2); mctx.fill(); }
  mctx.fillStyle = '#8a5a3a';
  for (const s of state.shelters) { const [mx, my] = toMap(s.x, s.y); mctx.beginPath(); mctx.arc(mx, my, 2.8, 0, Math.PI * 2); mctx.fill(); }
  mctx.fillStyle = '#ffb85c';
  for (const f of state.campfires) { const [mx, my] = toMap(f.x, f.y); mctx.beginPath(); mctx.arc(mx, my, 1.8, 0, Math.PI * 2); mctx.fill(); }
  mctx.fillStyle = '#c0392b';
  for (const w of state.wolves) { const [mx, my] = toMap(w.x, w.y); mctx.beginPath(); mctx.arc(mx, my, 1.6, 0, Math.PI * 2); mctx.fill(); }

  mctx.strokeStyle = 'rgba(203,216,195,0.45)';
  mctx.lineWidth = 1;
  const [rx, ry] = toMap(cam.x, cam.y);
  mctx.strokeRect(rx, ry, viewW * scale, viewH * scale);

  mctx.fillStyle = '#ffe9c7';
  mctx.beginPath();
  mctx.arc(W / 2, H / 2, 3, 0, Math.PI * 2);
  mctx.fill();
  mctx.strokeStyle = '#ffe9c7';
  mctx.lineWidth = 1.4;
  mctx.beginPath();
  mctx.moveTo(W / 2, H / 2);
  mctx.lineTo(W / 2 + state.player.dir.x * 9, H / 2 + state.player.dir.y * 9);
  mctx.stroke();
}

function drawPlayer(cam) {
  const sx = state.player.x - cam.x;
  const moving = Math.abs(state.player.dir.x) + Math.abs(state.player.dir.y) > 0 && state.keys && (state.keys['w'] || state.keys['a'] || state.keys['s'] || state.keys['d'] || state.keys['arrowup'] || state.keys['arrowdown'] || state.keys['arrowleft'] || state.keys['arrowright']);
  const bob = moving ? Math.sin(state.elapsed * 10) * 1.6 : 0;
  const sy = state.player.y - cam.y + bob;

  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(sx, state.player.y - cam.y + 15, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  if (state.player.hasBackpack) {
    ctx.fillStyle = '#5a4530';
    ctx.beginPath();
    ctx.ellipse(sx - state.player.dir.y * 8, sy + 4 - state.player.dir.x * 2, 6, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const bodyG = ctx.createLinearGradient(sx - 9, 0, sx + 9, 0);
  bodyG.addColorStop(0, '#5f3f22');
  bodyG.addColorStop(0.5, '#8a5c34');
  bodyG.addColorStop(1, '#5f3f22');
  ctx.fillStyle = bodyG;
  ctx.beginPath();
  ctx.moveTo(sx - 9, sy + 14);
  ctx.lineTo(sx + 9, sy + 14);
  ctx.lineTo(sx, sy - 6);
  ctx.closePath();
  ctx.fill();

  const headG = ctx.createRadialGradient(sx - 3, sy - 15, 1, sx, sy - 12, 9);
  headG.addColorStop(0, '#f0cca0');
  headG.addColorStop(1, '#cf9d6c');
  ctx.fillStyle = headG;
  ctx.beginPath();
  ctx.arc(sx, sy - 12, 8, 0, Math.PI * 2);
  ctx.fill();

  if (state.player.hasSpear) {
    ctx.strokeStyle = '#c9a86a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sx + state.player.dir.x * 4, sy + state.player.dir.y * 4);
    ctx.lineTo(sx + state.player.dir.x * 34, sy + state.player.dir.y * 34);
    ctx.stroke();
    ctx.fillStyle = '#e4e4dc';
    ctx.beginPath();
    ctx.arc(sx + state.player.dir.x * 36, sy + state.player.dir.y * 36, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Hacha o pico "en la mano": solo se dibuja si esa es la herramienta activa,
  // para que se note a simple vista que el jugador puede talar o minar ahora mismo.
  if (state.player.equippedTool === 'axe' || state.player.equippedTool === 'pickaxe') {
    const hx = sx + state.player.dir.x * 16;
    const hy = sy + state.player.dir.y * 16 - 4;
    ctx.strokeStyle = '#5a4530';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(hx, hy + 10);
    ctx.lineTo(hx + state.player.dir.x * 4, hy - 8);
    ctx.stroke();
    ctx.fillStyle = '#b7b6ac';
    ctx.beginPath();
    if (state.player.equippedTool === 'axe') {
      ctx.moveTo(hx + state.player.dir.x * 4 - 5, hy - 8);
      ctx.lineTo(hx + state.player.dir.x * 4 + 5, hy - 10);
      ctx.lineTo(hx + state.player.dir.x * 4 + 3, hy - 2);
      ctx.lineTo(hx + state.player.dir.x * 4 - 4, hy - 3);
    } else {
      ctx.moveTo(hx + state.player.dir.x * 4 - 6, hy - 5);
      ctx.lineTo(hx + state.player.dir.x * 4 + 6, hy - 11);
      ctx.lineTo(hx + state.player.dir.x * 4 + 2, hy - 3);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#e8933a';
  ctx.beginPath();
  ctx.arc(sx + state.player.dir.x * 10, sy + state.player.dir.y * 10 - 8, 2.2, 0, Math.PI * 2);
  ctx.fill();
}

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
  updateWolves(dt);

  if (state.player.health <= 0) endGame();
  updateHUD();
  tickAutosave(dt);
}

function render() {
  const zoom = state.zoom;
  // El área visible del mundo se achica con zoom > 1, acercando la cámara al jugador.
  const viewW = canvas.width / zoom;
  const viewH = canvas.height / zoom;
  const cam = {
    x: state.player.x - viewW / 2,
    y: state.player.y - viewH / 2
  };

  ctx.save();
  ctx.scale(zoom, zoom);

  drawGround(ctx, { width: viewW, height: viewH }, cam);
  drawGrassDecor(ctx, cam, viewW, viewH);
  drawPonds(ctx, cam, viewW, viewH);

  // Se descarta lo que quedó fuera de pantalla ANTES de armar el array a ordenar
  // (antes se armaba con TODO lo cargado en los chunks vecinos y se filtraba
  // recién adentro de cada draw(), lo cual con el mapa infinito significaba
  // ordenar miles de objetos innecesariamente en cada frame).
  const margin = 220;
  const left = cam.x - margin, right = cam.x + viewW + margin;
  const top = cam.y - margin, bottom = cam.y + viewH + margin;
  const inView = (o) => o.x >= left && o.x <= right && o.y >= top && o.y <= bottom;

  const drawables = [];
  for (const t of state.trees) if (inView(t)) drawables.push({ y: t.y, type: 0, ref: t });
  for (const r of state.rocks) if (inView(r)) drawables.push({ y: r.y, type: 1, ref: r });
  for (const b of state.bushes) if (inView(b)) drawables.push({ y: b.y, type: 2, ref: b });
  for (const s of state.sticks) if (inView(s)) drawables.push({ y: s.y, type: 8, ref: s });
  for (const s of state.stones) if (inView(s)) drawables.push({ y: s.y, type: 9, ref: s });
  for (const f of state.campfires) if (inView(f)) drawables.push({ y: f.y, type: 3, ref: f });
  for (const s of state.shelters) if (inView(s)) drawables.push({ y: s.y, type: 4, ref: s });
  for (const d of state.deer) if (inView(d)) drawables.push({ y: d.y, type: 5, ref: d });
  for (const w of state.wolves) if (inView(w)) drawables.push({ y: w.y, type: 6, ref: w });
  drawables.push({ y: state.player.y, type: 7, ref: null });
  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) {
    switch (d.type) {
      case 0: drawTree(d.ref, cam, ctx); break;
      case 1: drawRock(d.ref, cam, ctx); break;
      case 2: drawBush(d.ref, cam, ctx); break;
      case 3: drawCampfire(d.ref, cam); break;
      case 4: drawShelter(d.ref, cam); break;
      case 5: drawDeer(d.ref, cam, ctx); break;
      case 6: drawWolf(d.ref, cam, ctx); break;
      case 7: drawPlayer(cam); break;
      case 8: drawStick(d.ref, cam, ctx); break;
      case 9: drawStone(d.ref, cam, ctx); break;
    }
  }

  ctx.restore(); // el resto (oscuridad, flash, minimapa) se dibuja en espacio de pantalla real, sin escalar

  const phase = (state.elapsed % DAY_LENGTH) / DAY_LENGTH;
  let darkness = 0;
  if (phase > 0.42 && phase <= 0.58) darkness = (phase - 0.42) / 0.16;
  else if (phase > 0.58 && phase < 0.90) darkness = 1;
  else if (phase >= 0.90 && phase < 1.0) darkness = 1 - ((phase - 0.90) / 0.10);
  darkness = clamp(darkness, 0, 1) * 0.82;
  SoundFX.setDarkness(darkness);

  if (darkness > 0.01) {
    const mask = document.createElement('canvas');
    mask.width = canvas.width;
    mask.height = canvas.height;
    const mctx = mask.getContext('2d');
    mctx.fillStyle = `rgba(4,8,10,${darkness})`;
    mctx.fillRect(0, 0, canvas.width, canvas.height);
    mctx.globalCompositeOperation = 'destination-out';
    // Posiciones y radios en espacio de pantalla real: hay que multiplicar por el zoom
    // porque el mundo se dibujó escalado, pero esta máscara no.
    const px = (state.player.x - cam.x) * zoom;
    const py = (state.player.y - cam.y) * zoom;
    const playerR = 200 * zoom;
    let rg = mctx.createRadialGradient(px, py, 10 * zoom, px, py, playerR);
    rg.addColorStop(0, 'rgba(0,0,0,1)');
    rg.addColorStop(0.6, 'rgba(0,0,0,0.65)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    mctx.fillStyle = rg;
    mctx.beginPath();
    mctx.arc(px, py, playerR, 0, Math.PI * 2);
    mctx.fill();
    for (const f of state.campfires) {
      const fx = (f.x - cam.x) * zoom;
      const fy = (f.y - cam.y) * zoom;
      const fireR = 260 * zoom;
      let fg = mctx.createRadialGradient(fx, fy, 10 * zoom, fx, fy, fireR);
      fg.addColorStop(0, 'rgba(0,0,0,1)');
      fg.addColorStop(0.55, 'rgba(0,0,0,0.6)');
      fg.addColorStop(1, 'rgba(0,0,0,0)');
      mctx.fillStyle = fg;
      mctx.beginPath();
      mctx.arc(fx, fy, fireR, 0, Math.PI * 2);
      mctx.fill();
    }
    ctx.drawImage(mask, 0, 0);
  }

  if (state.player.hitFlash > 0) {
    ctx.fillStyle = `rgba(160,20,10,${state.player.hitFlash * 0.5})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  renderMinimap(cam, viewW, viewH);
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

function bindControls() {
  window.addEventListener('keydown', e => {
    state.keys[e.key.toLowerCase()] = true;
    if (!state.running || state.gameOver) return;
    if (e.key === 'e' || e.key === 'E') tryInteract();
    if (e.key === ' ') tryAttack();
    if (e.key === '1') tryCraftSpear();
    if (e.key === '2') tryPlaceCampfire();
    if (e.key === '3') { if (state.player.hasAxe) tryEquipTool('axe'); else tryCraftAxe(); }
    if (e.key === '4') { if (state.player.hasPickaxe) tryEquipTool('pickaxe'); else tryCraftPickaxe(); }
    if (e.key === '5') tryCraftBackpack();
    if (e.key === '6') tryPlaceShelter();
  });
  window.addEventListener('keyup', e => { state.keys[e.key.toLowerCase()] = false; });
  window.addEventListener('keydown', e => {
    if (!state.running || state.gameOver) return;
    if (e.key === 'q' || e.key === 'Q') handleManualEat();
    if (e.key === 'i' || e.key === 'I') toggleInventory();
    if (e.key === 'Escape') {
      if (isInventoryOpen()) closeInventory();
      else if (state.paused) closePause();
      else openPause();
    }
  });

  // Rueda del mouse: acerca/aleja la cámara de forma suave (interpolada en update()).
  canvas.addEventListener('wheel', e => {
    if (!state.running || state.gameOver || state.paused) return;
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.0012);
    state.targetZoom = clamp(state.targetZoom * factor, ZOOM_MIN, ZOOM_MAX);
  }, { passive: false });

  // Hotbar: cada slot dispara la misma acción que su tecla numérica.
  const HOTBAR_ACTIONS = {
    spear: tryCraftSpear,
    campfire: tryPlaceCampfire,
    axe: () => { if (state.player.hasAxe) tryEquipTool('axe'); else tryCraftAxe(); },
    pickaxe: () => { if (state.player.hasPickaxe) tryEquipTool('pickaxe'); else tryCraftPickaxe(); },
    backpack: tryCraftBackpack,
    shelter: tryPlaceShelter
  };
  document.querySelectorAll('#hotbar .hotSlot[data-action]').forEach(el => {
    el.addEventListener('click', () => {
      if (!state.running || state.gameOver || state.paused) return;
      const action = HOTBAR_ACTIONS[el.dataset.action];
      if (action) action();
    });
    // Soltar una herramienta arrastrada desde el inventario: si coincide con
    // este slot y está craftada, queda equipada ("en la mano"); cualquier
    // otra cosa (materiales, herramientas que no van acá) se rechaza.
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      el.classList.add('dragOver');
    });
    el.addEventListener('dragleave', () => el.classList.remove('dragOver'));
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('dragOver');
      if (!state.running || state.gameOver || state.paused) return;
      const type = e.dataTransfer.getData('text/plain');
      const action = el.dataset.action;
      if (action === 'axe' && type === 'axe' && state.player.hasAxe) {
        tryEquipTool('axe');
      } else if (action === 'pickaxe' && type === 'pickaxe' && state.player.hasPickaxe) {
        tryEquipTool('pickaxe');
      } else {
        SoundFX.craftFail();
        showHint('Eso no se puede colocar ahí');
      }
    });
  });
  document.getElementById('invToggleBtn').addEventListener('click', () => toggleInventory());
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
