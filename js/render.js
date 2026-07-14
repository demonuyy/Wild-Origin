// Todo lo que dibuja en pantalla (antes vivía adentro de game.js, mezclado
// con el bucle principal y el binding de controles). game.js ahora solo
// llama a render() una vez por frame.
import { state, ctx, canvas, DAY_LENGTH, ZOOM_MIN, ZOOM_DEFAULT, clamp } from './config.js';
import { SoundFX } from './audio.js';
import { drawGround, drawGrassDecor, drawBloodDecals, drawPonds, drawTree, drawRock, drawBush, drawStick, drawStone } from './world.js';
import { drawDeer } from './animals.js';
import { drawWolf } from './enemies.js';
import { drawCampfire, drawShelter } from './building.js';

// El minimapa es infinito como el mundo: no hay un WORLD_W/H para escalar,
// así que se centra siempre en el jugador y muestra una ventana fija a su alrededor.
const MINIMAP_RANGE = 1800; // unidades de mundo visibles a cada lado del jugador

function renderMinimap(cam, viewW, viewH) {
  const mc = document.getElementById('minimap');
  const mctx = mc.getContext('2d');
  const W = mc.width;
  const H = mc.height;
  const scale = W / (MINIMAP_RANGE * 2);
  const px = state.player.x, py = state.player.y;
  const toMap = (wx, wy) => [W / 2 + (wx - px) * scale, H / 2 + (wy - py) * scale];

  mctx.clearRect(0, 0, W, H);
  mctx.fillStyle = '#1c2e1a';
  mctx.fillRect(0, 0, W, H);

  mctx.fillStyle = '#3d6b7a';
  for (const p of state.ponds) { const [mx, my] = toMap(p.x, p.y); mctx.beginPath(); mctx.arc(mx, my, 2.2, 0, Math.PI * 2); mctx.fill(); }
  mctx.fillStyle = '#8a5a3a';
  for (const s of state.shelters) { const [mx, my] = toMap(s.x, s.y); mctx.beginPath(); mctx.arc(mx, my, 2.8, 0, Math.PI * 2); mctx.fill(); }
  mctx.fillStyle = '#ffb85c';
  for (const f of state.campfires) { const [mx, my] = toMap(f.x, f.y); mctx.beginPath(); mctx.arc(mx, my, 1.8, 0, Math.PI * 2); mctx.fill(); }
  mctx.fillStyle = '#c0392b';
  for (const w of state.wolves) { const [mx, my] = toMap(w.x, w.y); mctx.beginPath(); mctx.arc(mx, my, 1.6, 0, Math.PI * 2); mctx.fill(); }

  mctx.strokeStyle = 'rgba(203,216,195,0.45)';
  mctx.lineWidth = 1;
  const [rx, ry] = toMap(cam.x, cam.y);
  mctx.strokeRect(rx, ry, viewW * scale, viewH * scale);

  mctx.fillStyle = '#ffe9c7';
  mctx.beginPath();
  mctx.arc(W / 2, H / 2, 3, 0, Math.PI * 2);
  mctx.fill();
  mctx.strokeStyle = '#ffe9c7';
  mctx.lineWidth = 1.4;
  mctx.beginPath();
  mctx.moveTo(W / 2, H / 2);
  mctx.lineTo(W / 2 + state.player.dir.x * 9, H / 2 + state.player.dir.y * 9);
  mctx.stroke();
}

