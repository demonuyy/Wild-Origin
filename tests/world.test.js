import './helpers/dom-shim.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../js/config.js';
import { generateWorld, updateChunks, snowFactor, isSnowBiome } from '../js/world.js';
import { resetState } from './helpers/reset-state.js';

test('nunca hay nieve pegada al spawn, sin importar la semilla', () => {
  resetState();
  generateWorld(); // usa una semilla al azar: esto tiene que valer para CUALQUIERA
  assert.equal(snowFactor(0, 0), 0);
  assert.equal(isSnowBiome(0, 0), false);
  assert.equal(snowFactor(200, -150), 0, 'sigue dentro del radio seguro alrededor del spawn');
});

test('el bioma de nieve existe en algún lugar lejos del spawn', () => {
  resetState();
  generateWorld();
  let foundSnow = false;
  for (let x = -15000; x <= 15000 && !foundSnow; x += 400) {
    for (let y = -15000; y <= 15000 && !foundSnow; y += 400) {
      if (isSnowBiome(x, y)) { foundSnow = true; break; }
    }
  }
  assert.equal(foundSnow, true, 'en un área tan grande debería haber al menos una zona de nieve');
});

test('snowFactor no da saltos bruscos entre dos puntos cercanos (transición suave del bioma)', () => {
  resetState();
  generateWorld();
  for (let x = -6000; x <= 6000; x += 500) {
    const a = snowFactor(x, 3000);
    const b = snowFactor(x + 50, 3000);
    assert.ok(Math.abs(a - b) < 0.35, `salto demasiado brusco cerca de x=${x}: ${a} vs ${b}`);
  }
});

test('ningún arbusto/ciervo/conejo generado cae dentro del bioma de nieve', () => {
  resetState();
  generateWorld();
  // Busca un punto nevado y bastante lejano para maximizar las chances de
  // que los chunks cargados alrededor realmente atraviesen el bioma.
  let snowSpot = null;
  for (let x = -15000; x <= 15000 && !snowSpot; x += 400) {
    for (let y = -15000; y <= 15000 && !snowSpot; y += 400) {
      if (isSnowBiome(x, y)) snowSpot = { x, y };
    }
  }
  state.player.x = snowSpot.x;
  state.player.y = snowSpot.y;
  updateChunks(1400, 1000);
  for (const b of state.bushes) assert.equal(isSnowBiome(b.x, b.y), false, `arbusto en (${b.x},${b.y})`);
  for (const d of state.deer) assert.equal(isSnowBiome(d.x, d.y), false, `ciervo en (${d.x},${d.y})`);
  for (const r of state.rabbits) assert.equal(isSnowBiome(r.x, r.y), false, `conejo en (${r.x},${r.y})`);
});

test('el oso aparece y solo dentro del bioma de nieve', () => {
  resetState();
  generateWorld();
  let found = false;
  for (let x = -15000; x <= 15000 && !found; x += 1200) {
    for (let y = -15000; y <= 15000 && !found; y += 1200) {
      if (!isSnowBiome(x, y)) continue;
      state.player.x = x;
      state.player.y = y;
      updateChunks(1400, 1000);
      if (state.bears.length > 0) found = true;
    }
  }
  assert.equal(found, true, 'recorriendo bastante bioma de nieve debería aparecer al menos un oso');
  for (const b of state.bears) assert.equal(isSnowBiome(b.x, b.y), true, `oso fuera de la nieve en (${b.x},${b.y})`);
});
