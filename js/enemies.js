import { state, rand, dist, clamp, WORLD_W, WORLD_H, DAY_LENGTH, isNightPhase } from './config.js';
import { SoundFX } from './audio.js';
import { pushLog } from './ui.js';

export function updateWolves(dt) {
  for (const w of state.wolves) {
    const distToPlayer = dist(w.x, w.y, state.player.x, state.player.y);
    const phase = (state.elapsed % DAY_LENGTH) / DAY_LENGTH;
    const alert = isNightPhase(phase) ? w.alertR * 2.6 : w.alertR;
    const nearFire = state.campfires.some(f => dist(f.x, f.y, w.x, w.y) < 150) || state.shelters.some(s => dist(s.x, s.y, w.x, w.y) < 190);

    if (distToPlayer < alert && !nearFire) {
      if (w.state !== 'chase') SoundFX.wolfGrowl();
      w.state = 'chase';
    } else if (distToPlayer > alert * 1.6) {
      w.state = 'wander';
    }

    if (w.state === 'chase') {
      let ang = Math.atan2(state.player.y - w.y, state.player.x - w.x);
      if (nearFire) ang += Math.PI;
      w.x += Math.cos(ang) * w.speed * dt;
      w.y += Math.sin(ang) * w.speed * dt;
      if (distToPlayer < 30 && w.attackCd <= 0) {
        state.player.health = clamp(state.player.health - 9, 0, 100);
        state.player.hitFlash = 0.3;
        w.attackCd = 1.1;
        SoundFX.playerHurt();
        pushLog('¡Un lobo te mordió!');
      }
    } else {
      if (!w.wanderTarget || dist(w.x, w.y, w.wanderTarget.x, w.wanderTarget.y) < 20) {
        w.wanderTarget = { x: clamp(w.x + rand(-220, 220), 20, WORLD_W - 20), y: clamp(w.y + rand(-220, 220), 20, WORLD_H - 20) };
      }
      const ang = Math.atan2(w.wanderTarget.y - w.y, w.wanderTarget.x - w.x);
      w.x += Math.cos(ang) * w.speed * 0.35 * dt;
      w.y += Math.sin(ang) * w.speed * 0.35 * dt;
    }
    if (w.attackCd > 0) w.attackCd -= dt;
    w.x = clamp(w.x, 20, WORLD_W - 20);
    w.y = clamp(w.y, 20, WORLD_H - 20);
  }
}

export function drawWolf(w, cam, ctx) {
  const sx = w.x - cam.x;
  const sy = w.y - cam.y;
  if (sx < -50 || sx > ctx.canvas.width + 50 || sy < -50 || sy > ctx.canvas.height + 50) return;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(sx, sy + 8, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = w.state === 'chase' ? '#5a5a58' : '#68685f';
  ctx.beginPath();
  ctx.ellipse(sx, sy, 12, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(sx + 9, sy - 5, 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  if (w.state === 'chase') {
    ctx.fillStyle = '#ff4433';
    ctx.beginPath();
    ctx.arc(sx + 11, sy - 6, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(203,216,195,0.6)';
  ctx.strokeRect(sx - 14, sy - 20, 28 * (w.health / w.maxHealth), 3);
}
