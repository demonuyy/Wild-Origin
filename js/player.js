import { state, clamp, dist, DAY_LENGTH, invTotal, capFor, isNightPhase } from './config.js';
import { pushLog, showHint, updateEquipUI, updateHUD, showInteractPrompt, hideInteractPrompt, isInventoryOpen } from './ui.js';
import { SoundFX } from './audio.js';
import { collectTreeResource, collectRockResource, collectBushResource, consumeBerry, collectStick, collectStone } from './inventory.js';
import { removeEntity, spawnBlood, spawnRipple, isInWater } from './world.js';
import { hitDeer } from './animals.js';

let footstepTimer = 0;

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

export function resetPlayer() {
  state.player.x = 0;
  state.player.y = 0;
  state.player.health = 100;
  state.player.hunger = 100;
  state.player.thirst = 100;
  state.player.stamina = 100;
  state.player.staminaCooldown = 0;
  state.player.staminaRegenDelay = 0;
  state.player.wood = 0;
  state.player.stone = 0;
  state.player.berries = 0;
  state.player.hasSpear = false;
  state.player.hasAxe = false;
  state.player.hasPickaxe = false;
  state.player.hasBackpack = false;
  state.player.equippedTool = null;
  state.player.attackDamage = 12;
  state.player.attackRange = 34;
  state.player.attackCooldown = 0;
  state.player.hitFlash = 0;
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
    showInteractPrompt(`${INTERACT_LABELS[best.type]} <span class="promptKey">E</span>`);
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
  state.player.hunger = clamp(state.player.hunger - skip * 0.42, 0, 100);
  state.player.thirst = clamp(state.player.thirst - skip * 0.55, 0, 100);
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
  if (hitSomething) pushLog('¡Golpe certero!');
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
    const sprint = state.keys['shift'] && player.stamina > 0 && player.staminaCooldown <= 0;
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

  player.hunger = clamp(player.hunger - 0.42 * dt, 0, 100);
  player.thirst = clamp(player.thirst - 0.55 * dt, 0, 100);
  if (player.hunger <= 0 || player.thirst <= 0) {
    player.health = clamp(player.health - 3.2 * dt, 0, 100);
  } else if (player.health < 100 && player.hunger > 55 && player.thirst > 55 && !isNightPhase((state.elapsed % DAY_LENGTH) / DAY_LENGTH)) {
    player.health = clamp(player.health + 1.4 * dt, 0, 100);
  }
  if (player.attackCooldown > 0) player.attackCooldown -= dt;
  if (player.hitFlash > 0) player.hitFlash -= dt;
}

export function handleManualEat() {
  if (state.player.berries > 0) {
    consumeBerry();
  } else {
    SoundFX.craftFail();
    showHint('No tenés bayas para comer');
  }
}
