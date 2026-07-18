import './helpers/dom-shim.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { state, addItem, countItem, hasItem, getDurability } from '../js/config.js';
import { resetState } from './helpers/reset-state.js';
import {
  collectTreeResource,
  collectRockResource,
  collectStick,
  collectStone,
  collectBushResource,
  consumeBerry,
  dropItem,
  pickUpGroundItem
} from '../js/inventory.js';
import { tryCraftAxe } from '../js/crafting.js';

test('talar un árbol requiere el hacha craftada Y equipada (en la mano)', () => {
  resetState();
  const tree = { x: 0, y: 0, hits: 3, maxHits: 3 };
  state.trees.push(tree);

  collectTreeResource(tree); // sin hacha
  assert.equal(countItem('wood'), 0);

  addItem('axe', 1); // tiene el hacha pero no la tiene en la mano
  collectTreeResource(tree);
  assert.equal(countItem('wood'), 0);

  state.player.equippedTool = 'axe';
  collectTreeResource(tree);
  assert.ok(countItem('wood') >= 3 && countItem('wood') <= 5, 'gana entre 3 y 5 de madera por golpe');
  assert.equal(tree.hits, 1);
});

test('un árbol se elimina del mundo cuando se queda sin hits', () => {
  resetState();
  const tree = { x: 0, y: 0, hits: 2, maxHits: 2 };
  state.trees.push(tree);
  addItem('axe', 1);
  state.player.equippedTool = 'axe';
  collectTreeResource(tree);
  assert.equal(state.trees.includes(tree), false);
});

test('minar una roca requiere el pico craftado y equipado, igual que talar', () => {
  resetState();
  const rock = { x: 0, y: 0, hits: 4, maxHits: 4 };
  state.rocks.push(rock);

  collectRockResource(rock);
  assert.equal(countItem('stone'), 0);

  addItem('pickaxe', 1);
  state.player.equippedTool = 'pickaxe';
  collectRockResource(rock);
  assert.ok(countItem('stone') >= 3 && countItem('stone') <= 4);
});

test('recoger palos y piedras sueltas no requiere ninguna herramienta', () => {
  resetState();
  const stick = { x: 0, y: 0 };
  state.sticks.push(stick);
  collectStick(stick);
  assert.equal(countItem('wood'), 1);
  assert.equal(state.sticks.includes(stick), false);

  const stone = { x: 0, y: 0 };
  state.stones.push(stone);
  collectStone(stone);
  assert.equal(countItem('stone'), 1);
  assert.equal(state.stones.includes(stone), false);
});

test('el inventario no tiene límite de capacidad: siempre se puede seguir recolectando', () => {
  resetState();
  addItem('wood', 500); // cantidad grande, ya no existe un tope que la bloquee
  const stick = { x: 0, y: 0 };
  state.sticks.push(stick);
  collectStick(stick);
  assert.equal(countItem('wood'), 501, 'debería seguir sumando sin límite');
  assert.equal(state.sticks.includes(stick), false, 'el palo debería haberse recolectado');
});

test('collectBushResource agota el arbusto y arranca el timer de regrow', () => {
  resetState();
  const bush = { x: 0, y: 0, stock: 1, maxStock: 3, regrowTimer: 0 };
  state.bushes.push(bush);
  collectBushResource(bush);
  assert.equal(countItem('berries'), 1);
  assert.equal(bush.stock, 0);
  assert.equal(bush.regrowTimer, 26);
});

test('un arbusto agotado no da más bayas hasta regenerarse', () => {
  resetState();
  const bush = { x: 0, y: 0, stock: 0, maxStock: 3, regrowTimer: 10 };
  state.bushes.push(bush);
  collectBushResource(bush);
  assert.equal(countItem('berries'), 0);
});

test('consumeBerry resta una baya y suma hambre sin pasarse de 100', () => {
  resetState();
  addItem('berries', 2);
  state.player.hunger = 90;
  consumeBerry();
  assert.equal(countItem('berries'), 1);
  assert.equal(state.player.hunger, 100); // clamp: 90 + 22 = 112 -> 100
});

test('dropItem saca el ítem del inventario y lo deja en state.groundItems', () => {
  resetState();
  addItem('wood', 10);
  state.player.x = 50;
  state.player.y = -20;
  dropItem('wood', 4);
  assert.equal(countItem('wood'), 6);
  assert.equal(state.groundItems.length, 1);
  assert.equal(state.groundItems[0].id, 'wood');
  assert.equal(state.groundItems[0].qty, 4);
});

test('dropItem nunca tira más de lo que realmente se tiene', () => {
  resetState();
  addItem('wood', 3);
  dropItem('wood', 999);
  assert.equal(countItem('wood'), 0);
  assert.equal(state.groundItems[0].qty, 3);
});

test('dropItem no hace nada si no se tiene ese ítem', () => {
  resetState();
  dropItem('wood', 5);
  assert.equal(state.groundItems.length, 0);
});

test('tirar la herramienta equipada la desequipa', () => {
  resetState();
  addItem('wood', 5);
  addItem('stone', 3);
  tryCraftAxe(); // queda equipada
  assert.equal(state.player.equippedTool, 'axe');
  dropItem('axe', 1);
  assert.equal(hasItem('axe'), false);
  assert.equal(state.player.equippedTool, null);
});

test('pickUpGroundItem devuelve el ítem al inventario y lo saca del suelo', () => {
  resetState();
  addItem('wood', 2);
  dropItem('wood', 2);
  assert.equal(countItem('wood'), 0);
  const ground = state.groundItems[0];
  pickUpGroundItem(ground);
  assert.equal(countItem('wood'), 2);
  assert.equal(state.groundItems.length, 0);
});

test('tirar y recoger una herramienta gastada NO la repara gratis', () => {
  resetState();
  addItem('wood', 5);
  addItem('stone', 3);
  tryCraftAxe();
  const maxDur = getDurability('axe');
  // Simula una herramienta ya con desgaste antes de tirarla.
  state.player.inventory.find(s => s.id === 'axe').durability = maxDur - 7;
  dropItem('axe', 1);
  const ground = state.groundItems[0];
  assert.equal(ground.durability, maxDur - 7, 'el desgaste viaja con el ítem tirado');
  pickUpGroundItem(ground);
  assert.equal(getDurability('axe'), maxDur - 7, 'sigue gastada al recogerla, no vuelve al máximo');
});
