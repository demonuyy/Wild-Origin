import './helpers/dom-shim.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { state, addItem, countItem, hasItem, getDurability, maxDurability, damageTool, repairTool } from '../js/config.js';
import { resetState } from './helpers/reset-state.js';
import { tryCraftAxe, tryCraftPickaxe, tryCraftSpear, tryRepairTool } from '../js/crafting.js';
import { collectTreeResource } from '../js/inventory.js';
import { tryAttack } from '../js/player.js';

test('una herramienta recién crafteada arranca con la durabilidad al máximo', () => {
  resetState();
  addItem('wood', 5);
  addItem('stone', 3);
  tryCraftAxe();
  assert.equal(getDurability('axe'), maxDurability('axe'));
});

test('la mochila no tiene durabilidad (es pasiva, nunca se gasta)', () => {
  resetState();
  addItem('wood', 8);
  addItem('stone', 4);
  assert.equal(maxDurability('backpack'), null);
});

test('damageTool gasta 1 uso y no hace nada si el ítem no tiene durabilidad', () => {
  resetState();
  addItem('wood', 5);
  addItem('stone', 3);
  tryCraftAxe();
  const before = getDurability('axe');
  damageTool('axe', 1);
  assert.equal(getDurability('axe'), before - 1);

  addItem('wood', 10);
  const broke = damageTool('wood', 1); // la madera no tiene durabilidad
  assert.equal(broke, false);
});

test('la herramienta se rompe y desaparece del inventario al llegar a 0 (y se desequipa si estaba en la mano)', () => {
  resetState();
  addItem('wood', 5);
  addItem('stone', 3);
  tryCraftAxe(); // queda equipada
  assert.equal(state.player.equippedTool, 'axe');
  const max = maxDurability('axe');
  const broke = damageTool('axe', max); // gasta toda la durabilidad de una
  assert.equal(broke, true);
  assert.equal(hasItem('axe'), false, 'el hacha desaparece del inventario');
  assert.equal(state.player.equippedTool, null, 'se desequipa sola al romperse');
});

test('talar un árbol gasta 1 de durabilidad del hacha equipada', () => {
  resetState();
  addItem('wood', 5);
  addItem('stone', 3);
  tryCraftAxe();
  const before = getDurability('axe');
  const tree = { x: 0, y: 0, hits: 3, maxHits: 3 };
  state.trees.push(tree);
  collectTreeResource(tree);
  assert.equal(getDurability('axe'), before - 1);
});

test('el hacha se rompe sola si se queda sin durabilidad mientras se sigue talando', () => {
  resetState();
  addItem('wood', 5);
  addItem('stone', 3);
  tryCraftAxe();
  damageTool('axe', maxDurability('axe') - 1); // le queda 1 solo golpe
  const tree = { x: 0, y: 0, hits: 3, maxHits: 3 };
  state.trees.push(tree);
  collectTreeResource(tree); // este golpe la termina de romper
  assert.equal(hasItem('axe'), false);
  // pero la madera de ese último golpe sí se cobró antes de romperse
  assert.ok(countItem('wood') > 0, 'el último golpe sigue dando recursos');
});

test('la lanza solo se gasta si el golpe conecta, no si ataca al aire', () => {
  resetState();
  addItem('wood', 4);
  addItem('stone', 2);
  tryCraftSpear();
  const before = getDurability('spear');
  tryAttack(); // no hay ningún lobo cerca: no debería gastar nada
  assert.equal(getDurability('spear'), before);

  state.player.attackCooldown = 0;
  const wolf = { x: 0, y: 0, health: 100 };
  state.wolves.push(wolf);
  tryAttack(); // ahora sí conecta
  assert.equal(getDurability('spear'), before - 1);
});

test('repairTool restaura al máximo', () => {
  resetState();
  addItem('wood', 5);
  addItem('stone', 3);
  tryCraftAxe();
  damageTool('axe', 20);
  repairTool('axe');
  assert.equal(getDurability('axe'), maxDurability('axe'));
});

test('tryRepairTool cobra la mitad del costo original y repara al máximo', () => {
  resetState();
  addItem('wood', 5);
  addItem('stone', 3);
  tryCraftAxe(); // costó 5 madera + 3 piedra, quedan 0 y 0
  damageTool('axe', 20);
  addItem('wood', 3); // mitad de 5 redondeado arriba = 3
  addItem('stone', 2); // mitad de 3 redondeado arriba = 2
  tryRepairTool('axe');
  assert.equal(getDurability('axe'), maxDurability('axe'));
  assert.equal(countItem('wood'), 0);
  assert.equal(countItem('stone'), 0);
});

test('tryRepairTool no cobra nada si no alcanzan los materiales', () => {
  resetState();
  addItem('wood', 5);
  addItem('stone', 3);
  tryCraftAxe();
  damageTool('axe', 20);
  tryRepairTool('axe'); // sin materiales para reparar
  assert.ok(getDurability('axe') < maxDurability('axe'), 'sigue dañada');
  assert.equal(countItem('wood'), 0);
});

test('tryRepairTool no hace nada si la herramienta ya está al máximo', () => {
  resetState();
  addItem('wood', 5);
  addItem('stone', 3);
  tryCraftAxe();
  addItem('wood', 10);
  addItem('stone', 10);
  tryRepairTool('axe'); // ya está al 100%
  assert.equal(countItem('wood'), 10, 'no debería haber cobrado nada');
  assert.equal(countItem('stone'), 10);
});
