import { state, rand, dist } from './config.js';

export function updateDeer(dt) {
  for (const d of state.deer) {
    const distToPlayer = dist(d.x, d.y, state.player.x, state.player.y);
    if (distToPlayer < 140) {
      const ang = Math.atan2(d.y - state.player.y, d.x - state.player.x);
      d.x += Math.cos(ang) * d.speed * 1.4 * dt;
      d.y += Math.sin(ang) * d.speed * 1.4 * dt;
    } else {
      if (!d.wanderTarget || dist(d.x, d.y, d.wanderTarget.x, d.wanderTarget.y) < 20) {
        d.wanderTarget = { x: d.x + rand(-200, 200), y: d.y + rand(-200, 200) };
      }
      const ang = Math.atan2(d.wanderTarget.y - d.y, d.wanderTarget.x - d.x);
      d.x += Math.cos(ang) * d.speed * 0.4 * dt;
      d.y += Math.sin(ang) * d.speed * 0.4 * dt;
    }
  }
}

export function drawDeer(d, cam, ctx) {
  const sx = d.x - cam.x;
  const sy = d.y - cam.y;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(sx, sy + 8, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  const furG = ctx.createRadialGradient(sx - 3, sy - 3, 1, sx, sy, 12);
  furG.addColorStop(0, '#c19467');
  furG.addColorStop(1, '#8a6440');
  ctx.fillStyle = furG;
  ctx.beginPath();
  ctx.ellipse(sx, sy, 11, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = furG;
  ctx.beginPath();
  ctx.ellipse(sx + 8, sy - 5, 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,235,215,0.45)';
  ctx.beginPath();
  ctx.ellipse(sx - 2, sy + 2, 3.5, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,15,10,0.8)';
  ctx.beginPath();
  ctx.arc(sx + 10, sy - 6, 1, 0, Math.PI * 2);
  ctx.fill();
}
