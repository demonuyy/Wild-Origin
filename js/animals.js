import { state, rand, dist } from './config.js';
import { SoundFX } from './audio.js';
import { removeEntity, spawnBlood, maybeSpawnWaterRipple, spawnCorpse } from './world.js';
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
    spawnCorpse(d.x, d.y, 'deer', d.variant);
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
      // Encara hacia donde corre (solo si el movimiento tiene una componente
      // horizontal clara, para que no tiemble entre lados al huir casi
      // derecho hacia arriba/abajo).
      if (Math.abs(Math.cos(ang)) > 0.15) d.facing = Math.cos(ang) >= 0 ? 1 : -1;
      maybeSpawnWaterRipple(d, dt);
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
        if (Math.abs(Math.cos(ang)) > 0.15) d.facing = Math.cos(ang) >= 0 ? 1 : -1;
        maybeSpawnWaterRipple(d, dt);
      }
    }
  }
}

// ---------- Conejo ----------
// Presa chica y muy asustadiza: a diferencia del ciervo, no tiene manada
// (spookDeer avisa a otros ciervos cercanos; acá cada conejo reacciona solo
// por su cuenta) ni etapa de "pastar" quieto — o deambula despacio, o huye
// a los saltos. Muere de un solo golpe (ver health en world.js/generateChunk)
// y su cadáver (kind: 'rabbit') se cosecha entero de una, sin piel/huesos
// (ver harvestCorpse en inventory.js).
function spookRabbit(r, fromX, fromY) {
  r.state = 'flee';
  r.fleeFromX = fromX;
  r.fleeFromY = fromY;
}

export function hitRabbit(r, damage) {
  r.health -= damage;
  r.knockX = r.x - state.player.x;
  r.knockY = r.y - state.player.y;
  SoundFX.rabbitHurt(r.x, r.y);
  spawnBlood(r.x, r.y, 2);
  spookRabbit(r, state.player.x, state.player.y);
  if (r.health <= 0) {
    removeEntity('rabbits', r);
    spawnCorpse(r.x, r.y, 'rabbit', r.variant);
    SoundFX.rabbitDeath(r.x, r.y);
    spawnBlood(r.x, r.y, 3);
    pushLog('El conejo cayó');
    return true;
  }
  return false;
}

export function updateRabbits(dt) {
  for (const r of state.rabbits) {
    const distToPlayer = dist(r.x, r.y, state.player.x, state.player.y);
    // Radio de alerta bien más chico que el del ciervo (90 vs 140): el
    // conejo deja acercarse más antes de asustarse, pero cuando arranca a
    // huir es más rápido en proporción a su tamaño.
    if (r.state !== 'flee' && distToPlayer < 90) {
      spookRabbit(r, state.player.x, state.player.y);
    }

    if (r.state === 'flee') {
      const baseAng = Math.atan2(r.y - r.fleeFromY, r.x - r.fleeFromX);
      const ang = baseAng + (r.wobble || (r.wobble = rand(-0.6, 0.6)));
      r.x += Math.cos(ang) * r.speed * 1.7 * dt;
      r.y += Math.sin(ang) * r.speed * 1.7 * dt;
      if (Math.abs(Math.cos(ang)) > 0.15) r.facing = Math.cos(ang) >= 0 ? 1 : -1;
      maybeSpawnWaterRipple(r, dt);
      // Se calma más rápido/cerca que el ciervo: no hace falta poner tanta
      // distancia para que un bicho tan chico se sienta a salvo de nuevo.
      const farFromPlayer = distToPlayer > 260;
      const farFromThreat = dist(r.x, r.y, r.fleeFromX, r.fleeFromY) > 240;
      if (farFromPlayer && farFromThreat) {
        r.state = 'wander';
        r.wanderTarget = null;
        r.wobble = null;
      }
    } else {
      if (!r.wanderTarget || dist(r.x, r.y, r.wanderTarget.x, r.wanderTarget.y) < 14) {
        r.wanderTarget = { x: r.x + rand(-90, 90), y: r.y + rand(-90, 90) };
      }
      const ang = Math.atan2(r.wanderTarget.y - r.y, r.wanderTarget.x - r.x);
      r.x += Math.cos(ang) * r.speed * 0.5 * dt;
      r.y += Math.sin(ang) * r.speed * 0.5 * dt;
      if (Math.abs(Math.cos(ang)) > 0.15) r.facing = Math.cos(ang) >= 0 ? 1 : -1;
      maybeSpawnWaterRipple(r, dt);
    }
  }
}

