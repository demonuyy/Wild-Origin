import './helpers/dom-shim.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { state, rotateCamera, screenToWorldDir } from '../js/config.js';
import { resetState } from './helpers/reset-state.js';

test('rotateCamera gira de a pasos de 90° y da la vuelta completa en 4 pasos', () => {
  resetState();
  assert.equal(state.cameraRotation, 0);
  rotateCamera(1); // E, derecha
  assert.equal(state.cameraRotation, Math.PI / 2);
  rotateCamera(1);
  rotateCamera(1);
  rotateCamera(1);
  assert.ok(Math.abs(state.cameraRotation) < 1e-9, 'a los 4 pasos vuelve a 0 (360°)');
});

test('rotateCamera con Q (izquierda) resta, y nunca queda negativo', () => {
  resetState();
  rotateCamera(-1); // Q, izquierda desde 0°
  assert.ok(state.cameraRotation > 0, 'el módulo lo normaliza a positivo (270°), no -90°');
  assert.ok(Math.abs(state.cameraRotation - (3 * Math.PI) / 2) < 1e-9);
});

test('sin rotación, screenToWorldDir no cambia nada (pantalla = mundo)', () => {
  resetState();
  const [wx, wy] = screenToWorldDir(0, -1); // W: arriba en pantalla
  assert.ok(Math.abs(wx - 0) < 1e-9);
  assert.ok(Math.abs(wy - (-1)) < 1e-9);
});

test('con la cámara rotada 90° a la derecha, W ya no mueve hacia -y del mundo', () => {
  resetState();
  rotateCamera(1); // 90°
  const [wx, wy] = screenToWorldDir(0, -1); // W sigue siendo "arriba en pantalla"
  // Ver el cálculo en config.js: a 90°, arriba-en-pantalla pasa a ser
  // izquierda-en-mundo (-1, 0), no arriba-en-mundo.
  assert.ok(Math.abs(wx - (-1)) < 1e-9);
  assert.ok(Math.abs(wy - 0) < 1e-9);
});

test('rotar 4 veces a la derecha y 4 a la izquierda vuelve al mismo lugar', () => {
  resetState();
  for (let i = 0; i < 4; i++) rotateCamera(1);
  for (let i = 0; i < 4; i++) rotateCamera(-1);
  assert.ok(Math.abs(state.cameraRotation) < 1e-9);
});
