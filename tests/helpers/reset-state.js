import { state } from '../../js/config.js';

// state (en config.js) es un único objeto compartido por todos los módulos
// del juego -- exactamente igual que en el navegador. Para que un test no
// contamine al siguiente (por ejemplo, madera sobrante de un test anterior),
// cada test debe empezar llamando a esto.
export function resetState() {
  state.running = false;
  state.gameOver = false;
  state.paused = false;
  state.elapsed = 0;
  state.dayCounter = 1;
  state.keys = {};
  state.worldSeed = 0;
  state.loadedChunks = new Set();
  state.chunkStore = {};
  state.discoveredActions = new Set();
  state.zoom = state.targetZoom = 1.6;
  state.trees = [];
  state.rocks = [];
  state.bushes = [];
  state.ponds = [];
  state.campfires = [];
  state.shelters = [];
  state.wolves = [];
  state.deer = [];
  state.grassDecor = [];
  state.sticks = [];
  state.stones = [];
  Object.assign(state.player, {
    x: 0, y: 0,
    dir: { x: 0, y: 1 },
    health: 100, hunger: 100, thirst: 100, stamina: 100,
    wood: 0, stone: 0, berries: 0,
    hasSpear: false, hasAxe: false, hasPickaxe: false, hasBackpack: false,
    equippedTool: null,
    attackDamage: 12, attackRange: 34, attackCooldown: 0, hitFlash: 0
  });
}
