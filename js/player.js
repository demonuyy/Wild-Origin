import { state, clamp, dist, DAY_LENGTH, invTotal, capFor, isNightPhase } from './config.js';
import { pushLog, showHint, updateEquipUI, updateHUD, showInteractPrompt, hideInteractPrompt, isInventoryOpen } from './ui.js';
import { SoundFX } from './audio.js';
import { collectTreeResource, collectRockResource, collectBushResource, consumeBerry, collectStick, collectStone } from './inventory.js';
import { removeEntity, spawnBlood } from './world.js';
import { hitDeer } from './animals.js';

let footstepTimer = 0;

export function resetPlayer() {
  state.player.x = 0;
  state.player.y = 0;
  state.player.health = 100;
  state.player.hunger = 100;
  state.player.thirst = 100;
  state.player.stamina = 100;
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
  SoundFX.sleep();
  pushLog('Dormiste a salvo hasta el amanecer');
}

export function tryAttack() {
  if (state.player.attackCooldown > 0) return;
  state.player.attackCooldown = state.player.hasSpear ? 0.5 : 0.7;
  SoundFX.attackSwing();
  const range = state.player.attackRange + (state.player.hasSpear ? 18 : 0);
  let hitSomething = false;
  for (const w of state.wolves) {
    if (dist(state.player.x, state.player.y, w.x, w.y) < range) {
      w.health -= state.player.attackDamage;
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
      hitDeer(d, state.player.attackDamage);
      hitSomething = true;
    }
  }
  if (hitSomething) pushLog('¡Golpe certero!');
}

// Devuelve true si (x,y) cae dentro del óvalo de una laguna (no del halo de
// orilla, la forma real de agua). La usa updatePlayer() para frenar al jugador.
function isInWater(x, y) {
  return state.ponds.some(p => {
    const dx = (x - p.x) / p.rw;
    const dy = (y - p.y) / p.rh;
    return dx * dx + dy * dy < 1;
  });
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
  if (moved) {
    const len = Math.hypot(mx, my);
    mx /= len;
    my /= len;
    player.dir.x = mx;
    player.dir.y = my;
    const sprint = state.keys['shift'] && player.stamina > 2;
    // Vadear una laguna pesa: se mueve a poco más de la mitad de velocidad,
    // tanto caminando como corriendo.
    const wading = isInWater(player.x, player.y);
    const spd = player.speed * (sprint ? player.sprintMult : 1) * (wading ? 0.55 : 1);
    player.x += mx * spd * dt;
    player.y += my * spd * dt;
    if (sprint) player.stamina = clamp(player.stamina - 18 * dt, 0, 100);
    footstepTimer -= dt;
    if (footstepTimer <= 0) {
      SoundFX.footstep(sprint ? 1.15 : 0.9, wading);
      footstepTimer = sprint ? 0.27 : 0.4;
    }
  } else {
    footstepTimer = 0;
  }
  if (!state.keys['shift'] || !moved) {
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
