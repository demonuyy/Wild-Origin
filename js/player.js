import { state, clamp, dist, DAY_LENGTH, invTotal, capFor, isNightPhase, hasItem, HOTBAR_SIZE, damageTool, ACTION_SWING_DURATION } from './config.js';
import { pushLog, showHint, updateEquipUI, updateHUD, showInteractPrompt, hideInteractPrompt, isInventoryOpen } from './ui.js';
import { SoundFX } from './audio.js';
import { collectTreeResource, collectRockResource, collectBushResource, consumeBerry, collectStick, collectStone, harvestCorpse } from './inventory.js';
import { removeEntity, spawnBlood, spawnRipple, isInWater, spawnCorpse } from './world.js';
import { hitDeer } from './animals.js';

let footstepTimer = 0;
// Cadencia del sonido de dolor mientras se está muriendo de hambre/sed (ver
// updatePlayer): sin este timer, SoundFX.playerHurt() sonaría todos los
// frames (varias veces por segundo) en vez de un "ay" cada tanto.
let starveHurtTimer = 0;

// Bonos de la lanza: antes se aplicaban de forma PERMANENTE apenas se
// crafteaba (mutando attackDamage/attackRange para siempre, sin poder
// guardarla) y además el alcance se sumaba dos veces: crafting.js subía
// attackRange a 46 y tryAttack le sumaba otros +18 encima. Ahora solo se
// aplican mientras está equipada de verdad (equippedTool === 'spear'),
// igual que hacha/pico solo cortan/minan si están en la mano.
const SPEAR_DAMAGE = 26;
const SPEAR_RANGE = 50;
const SPEAR_ATTACK_COOLDOWN = 0.5;
const UNARMED_ATTACK_COOLDOWN = 0.7;

// Cuánto bajan hambre/sed por segundo en reposo/caminando (se usa tanto en
// el decaimiento normal de update() como al dormir en trySleep(), que
// simula de un salto todo el tiempo hasta el amanecer).
const HUNGER_DECAY_RATE = 0.42;
const THIRST_DECAY_RATE = 0.55;
// Mientras se corre (sprint con shift) hambre y sed bajan más rápido que
// caminando o parado; NO aplica en trySleep() (dormir no es correr).
const SPRINT_DECAY_MULT = 1.6;

export function resetPlayer() {
  state.player.x = 0;
  state.player.y = 0;
  state.player.health = 100;
  state.player.hunger = 100;
  state.player.thirst = 100;
  state.player.stamina = 100;
  state.player.staminaCooldown = 0;
  state.player.staminaRegenDelay = 0;
  state.player.inventory = [];
  state.player.hotbar = new Array(HOTBAR_SIZE).fill(null);
  state.player.invSlots = [];
  state.player.equippedTool = null;
  state.player.attackDamage = 12;
  state.player.attackRange = 34;
  state.player.attackCooldown = 0;
  state.player.hitFlash = 0;
  state.player.actionAnim = 0;
  state.discoveredActions = new Set();
  updateEquipUI();
  updateHUD();
}

// Nombre de la acción mostrada en el cartel contextual, por tipo de objeto.
const INTERACT_LABELS = {
  tree: 'Talar',
  rock: 'Minar',
  bush: 'Recolectar',
  stick: 'Recoger',
  stone: 'Recoger',
  shelter: 'Dormir',
  pond: 'Beber'
};

// Caso aparte: el cadáver tiene dos etapas (ver harvestCorpse en
// inventory.js) y cada una necesita su propio verbo, así que no alcanza con
// una entrada fija en INTERACT_LABELS como el resto de los tipos.
function interactLabel(best) {
  if (best.type === 'corpse') {
    return best.obj.stage === 'fresh' ? 'Desollar' : 'Juntar huesos';
  }
  return INTERACT_LABELS[best.type];
}

// Busca el objeto interactuable más cercano al jugador (árbol, roca, arbusto,
// palo, piedra suelta, refugio o laguna). La usan tanto tryInteract() (al
// apretar E) como updateInteractionPrompt() (para decidir si mostrar el
// cartel), así la distancia de interacción vive en un solo lugar.
function findNearestInteractable() {
  let best = null;
  let bestD = 60;
  for (const t of state.trees) {
    const d = dist(state.player.x, state.player.y, t.x, t.y);
    if (d < bestD) {
      bestD = d;
      best = { type: 'tree', obj: t };
    }
  }
  for (const r of state.rocks) {
    const d = dist(state.player.x, state.player.y, r.x, r.y);
    if (d < bestD) {
      bestD = d;
      best = { type: 'rock', obj: r };
    }
  }
  for (const b of state.bushes) {
    const d = dist(state.player.x, state.player.y, b.x, b.y);
    if (d < bestD) {
      bestD = d;
      best = { type: 'bush', obj: b };
    }
  }
  for (const s of state.sticks) {
    const d = dist(state.player.x, state.player.y, s.x, s.y);
    if (d < bestD) {
      bestD = d;
      best = { type: 'stick', obj: s };
    }
  }
  for (const s of state.stones) {
    const d = dist(state.player.x, state.player.y, s.x, s.y);
    if (d < bestD) {
      bestD = d;
      best = { type: 'stone', obj: s };
    }
  }
  for (const c of state.corpses) {
    const d = dist(state.player.x, state.player.y, c.x, c.y);
    if (d < bestD) {
      bestD = d;
      best = { type: 'corpse', obj: c };
    }
  }
  for (const s of state.shelters) {
    const d = dist(state.player.x, state.player.y, s.x, s.y);
    if (d < bestD) {
      bestD = d;
      best = { type: 'shelter', obj: s };
    }
  }
  for (const p of state.ponds) {
    const dx = (state.player.x - p.x) / p.rw;
    const dy = (state.player.y - p.y) / p.rh;
    if (dx * dx + dy * dy < 2.2) {
      best = { type: 'pond', obj: p };
      bestD = 0;
      break;
    }
  }
  return best;
}