// Paletas de pelaje del ciervo (ver DEER_VARIANTS en world.js/generateChunk):
// cervato claro (original), pardo oscuro y dorado pálido. `rump` es la mancha
// clara trasera típica de un ciervo, un poco más clara/oscura según la paleta
// para que siga contrastando con el resto del cuerpo.
const DEER_PALETTES = [
  { light: '#c19467', dark: '#8a6440', rump: 'rgba(255,235,215,0.45)' },
  { light: '#9c7248', dark: '#664728', rump: 'rgba(235,210,180,0.4)' },
  { light: '#dcbb87', dark: '#a9895a', rump: 'rgba(255,244,225,0.5)' }
];

export function drawDeer(d, cam, ctx) {
  const sx = d.x - cam.x;
  const sy = d.y - cam.y;
  const pal = DEER_PALETTES[d.variant || 0] || DEER_PALETTES[0];
  const moving = d.state === 'flee' || d.state === 'wander';
  const grazing = d.state === 'graze';
  const dir = d.facing || 1;
  // Balanceo simple de patas: solo cuando se está moviendo, para que un
  // ciervo parado pastando no tiemble en el lugar.
  const stride = moving ? Math.sin(state.elapsed * (d.state === 'flee' ? 12 : 6) + d.x * 0.1) * 2.4 : 0;
  // Respiración sutil (todo el cuerpo sube/baja de a poco) y, si está
  // pastando, la cabeza baja y sube cada tanto como si mordisqueara.
  const breathe = Math.sin(state.elapsed * 2.2 + d.x * 0.3) * (grazing ? 0.6 : 0.3);
  const headDip = grazing ? (Math.sin(state.elapsed * 0.8 + d.x * 0.2) * 0.5 + 0.5) * 2.6 : 0;
  const tailWag = Math.sin(state.elapsed * (moving ? 9 : 3) + d.y * 0.2) * (moving ? 1 : 0.5);

  // sx/sy quedan como origen local; ctx.scale(dir,1) espeja todo el dibujo
  // cuando el ciervo se mueve hacia la izquierda, así deja de mirar siempre
  // para el mismo lado.
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(dir, 1);

  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(0, 8, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Patas: dos pares con desfase de zancada opuesto entre sí.
  ctx.strokeStyle = pal.dark;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  [[-5, stride], [1, -stride], [5, -stride * 0.7], [-1, stride * 0.7]].forEach(([lx, off]) => {
    ctx.beginPath();
    ctx.moveTo(lx, 3 + breathe * 0.3);
    ctx.lineTo(lx + off * 0.3, 9);
    ctx.stroke();
  });

  // Cola cortita, con un leve meneo constante (más rápido si está corriendo).
  ctx.save();
  ctx.translate(-9, -1 + breathe * 0.2);
  ctx.rotate(tailWag * 0.3);
  ctx.fillStyle = pal.rump;
  ctx.beginPath();
  ctx.ellipse(0, 0, 2.4, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const bodyY = breathe * 0.4;
  const furG = ctx.createRadialGradient(-3, bodyY - 3, 1, 0, bodyY, 12);
  furG.addColorStop(0, pal.light);
  furG.addColorStop(1, pal.dark);
  ctx.fillStyle = furG;
  ctx.beginPath();
  ctx.ellipse(0, bodyY, 11, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cabeza: baja un poco al pastar (headDip) en vez de quedar siempre fija.
  const headX = 8, headY = -5 + headDip + bodyY;
  ctx.fillStyle = furG;
  ctx.beginPath();
  ctx.ellipse(headX, headY, 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Orejas.
  ctx.fillStyle = pal.dark;
  ctx.beginPath();
  ctx.ellipse(headX + 1, headY - 4, 1.8, 3, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pal.rump;
  ctx.beginPath();
  ctx.ellipse(-2, bodyY + 2, 3.5, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,15,10,0.8)';
  ctx.beginPath();
  ctx.arc(headX + 2, headY - 1, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Barra de vida: solo aparece si ya recibió algún golpe (igual criterio
  // visual que se usa con el lobo, pero sin mostrarla todo el tiempo ya que
  // el ciervo no es hostil). Se dibuja después de restore() para que no se
  // espeje junto con el cuerpo.
  if (d.health < d.maxHealth) {
    ctx.strokeStyle = 'rgba(203,216,195,0.6)';
    ctx.strokeRect(sx - 13, sy - 18, 26 * (d.health / d.maxHealth), 3);
  }
}

// Paletas de pelaje del conejo (ver RABBIT_VARIANTS en world.js/generateChunk):
// gris de campo (original) y marrón. Bastante más chico y simple que el
// ciervo (sin cornamenta ni patas individuales marcadas): orejas largas,
// cuerpo ovalado y una colita redonda blanca.
const RABBIT_PALETTES = [
  { light: '#b8ada0', dark: '#847a6e', tail: '#f2ece2' },
  { light: '#8a6a4c', dark: '#5c4530', tail: '#e8ddc8' }
];

export function drawRabbit(r, cam, ctx) {
  const sx = r.x - cam.x;
  const sy = r.y - cam.y;
  const pal = RABBIT_PALETTES[r.variant || 0] || RABBIT_PALETTES[0];
  const moving = r.state === 'flee' || r.state === 'wander';
  const dir = r.facing || 1;
  // Salto simple en vez del balanceo de patas del ciervo: el cuerpo entero
  // rebota un poco al moverse (más marcado huyendo que deambulando).
  const hop = moving ? Math.abs(Math.sin(state.elapsed * (r.state === 'flee' ? 14 : 7) + r.x * 0.1)) * (r.state === 'flee' ? 3 : 1.6) : 0;
  const breathe = Math.sin(state.elapsed * 3 + r.x * 0.3) * 0.3;

  ctx.save();
  ctx.translate(sx, sy - hop);
  ctx.scale(dir, 1);

  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(0, 6 + hop, 6, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();

  const bodyY = breathe * 0.3;
  const furG = ctx.createRadialGradient(-2, bodyY - 2, 1, 0, bodyY, 7);
  furG.addColorStop(0, pal.light);
  furG.addColorStop(1, pal.dark);
  ctx.fillStyle = furG;
  ctx.beginPath();
  ctx.ellipse(0, bodyY, 7, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cabeza, orejas largas (la seña de identidad del conejo) y colita.
  const headX = 5, headY = -3 + bodyY;
  ctx.fillStyle = furG;
  ctx.beginPath();
  ctx.ellipse(headX, headY, 3.2, 2.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pal.dark;
  [[-0.4, -1], [1, -0.6]].forEach(([ox, rot]) => {
    ctx.save();
    ctx.translate(headX + ox, headY - 2);
    ctx.rotate(rot * 0.25);
    ctx.beginPath();
    ctx.ellipse(0, -3.2, 1, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  ctx.fillStyle = pal.tail;
  ctx.beginPath();
  ctx.ellipse(-6, bodyY + 1, 2, 1.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,15,10,0.8)';
  ctx.beginPath();
  ctx.arc(headX + 1.6, headY - 0.5, 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Igual criterio que el ciervo: la barra de vida solo aparece si ya
  // recibió algún golpe, y se dibuja después de restore() para que no se
  // espeje junto con el cuerpo.
  if (r.health < r.maxHealth) {
    ctx.strokeStyle = 'rgba(203,216,195,0.6)';
    ctx.strokeRect(sx - 8, sy - 12, 16 * (r.health / r.maxHealth), 2.5);
  }
}
