import { state, CHUNK_SIZE, rand, dist, clamp } from './config.js';

// ---------- Ruido de valor 2D (continuo, sin dependencias externas) ----------
// Define "biomas" suaves (zonas más boscosas, más rocosas, etc.) que son iguales
// sin importar en qué chunk se evalúen -> los biomas cruzan los bordes de los
// chunks sin costuras.
function makeNoise2D(seed) {
  function hash(x, y) {
    const s = Math.sin(x * 127.1 + y * 311.7 + seed) * 43758.5453123;
    return s - Math.floor(s);
  }
  function smooth(t) { return t * t * (3 - 2 * t); }
  return function (x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const v00 = hash(xi, yi), v10 = hash(xi + 1, yi);
    const v01 = hash(xi, yi + 1), v11 = hash(xi + 1, yi + 1);
    const u = smooth(xf), v = smooth(yf);
    const top = v00 + (v10 - v00) * u;
    const bottom = v01 + (v11 - v01) * u;
    return top + (bottom - top) * v;
  };
}

// ---------- PRNG determinístico por chunk ----------
// Cada chunk se genera siempre igual a partir de (semilla del mundo, cx, cy),
// así que se puede descargar y volver a cargar sin que cambie su contenido base.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function chunkSeed(worldSeed, cx, cy) {
  let h = (worldSeed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ cx, 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ cy, 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}

let forestNoise = null;
let rockNoise = null;
let bushNoise = null;
const NOISE_SCALE = 0.0035;

function chunkKeyOf(cx, cy) { return cx + ',' + cy; }

// Reinicia el mundo: nueva semilla global. A partir de acá todo se genera
// "on demand" chunk por chunk según updateChunks().
export function generateWorld() {
  state.trees = [];
  state.rocks = [];
  state.bushes = [];
  state.ponds = [];
  state.campfires = [];
  state.shelters = [];
  state.wolves = [];
  state.deer = [];
  state.grassDecor = [];
  state.chunkStore = {};
  state.loadedChunks = new Set();
  state.worldSeed = Math.floor(Math.random() * 1e9);
  forestNoise = makeNoise2D(state.worldSeed);
  rockNoise = makeNoise2D(state.worldSeed + 4321.7);
  bushNoise = makeNoise2D(state.worldSeed + 8765.3);
}

function generateChunk(cx, cy) {
  const key = chunkKeyOf(cx, cy);
  const rnd = mulberry32(chunkSeed(state.worldSeed, cx, cy));
  const crand = (a, b) => a + rnd() * (b - a);
  const ox = cx * CHUNK_SIZE, oy = cy * CHUNK_SIZE;
  const nearSpawn = (x, y) => dist(x, y, 0, 0) < 260;

  const trees = [], rocks = [], bushes = [], ponds = [], wolves = [], deer = [], grassDecor = [];

  const tryPlace = (list, attempts, noiseFn, factory) => {
    for (let i = 0; i < attempts; i++) {
      const x = ox + crand(0, CHUNK_SIZE);
      const y = oy + crand(0, CHUNK_SIZE);
      if (nearSpawn(x, y)) continue;
      const n = noiseFn(x * NOISE_SCALE, y * NOISE_SCALE);
      const density = clamp((n - 0.32) * 2.2, 0, 1);
      if (rnd() > density) continue;
      const obj = factory(x, y);
      obj.chunkKey = key;
      list.push(obj);
    }
  };

  // OJO: la fórmula de densidad de abajo acepta en promedio ~45% de los intentos
  // (no un 5-10% como parecería a simple vista), así que estos números ya están
  // calibrados para dar una densidad similar a la del mapa original por chunk.
  tryPlace(trees, 18, forestNoise, (x, y) => ({ x, y, hits: 3, maxHits: 3, size: crand(0.85, 1.3), sway: crand(0, Math.PI * 2) }));
  tryPlace(rocks, 9, rockNoise, (x, y) => ({ x, y, hits: 4, maxHits: 4, size: crand(0.8, 1.25) }));
  tryPlace(bushes, 7, bushNoise, (x, y) => ({ x, y, stock: 3, maxStock: 3, regrowTimer: 0, size: crand(0.85, 1.2) }));

  if (rnd() < 0.35) {
    const x = ox + crand(100, CHUNK_SIZE - 100);
    const y = oy + crand(100, CHUNK_SIZE - 100);
    if (!nearSpawn(x, y)) ponds.push({ x, y, rw: crand(70, 130), rh: crand(50, 90), chunkKey: key });
  }
  if (rnd() < 0.55) {
    const x = ox + crand(0, CHUNK_SIZE);
    const y = oy + crand(0, CHUNK_SIZE);
    if (!nearSpawn(x, y)) {
      wolves.push({ x, y, health: 34, maxHealth: 34, speed: crand(95, 125), state: 'wander', wanderTarget: null, attackCd: 0, alertR: 110, chunkKey: key });
    }
  }
  if (rnd() < 0.4) {
    const x = ox + crand(0, CHUNK_SIZE);
    const y = oy + crand(0, CHUNK_SIZE);
    if (!nearSpawn(x, y)) deer.push({ x, y, speed: 110, wanderTarget: null, fleeing: false, chunkKey: key });
  }
  for (let i = 0; i < 22; i++) {
    grassDecor.push({ x: ox + crand(0, CHUNK_SIZE), y: oy + crand(0, CHUNK_SIZE), s: crand(0.5, 1.3), rot: crand(0, Math.PI * 2), chunkKey: key });
  }

  const data = { trees, rocks, bushes, ponds, wolves, deer, grassDecor };
  state.chunkStore[key] = data;
  return data;
}