// Se llama una vez por frame. Muestra "Talar (E)" / "Minar (E)" / etc. solo
// mientras el jugador está cerca de un tipo de objeto con el que todavía no
// interactuó nunca en esta partida; una vez que interactúa una vez con ese
// tipo, no vuelve a aparecer (ver tryInteract, que marca el tipo como
// descubierto).
export function updateInteractionPrompt() {
  if (isInventoryOpen()) {
    hideInteractPrompt();
    return;
  }
  const best = findNearestInteractable();
  if (best && !state.discoveredActions.has(best.type)) {
    showInteractPrompt(`${interactLabel(best)} <span class="promptKey">E</span>`);
  } else {
    hideInteractPrompt();
  }
}

export function tryInteract() {
  const best = findNearestInteractable();

  if (!best) {
    showHint('Nada cerca para recolectar');
    return;
  }

  state.discoveredActions.add(best.type);

  if (best.type === 'tree') {
    collectTreeResource(best.obj);
  } else if (best.type === 'rock') {
    collectRockResource(best.obj);
  } else if (best.type === 'bush') {
    collectBushResource(best.obj);
  } else if (best.type === 'stick') {
    collectStick(best.obj);
  } else if (best.type === 'stone') {
    collectStone(best.obj);
  } else if (best.type === 'corpse') {
    harvestCorpse(best.obj);
  } else if (best.type === 'pond') {
    state.player.thirst = 100;
    SoundFX.drink();
    pushLog('Bebiste agua fresca');
  } else if (best.type === 'shelter') {
    trySleep();
  }
}

export function trySleep() {
  const nextDawn = state.dayCounter * DAY_LENGTH + 0.12 * DAY_LENGTH;
  const skip = nextDawn - state.elapsed;
  if (skip <= 1) {
    showHint('Ya es de día');
    return;
  }
  state.elapsed = nextDawn;
  state.player.hunger = clamp(state.player.hunger - skip * HUNGER_DECAY_RATE, 0, 100);
  state.player.thirst = clamp(state.player.thirst - skip * THIRST_DECAY_RATE, 0, 100);
  state.player.health = 100;
  state.player.stamina = 100;
  state.player.staminaCooldown = 0;
  state.player.staminaRegenDelay = 0;
  SoundFX.sleep();
  pushLog('Dormiste a salvo hasta el amanecer');
}

export function tryAttack() {
  if (state.player.attackCooldown > 0) return;
  const wielding = state.player.equippedTool === 'spear';
  state.player.attackCooldown = wielding ? SPEAR_ATTACK_COOLDOWN : UNARMED_ATTACK_COOLDOWN;
  state.player.actionAnim = ACTION_SWING_DURATION;
  SoundFX.attackSwing();
  const range = wielding ? SPEAR_RANGE : state.player.attackRange;
  const damage = wielding ? SPEAR_DAMAGE : state.player.attackDamage;
  let hitSomething = false;
  for (const w of state.wolves) {
    if (dist(state.player.x, state.player.y, w.x, w.y) < range) {
      w.health -= damage;
      w.knockX = w.x - state.player.x;
      w.knockY = w.y - state.player.y;
      hitSomething = true;
      SoundFX.wolfHit(w.x, w.y);
      spawnBlood(w.x, w.y, 3);
      if (w.health <= 0) {
        removeEntity('wolves', w);
        spawnCorpse(w.x, w.y, 'wolf', w.variant);
        SoundFX.wolfDeath(w.x, w.y);
        spawnBlood(w.x, w.y, 6);
        pushLog('El lobo cayó');
      }
    }
  }
  for (const d of state.deer) {
    if (dist(state.player.x, state.player.y, d.x, d.y) < range) {
      hitDeer(d, damage);
      hitSomething = true;
    }
  }
  if (hitSomething) {
    pushLog('¡Golpe certero!');
    // La lanza se gasta con cada golpe que conecta (no si el jugador
    // ataca al aire sin pegarle a nada).
    if (wielding && damageTool('spear', 1)) {
      SoundFX.craftFail();
      pushLog('La lanza se rompió');
    }
  }
}

