import './helpers/dom-shim.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { state, capFor, addItem, countItem, hasItem } from '../js/config.js';
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
import { tryAttack } from '../js/player.js';

test('tryCraftSpear cobra exactamente 4 madera y 2 piedra, y la deja lista en la mano', () => {
  resetState();
  addItem('wood', 4);
  addItem('stone', 2);
  tryCraftSpear();
  assert.equal(hasItem('spear'), true);
  assert.equal(state.player.equippedTool, 'spear');
  assert.equal(countItem('wood'), 0);
  assert.equal(countItem('stone'), 0);
});

test('la lanza equipada pega más fuerte que a mano limpia', () => {
  resetState();
  addItem('wood', 4);
  addItem('stone', 2);
  tryCraftSpear(); // tryCraftSpear ya la deja equipada
  const wolf = { x: 0, y: 0, health: 100 };
  state.wolves.push(wolf);
  tryAttack();
  assert.equal(wolf.health, 100 - 26, 'la lanza hace 26 de daño (ver SPEAR_DAMAGE en player.js)');
});

test('tryCraftSpear no cobra recursos si faltan', () => {
  resetState();
  addItem('wood', 3); // falta 1 de madera
  addItem('stone', 2);
  tryCraftSpear();
  assert.equal(hasItem('spear'), false);
  assert.equal(countItem('wood'), 3);
  assert.equal(countItem('stone'), 2);
});

test('tryCraftSpear ya poseída equivale a alternar equipar/guardar (no vuelve a cobrar)', () => {
  resetState();
  addItem('spear', 1);
  state.player.equippedTool = 'spear';
  addItem('wood', 10);
  tryCraftSpear(); // debería guardarla (dejar las manos libres), no cobrar de nuevo
  assert.equal(state.player.equippedTool, null);
  assert.equal(countItem('wood'), 10);
  tryCraftSpear(); // debería volver a ponerla en la mano
  assert.equal(state.player.equippedTool, 'spear');
});

test('tryCraftAxe deja el hacha equipada en la mano apenas se craftea', () => {
  resetState();
  addItem('wood', 5);
  addItem('stone', 3);
  tryCraftAxe();
  assert.equal(hasItem('axe'), true);
  assert.equal(state.player.equippedTool, 'axe');
  assert.equal(countItem('wood'), 0);
  assert.equal(countItem('stone'), 0);
});

test('tryCraftPickaxe requiere 5 madera y 3 piedra, igual que el hacha', () => {
  resetState();
  addItem('wood', 4); // falta 1
  addItem('stone', 3);
  tryCraftPickaxe();
  assert.equal(hasItem('pickaxe'), false);

  addItem('wood', 1);
  tryCraftPickaxe();
  assert.equal(hasItem('pickaxe'), true);
  assert.equal(state.player.equippedTool, 'pickaxe');
});

test('tryCraftAxe ya poseída equivale a alternar equipar/guardar', () => {
  resetState();
  addItem('axe', 1);
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
  addItem('axe', 1);
  addItem('pickaxe', 1);
  tryEquipTool('axe');
  assert.equal(state.player.equippedTool, 'axe');
  tryEquipTool('pickaxe');
  assert.equal(state.player.equippedTool, 'pickaxe');
});

test('tryPlaceCampfire coloca la fogata en la posición actual del jugador', () => {
  resetState();
  addItem('wood', 6);
  state.player.x = 120;
  state.player.y = -40;
  tryPlaceCampfire();
  assert.equal(state.campfires.length, 1);
  assert.equal(state.campfires[0].x, 120);
  assert.equal(state.campfires[0].y, -40);
  assert.equal(countItem('wood'), 0);
});

test('tryCraftBackpack no cambia capFor() (capacidad sin límite) pero sigue craftéandose', () => {
  resetState();
  assert.equal(capFor(), Infinity);
  addItem('wood', 8);
  addItem('stone', 4);
  tryCraftBackpack();
  assert.equal(hasItem('backpack'), true);
  assert.equal(capFor(), Infinity);
});

test('tryPlaceShelter requiere 15 madera y 8 piedra', () => {
  resetState();
  addItem('wood', 14);
  addItem('stone', 8);
  tryPlaceShelter();
  assert.equal(state.shelters.length, 0);

  addItem('wood', 1);
  tryPlaceShelter();
  assert.equal(state.shelters.length, 1);
  assert.equal(countItem('wood'), 0);
  assert.equal(countItem('stone'), 0);
});
