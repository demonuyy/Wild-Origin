import { state } from './config.js';

export function saveGame() {
  const data = {
    player: { ...state.player },
    elapsed: state.elapsed,
    dayCounter: state.dayCounter,
    world: {
      trees: state.trees,
      rocks: state.rocks,
      bushes: state.bushes,
      ponds: state.ponds,
      campfires: state.campfires,
      shelters: state.shelters,
      wolves: state.wolves,
      deer: state.deer,
      grassDecor: state.grassDecor,
      sticks: state.sticks,
      stones: state.stones
    }
  };
  localStorage.setItem('wildOriginSave', JSON.stringify(data));
}

export function loadGame() {
  const raw = localStorage.getItem('wildOriginSave');
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    Object.assign(state.player, data.player);
    state.elapsed = data.elapsed || 0;
    state.dayCounter = data.dayCounter || 1;
    state.trees = data.world?.trees || [];
    state.rocks = data.world?.rocks || [];
    state.bushes = data.world?.bushes || [];
    state.ponds = data.world?.ponds || [];
    state.campfires = data.world?.campfires || [];
    state.shelters = data.world?.shelters || [];
    state.wolves = data.world?.wolves || [];
    state.deer = data.world?.deer || [];
    state.grassDecor = data.world?.grassDecor || [];
    state.sticks = data.world?.sticks || [];
    state.stones = data.world?.stones || [];
    return true;
  } catch {
    return false;
  }
}
