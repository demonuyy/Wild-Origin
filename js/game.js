import { state, ctx, canvas, WORLD_W, WORLD_H, DAY_LENGTH, resize, rand, dist, clamp, isNightPhase, capFor, invTotal } from './config.js';
import { SoundFX } from './audio.js';
import { generateWorld, drawGround, drawGrassDecor, drawPonds, drawTree, drawRock, drawBush } from './world.js';
import { updateDeer, drawDeer } from './animals.js';
import { updateWolves, drawWolf } from './enemies.js';
import { resetPlayer, tryInteract, tryAttack, updatePlayer, handleManualEat } from './player.js';
import { tryCraftSpear, tryPlaceCampfire, tryCraftAxe, tryCraftPickaxe, tryCraftBackpack, tryPlaceShelter } from './crafting.js';
import { drawCampfire, drawShelter } from './building.js';
import { pushLog, showHint, updateEquipUI, updateHUD, endGame, openPause, closePause, goToMainMenu, wireVolumeControls } from './ui.js';
import { saveGame } from './save.js';

function renderMinimap(cam) {
  const mc = document.getElementById('minimap');
  const mctx = mc.getContext('2d');
  const W = mc.width;
  const H = mc.height;
  const sx = W / WORLD_W;
  const sy = H / WORLD_H;
  mctx.clearRect(0, 0, W, H);
  mctx.fillStyle = '#1c2e1a';
  mctx.fillRect(0, 0, W, H);

  mctx.fillStyle = '#3d6b7a';
  for (const p of state.ponds) { mctx.beginPath(); mctx.arc(p.x * sx, p.y * sy, 2.2, 0, Math.PI * 2); mctx.fill(); }
  mctx.fillStyle = '#8a5a3a';
  for (const s of state.shelters) { mctx.beginPath(); mctx.arc(s.x * sx, s.y * sy, 2.8, 0, Math.PI * 2); mctx.fill(); }
  mctx.fillStyle = '#ffb85c';
  for (const f of state.campfires) { mctx.beginPath(); mctx.arc(f.x * sx, f.y * sy, 1.8, 0, Math.PI * 2); mctx.fill(); }
  mctx.fillStyle = '#c0392b';
  for (const w of state.wolves) { mctx.beginPath(); mctx.arc(w.x * sx, w.y * sy, 1.6, 0, Math.PI * 2); mctx.fill(); }

  mctx.strokeStyle = 'rgba(203,216,195,0.45)';
  mctx.lineWidth = 1;
  mctx.strokeRect(cam.x * sx, cam.y * sy, canvas.width * sx, canvas.height * sy);

  mctx.fillStyle = '#ffe9c7';
  mctx.beginPath();
  mctx.arc(state.player.x * sx, state.player.y * sy, 3, 0, Math.PI * 2);
  mctx.fill();
  mctx.strokeStyle = '#ffe9c7';
  mctx.lineWidth = 1.4;
  mctx.beginPath();
  mctx.moveTo(state.player.x * sx, state.player.y * sy);
  mctx.lineTo(state.player.x * sx + state.player.dir.x * 9, state.player.y * sy + state.player.dir.y * 9);
  mctx.stroke();
}

