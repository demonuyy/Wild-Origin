import './helpers/dom-shim.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { state, addItem, countItem, hasItem } from '../js/config.js';
import { resetState } from './helpers/reset-state.js';
import { hitRabbit, updateRabbits } from '../js/animals.js';
import { harvestCorpse, tryCookMeat, consumeFood } from '../js/inventory.js';

test('un golpe alcanza para matar a un conejo (health bajo, a diferencia de lobo/ciervo)', () => {
  resetState();
  const rabbit = { x: 0, y: 0, health: 6, maxHealth: 6, speed: 90, state: 'wander', wanderTarget: null, variant: 0 };
  state.rabbits.push(rabbit);
  const died = hitRabbit(rabbit, 12); // daño a mano limpia
  assert.equal(died, true);
  assert.equal(state.rabbits.includes(rabbit), false, 'se saca de state.rabbits al morir');
  assert.equal(state.corpses.length, 1);
  assert.equal(state.corpses[0].kind, 'rabbit');
});

test('el cadáver de un conejo se cosecha entero de un solo golpe (sin etapa de huesos)', () => {
  resetState();
  state.corpses.push({ x: 0, y: 0, kind: 'rabbit', stage: 'fresh', variant: 0 });
  harvestCorpse(state.corpses[0]);
  assert.ok(countItem('raw_meat') >= 1 && countItem('raw_meat') <= 2);
  assert.equal(state.corpses.length, 0, 'a diferencia de lobo/ciervo, no queda un cadáver en etapa "bones"');
  assert.equal(hasItem('hide'), false, 'el conejo no da piel');
});

test('un conejo asustado pasa a estado flee y no vuelve a wander hasta alejarse', () => {
  resetState();
  const rabbit = { x: 0, y: 0, health: 6, maxHealth: 6, speed: 90, state: 'wander', wanderTarget: null, variant: 0 };
  state.rabbits.push(rabbit);
  state.player.x = 10;
  state.player.y = 0; // bien cerca, dentro del radio de alerta del conejo
  updateRabbits(0.1);
  assert.equal(rabbit.state, 'flee');
});

test('tryCookMeat convierte carne cruda en carne cocida 1 a 1', () => {
  resetState();
  addItem('raw_meat', 2);
  tryCookMeat();
  assert.equal(countItem('raw_meat'), 1);
  assert.equal(countItem('cooked_meat'), 1);
});

test('tryCookMeat no hace nada si no hay carne cruda', () => {
  resetState();
  tryCookMeat();
  assert.equal(countItem('cooked_meat'), 0);
});

test('comer carne cruda sacia hambre pero baja mucho la sed y un poco la vida', () => {
  resetState();
  addItem('raw_meat', 1);
  state.player.hunger = 50;
  state.player.thirst = 100;
  state.player.health = 100;
  consumeFood('raw_meat');
  assert.equal(state.player.hunger, 80, '+30 de hambre, igual que antes');
  assert.equal(state.player.thirst, 72, '-28 de sed');
  assert.equal(state.player.health, 92, '-8 de vida');
});

test('comer carne cocida sacia más hambre y no tiene penalización', () => {
  resetState();
  addItem('cooked_meat', 1);
  state.player.hunger = 50;
  state.player.thirst = 100;
  state.player.health = 100;
  consumeFood('cooked_meat');
  assert.equal(state.player.hunger, 90, '+40 de hambre, más que la cruda');
  assert.equal(state.player.thirst, 100, 'sin penalización de sed');
  assert.equal(state.player.health, 100, 'sin penalización de vida');
});
