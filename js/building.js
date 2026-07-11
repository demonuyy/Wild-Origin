import { state, ctx } from './config.js';

export function drawCampfire(f, cam) {
  const sx = f.x - cam.x;
  const sy = f.y - cam.y;
  if (sx < -60 || sx > ctx.canvas.width + 60 || sy < -60 || sy > ctx.canvas.height + 60) return;
  const flick = 8 + Math.sin(f.pulse * 8) * 3;
  const gg = ctx.createRadialGradient(sx, sy, 2, sx, sy, 60);
  gg.addColorStop(0, 'rgba(255,184,92,0.55)');
  gg.addColorStop(1, 'rgba(255,184,92,0)');
  ctx.fillStyle = gg;
  ctx.beginPath();
  ctx.arc(sx, sy, 60, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4a3626';
  ctx.fillRect(sx - 10, sy + 2, 20, 4);
  ctx.fillRect(sx - 8, sy - 2, 16, 4);
  ctx.fillStyle = '#e8933a';
  ctx.beginPath();
  ctx.moveTo(sx, sy - flick);
  ctx.quadraticCurveTo(sx + 7, sy - 4, sx, sy + 2);
  ctx.quadraticCurveTo(sx - 7, sy - 4, sx, sy - flick);
  ctx.fill();
  ctx.fillStyle = '#ffd27a';
  ctx.beginPath();
  ctx.ellipse(sx, sy - 2, 3, 6, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawShelter(s, cam) {
  const sx = s.x - cam.x;
  const sy = s.y - cam.y;
  if (sx < -90 || sx > ctx.canvas.width + 90 || sy < -100 || sy > ctx.canvas.height + 100) return;
  ctx.strokeStyle = 'rgba(255,210,122,0.25)';
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(sx, sy, 190, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(sx, sy + 22, 40, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a2a1c';
  ctx.fillRect(sx - 28, sy - 4, 7, 26);
  ctx.fillRect(sx + 21, sy - 4, 7, 26);
  ctx.fillStyle = '#4a3626';
  ctx.fillRect(sx - 26, sy - 14, 52, 20);
  ctx.fillStyle = '#5c4433';
  ctx.beginPath();
  ctx.moveTo(sx - 38, sy - 14);
  ctx.lineTo(sx, sy - 42);
  ctx.lineTo(sx + 38, sy - 14);
  ctx.lineTo(sx + 30, sy - 10);
  ctx.lineTo(sx, sy - 34);
  ctx.lineTo(sx - 30, sy - 10);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(sx + i * 12, sy - 14 - Math.abs(i) * 4);
    ctx.lineTo(sx + i * 6, sy - 36 + Math.abs(i) * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#1b1108';
  ctx.beginPath();
  ctx.ellipse(sx, sy - 2, 10, 12, 0, 0, Math.PI * 2);
  ctx.fill();
}
