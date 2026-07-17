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
  syncInventorySlots,
  moveInventorySlot
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

test('un ítem nuevo se auto-asigna a la hotbar antes que nada (primeras casillas en llenarse)', () => {
  resetState();
  addItem('wood', 5); // primer ítem que se recolecta en toda la partida
  assert.equal(state.player.hotbar[0], 'wood', 'va directo a la primera casilla de la hotbar');

  addItem('stone', 2);
  assert.equal(state.player.hotbar[1], 'stone', 'el segundo tipo ocupa la siguiente casilla libre');

  addItem('wood', 10); // ya lo tenía asignado: no debe duplicarse ni moverse
  assert.equal(state.player.hotbar[0], 'wood');
  assert.equal(state.player.hotbar.filter(id => id === 'wood').length, 1);
});

test('syncInventorySlots agrega ítems nuevos a la primera casilla libre y saca los que ya no se poseen', () => {
  resetState();
  addItem('wood', 5);
  addItem('stone', 2);
  syncInventorySlots(10);
  assert.deepEqual(state.player.invSlots.slice(0, 2).map(s => s.id), ['wood', 'stone']);

  addItem('berries', 1);
  syncInventorySlots(10);
  assert.deepEqual(state.player.invSlots.slice(0, 3).map(s => s.id), ['wood', 'stone', 'berries']);

  removeItem('stone', 2);
  syncInventorySlots(10);
  assert.equal(state.player.invSlots.some(s => s && s.id === 'stone'), false, 'la piedra ya no está en ninguna posición');
  assert.equal(state.player.invSlots[0].id, 'wood', 'la madera no se movió de su lugar');
});

test('syncInventorySlots no mueve un ítem que sigue necesitando la misma cantidad de casillas', () => {
  resetState();
  addItem('wood', 5);
  addItem('stone', 2);
  syncInventorySlots(10);
  moveInventorySlot(0, 5); // el jugador arrastra la madera a la casilla 5
  syncInventorySlots(10); // un nuevo render no debería reacomodarla ni rellenar el hueco
  assert.equal(state.player.invSlots[5].id, 'wood');
  assert.equal(state.player.invSlots[1].id, 'stone', 'la piedra sigue en su lugar de siempre');
  assert.equal(state.player.invSlots[0], null, 'el hueco que dejó la madera queda vacío, no se rellena solo');
});

test('moveInventorySlot mueve un ítem a una casilla vacía específica, dejando un hueco', () => {
  resetState();
  addItem('wood', 5);
  addItem('stone', 2);
  addItem('berries', 1);
  syncInventorySlots(10);
  moveInventorySlot(0, 7); // mover la madera (casilla 0) a la casilla 7, vacía
  assert.equal(state.player.invSlots[0], null, 'la casilla de origen queda vacía');
  assert.equal(state.player.invSlots[7].id, 'wood');
  assert.equal(state.player.invSlots[1].id, 'stone', 'el resto no se movió');
});

test('moveInventorySlot sobre una casilla ocupada por otro ítem intercambia los dos', () => {
  resetState();
  addItem('wood', 5);
  addItem('stone', 2);
  syncInventorySlots(10);
  moveInventorySlot(0, 1); // madera <-> piedra
  assert.equal(state.player.invSlots[0].id, 'stone');
  assert.equal(state.player.invSlots[1].id, 'wood');
});

test('moveInventorySlot intercambia dos stacks del MISMO ítem con distinta cantidad (25 y 3)', () => {
  resetState();
  addItem('wood', 28); // 1 stack lleno de 25 + 1 de 3
  syncInventorySlots(10);
  const bigSlot = state.player.invSlots.findIndex(s => s && s.qty === 25);
  const smallSlot = state.player.invSlots.findIndex(s => s && s.qty === 3);
  moveInventorySlot(bigSlot, smallSlot);
  assert.equal(state.player.invSlots[bigSlot].qty, 3, 'el stack chico pasó a la casilla del grande');
  assert.equal(state.player.invSlots[smallSlot].qty, 25, 'el stack grande pasó a la casilla del chico');
});

test('un ítem con varios stacks ocupa varias casillas y las libera si baja la cantidad', () => {
  resetState();
  addItem('wood', 40); // stack de madera = 25 -> necesita 2 casillas
  syncInventorySlots(10);
  assert.equal(state.player.invSlots.filter(s => s && s.id === 'wood').length, 2);

  removeItem('wood', 20); // quedan 20, ya entra en 1 sola casilla
  syncInventorySlots(10);
  assert.equal(state.player.invSlots.filter(s => s && s.id === 'wood').length, 1);
});

test('al subir la cantidad, primero se rellena el stack existente que no esté al tope', () => {
  resetState();
  addItem('wood', 3); // una sola casilla con 3
  syncInventorySlots(10);
  moveInventorySlot(0, 4); // el jugador la mueve a otra posición, a mano
  addItem('wood', 5); // sube a 8: debe sumarse a la MISMA casilla, no abrir una nueva
  syncInventorySlots(10);
  assert.equal(state.player.invSlots[4].qty, 8);
  assert.equal(state.player.invSlots.filter(s => s && s.id === 'wood').length, 1, 'sigue siendo una sola casilla');
});

test('al bajar la cantidad, se descuenta primero de la última casilla asignada', () => {
  resetState();
  addItem('wood', 40); // 25 + 15, en dos casillas
  syncInventorySlots(10);
  const firstSlot = state.player.invSlots.findIndex(s => s && s.id === 'wood');
  removeItem('wood', 10); // debería salir de la segunda casilla (15 -> 5), no de la primera (25)
  syncInventorySlots(10);
  assert.equal(state.player.invSlots[firstSlot].qty, 25, 'el stack principal queda intacto');
});
