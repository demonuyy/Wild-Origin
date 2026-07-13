import { state, rand, dist, clamp, DAY_LENGTH, isNightPhase } from './config.js';
import { SoundFX } from './audio.js';
import { pushLog } from './ui.js';

// Radio en el que un lobo que entra en persecución llama a la manada: otros
// lobos cercanos que estaban tranquilos se suman a la cacería sin tener que
// notar al jugador ellos mismos (antes cada lobo reaccionaba en aislado).
const PACK_CALL_R = 260;
// Cuánto tiempo, tras perder de vista al jugador, el lobo va a investigar la
// última posición conocida antes de volver a deambular al azar (antes volvía
// directo a 'wander', como si se olvidara instantáneamente de la caza).
const SEARCH_TIME = 3.5;

function alertPack(source) {
  for (const w of state.wolves) {
    if (w === source || w.state === 'chase') continue;
    if (dist(w.x, w.y, source.x, source.y) < PACK_CALL_R) {
      w.state = 'chase';
      w.calledByPack = true;
    }
  }
}

export function updateWolves(dt) {
  const phase = (state.elapsed % DAY_LENGTH) / DAY_LENGTH;
  const night = isNightPhase(phase);

  for (const w of state.wolves) {
    const distToPlayer = dist(w.x, w.y, state.player.x, state.player.y);
    const alert = night ? w.alertR * 2.6 : w.alertR;
    const nearFire = state.campfires.some(f => dist(f.x, f.y, w.x, w.y) < 150) || state.shelters.some(s => dist(s.x, s.y, w.x, w.y) < 190);

    if (w.attackCd > 0) w.attackCd -= dt;
    if (w.howlCd === undefined) w.howlCd = rand(25, 45);
    w.howlCd -= dt;

    if (distToPlayer < alert && !nearFire) {
      if (w.state !== 'chase') {
        SoundFX.wolfGrowl(w.x, w.y);
        alertPack(w);
      }
      w.state = 'chase';
      w.searchTimer = SEARCH_TIME;
      w.lastSeenX = state.player.x;
      w.lastSeenY = state.player.y;
    } else if (w.state === 'chase' && distToPlayer > alert * 1.6) {
      // Recién perdido de vista: no vuelve a deambular de golpe, primero va
      // a olfatear la última posición donde estaba el jugador.
      w.state = 'search';
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
        SoundFX.wolfAttack(w.x, w.y);
        SoundFX.playerHurt();
        pushLog('¡Un lobo te mordió!');
      }
      w.footstepTimer = (w.footstepTimer || 0) - dt;
      if (w.footstepTimer <= 0) {
        SoundFX.footstepAnimal(w.x, w.y, 1);
        w.footstepTimer = 0.24;
      }
    } else if (w.state === 'search') {
      w.searchTimer -= dt;
      const distToLast = dist(w.x, w.y, w.lastSeenX, w.lastSeenY);
      if (w.searchTimer <= 0 || distToLast < 20) {
        w.state = 'wander';
        w.wanderTarget = null;
      } else {
        const ang = Math.atan2(w.lastSeenY - w.y, w.lastSeenX - w.x);
        w.x += Math.cos(ang) * w.speed * 0.55 * dt;
        w.y += Math.sin(ang) * w.speed * 0.55 * dt;
      }
    } else {
      if (!w.wanderTarget || dist(w.x, w.y, w.wanderTarget.x, w.wanderTarget.y) < 20) {
        w.wanderTarget = { x: w.x + rand(-220, 220), y: w.y + rand(-220, 220) };
      }
      const ang = Math.atan2(w.wanderTarget.y - w.y, w.wanderTarget.x - w.x);
      w.x += Math.cos(ang) * w.speed * 0.35 * dt;
      w.y += Math.sin(ang) * w.speed * 0.35 * dt;

      // Aullido ambiental nocturno: solo lobos tranquilos, de a uno por vez
      // (el cooldown individual evita que aúllen todos juntos todo el rato).
      if (night && w.howlCd <= 0) {
        SoundFX.wolfHowl(w.x, w.y);
        w.howlCd = rand(45, 90);
      }
    }
  }
}

export function drawWolf(w, cam, ctx) {
  const sx = w.x - cam.x;
  const sy = w.y - cam.y;
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(sx, sy + 8, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  const furG = ctx.createRadialGradient(sx - 4, sy - 4, 2, sx, sy, 14);
  if (w.state === 'chase') {
    furG.addColorStop(0, '#77746f');
    furG.addColorStop(1, '#42413d');
  } else {
    furG.addColorStop(0, '#87867c');
    furG.addColorStop(1, '#54544c');
  }
  ctx.fillStyle = furG;
  ctx.beginPath();
  ctx.ellipse(sx, sy, 12, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = furG;
  ctx.beginPath();
  ctx.ellipse(sx + 9, sy - 5, 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Orejas.
  ctx.beginPath();
  ctx.moveTo(sx + 7, sy - 8);
  ctx.lineTo(sx + 9, sy - 13);
  ctx.lineTo(sx + 11, sy - 8);
  ctx.closePath();
  ctx.fill();
  if (w.state === 'chase' || w.state === 'search') {
    ctx.fillStyle = w.state === 'chase' ? '#ff4433' : '#ffb733';
    ctx.beginPath();
    ctx.arc(sx + 11, sy - 6, 1.6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(20,15,10,0.8)';
    ctx.beginPath();
    ctx.arc(sx + 11, sy - 6, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(203,216,195,0.6)';
  ctx.strokeRect(sx - 14, sy - 20, 28 * (w.health / w.maxHealth), 3);
}