function attachChunk(key) {
  const [cx, cy] = key.split(',').map(Number);
  const data = state.chunkStore[key] || generateChunk(cx, cy);
  state.trees.push(...data.trees);
  state.rocks.push(...data.rocks);
  state.bushes.push(...data.bushes);
  state.ponds.push(...data.ponds);
  state.wolves.push(...data.wolves);
  state.deer.push(...data.deer);
  state.grassDecor.push(...data.grassDecor);
  state.loadedChunks.add(key);
}

function detachChunk(key) {
  state.trees = state.trees.filter(o => o.chunkKey !== key);
  state.rocks = state.rocks.filter(o => o.chunkKey !== key);
  state.bushes = state.bushes.filter(o => o.chunkKey !== key);
  state.ponds = state.ponds.filter(o => o.chunkKey !== key);
  state.wolves = state.wolves.filter(o => o.chunkKey !== key);
  state.deer = state.deer.filter(o => o.chunkKey !== key);
  state.grassDecor = state.grassDecor.filter(o => o.chunkKey !== key);
  state.loadedChunks.delete(key);
}

// Quita permanentemente una entidad (árbol talado del todo, lobo muerto, etc.)
// tanto de la lista activa como del chunk guardado, para que no reaparezca al
// volver a esa zona.
export function removeEntity(listName, obj) {
  const arr = state[listName];
  const i = arr.indexOf(obj);
  if (i !== -1) arr.splice(i, 1);
  const chunk = state.chunkStore[obj.chunkKey];
  if (chunk) {
    const arr2 = chunk[listName];
    const j = arr2.indexOf(obj);
    if (j !== -1) arr2.splice(j, 1);
  }
}

// Carga los chunks necesarios para cubrir lo que se ve en pantalla (según el
// zoom actual) y descarga los que quedaron lejos. Se llama en cada frame.
export function updateChunks(viewW, viewH) {
  const pcx = Math.floor(state.player.x / CHUNK_SIZE);
  const pcy = Math.floor(state.player.y / CHUNK_SIZE);
  // Se limita el radio máximo aunque el jugador aleje mucho el zoom, para no
  // disparar la cantidad de objetos activos (y por lo tanto el costo por frame).
  const radius = Math.min(4, Math.ceil(Math.max(viewW, viewH) / CHUNK_SIZE / 2) + 1);

  const needed = new Set();
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      needed.add(chunkKeyOf(pcx + dx, pcy + dy));
    }
  }

  for (const key of needed) {
    if (!state.loadedChunks.has(key)) attachChunk(key);
  }

  const unloadRadius = radius + 1;
  for (const key of [...state.loadedChunks]) {
    if (needed.has(key)) continue;
    const [kcx, kcy] = key.split(',').map(Number);
    if (Math.abs(kcx - pcx) > unloadRadius || Math.abs(kcy - pcy) > unloadRadius) {
      detachChunk(key);
    }
  }
}

// ---------- Dibujo ----------

