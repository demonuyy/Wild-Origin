import { state, WORLD_W, WORLD_H, rand, dist, clamp } from './config.js';

export function generateWorld() {
  state.trees = [];
  state.rocks = [];
  state.bushes = [];
  state.ponds = [];
  state.campfires = [];
  state.shelters = [];
  state.wolves = [];
  state.deer = [];
  state.grassDecor = [];

  const safeR = 220;
  const centerX = WORLD_W / 2;
  const centerY = WORLD_H / 2;
  const farEnoughFromSpawn = (x, y) => dist(x, y, centerX, centerY) > safeR;

  for (let i = 0; i < 190; i++) {
    let x = rand(60, WORLD_W - 60);
    let y = rand(60, WORLD_H - 60);
    if (!farEnoughFromSpawn(x, y)) continue;
    state.trees.push({ x, y, hits: 3, maxHits: 3, size: rand(0.85, 1.3), sway: rand(0, Math.PI * 2) });
  }
  for (let i = 0; i < 95; i++) {
    let x = rand(60, WORLD_W - 60);
    let y = rand(60, WORLD_H - 60);
    if (!farEnoughFromSpawn(x, y)) continue;
    state.rocks.push({ x, y, hits: 4, maxHits: 4, size: rand(0.8, 1.25) });
  }
  for (let i = 0; i < 70; i++) {
    let x = rand(60, WORLD_W - 60);
    let y = rand(60, WORLD_H - 60);
    if (!farEnoughFromSpawn(x, y)) continue;
    state.bushes.push({ x, y, stock: 3, maxStock: 3, regrowTimer: 0, size: rand(0.85, 1.2) });
  }
  for (let i = 0; i < 9; i++) {
    state.ponds.push({ x: rand(200, WORLD_W - 200), y: rand(200, WORLD_H - 200), rw: rand(70, 130), rh: rand(50, 90) });
  }
  for (let i = 0; i < 14; i++) {
    state.wolves.push({
      x: rand(100, WORLD_W - 100),
      y: rand(100, WORLD_H - 100),
      health: 34,
      maxHealth: 34,
      speed: rand(95, 125),
      state: 'wander',
      wanderTarget: null,
      attackCd: 0,
      alertR: 110
    });
  }
  for (let i = 0; i < 10; i++) {
    state.deer.push({ x: rand(100, WORLD_W - 100), y: rand(100, WORLD_H - 100), speed: 110, wanderTarget: null, fleeing: false });
  }
  for (let i = 0; i < 900; i++) {
    state.grassDecor.push({ x: rand(0, WORLD_W), y: rand(0, WORLD_H), s: rand(0.5, 1.3), rot: rand(0, Math.PI * 2) });
  }
}

export function drawGround(ctx, canvas, cam) {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#233b22');
  grad.addColorStop(1, '#182b18');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  for (let i = 0; i < 40; i++) {
    const px = ((i * 577) % WORLD_W) - cam.x;
    const py = ((i * 991) % WORLD_H) - cam.y;
    if (px < -100 || px > canvas.width + 100 || py < -100 || py > canvas.height + 100) continue;
    ctx.beginPath();
    ctx.ellipse(px, py, 90, 50, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawGrassDecor(ctx, cam) {
  ctx.strokeStyle = 'rgba(120,150,100,0.5)';
  ctx.lineWidth = 2;
  for (const g of state.grassDecor) {
    const sx = g.x - cam.x;
    const sy = g.y - cam.y;
    if (sx < -20 || sx > ctx.canvas.width + 20 || sy < -20 || sy > ctx.canvas.height + 20) continue;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(g.rot);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -8 * g.s);
    ctx.stroke();
    ctx.restore();
  }
}

export function drawPonds(ctx, cam) {
  for (const p of state.ponds) {
    const sx = p.x - cam.x;
    const sy = p.y - cam.y;
    if (sx < -150 || sx > ctx.canvas.width + 150 || sy < -150 || sy > ctx.canvas.height + 150) continue;
    ctx.fillStyle = 'rgba(20,30,20,0.4)';
    ctx.beginPath();
    ctx.ellipse(sx + 6, sy + 8, p.rw, p.rh, 0, 0, Math.PI * 2);
    ctx.fill();
    const wg = ctx.createRadialGradient(sx, sy, 4, sx, sy, p.rw);
    wg.addColorStop(0, '#5c93a3');
    wg.addColorStop(1, '#284a56');
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.ellipse(sx, sy, p.rw, p.rh, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawTree(t, cam, ctx) {
  const sx = t.x - cam.x;
  const sy = t.y - cam.y;
  if (sx < -80 || sx > ctx.canvas.width + 80 || sy < -100 || sy > ctx.canvas.height + 100) return;
  const s = t.size;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(sx, sy + 6, 18 * s, 7 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4a3626';
  ctx.fillRect(sx - 4 * s, sy - 6 * s, 8 * s, 26 * s);
  ctx.fillStyle = '#2f4a2a';
  ctx.beginPath();
  ctx.arc(sx, sy - 20 * s, 22 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3c5c34';
  ctx.beginPath();
  ctx.arc(sx - 10 * s, sy - 28 * s, 16 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(sx + 12 * s, sy - 26 * s, 15 * s, 0, Math.PI * 2);
  ctx.fill();
  if (t.hits < t.maxHits) {
    ctx.strokeStyle = 'rgba(203,216,195,0.5)';
    ctx.strokeRect(sx - 16, sy - 40, 32 * (t.hits / t.maxHits), 4);
  }
}

export function drawRock(r, cam, ctx) {
  const sx = r.x - cam.x;
  const sy = r.y - cam.y;
  if (sx < -60 || sx > ctx.canvas.width + 60 || sy < -60 || sy > ctx.canvas.height + 60) return;
  const s = r.size;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(sx, sy + 5, 16 * s, 6 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7a7a72';
  ctx.beginPath();
  ctx.moveTo(sx - 14 * s, sy + 4 * s);
  ctx.lineTo(sx - 8 * s, sy - 10 * s);
  ctx.lineTo(sx + 4 * s, sy - 14 * s);
  ctx.lineTo(sx + 14 * s, sy - 2 * s);
  ctx.lineTo(sx + 8 * s, sy + 8 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.moveTo(sx - 8 * s, sy - 10 * s);
  ctx.lineTo(sx + 4 * s, sy - 14 * s);
  ctx.lineTo(sx - 2 * s, sy - 4 * s);
  ctx.closePath();
  ctx.fill();
}

export function drawBush(b, cam, ctx) {
  const sx = b.x - cam.x;
  const sy = b.y - cam.y;
  if (sx < -50 || sx > ctx.canvas.width + 50 || sy < -50 || sy > ctx.canvas.height + 50) return;
  const s = b.size;
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(sx, sy + 5, 14 * s, 6 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a5030';
  [[0, 0], [-8, 3], [8, 3]].forEach(([ox, oy]) => {
    ctx.beginPath();
    ctx.arc(sx + ox * s, sy + oy * s - 6 * s, 10 * s, 0, Math.PI * 2);
    ctx.fill();
  });
  if (b.stock > 0) {
    ctx.fillStyle = '#a8362c';
    for (let i = 0; i < b.stock; i++) {
      ctx.beginPath();
      ctx.arc(sx - 6 * s + i * 6 * s, sy - 8 * s, 2.4 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