function drawPlayer(cam) {
  const sx = state.player.x - cam.x;
  const sy = state.player.y - cam.y;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(sx, sy + 14, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7a5230';
  ctx.beginPath();
  ctx.moveTo(sx - 9, sy + 14);
  ctx.lineTo(sx + 9, sy + 14);
  ctx.lineTo(sx, sy - 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e0b98c';
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
    ctx.fillStyle = '#d8d8d0';
    ctx.beginPath();
    ctx.arc(sx + state.player.dir.x * 36, sy + state.player.dir.y * 36, 3, 0, Math.PI * 2);
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
}

function update(dt) {
  state.elapsed += dt;
  if (state.elapsed >= state.dayCounter * DAY_LENGTH) {
    state.dayCounter++;
    SoundFX.dayChime();
    pushLog(`Comienza el día ${state.dayCounter}`);
  }

  updatePlayer(dt);

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
  saveGame();
}

function render() {
  const cam = {
    x: clamp(state.player.x - canvas.width / 2, 0, WORLD_W - canvas.width),
    y: clamp(state.player.y - canvas.height / 2, 0, WORLD_H - canvas.height)
  };

  drawGround(ctx, canvas, cam);
  drawGrassDecor(ctx, cam);
  drawPonds(ctx, cam);

  const drawables = [];
  for (const t of state.trees) drawables.push({ y: t.y, draw: () => drawTree(t, cam, ctx) });
  for (const r of state.rocks) drawables.push({ y: r.y, draw: () => drawRock(r, cam, ctx) });
  for (const b of state.bushes) drawables.push({ y: b.y, draw: () => drawBush(b, cam, ctx) });
  for (const f of state.campfires) drawables.push({ y: f.y, draw: () => drawCampfire(f, cam) });
  for (const s of state.shelters) drawables.push({ y: s.y, draw: () => drawShelter(s, cam) });
  for (const d of state.deer) drawables.push({ y: d.y, draw: () => drawDeer(d, cam, ctx) });
  for (const w of state.wolves) drawables.push({ y: w.y, draw: () => drawWolf(w, cam, ctx) });
  drawables.push({ y: state.player.y, draw: () => drawPlayer(cam) });
  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) d.draw();

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
    const px = state.player.x - cam.x;
    const py = state.player.y - cam.y;
    let rg = mctx.createRadialGradient(px, py, 10, px, py, 200);
    rg.addColorStop(0, 'rgba(0,0,0,1)');
    rg.addColorStop(0.6, 'rgba(0,0,0,0.65)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    mctx.fillStyle = rg;
    mctx.beginPath();
    mctx.arc(px, py, 200, 0, Math.PI * 2);
    mctx.fill();
    for (const f of state.campfires) {
      const fx = f.x - cam.x;
      const fy = f.y - cam.y;
      let fg = mctx.createRadialGradient(fx, fy, 10, fx, fy, 260);
      fg.addColorStop(0, 'rgba(0,0,0,1)');
      fg.addColorStop(0.55, 'rgba(0,0,0,0.6)');
      fg.addColorStop(1, 'rgba(0,0,0,0)');
      mctx.fillStyle = fg;
      mctx.beginPath();
      mctx.arc(fx, fy, 260, 0, Math.PI * 2);
      mctx.fill();
    }
    ctx.drawImage(mask, 0, 0);
  }

  if (state.player.hitFlash > 0) {
    ctx.fillStyle = `rgba(160,20,10,${state.player.hitFlash * 0.5})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  renderMinimap(cam);
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
    if (e.key === '3') tryCraftAxe();
    if (e.key === '4') tryCraftPickaxe();
    if (e.key === '5') tryCraftBackpack();
    if (e.key === '6') tryPlaceShelter();
  });
  window.addEventListener('keyup', e => { state.keys[e.key.toLowerCase()] = false; });
  window.addEventListener('keydown', e => {
    if (!state.running || state.gameOver) return;
    if (e.key === 'q' || e.key === 'Q') handleManualEat();
    if (e.key === 'Escape') {
      if (state.paused) closePause();
      else openPause();
    }
  });
}

function bindUI() {
  document.getElementById('startBtn').addEventListener('click', () => {
    SoundFX.init();
    SoundFX.click();
    document.getElementById('title').classList.add('hidden');
    document.getElementById('menuBtn').classList.remove('hidden');
    document.getElementById('minimapWrap').classList.remove('hidden');
    resetGame();
    state.running = true;
    pushLog('El bosque te observa. Sobrevivé.');
  });
  document.getElementById('restartBtn').addEventListener('click', () => {
    SoundFX.click();
    document.getElementById('gameOver').style.display = 'none';
    document.getElementById('menuBtn').classList.remove('hidden');
    document.getElementById('minimapWrap').classList.remove('hidden');
    resetGame();
    state.running = true;
  });
  document.getElementById('menuBtn').addEventListener('click', () => { SoundFX.click(); openPause(); });
  document.getElementById('resumeBtn').addEventListener('click', () => { SoundFX.click(); closePause(); });
  document.getElementById('pauseRestartBtn').addEventListener('click', () => {
    SoundFX.click();
    document.getElementById('pauseMenu').style.display = 'none';
    state.paused = false;
    resetGame();
    state.running = true;
  });
  document.getElementById('pauseMainMenuBtn').addEventListener('click', () => { SoundFX.click(); goToMainMenu(); });

  wireVolumeControls('volumeSliderTitle', 'muteToggleTitle');
  wireVolumeControls('volumeSliderPause', 'muteTogglePause');
}

function init() {
  bindControls();
  bindUI();
  generateWorld();
  updateEquipUI();
  updateHUD();
  requestAnimationFrame(loop);
}

init();