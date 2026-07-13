import './helpers/dom-shim.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { state, BASE_CAP } from '../js/config.js';
import { resetState } from './helpers/reset-state.js';
import {
  collectTreeResource,
  collectRockResource,
  collectStick,
  collectStone,
  collectBushResource,
  consumeBerry
} from '../js/inventory.js';

test('talar un árbol requiere el hacha craftada Y equipada (en la mano)', () => {
  resetState();
  const tree = { x: 0, y: 0, hits: 3, maxHits: 3 };
  state.trees.push(tree);

  collectTreeResource(tree); // sin hacha
  assert.equal(state.player.wood, 0);

  state.player.hasAxe = true; // tiene el hacha pero no la tiene en la mano
  collectTreeResource(tree);
  assert.equal(state.player.wood, 0);

  state.player.equippedTool = 'axe';
  collectTreeResource(tree);
  assert.ok(state.player.wood >= 3 && state.player.wood <= 5, 'gana entre 3 y 5 de madera por golpe');
  assert.equal(tree.hits, 1);
});

test('un árbol se elimina del mundo cuando se queda sin hits', () => {
  resetState();
  const tree = { x: 0, y: 0, hits: 2, maxHits: 2 };
  state.trees.push(tree);
  state.player.hasAxe = true;
  state.player.equippedTool = 'axe';
  collectTreeResource(tree);
  assert.equal(state.trees.includes(tree), false);
});

test('minar una roca requiere el pico craftado y equipado, igual que talar', () => {
  resetState();
  const rock = { x: 0, y: 0, hits: 4, maxHits: 4 };
  state.rocks.push(rock);

  collectRockResource(rock);
  assert.equal(state.player.stone, 0);

  state.player.hasPickaxe = true;
  state.player.equippedTool = 'pickaxe';
  collectRockResource(rock);
  assert.ok(state.player.stone >= 3 && state.player.stone <= 4);
});

test('recoger palos y piedras sueltas no requiere ninguna herramienta', () => {
  resetState();
  const stick = { x: 0, y: 0 };
  state.sticks.push(stick);
  collectStick(stick);
  assert.equal(state.player.wood, 1);
  assert.equal(state.sticks.includes(stick), false);

  const stone = { x: 0, y: 0 };
  state.stones.push(stone);
  collectStone(stone);
  assert.equal(state.player.stone, 1);
  assert.equal(state.stones.includes(stone), false);
});

test('el límite de inventario (capFor) impide seguir recolectando', () => {
  resetState();
  state.player.wood = BASE_CAP; // inventario lleno solo con madera
  const stick = { x: 0, y: 0 };
  state.sticks.push(stick);
  collectStick(stick);
  assert.equal(state.player.wood, BASE_CAP, 'no debería sumar de más');
  assert.equal(state.sticks.includes(stick), true, 'el palo debería seguir en el piso');
});

test('collectBushResource agota el arbusto y arranca el timer de regrow', () => {
  resetState();
  const bush = { x: 0, y: 0, stock: 1, maxStock: 3, regrowTimer: 0 };
  state.bushes.push(bush);
  collectBushResource(bush);
  assert.equal(state.player.berries, 1);
  assert.equal(bush.stock, 0);
  assert.equal(bush.regrowTimer, 26);
});

test('un arbusto agotado no da más bayas hasta regenerarse', () => {
  resetState();
  const bush = { x: 0, y: 0, stock: 0, maxStock: 3, regrowTimer: 10 };
  state.bushes.push(bush);
  collectBushResource(bush);
  assert.equal(state.player.berries, 0);
});

test('consumeBerry resta una baya y suma hambre sin pasarse de 100', () => {
  resetState();
  state.player.berries = 2;
  state.player.hunger = 90;
  consumeBerry();
  assert.equal(state.player.berries, 1);
  assert.equal(state.player.hunger, 100); // clamp: 90 + 22 = 112 -> 100
});
