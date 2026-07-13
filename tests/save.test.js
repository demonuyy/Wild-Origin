import './helpers/dom-shim.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../js/config.js';
import { resetState } from './helpers/reset-state.js';
import { saveGame, loadGame, hasSavedGame } from '../js/save.js';

test('saveGame + loadGame conservan los datos del jugador', () => {
  resetState();
  localStorage.clear();
  state.player.wood = 12;
  state.player.hasAxe = true;
  state.dayCounter = 3;
  saveGame();

  resetState(); // simula cerrar y volver a abrir el juego
  const ok = loadGame();
  assert.equal(ok, true);
  assert.equal(state.player.wood, 12);
  assert.equal(state.player.hasAxe, true);
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
  assert.equal(state.player.wood, 5);
});

test('un guardado principal corrupto cae al backup en vez de perder la partida', () => {
  resetState();
  localStorage.clear();
  state.player.wood = 7;
  saveGame(); // este guardado va a quedar como "backup" en el siguiente save

  state.player.wood = 20;
  saveGame(); // el guardado con wood=7 pasa a ser el backup

  // Simula que el guardado principal quedó corrupto (por ejemplo, el
  // navegador se cerró a mitad de un JSON.stringify/localStorage.setItem).
  localStorage.setItem('wildOriginSave:slot1', '{ esto no es JSON válido');

  resetState();
  const ok = loadGame();
  assert.equal(ok, true, 'debería recuperarse usando el backup');
  assert.equal(state.player.wood, 7);
});

test('sin ningún guardado, loadGame devuelve false y no toca el estado', () => {
  resetState();
  localStorage.clear();
  assert.equal(hasSavedGame(), false);
  const ok = loadGame();
  assert.equal(ok, false);
});