export function updatePlayer(dt) {
  const { player } = state;
  const moving = (state.keys['w'] || state.keys['arrowup'] ? -1 : 0) + (state.keys['s'] || state.keys['arrowdown'] ? 1 : 0);
  let mx = 0;
  let my = 0;
  if (state.keys['w'] || state.keys['arrowup']) my -= 1;
  if (state.keys['s'] || state.keys['arrowdown']) my += 1;
  if (state.keys['a'] || state.keys['arrowleft']) mx -= 1;
  if (state.keys['d'] || state.keys['arrowright']) mx += 1;
  const moved = mx !== 0 || my !== 0;
  // Se usa más abajo también para el decaimiento de hambre/sed (correr
  // desgasta más que caminar), por eso vive afuera del if(moved): si el
  // jugador no se mueve, nunca está "corriendo".
  let sprint = false;
  // Cooldown de energía: cuenta regresiva independiente de si el jugador se
  // mueve o no, para que corra siempre igual sin importar qué haga mientras
  // tanto.
  if (player.staminaCooldown > 0) {
    player.staminaCooldown = Math.max(0, player.staminaCooldown - dt);
  }
  // Delay de regeneración: también cuenta regresiva sin importar qué haga
  // el jugador. Se resetea a 4 más abajo cada frame que corre; una vez que
  // deja de correr, tienen que pasar esos 4s antes de que la energía
  // empiece a subir de nuevo.
  if (player.staminaRegenDelay > 0) {
    player.staminaRegenDelay = Math.max(0, player.staminaRegenDelay - dt);
  }
  if (moved) {
    const len = Math.hypot(mx, my);
    mx /= len;
    my /= len;
    player.dir.x = mx;
    player.dir.y = my;
    // Ya no alcanza con tener algo de energía: si el cooldown sigue activo
    // (arrancó al llegar a 0 la última vez), no se puede correr aunque la
    // energía se haya recuperado mientras tanto.
    sprint = state.keys['shift'] && player.stamina > 0 && player.staminaCooldown <= 0;
    // Vadear una laguna pesa: se mueve a poco más de la mitad de velocidad,
    // tanto caminando como corriendo.
    const wading = isInWater(player.x, player.y);
    const spd = player.speed * (sprint ? player.sprintMult : 1) * (wading ? 0.55 : 1);
    player.x += mx * spd * dt;
    player.y += my * spd * dt;
    if (sprint) {
      player.stamina = clamp(player.stamina - 18 * dt, 0, 100);
      player.staminaRegenDelay = 4;
      // Se quedó sin energía corriendo: arranca el cooldown de 5s y suena
      // el jadeo de fatiga (una sola vez, justo en el frame en que llega a 0).
      if (player.stamina <= 0 && player.staminaCooldown <= 0) {
        player.staminaCooldown = 5;
        SoundFX.fatigue();
      }
    }
    footstepTimer -= dt;
    if (footstepTimer <= 0) {
      SoundFX.footstep(sprint ? 1.15 : 0.9, wading);
      if (wading) spawnRipple(player.x, player.y + 14);
      footstepTimer = sprint ? 0.27 : 0.4;
    }
  } else {
    footstepTimer = 0;
  }
  if ((!state.keys['shift'] || !moved) && player.staminaRegenDelay <= 0) {
    player.stamina = clamp(player.stamina + 9 * dt, 0, 100);
  }

  const decayMult = sprint ? SPRINT_DECAY_MULT : 1;
  player.hunger = clamp(player.hunger - HUNGER_DECAY_RATE * decayMult * dt, 0, 100);
  player.thirst = clamp(player.thirst - THIRST_DECAY_RATE * decayMult * dt, 0, 100);
  if (player.hunger <= 0 || player.thirst <= 0) {
    player.health = clamp(player.health - 3.2 * dt, 0, 100);
    // Mismo sonido de dolor que usa el mordisco del lobo (enemies.js), acá
    // repetido cada ~1.8s mientras el hambre o la sed sigan en 0, para que
    // se note que la salud se está yendo por inanición y no solo por el HUD.
    starveHurtTimer -= dt;
    if (starveHurtTimer <= 0) {
      SoundFX.playerHurt();
      starveHurtTimer = 1.8;
    }
  } else {
    starveHurtTimer = 0;
    if (player.health < 100 && player.hunger > 55 && player.thirst > 55 && !isNightPhase((state.elapsed % DAY_LENGTH) / DAY_LENGTH)) {
      player.health = clamp(player.health + 1.4 * dt, 0, 100);
    }
  }
  if (player.attackCooldown > 0) player.attackCooldown -= dt;
  if (player.hitFlash > 0) player.hitFlash -= dt;
  if (player.actionAnim > 0) player.actionAnim = Math.max(0, player.actionAnim - dt);
}

export function handleManualEat() {
  if (hasItem('berries')) {
    consumeBerry();
  } else {
    SoundFX.craftFail();
    showHint('No tenés bayas para comer');
  }
}
