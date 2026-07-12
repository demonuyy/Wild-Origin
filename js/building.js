import { state, ctx } from './config.js';

export function drawCampfire(f, cam) {
  const sx = f.x - cam.x;
  const sy = f.y - cam.y;
  const flick = 8 + Math.sin(f.pulse * 8) * 3;
  const gg = ctx.createRadialGradient(sx, sy, 2, sx, sy, 60);
  gg.addColorStop(0, 'rgba(255,184,92,0.55)');
  gg.addColorStop(1, 'rgba(255,184,92,0)');
  ctx.fillStyle = gg;
  ctx.beginPath();
  ctx.arc(sx, sy, 60, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(sx, sy + 8, 16, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4a3626';
  ctx.fillRect(sx - 10, sy + 2, 20, 4);
  ctx.fillRect(sx - 8, sy - 2, 16, 4);
  ctx.fillStyle = '#e05a1c';
  ctx.beginPath();
  ctx.arc(sx, sy + 3, 3, 0, Math.PI * 2);
  ctx.fill();
  const flameG = ctx.createLinearGradient(sx, sy - flick, sx, sy + 2);
  flameG.addColorStop(0, '#ffe27a');
  flameG.addColorStop(0.5, '#ff9a3a');
  flameG.addColorStop(1, '#e8933a');
  ctx.fillStyle = flameG;
  ctx.beginPath();
  ctx.moveTo(sx, sy - flick);
  ctx.quadraticCurveTo(sx + 7, sy - 4, sx, sy + 2);
  ctx.quadraticCurveTo(sx - 7, sy - 4, sx, sy - flick);
  ctx.fill();
  ctx.fillStyle = '#fff3cf';
  ctx.beginPath();
  ctx.ellipse(sx, sy - 2, 3, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Chispas ocasionales que suben desde el fuego.
  for (let i = 0; i < 2; i++) {
    const t = (f.pulse * 0.6 + i * 0.5) % 1;
    const emberY = sy - t * 34;
    const emberX = sx + Math.sin(f.pulse * 3 + i * 7) * 6;
    ctx.fillStyle = `rgba(255,180,90,${1 - t})`;
    ctx.beginPath();
    ctx.arc(emberX, emberY, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawShelter(s, cam) {
  const sx = s.x - cam.x;
  const sy = s.y - cam.y;
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
  const roofG = ctx.createLinearGradient(sx, sy - 42, sx, sy - 10);
  roofG.addColorStop(0, '#6c5238');
  roofG.addColorStop(1, '#4a3626');
  ctx.fillStyle = roofG;
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
