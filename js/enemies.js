import { state, rand, dist, clamp, DAY_LENGTH, isNightPhase } from './config.js';
import { SoundFX } from './audio.js';
import { spawnBlood, maybeSpawnWaterRipple } from './world.js';
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
    // Histéresis: antes esto se recalculaba "en crudo" cada frame con un
    // límite único (150/190), así que un lobo parado justo en ese borde
    // alternaba entre "perseguir" y "huir del fuego" frame a frame y
    // quedaba titilando en el lugar. Ahora, una vez que empieza a
    // retroceder, se queda retrocediendo hasta estar claramente afuera
    // (borde + 40) antes de volver a perseguir; el reingreso sigue usando
    // el límite original para no hacerlo entrar de más.
    const nearFireEnter = state.campfires.some(f => dist(f.x, f.y, w.x, w.y) < 150) || state.shelters.some(s => dist(s.x, s.y, w.x, w.y) < 190);
    const nearFireExit = state.campfires.some(f => dist(f.x, f.y, w.x, w.y) < 190) || state.shelters.some(s => dist(s.x, s.y, w.x, w.y) < 230);
    if (nearFireEnter) w.fireRepelled = true;
    else if (!nearFireExit) w.fireRepelled = false;
    const nearFire = !!w.fireRepelled;

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
      // Frenar a una distancia mínima del jugador (en vez de seguir
      // empujando hasta pisarlo): a distancia casi nula, atan2 se vuelve
      // inestable con el más mínimo movimiento y el lobo tiembla en el
      // lugar en vez de quedarse quieto mordiendo. No aplica mientras huye
      // del fuego, ahí sí tiene que poder alejarse aunque esté cerca.
      const willMove = nearFire || distToPlayer > 26;
      if (willMove) {
        w.x += Math.cos(ang) * w.speed * dt;
        w.y += Math.sin(ang) * w.speed * dt;
        if (Math.abs(Math.cos(ang)) > 0.15) w.facing = Math.cos(ang) >= 0 ? 1 : -1;
        maybeSpawnWaterRipple(w, dt);
      }
      if (distToPlayer < 30 && w.attackCd <= 0) {
        state.player.health = clamp(state.player.health - 9, 0, 100);
        state.player.hitFlash = 0.3;
        w.attackCd = 1.1;
        SoundFX.wolfAttack(w.x, w.y);
        SoundFX.playerHurt();
        spawnBlood(state.player.x, state.player.y, 3);
        pushLog('¡Un lobo te mordió!');
      }
      // El timer de pasos solo cuenta mientras el lobo se mueve de verdad:
      // antes seguía corriendo (y sonando) igual aunque el frenado de arriba
      // lo dejara quieto pegado al jugador.
      if (willMove) {
        w.footstepTimer = (w.footstepTimer || 0) - dt;
        if (w.footstepTimer <= 0) {
          SoundFX.footstepAnimal(w.x, w.y, 1);
          w.footstepTimer = 0.24;
        }
      } else {
        w.footstepTimer = 0;
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
        if (Math.abs(Math.cos(ang)) > 0.15) w.facing = Math.cos(ang) >= 0 ? 1 : -1;
        maybeSpawnWaterRipple(w, dt);
      }
    } else {
      if (!w.wanderTarget || dist(w.x, w.y, w.wanderTarget.x, w.wanderTarget.y) < 20) {
        w.wanderTarget = { x: w.x + rand(-220, 220), y: w.y + rand(-220, 220) };
      }
      const ang = Math.atan2(w.wanderTarget.y - w.y, w.wanderTarget.x - w.x);
      w.x += Math.cos(ang) * w.speed * 0.35 * dt;
      w.y += Math.sin(ang) * w.speed * 0.35 * dt;
      if (Math.abs(Math.cos(ang)) > 0.15) w.facing = Math.cos(ang) >= 0 ? 1 : -1;
      maybeSpawnWaterRipple(w, dt);

      // Aullido ambiental nocturno: solo lobos tranquilos, de a uno por vez
      // (el cooldown individual evita que aúllen todos juntos todo el rato).
      if (night && w.howlCd <= 0) {
        SoundFX.wolfHowl(w.x, w.y);
        w.howlCd = rand(45, 90);
      }
    }
  }
}

