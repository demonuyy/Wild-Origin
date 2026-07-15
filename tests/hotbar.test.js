import './helpers/dom-shim.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  state,
  HOTBAR_SIZE,
  addItem,
  removeItem,
  assignHotbar,
  clearHotbarSlot,
  swapHotbarSlots,
  pruneHotbar,
  autoAssignHotbar,
  getInventoryOrder,
  reorderInventory,
  moveInventoryToEnd
} from '../js/config.js';
import { resetState } from './helpers/reset-state.js';

test('assignHotbar solo acepta ítems que el jugador realmente posee', () => {
  resetState();
  assignHotbar(0, 'axe'); // no lo tiene todavía
  assert.equal(state.player.hotbar[0], null);

  addItem('axe', 1);
  assignHotbar(0, 'axe');
  assert.equal(state.player.hotbar[0], 'axe');
});

test('assignHotbar no deja un mismo ítem duplicado en dos casillas', () => {
  resetState();
  addItem('axe', 1);
  assignHotbar(0, 'axe');
  assignHotbar(3, 'axe');
  assert.equal(state.player.hotbar[0], null, 'la casilla vieja se vacía');
  assert.equal(state.player.hotbar[3], 'axe');
});

test('swapHotbarSlots intercambia el contenido de dos casillas', () => {
  resetState();
  addItem('axe', 1);
  addItem('pickaxe', 1);
  assignHotbar(0, 'axe');
  assignHotbar(1, 'pickaxe');
  swapHotbarSlots(0, 1);
  assert.equal(state.player.hotbar[0], 'pickaxe');
  assert.equal(state.player.hotbar[1], 'axe');
});

test('clearHotbarSlot vacía la casilla sin tocar el inventario', () => {
  resetState();
  addItem('axe', 1);
  assignHotbar(0, 'axe');
  clearHotbarSlot(0);
  assert.equal(state.player.hotbar[0], null);
  assert.equal(state.player.inventory.find(s => s.id === 'axe').qty, 1, 'el hacha sigue en el inventario');
});

test('pruneHotbar vacía una casilla cuyo ítem ya no se posee', () => {
  resetState();
  addItem('berries', 3);
  assignHotbar(0, 'berries');
  removeItem('berries', 3); // se comieron todas
  pruneHotbar();
  assert.equal(state.player.hotbar[0], null);
});

test('autoAssignHotbar ocupa la primera casilla libre una sola vez por ítem', () => {
  resetState();
  addItem('axe', 1);
  autoAssignHotbar('axe');
  assert.equal(state.player.hotbar[0], 'axe');

  addItem('pickaxe', 1);
  autoAssignHotbar('axe'); // ya estaba asignado, no debe duplicarse ni moverse
  autoAssignHotbar('pickaxe');
  assert.equal(state.player.hotbar[0], 'axe');
  assert.equal(state.player.hotbar[1], 'pickaxe');
  assert.equal(state.player.hotbar.filter(id => id === 'axe').length, 1);
});

test('autoAssignHotbar no hace nada si ya no queda ninguna casilla libre', () => {
  resetState();
  for (let i = 0; i < HOTBAR_SIZE; i++) {
    addItem(`item${i}`, 1);
    state.player.hotbar[i] = `item${i}`;
  }
  addItem('axe', 1);
  autoAssignHotbar('axe');
  assert.ok(!state.player.hotbar.includes('axe'));
});

test('getInventoryOrder agrega ítems nuevos al final y saca los que ya no se poseen', () => {
  resetState();
  addItem('wood', 5);
  addItem('stone', 2);
  let order = getInventoryOrder();
  assert.deepEqual(order, ['wood', 'stone']);

  addItem('berries', 1);
  order = getInventoryOrder();
  assert.deepEqual(order, ['wood', 'stone', 'berries']);

  removeItem('stone', 2);
  order = getInventoryOrder();
  assert.deepEqual(order, ['wood', 'berries']);
});

test('reorderInventory intercambia la posición de dos ítems existentes', () => {
  resetState();
  addItem('wood', 5);
  addItem('stone', 2);
  addItem('berries', 1);
  reorderInventory('wood', 'berries');
  assert.deepEqual(getInventoryOrder(), ['berries', 'stone', 'wood']);
});

test('reorderInventory no hace nada si alguno de los dos ítems no existe', () => {
  resetState();
  addItem('wood', 5);
  reorderInventory('wood', 'stone'); // no tiene piedra
  assert.deepEqual(getInventoryOrder(), ['wood']);
});

test('moveInventoryToEnd manda un ítem al final del orden (soltar sobre casilla vacía)', () => {
  resetState();
  addItem('wood', 5);
  addItem('stone', 2);
  addItem('berries', 1);
  moveInventoryToEnd('wood');
  assert.deepEqual(getInventoryOrder(), ['stone', 'berries', 'wood']);
});

test('moveInventoryToEnd no hace nada si el ítem no existe', () => {
  resetState();
  addItem('wood', 5);
  moveInventoryToEnd('stone');
  assert.deepEqual(getInventoryOrder(), ['wood']);
});
