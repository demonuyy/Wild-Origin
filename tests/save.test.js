import './helpers/dom-shim.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { state, addItem, countItem, hasItem } from '../js/config.js';
import { resetState } from './helpers/reset-state.js';
import { saveGame, loadGame, hasSavedGame } from '../js/save.js';

test('saveGame + loadGame conservan los datos del jugador', () => {
  resetState();
  localStorage.clear();
  addItem('wood', 12);
  addItem('axe', 1);
  state.dayCounter = 3;
  saveGame();

  resetState(); // simula cerrar y volver a abrir el juego
  const ok = loadGame();
  assert.equal(ok, true);
  assert.equal(countItem('wood'), 12);
  assert.equal(hasItem('axe'), true);
  assert.equal(state.dayCounter, 3);
});

test('un guardado viejo bajo la clave legacy (de antes de este cambio) se sigue leyendo', () => {
  resetState();
  localStorage.clear();
  // Formato de guardado previo a save.js con slots/versión.
  localStorage.setItem('wildOriginSave', JSON.stringify({
    player: { wood: 5, stone: 0, berries: 0 },
    dayCounter: 1,
    world: {}
  }));
  assert.equal(hasSavedGame(), true);
  const ok = loadGame();
  assert.equal(ok, true);
  assert.equal(countItem('wood'), 5);
});

test('un guardado de antes del inventario real (v2, campos sueltos) migra a player.inventory', () => {
  resetState();
  localStorage.clear();
  // Formato v2: recursos y herramientas como campos sueltos en vez de
  // player.inventory (ver migrateSaveData en save.js).
  localStorage.setItem('wildOriginSave:slot1', JSON.stringify({
    version: 2,
    player: { wood: 5, stone: 2, berries: 0, hasAxe: true, hasBackpack: true, equippedTool: 'axe' },
    dayCounter: 1,
    world: {}
  }));
  const ok = loadGame();
  assert.equal(ok, true);
  assert.equal(countItem('wood'), 5);
  assert.equal(countItem('stone'), 2);
  assert.equal(hasItem('axe'), true);
  assert.equal(hasItem('backpack'), true);
  assert.equal(hasItem('pickaxe'), false);
  assert.equal(state.player.equippedTool, 'axe');
});

test('un guardado principal corrupto cae al backup en vez de perder la partida', () => {
  resetState();
  localStorage.clear();
  addItem('wood', 7);
  saveGame(); // este guardado va a quedar como "backup" en el siguiente save

  addItem('wood', 13); // ahora tiene 20
  saveGame(); // el guardado con wood=7 pasa a ser el backup

  // Simula que el guardado principal quedó corrupto (por ejemplo, el
  // navegador se cerró a mitad de un JSON.stringify/localStorage.setItem).
  localStorage.setItem('wildOriginSave:slot1', '{ esto no es JSON válido');

  resetState();
  const ok = loadGame();
  assert.equal(ok, true, 'debería recuperarse usando el backup');
  assert.equal(countItem('wood'), 7);
});

test('sin ningún guardado, loadGame devuelve false y no toca el estado', () => {
  resetState();
  localStorage.clear();
  assert.equal(hasSavedGame(), false);
  const ok = loadGame();
  assert.equal(ok, false);
});