function drawPlayer(cam) {
  const { player } = state;
  const sx = player.x - cam.x;
  const moving = Math.abs(player.dir.x) + Math.abs(player.dir.y) > 0 && state.keys && (state.keys['w'] || state.keys['a'] || state.keys['s'] || state.keys['d'] || state.keys['arrowup'] || state.keys['arrowdown'] || state.keys['arrowleft'] || state.keys['arrowright']);
  const bob = moving ? Math.sin(state.elapsed * 10) * 1.6 : 0;
  const sy = player.y - cam.y + bob;
  // Vector perpendicular a la dirección (para separar los brazos a cada
  // costado del cuerpo) y balanceo de brazos al caminar.
  const perpX = -player.dir.y;
  const perpY = player.dir.x;
  const armSwing = moving ? Math.sin(state.elapsed * 10) * 4 : 0;
  const hasTool = player.hasSpear || player.equippedTool === 'axe' || player.equippedTool === 'pickaxe';
  // Contorno oscuro fino aplicado a casi todas las piezas: es lo que hace
  // que el personaje se lea con claridad contra el pasto/fondo, en vez de
  // mezclarse con los colores del mundo como pasaba antes.
  const OUTLINE = 'rgba(35,24,14,0.55)';

  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(sx, player.y - cam.y + 15, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mochila: ahora se ancla detrás del jugador (lado opuesto a hacia donde
  // mira) en vez de a un costado fijo, así no queda "flotando" rara cuando
  // el jugador cambia de dirección.
  if (player.hasBackpack) {
    const bpX = sx - player.dir.x * 7;
    const bpY = sy - player.dir.y * 7 + 3;
    ctx.fillStyle = '#4a3826';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(bpX, bpY, 6.5, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // ---- Piernas ----
  // Se dibujan antes que el torso para que la cadera quede tapada por él y
  // solo se vean los pies asomando por debajo, en contrafase entre sí (una
  // pierna adelante, la otra atrás) siguiendo el bamboleo del cuerpo.
  function drawLeg(hipSide, swing) {
    const hipX = sx + perpX * 4 * hipSide;
    const hipY = sy + 12;
    const footX = hipX + player.dir.x * swing;
    const footY = hipY + 8 + player.dir.y * swing;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(footX, footY);
    ctx.stroke();
    ctx.strokeStyle = '#4a3320';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(footX, footY);
    ctx.stroke();
    // Bota: una manchita más oscura en la punta del pie.
    ctx.fillStyle = '#2e2015';
    ctx.beginPath();
    ctx.ellipse(footX, footY, 2.6, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const legSwing = moving ? Math.sin(state.elapsed * 10) * 5 : 0;
  drawLeg(-1, legSwing);
  drawLeg(1, -legSwing);

  // ---- Brazos y manos ----
  // La mano "libre" se balancea al caminar; la mano "activa" agarra la
  // lanza/hacha/pico si hay una herramienta en la mano (si no, se balancea
  // igual que la libre). Los hombros se separan un poco más del cuerpo
  // (ARM_SPACING) que antes para que ambos brazos se noten mejor.
  const ARM_SPACING = 8.5;

  function drawArm(shoulderSide, handX, handY) {
    const shoulderX = sx + perpX * ARM_SPACING * shoulderSide;
    const shoulderY = sy - 3 + perpY * ARM_SPACING * shoulderSide;
    // Trazo oscuro un poco más ancho detrás, para que el brazo tenga borde
    // definido en vez de ser una línea plana flotando sobre el fondo.
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(handX, handY);
    ctx.stroke();
    ctx.strokeStyle = '#dba579';
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(handX, handY);
    ctx.stroke();
    const handG = ctx.createRadialGradient(handX - 1, handY - 1, 0.5, handX, handY, 3.4);
    handG.addColorStop(0, '#f0cca0');
    handG.addColorStop(1, '#cf9d6c');
    ctx.fillStyle = handG;
    ctx.beginPath();
    ctx.arc(handX, handY, 3.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  const freeShoulderX = sx + perpX * ARM_SPACING * -1;
  const freeShoulderY = sy - 3 + perpY * ARM_SPACING * -1;
  const freeHandX = freeShoulderX - player.dir.x * (armSwing - 3);
  const freeHandY = freeShoulderY - player.dir.y * (armSwing - 3) + 8;

  const activeShoulderX = sx + perpX * ARM_SPACING;
  const activeShoulderY = sy - 3 + perpY * ARM_SPACING;
  let activeHandX, activeHandY;
  if (hasTool) {
    activeHandX = sx + player.dir.x * 14;
    activeHandY = sy + player.dir.y * 14 - 2;
  } else {
    activeHandX = activeShoulderX + player.dir.x * (armSwing + 3);
    activeHandY = activeShoulderY + player.dir.y * (armSwing + 3) + 8;
  }

  // Cuál brazo queda tapado por el torso depende de hacia qué lado mira el
  // jugador: mirando a la izquierda, el brazo derecho (shoulderSide 1) pasa
  // por detrás; mirando a la derecha, es el izquierdo (shoulderSide -1) el
  // que pasa por detrás. Mirando solo arriba/abajo no hay un lado detrás
  // claro, así que se dibujan los dos por delante como antes.
  const backSide = player.dir.x < -0.05 ? 1 : (player.dir.x > 0.05 ? -1 : 0);

  if (backSide === 1) drawArm(1, activeHandX, activeHandY);
  else if (backSide === -1) drawArm(-1, freeHandX, freeHandY);

  // ---- Torso ----
  // Antes era un triángulo con la punta siempre hacia arriba sin importar
  // hacia dónde caminara el jugador; combinado con brazos/piernas que sí
  // giran según player.dir, quedaba una mezcla rara (cuerpo "mirando" para
  // un lado, extremidades para otro). Ahora es un torso desnudo (mismo tono
  // de piel que la cabeza y los brazos) con hombros redondeados, y un
  // taparrabos de cuero cubriendo solo la cadera en vez de una remera entera.
  ctx.fillStyle = OUTLINE;
  ctx.beginPath();
  ctx.moveTo(sx - 9.5, sy + 14.5);
  ctx.quadraticCurveTo(sx - 10.5, sy - 2.5, sx - 6, sy - 7.5);
  ctx.quadraticCurveTo(sx, sy - 10.5, sx + 6, sy - 7.5);
  ctx.quadraticCurveTo(sx + 10.5, sy - 2.5, sx + 9.5, sy + 14.5);
  ctx.closePath();
  ctx.fill();

  const bodyG = ctx.createLinearGradient(sx - 9, 0, sx + 9, 0);
  bodyG.addColorStop(0, '#cf9d6c');
  bodyG.addColorStop(0.5, '#f0cca0');
  bodyG.addColorStop(1, '#cf9d6c');
  ctx.fillStyle = bodyG;
  ctx.beginPath();
  ctx.moveTo(sx - 8.5, sy + 14);
  ctx.quadraticCurveTo(sx - 9.5, sy - 2, sx - 5.5, sy - 6.8);
  ctx.quadraticCurveTo(sx, sy - 9.6, sx + 5.5, sy - 6.8);
  ctx.quadraticCurveTo(sx + 9.5, sy - 2, sx + 8.5, sy + 14);
  ctx.closePath();
  ctx.fill();

  // Taparrabos: paño de cuero que cubre solo la parte baja del torso (la
  // cadera), dejando el pecho al desnudo.
  ctx.fillStyle = OUTLINE;
  ctx.beginPath();
  ctx.moveTo(sx - 8.8, sy + 14.5);
  ctx.lineTo(sx + 8.8, sy + 14.5);
  ctx.lineTo(sx + 6.8, sy + 3.5);
  ctx.lineTo(sx - 6.8, sy + 3.5);
  ctx.closePath();
  ctx.fill();

  const clothG = ctx.createLinearGradient(sx - 7, 0, sx + 7, 0);
  clothG.addColorStop(0, '#4a3320');
  clothG.addColorStop(0.5, '#6b4d2c');
  clothG.addColorStop(1, '#4a3320');
  ctx.fillStyle = clothG;
  ctx.beginPath();
  ctx.moveTo(sx - 8, sy + 14);
  ctx.lineTo(sx + 8, sy + 14);
  ctx.lineTo(sx + 6, sy + 4);
  ctx.lineTo(sx - 6, sy + 4);
  ctx.closePath();
  ctx.fill();

  // ---- Cabeza ----
  ctx.fillStyle = OUTLINE;
  ctx.beginPath();
  ctx.arc(sx, sy - 12, 8.8, 0, Math.PI * 2);
  ctx.fill();

  const headG = ctx.createRadialGradient(sx - 3, sy - 15, 1, sx, sy - 12, 9);
  headG.addColorStop(0, '#f0cca0');
  headG.addColorStop(1, '#cf9d6c');
  ctx.fillStyle = headG;
  ctx.beginPath();
  ctx.arc(sx, sy - 12, 8, 0, Math.PI * 2);
  ctx.fill();

  // Mirando hacia el norte (arriba) se ve la nuca, no la cara: en ese caso
  // el pelo cubre toda la cabeza y no se dibujan ojos. En cualquier otra
  // dirección se ve un casquete de pelo solo del lado de atrás, y la cara
  // (ojos) del lado hacia donde camina.
  const facingNorth = player.dir.y < -0.5;

  if (facingNorth) {
    ctx.fillStyle = '#3a2a1a';
    ctx.beginPath();
    ctx.arc(sx, sy - 12, 7.6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Pelo: un casquete oscuro sobre la mitad de atrás de la cabeza (opuesta
    // a hacia donde mira), para reforzar que la "cara" queda del otro lado.
    ctx.fillStyle = '#3a2a1a';
    ctx.beginPath();
    ctx.arc(sx - player.dir.x * 2.5, sy - 12 - player.dir.y * 2.5, 7.6,
      Math.atan2(player.dir.y, player.dir.x) + Math.PI * 0.5,
      Math.atan2(player.dir.y, player.dir.x) + Math.PI * 1.5);
    ctx.fill();

    // Ojos: dos puntitos oscuros corridos hacia donde mira el jugador y
    // separados a los costados, así de un vistazo se entiende para dónde
    // está mirando (antes la cabeza era una bolita lisa, sin cara).
    const eyeFX = sx + player.dir.x * 4;
    const eyeFY = sy - 12 + player.dir.y * 4;
    ctx.fillStyle = '#2a1c12';
    [-1, 1].forEach(side => {
      ctx.beginPath();
      ctx.arc(eyeFX + perpX * 2.6 * side, eyeFY + perpY * 2.6 * side, 1.15, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // El brazo que no quedó detrás del torso se dibuja ahora, por delante de
  // todo (torso, cabeza), bien visible. Mirando arriba/abajo se dibujan los
  // dos acá, ambos por delante.
  if (backSide === 1) {
    drawArm(-1, freeHandX, freeHandY);
  } else if (backSide === -1) {
    drawArm(1, activeHandX, activeHandY);
  } else {
    drawArm(-1, freeHandX, freeHandY);
    drawArm(1, activeHandX, activeHandY);
  }

  if (player.hasSpear) {
    ctx.strokeStyle = '#c9a86a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sx + player.dir.x * 4, sy + player.dir.y * 4);
    ctx.lineTo(sx + player.dir.x * 34, sy + player.dir.y * 34);
    ctx.stroke();
    ctx.fillStyle = '#e4e4dc';
    ctx.beginPath();
    ctx.arc(sx + player.dir.x * 36, sy + player.dir.y * 36, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Hacha o pico "en la mano": solo se dibuja si esa es la herramienta activa,
  // para que se note a simple vista que el jugador puede talar o minar ahora mismo.
  if (player.equippedTool === 'axe' || player.equippedTool === 'pickaxe') {
    const hx = sx + player.dir.x * 16;
    const hy = sy + player.dir.y * 16 - 4;
    ctx.strokeStyle = '#5a4530';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(hx, hy + 10);
    ctx.lineTo(hx + player.dir.x * 4, hy - 8);
    ctx.stroke();
    ctx.fillStyle = '#b7b6ac';
    ctx.beginPath();
    if (player.equippedTool === 'axe') {
      ctx.moveTo(hx + player.dir.x * 4 - 5, hy - 8);
      ctx.lineTo(hx + player.dir.x * 4 + 5, hy - 10);
      ctx.lineTo(hx + player.dir.x * 4 + 3, hy - 2);
      ctx.lineTo(hx + player.dir.x * 4 - 4, hy - 3);
    } else {
      ctx.moveTo(hx + player.dir.x * 4 - 6, hy - 5);
      ctx.lineTo(hx + player.dir.x * 4 + 6, hy - 11);
      ctx.lineTo(hx + player.dir.x * 4 + 2, hy - 3);
    }
    ctx.closePath();
    ctx.fill();
  }
}

// ---------- Niebla al alejar la cámara ----------
// Cuanto más aleja el jugador el zoom (rueda del mouse hacia atrás), más
// nubes/neblina cruzan la pantalla — a ZOOM_DEFAULT (o más cerca) no hay
// nada, a ZOOM_MIN está en su punto máximo. Además de dar ambiente, disimula
// un poco el borde de lo que se alcanza a cargar/dibujar bien lejos.
// Cada puff tiene su propia semilla de posición y velocidad de deriva; se
// dibujan en espacio de pantalla (no del mundo) así que no hace falta cam.
const FOG_PUFFS = [
  { seed: 0.11, seedY: 0.62, speedX: 6, speedY: 1.4, size: 0.55 },
  { seed: 0.47, seedY: 0.18, speedX: -4.5, speedY: 2.1, size: 0.75 },
  { seed: 0.72, seedY: 0.83, speedX: 5.2, speedY: -1.8, size: 0.42 },
  { seed: 0.29, seedY: 0.41, speedX: -3.1, speedY: -2.6, size: 0.62 },
  { seed: 0.88, seedY: 0.05, speedX: 3.8, speedY: 2.9, size: 0.5 }
];

function drawFogLayer(t) {
  if (t <= 0.01) return;
  const w = canvas.width, h = canvas.height;
  const span = w + h * 0.6;
  ctx.save();
  for (const p of FOG_PUFFS) {
    // Deriva en loop infinito (módulo) para no tener que reposicionar nada a mano.
    const px = (((p.seed * w + state.elapsed * p.speedX * 9) % span) + span) % span - h * 0.3;
    const py = (((p.seedY * h + state.elapsed * p.speedY * 9) % (h + w * 0.3)) + (h + w * 0.3)) % (h + w * 0.3) - w * 0.15;
    const r = (w + h) * 0.5 * p.size * (0.55 + t * 0.45);
    const g = ctx.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, `rgba(213,221,224,${0.28 * t})`);
    g.addColorStop(0.6, `rgba(213,221,224,${0.13 * t})`);
    g.addColorStop(1, 'rgba(213,221,224,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Dibuja un frame completo: terreno, entidades ordenadas por Y, oscuridad
// día/noche y minimapa. Llamado una vez por frame desde el loop de game.js.
export function render() {
  const zoom = state.zoom;
  // El área visible del mundo se achica con zoom > 1, acercando la cámara al jugador.
  const viewW = canvas.width / zoom;
  const viewH = canvas.height / zoom;
  const cam = {
    x: state.player.x - viewW / 2,
    y: state.player.y - viewH / 2
  };

  ctx.save();
  ctx.scale(zoom, zoom);

  drawGround(ctx, { width: viewW, height: viewH }, cam);
  drawGrassDecor(ctx, cam, viewW, viewH);
  drawBloodDecals(ctx, cam, viewW, viewH);
  drawPonds(ctx, cam, viewW, viewH);

  // Se descarta lo que quedó fuera de pantalla ANTES de armar el array a ordenar
  // (antes se armaba con TODO lo cargado en los chunks vecinos y se filtraba
  // recién adentro de cada draw(), lo cual con el mapa infinito significaba
  // ordenar miles de objetos innecesariamente en cada frame).
  const margin = 220;
  const left = cam.x - margin, right = cam.x + viewW + margin;
  const top = cam.y - margin, bottom = cam.y + viewH + margin;
  const inView = (o) => o.x >= left && o.x <= right && o.y >= top && o.y <= bottom;

  const drawables = [];
  for (const t of state.trees) if (inView(t)) drawables.push({ y: t.y, type: 0, ref: t });
  for (const r of state.rocks) if (inView(r)) drawables.push({ y: r.y, type: 1, ref: r });
  for (const b of state.bushes) if (inView(b)) drawables.push({ y: b.y, type: 2, ref: b });
  for (const s of state.sticks) if (inView(s)) drawables.push({ y: s.y, type: 8, ref: s });
  for (const s of state.stones) if (inView(s)) drawables.push({ y: s.y, type: 9, ref: s });
  for (const f of state.campfires) if (inView(f)) drawables.push({ y: f.y, type: 3, ref: f });
  for (const s of state.shelters) if (inView(s)) drawables.push({ y: s.y, type: 4, ref: s });
  for (const d of state.deer) if (inView(d)) drawables.push({ y: d.y, type: 5, ref: d });
  for (const w of state.wolves) if (inView(w)) drawables.push({ y: w.y, type: 6, ref: w });
  drawables.push({ y: state.player.y, type: 7, ref: null });
  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) {
    switch (d.type) {
      case 0: drawTree(d.ref, cam, ctx); break;
      case 1: drawRock(d.ref, cam, ctx); break;
      case 2: drawBush(d.ref, cam, ctx); break;
      case 3: drawCampfire(d.ref, cam); break;
      case 4: drawShelter(d.ref, cam); break;
      case 5: drawDeer(d.ref, cam, ctx); break;
      case 6: drawWolf(d.ref, cam, ctx); break;
      case 7: drawPlayer(cam); break;
      case 8: drawStick(d.ref, cam, ctx); break;
      case 9: drawStone(d.ref, cam, ctx); break;
    }
  }

  ctx.restore(); // el resto (niebla, oscuridad, flash, minimapa) se dibuja en espacio de pantalla real, sin escalar

  // 0 = zoom normal/cercano, 1 = zoom mínimo (cámara lo más alejada posible).
  // Un mismo valor maneja tanto la niebla visual como el refuerzo de viento.
  const zoomFog = clamp((ZOOM_DEFAULT - zoom) / (ZOOM_DEFAULT - ZOOM_MIN), 0, 1);
  drawFogLayer(zoomFog);
  SoundFX.setZoomFog(zoomFog);

  const phase = (state.elapsed % DAY_LENGTH) / DAY_LENGTH;
  let darkness = 0;
  if (phase > 0.42 && phase <= 0.58) darkness = (phase - 0.42) / 0.16;
  else if (phase > 0.58 && phase < 0.90) darkness = 1;
  else if (phase >= 0.90 && phase < 1.0) darkness = 1 - ((phase - 0.90) / 0.10);
  darkness = clamp(darkness, 0, 1) * 0.82;
  SoundFX.setDarkness(darkness);

  if (darkness > 0.01) {
    const mask = document.createElement('canvas');
    mask.width = canvas.width;
    mask.height = canvas.height;
    const mctx = mask.getContext('2d');
    mctx.fillStyle = `rgba(4,8,10,${darkness})`;
    mctx.fillRect(0, 0, canvas.width, canvas.height);
    mctx.globalCompositeOperation = 'destination-out';
    // Posiciones y radios en espacio de pantalla real: hay que multiplicar por el zoom
    // porque el mundo se dibujó escalado, pero esta máscara no.
    const px = (state.player.x - cam.x) * zoom;
    const py = (state.player.y - cam.y) * zoom;
    const playerR = 200 * zoom;
    let rg = mctx.createRadialGradient(px, py, 10 * zoom, px, py, playerR);
    rg.addColorStop(0, 'rgba(0,0,0,1)');
    rg.addColorStop(0.6, 'rgba(0,0,0,0.65)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    mctx.fillStyle = rg;
    mctx.beginPath();
    mctx.arc(px, py, playerR, 0, Math.PI * 2);
    mctx.fill();
    for (const f of state.campfires) {
      const fx = (f.x - cam.x) * zoom;
      const fy = (f.y - cam.y) * zoom;
      const fireR = 260 * zoom;
      let fg = mctx.createRadialGradient(fx, fy, 10 * zoom, fx, fy, fireR);
      fg.addColorStop(0, 'rgba(0,0,0,1)');
      fg.addColorStop(0.55, 'rgba(0,0,0,0.6)');
      fg.addColorStop(1, 'rgba(0,0,0,0)');
      mctx.fillStyle = fg;
      mctx.beginPath();
      mctx.arc(fx, fy, fireR, 0, Math.PI * 2);
      mctx.fill();
    }
    ctx.drawImage(mask, 0, 0);
  }

  if (state.player.hitFlash > 0) {
    ctx.fillStyle = `rgba(160,20,10,${state.player.hitFlash * 0.5})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  renderMinimap(cam, viewW, viewH);
}
