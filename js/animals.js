import { state, rand, dist, clamp, WORLD_W, WORLD_H } from './config.js';

export function updateDeer(dt) {
  for (const d of state.deer) {
    const distToPlayer = dist(d.x, d.y, state.player.x, state.player.y);
    if (distToPlayer < 140) {
      const ang = Math.atan2(d.y - state.player.y, d.x - state.player.x);
      d.x += Math.cos(ang) * d.speed * 1.4 * dt;
      d.y += Math.sin(ang) * d.speed * 1.4 * dt;
    } else {
      if (!d.wanderTarget || dist(d.x, d.y, d.wanderTarget.x, d.wanderTarget.y) < 20) {
        d.wanderTarget = { x: clamp(d.x + rand(-200, 200), 20, WORLD_W - 20), y: clamp(d.y + rand(-200, 200), 20, WORLD_H - 20) };
      }
      const ang = Math.atan2(d.wanderTarget.y - d.y, d.wanderTarget.x - d.x);
      d.x += Math.cos(ang) * d.speed * 0.4 * dt;
      d.y += Math.sin(ang) * d.speed * 0.4 * dt;
    }
    d.x = clamp(d.x, 20, WORLD_W - 20);
    d.y = clamp(d.y, 20, WORLD_H - 20);
  }
}

export function drawDeer(d, cam, ctx) {
  const sx = d.x - cam.x;
  const sy = d.y - cam.y;
  if (sx < -40 || sx > ctx.canvas.width + 40 || sy < -40 || sy > ctx.canvas.height + 40) return;
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(sx, sy + 8, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#a9805a';
  ctx.beginPath();
  ctx.ellipse(sx, sy, 11, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(sx + 8, sy - 5, 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();
}
