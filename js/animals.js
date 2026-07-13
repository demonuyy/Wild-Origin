import { state, rand, dist } from './config.js';
import { SoundFX } from './audio.js';
import { removeEntity, spawnBlood } from './world.js';
import { pushLog } from './ui.js';

// Radio dentro del cual el pánico de un ciervo asusta a los demás (manada).
const HERD_PANIC_R = 220;
// Radio al que un ciervo nota a un lobo (más chico que el del jugador, porque
// un lobo cazando es una amenaza más silenciosa que pasos humanos).
const WOLF_ALERT_R = 170;

// Pone a un ciervo en fuga desde un punto (jugador, lobo, u otro ciervo
// asustado) y avisa al resto de la manada cercana.
function spookDeer(d, fromX, fromY, playSound) {
  if (d.state !== 'flee') {
    if (playSound) SoundFX.deerSnort(d.x, d.y);
    for (const other of state.deer) {
      if (other === d) continue;
      if (other.state !== 'flee' && dist(other.x, other.y, d.x, d.y) < HERD_PANIC_R) {
        other.state = 'flee';
        other.fleeFromX = fromX;
        other.fleeFromY = fromY;
      }
    }
  }
  d.state = 'flee';
  d.fleeFromX = fromX;
  d.fleeFromY = fromY;
}

export function hitDeer(d, damage) {
  d.health -= damage;
  d.knockX = d.x - state.player.x;
  d.knockY = d.y - state.player.y;
  SoundFX.deerHurt(d.x, d.y);
  spawnBlood(d.x, d.y, 3);
  spookDeer(d, state.player.x, state.player.y, false);
  if (d.health <= 0) {
    removeEntity('deer', d);
    SoundFX.deerDeath(d.x, d.y);
    spawnBlood(d.x, d.y, 6);
    pushLog('El ciervo cayó');
    return true;
  }
  return false;
}

export function updateDeer(dt) {
  for (const d of state.deer) {
    const distToPlayer = dist(d.x, d.y, state.player.x, state.player.y);
    if (d.alertCd > 0) d.alertCd -= dt;

    // Un ciervo tranquilo nota al jugador cerca o a un lobo cazando cerca y
    // pasa a huir (los lobos dan más margen de detección que el jugador).
    if (d.state !== 'flee') {
      if (distToPlayer < 140) {
        spookDeer(d, state.player.x, state.player.y, true);
      } else {
        const nearbyWolf = state.wolves.find(w => dist(w.x, w.y, d.x, d.y) < WOLF_ALERT_R);
        if (nearbyWolf) spookDeer(d, nearbyWolf.x, nearbyWolf.y, true);
      }
    }

    if (d.state === 'flee') {
      // Dirección opuesta a la amenaza, con un poco de variación para que no
      // corran en una línea perfectamente recta (más orgánico).
      const baseAng = Math.atan2(d.y - d.fleeFromY, d.x - d.fleeFromX);
      const ang = baseAng + (d.wobble || (d.wobble = rand(-0.5, 0.5)));
      d.x += Math.cos(ang) * d.speed * 1.5 * dt;
      d.y += Math.sin(ang) * d.speed * 1.5 * dt;
      d.footstepTimer = (d.footstepTimer || 0) - dt;
      if (d.footstepTimer <= 0) {
        SoundFX.footstepAnimal(d.x, d.y, 1.1);
        d.footstepTimer = 0.22;
      }
      // Deja de huir cuando ya puso distancia de sobra con ambas amenazas.
      // (antes 260/240 — ahora corren bastante más lejos antes de calmarse)
      const farFromPlayer = distToPlayer > 480;
      const farFromThreat = dist(d.x, d.y, d.fleeFromX, d.fleeFromY) > 440;
      if (farFromPlayer && farFromThreat) {
        d.state = 'wander';
        d.wanderTarget = null;
        d.wobble = null;
      }
    } else if (d.state === 'graze') {
      // Parado, quieto, mordisqueando pasto: de vez en cuando gruñe y después
      // de un rato pasa a deambular un poco.
      d.grazeTimer -= dt;
      if (d.grazeTimer <= 0) {
        if (Math.random() < 0.92) {
          d.state = 'wander';
          d.wanderTarget = null;
        } else {
          d.grazeTimer = rand(9, 16);
          SoundFX.deerGrunt(d.x, d.y);
        }
      }
    } else {
      if (!d.wanderTarget || dist(d.x, d.y, d.wanderTarget.x, d.wanderTarget.y) < 20) {
        // Al llegar a destino, buena chance de pararse a pastar de nuevo en
        // vez de deambular sin parar.
        if (Math.random() < 0.5) {
          d.state = 'graze';
          d.grazeTimer = rand(2, 6);
        } else {
          d.wanderTarget = { x: d.x + rand(-200, 200), y: d.y + rand(-200, 200) };
        }
      }
      if (d.wanderTarget) {
        const ang = Math.atan2(d.wanderTarget.y - d.y, d.wanderTarget.x - d.x);
        d.x += Math.cos(ang) * d.speed * 0.4 * dt;
        d.y += Math.sin(ang) * d.speed * 0.4 * dt;
      }
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
  // Barra de vida: solo aparece si ya recibió algún golpe (igual criterio
  // visual que se usa con el lobo, pero sin mostrarla todo el tiempo ya que
  // el ciervo no es hostil).
  if (d.health < d.maxHealth) {
    ctx.strokeStyle = 'rgba(203,216,195,0.6)';
    ctx.strokeRect(sx - 13, sy - 18, 26 * (d.health / d.maxHealth), 3);
  }
}