export function drawGround(ctx, canvas, cam) {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#2a4527');
  grad.addColorStop(1, '#16281a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Manchas de textura del suelo, en una grilla infinita (cada celda tiene un
  // offset pseudoaleatorio propio) para que no haga falta un WORLD_W/H fijo.
  const TILE = 260;
  const startCx = Math.floor(cam.x / TILE) - 1;
  const endCx = Math.floor((cam.x + canvas.width) / TILE) + 1;
  const startCy = Math.floor(cam.y / TILE) - 1;
  const endCy = Math.floor((cam.y + canvas.height) / TILE) + 1;
  const tones = ['rgba(70,110,55,0.10)', 'rgba(30,55,35,0.14)', 'rgba(90,120,60,0.08)'];
  for (let cx = startCx; cx <= endCx; cx++) {
    for (let cy = startCy; cy <= endCy; cy++) {
      const s = Math.sin(cx * 127.1 + cy * 311.7 + 17.3) * 43758.5453;
      const ox = (s - Math.floor(s)) * TILE;
      const s2 = Math.sin(cx * 269.5 + cy * 183.3 + 91.7) * 43758.5453;
      const oy = (s2 - Math.floor(s2)) * TILE;
      const s3 = Math.sin(cx * 51.7 + cy * 419.3 + 3.1) * 43758.5453;
      const tone = tones[Math.floor((s3 - Math.floor(s3)) * tones.length)];
      const px = cx * TILE + ox - cam.x;
      const py = cy * TILE + oy - cam.y;
      ctx.fillStyle = tone;
      ctx.beginPath();
      ctx.ellipse(px, py, 100, 56, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function drawGrassDecor(ctx, cam, viewW, viewH) {
  for (const g of state.grassDecor) {
    const sx = g.x - cam.x;
    const sy = g.y - cam.y;
    if (sx < -20 || sx > viewW + 20 || sy < -20 || sy > viewH + 20) continue;
    const sway = Math.sin(state.elapsed * 1.6 + g.x * 0.02) * 3;
    ctx.strokeStyle = g.s > 0.9 ? 'rgba(140,175,110,0.55)' : 'rgba(95,130,80,0.5)';
    ctx.lineWidth = 1.6 * g.s;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(g.rot);
    for (const off of [-2, 0, 2]) {
      ctx.beginPath();
      ctx.moveTo(off * g.s, 0);
      ctx.quadraticCurveTo(off * g.s + sway * 0.3, -5 * g.s, off * g.s + sway, -9 * g.s);
      ctx.stroke();
    }
    ctx.restore();
  }
}

export function drawPonds(ctx, cam, viewW, viewH) {
  for (const p of state.ponds) {
    const sx = p.x - cam.x;
    const sy = p.y - cam.y;
    if (sx < -150 || sx > viewW + 150 || sy < -150 || sy > viewH + 150) continue;

    // Orilla: halo de barro/pasto húmedo que se funde con el suelo.
    const shoreG = ctx.createRadialGradient(sx, sy, Math.max(p.rw, p.rh) * 0.7, sx, sy, Math.max(p.rw, p.rh) * 1.25);
    shoreG.addColorStop(0, 'rgba(35,45,25,0.35)');
    shoreG.addColorStop(1, 'rgba(35,45,25,0)');
    ctx.fillStyle = shoreG;
    ctx.beginPath();
    ctx.ellipse(sx, sy + 4, p.rw * 1.25, p.rh * 1.25, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(15,22,16,0.35)';
    ctx.beginPath();
    ctx.ellipse(sx + 6, sy + 8, p.rw, p.rh, 0, 0, Math.PI * 2);
    ctx.fill();

    const wg = ctx.createRadialGradient(sx - p.rw * 0.2, sy - p.rh * 0.2, 4, sx, sy, p.rw);
    wg.addColorStop(0, '#6fb0c2');
    wg.addColorStop(0.6, '#3f7488');
    wg.addColorStop(1, '#22404e');
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.ellipse(sx, sy, p.rw, p.rh, 0, 0, Math.PI * 2);
    ctx.fill();

    // Reflejo/brillo que se mueve lentamente con el tiempo, y un par de
    // franjas de ondas para dar sensación de agua viva.
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(sx, sy, p.rw, p.rh, 0, 0, Math.PI * 2);
    ctx.clip();
    const shimmer = Math.sin(state.elapsed * 0.9) * p.rw * 0.18;
    const gloss = ctx.createRadialGradient(sx + shimmer, sy - p.rh * 0.3, 2, sx + shimmer, sy - p.rh * 0.3, p.rw * 0.5);
    gloss.addColorStop(0, 'rgba(255,255,255,0.35)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gloss;
    ctx.beginPath();
    ctx.ellipse(sx + shimmer, sy - p.rh * 0.3, p.rw * 0.5, p.rh * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 2; i++) {
      const wy = sy - p.rh * 0.2 + i * p.rh * 0.5 + Math.sin(state.elapsed * 1.3 + i) * 3;
      ctx.beginPath();
      ctx.moveTo(sx - p.rw * 0.6, wy);
      ctx.quadraticCurveTo(sx, wy + 4, sx + p.rw * 0.6, wy);
      ctx.stroke();
    }
    ctx.restore();
  }
}

export function drawTree(t, cam, ctx) {
  const sx = t.x - cam.x;
  const sy = t.y - cam.y;
  const s = t.size;
  const wind = Math.sin(state.elapsed * 0.9 + t.sway) * 3.5 * s;

  // Sombra proyectada, un poco alargada para dar sensación de altura.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(sx + 4, sy + 6, 19 * s, 7 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tronco con luz lateral (gradiente) y un par de líneas de corteza.
  const trunkG = ctx.createLinearGradient(sx - 4 * s, 0, sx + 4 * s, 0);
  trunkG.addColorStop(0, '#3a2a1c');
  trunkG.addColorStop(0.5, '#5a4530');
  trunkG.addColorStop(1, '#3a2a1c');
  ctx.fillStyle = trunkG;
  ctx.fillRect(sx - 4 * s, sy - 6 * s, 8 * s, 26 * s);
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx - 1.5 * s, sy - 5 * s);
  ctx.lineTo(sx - 1.5 * s, sy + 18 * s);
  ctx.stroke();

  // Follaje: varias copas superpuestas con gradiente radial (más clara donde
  // pega la luz) y una leve oscilación de viento aplicada al conjunto.
  ctx.save();
  ctx.translate(sx, sy - 22 * s);
  ctx.rotate(wind * 0.01);
  const blobs = [
    { x: 0, y: 2 * s, r: 22 * s },
    { x: -12 * s, y: -6 * s, r: 16 * s },
    { x: 13 * s, y: -4 * s, r: 15 * s },
    { x: 2 * s, y: -16 * s, r: 13 * s }
  ];
  for (const bl of blobs) {
    const bx = bl.x + wind;
    const fg = ctx.createRadialGradient(bx - bl.r * 0.35, bl.y - bl.r * 0.35, bl.r * 0.15, bx, bl.y, bl.r);
    fg.addColorStop(0, '#4f7a42');
    fg.addColorStop(0.55, '#33532c');
    fg.addColorStop(1, '#22391e');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(bx, bl.y, bl.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  if (t.hits < t.maxHits) {
    ctx.strokeStyle = 'rgba(203,216,195,0.5)';
    ctx.strokeRect(sx - 16, sy - 40, 32 * (t.hits / t.maxHits), 4);
  }
}

export function drawRock(r, cam, ctx) {
  const sx = r.x - cam.x;
  const sy = r.y - cam.y;
  const s = r.size;
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(sx + 2, sy + 6, 16 * s, 6 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  const rg = ctx.createLinearGradient(sx - 14 * s, sy - 14 * s, sx + 10 * s, sy + 8 * s);
  rg.addColorStop(0, '#98978c');
  rg.addColorStop(0.5, '#75746a');
  rg.addColorStop(1, '#4c4b44');
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.moveTo(sx - 14 * s, sy + 4 * s);
  ctx.lineTo(sx - 8 * s, sy - 10 * s);
  ctx.lineTo(sx + 4 * s, sy - 14 * s);
  ctx.lineTo(sx + 14 * s, sy - 2 * s);
  ctx.lineTo(sx + 8 * s, sy + 8 * s);
  ctx.closePath();
  ctx.fill();

  // Líneas de fractura sutiles.
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx - 6 * s, sy - 4 * s);
  ctx.lineTo(sx + 2 * s, sy + 3 * s);
  ctx.moveTo(sx - 1 * s, sy - 9 * s);
  ctx.lineTo(sx + 5 * s, sy - 3 * s);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.moveTo(sx - 8 * s, sy - 10 * s);
  ctx.lineTo(sx + 4 * s, sy - 14 * s);
  ctx.lineTo(sx - 2 * s, sy - 4 * s);
  ctx.closePath();
  ctx.fill();

  // Musgo: solo en algunas rocas (determinístico según su posición, no cambia entre frames).
  if (((r.x * 12.9898 + r.y * 78.233) % 1 + 1) % 1 > 0.6) {
    ctx.fillStyle = 'rgba(90,120,55,0.55)';
    ctx.beginPath();
    ctx.ellipse(sx - 6 * s, sy + 2 * s, 5 * s, 3 * s, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawBush(b, cam, ctx) {
  const sx = b.x - cam.x;
  const sy = b.y - cam.y;
  const s = b.size;
  const wind = Math.sin(state.elapsed * 1.4 + b.x * 0.05) * 1.4;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(sx, sy + 5, 14 * s, 6 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  [[0, 0], [-8, 3], [8, 3]].forEach(([ox, oy], i) => {
    const bx = sx + ox * s + wind * (i === 0 ? 0.4 : 1);
    const by = sy + oy * s - 6 * s;
    const r = 10 * s;
    const bg = ctx.createRadialGradient(bx - r * 0.3, by - r * 0.3, r * 0.1, bx, by, r);
    bg.addColorStop(0, '#4d6d3f');
    bg.addColorStop(1, '#2c4225');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
  });
  if (b.stock > 0) {
    for (let i = 0; i < b.stock; i++) {
      const berryX = sx - 6 * s + i * 6 * s + wind * 0.6;
      const berryY = sy - 8 * s;
      ctx.fillStyle = '#8f281f';
      ctx.beginPath();
      ctx.arc(berryX, berryY, 2.4 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,200,180,0.6)';
      ctx.beginPath();
      ctx.arc(berryX - 0.7 * s, berryY - 0.7 * s, 0.8 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
