export const WORLD_W = 3400;
export const WORLD_H = 3400;
export const DAY_LENGTH = 130;
export const BASE_CAP = 30;
export const BACKPACK_BONUS = 30;

export const canvas = document.getElementById('game');
export const ctx = canvas.getContext('2d');

export const state = {
  running: false,
  gameOver: false,
  paused: false,
  elapsed: 0,
  dayCounter: 1,
  lastTime: performance.now(),
  keys: {},
  trees: [],
  rocks: [],
  bushes: [],
  ponds: [],
  campfires: [],
  shelters: [],
  wolves: [],
  deer: [],
  grassDecor: [],
  player: {
    x: WORLD_W / 2,
    y: WORLD_H / 2,
    dir: { x: 0, y: 1 },
    speed: 165,
    sprintMult: 1.7,
    health: 100,
    hunger: 100,
    thirst: 100,
    stamina: 100,
    wood: 0,
    stone: 0,
    berries: 0,
    hasSpear: false,
    hasAxe: false,
    hasPickaxe: false,
    hasBackpack: false,
    attackRange: 34,
    attackDamage: 12,
    attackCooldown: 0,
    hitFlash: 0,
    radius: 14
  }
};

export function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

export function rand(a, b) {
  return a + Math.random() * (b - a);
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function capFor() {
  return BASE_CAP + (state.player.hasBackpack ? BACKPACK_BONUS : 0);
}

export function invTotal() {
  return state.player.wood + state.player.stone + state.player.berries;
}

export function isNightPhase(phase) {
  return phase > 0.58 && phase < 0.97;
}

window.addEventListener('resize', resize);
resize();
