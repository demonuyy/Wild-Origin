import './helpers/dom-shim.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { state, BASE_CAP, BACKPACK_BONUS, capFor } from '../js/config.js';
import { resetState } from './helpers/reset-state.js';
import {
  tryCraftSpear,
  tryCraftAxe,
  tryCraftPickaxe,
  tryCraftBackpack,
  tryPlaceCampfire,
  tryPlaceShelter,
  tryEquipTool
} from '../js/crafting.js';

test('tryCraftSpear cobra exactamente 4 madera y 2 piedra, y la deja en la mano', () => {
  resetState();
  state.player.wood = 4;
  state.player.stone = 2;
  tryCraftSpear();
  assert.equal(state.player.hasSpear, true);
  assert.equal(state.player.equippedTool, 'spear');
  assert.equal(state.player.wood, 0);
  assert.equal(state.player.stone, 0);
});

test('tryCraftSpear no cobra recursos si faltan', () => {
  resetState();
  state.player.wood = 3; // falta 1 de madera
  state.player.stone = 2;
  tryCraftSpear();
  assert.equal(state.player.hasSpear, false);
  assert.equal(state.player.wood, 3);
  assert.equal(state.player.stone, 2);
});

test('tryCraftSpear ya poseída equivale a alternar equipar/guardar', () => {
  resetState();
  state.player.hasSpear = true;
  state.player.equippedTool = 'spear';
  state.player.wood = 10;
  tryCraftSpear(); // debería guardarla (dejar las manos libres), no cobrar de nuevo
  assert.equal(state.player.equippedTool, null);
  assert.equal(state.player.wood, 10);
  tryCraftSpear(); // debería volver a ponerla en la mano
  assert.equal(state.player.equippedTool, 'spear');
});

test('tryCraftAxe deja el hacha equipada en la mano apenas se craftea', () => {
  resetState();
  state.player.wood = 5;
  state.player.stone = 3;
  tryCraftAxe();
  assert.equal(state.player.hasAxe, true);
  assert.equal(state.player.equippedTool, 'axe');
  assert.equal(state.player.wood, 0);
  assert.equal(state.player.stone, 0);
});

test('tryCraftPickaxe requiere 5 madera y 3 piedra, igual que el hacha', () => {
  resetState();
  state.player.wood = 4; // falta 1
  state.player.stone = 3;
  tryCraftPickaxe();
  assert.equal(state.player.hasPickaxe, false);

  state.player.wood = 5;
  tryCraftPickaxe();
  assert.equal(state.player.hasPickaxe, true);
  assert.equal(state.player.equippedTool, 'pickaxe');
});

test('tryCraftAxe ya poseída equivale a alternar equipar/guardar', () => {
  resetState();
  state.player.hasAxe = true;
  state.player.equippedTool = 'axe';
  tryCraftAxe(); // debería guardarla (dejar las manos libres)
  assert.equal(state.player.equippedTool, null);
  tryCraftAxe(); // debería volver a ponerla en la mano
  assert.equal(state.player.equippedTool, 'axe');
});

test('tryEquipTool no hace nada si la herramienta no fue crafteada todavía', () => {
  resetState();
  tryEquipTool('pickaxe');
  assert.equal(state.player.equippedTool, null);
});

test('equipar el hacha no afecta si el pico está en la mano (y viceversa)', () => {
  resetState();
  state.player.hasAxe = true;
  state.player.hasPickaxe = true;
  tryEquipTool('axe');
  assert.equal(state.player.equippedTool, 'axe');
  tryEquipTool('pickaxe');
  assert.equal(state.player.equippedTool, 'pickaxe');
});

test('tryPlaceCampfire coloca la fogata en la posición actual del jugador', () => {
  resetState();
  state.player.wood = 6;
  state.player.x = 120;
  state.player.y = -40;
  tryPlaceCampfire();
  assert.equal(state.campfires.length, 1);
  assert.equal(state.campfires[0].x, 120);
  assert.equal(state.campfires[0].y, -40);
  assert.equal(state.player.wood, 0);
});

test('tryCraftBackpack aumenta la capacidad efectiva vía capFor()', () => {
  resetState();
  assert.equal(capFor(), BASE_CAP);
  state.player.wood = 8;
  state.player.stone = 4;
  tryCraftBackpack();
  assert.equal(state.player.hasBackpack, true);
  assert.equal(capFor(), BASE_CAP + BACKPACK_BONUS);
});

test('tryPlaceShelter requiere 15 madera y 8 piedra', () => {
  resetState();
  state.player.wood = 14;
  state.player.stone = 8;
  tryPlaceShelter();
  assert.equal(state.shelters.length, 0);

  state.player.wood = 15;
  tryPlaceShelter();
  assert.equal(state.shelters.length, 1);
  assert.equal(state.player.wood, 0);
  assert.equal(state.player.stone, 0);
});