// Paletas de pelaje del lobo (ver WOLF_VARIANTS en world.js/generateChunk):
// gris de manada (original), pardo casi negro y blanco ártico pálido. Cada
// una da un par [claro, oscuro] que se usa para el degradé normal; en
// persecución se oscurece más (ver `chase` abajo) para dar sensación de
// agresividad sin perder la identidad de color del lobo.
const WOLF_PALETTES = [
  { light: '#87867c', dark: '#54544c', chase: ['#77746f', '#42413d'] },
  { light: '#5c4a3a', dark: '#332619', chase: ['#4a3a2c', '#241a10'] },
  { light: '#c9c3b0', dark: '#9c9682', chase: ['#b0a993', '#847d68'] }
];

export function drawWolf(w, cam, ctx) {
  const sx = w.x - cam.x;
  const sy = w.y - cam.y;
  const pal = WOLF_PALETTES[w.variant || 0] || WOLF_PALETTES[0];
  const moving = w.state === 'chase' || w.state === 'search' || w.state === 'wander';
  const dir = w.facing || 1;
  const stride = moving ? Math.sin(state.elapsed * (w.state === 'chase' ? 14 : 7) + w.x * 0.1) * 2.6 : 0;
  // Oreja quieta que igual se mueve un poco (atenta al entorno) cuando no
  // está corriendo, para que un lobo parado no se vea congelado del todo.
  const earTwitch = moving ? 0 : Math.sin(state.elapsed * 1.6 + w.y * 0.2) * 0.08;

  // sx/sy quedan como origen local; ctx.scale(dir,1) espeja todo el dibujo
  // cuando el lobo se mueve hacia la izquierda, así deja de mirar siempre
  // para el mismo lado.
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(dir, 1);

  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(0, 8, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Patas y cola: dan más sensación de movimiento/acecho que el óvalo solo.
  ctx.strokeStyle = pal.dark;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  [[-6, stride], [0, -stride], [6, -stride * 0.7], [-2, stride * 0.7]].forEach(([lx, off]) => {
    ctx.beginPath();
    ctx.moveTo(lx, 3);
    ctx.lineTo(lx + off * 0.3, 10);
    ctx.stroke();
  });
  ctx.save();
  ctx.translate(-11, -1);
  // Cola: baja y quieta al perseguir, más levantada al deambular, con un
  // leve meneo constante en vez de quedar clavada en un solo ángulo.
  const tailWag = Math.sin(state.elapsed * (moving ? 8 : 2.5) + w.x * 0.15) * (moving ? 0.12 : 0.2);
  ctx.rotate((w.state === 'chase' ? -0.15 : 0.35) + tailWag);
  ctx.fillStyle = pal.dark;
  ctx.beginPath();
  ctx.ellipse(0, 0, 5, 1.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const furG = ctx.createRadialGradient(-4, -4, 2, 0, 0, 14);
  if (w.state === 'chase') {
    furG.addColorStop(0, pal.chase[0]);
    furG.addColorStop(1, pal.chase[1]);
  } else {
    furG.addColorStop(0, pal.light);
    furG.addColorStop(1, pal.dark);
  }
  ctx.fillStyle = furG;
  ctx.beginPath();
  ctx.ellipse(0, 0, 12, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = furG;
  ctx.beginPath();
  ctx.ellipse(9, -5, 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Oreja: leve rotación idle (earTwitch) para que no quede congelada.
  ctx.save();
  ctx.translate(9, -8);
  ctx.rotate(earTwitch);
  ctx.fillStyle = pal.dark;
  ctx.beginPath();
  ctx.moveTo(-2, 0);
  ctx.lineTo(0, -5);
  ctx.lineTo(2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  if (w.state === 'chase' || w.state === 'search') {
    ctx.fillStyle = w.state === 'chase' ? '#ff4433' : '#ffb733';
    ctx.beginPath();
    ctx.arc(11, -6, 1.6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(20,15,10,0.8)';
    ctx.beginPath();
    ctx.arc(11, -6, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(203,216,195,0.6)';
  ctx.strokeRect(sx - 14, sy - 20, 28 * (w.health / w.maxHealth), 3);
}
