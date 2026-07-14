// Binding de los controles "de juego": teclado, rueda del mouse y hotbar.
// Antes vivía adentro de game.js junto con el resto (loop, render, menús).
// El binding de los MENÚS (title/pause/settings) se queda en game.js porque
// está atado a resetGame()/continueGame(), que son funciones locales de ese
// módulo; separarlas hubiese significado pasar varios callbacks de un lado a
// otro sin ganar mucha claridad a cambio.
import { state, canvas, ZOOM_MIN, ZOOM_MAX, clamp } from './config.js';
import { SoundFX } from './audio.js';
import { tryInteract, tryAttack, handleManualEat } from './player.js';
import { tryCraftSpear, tryPlaceCampfire, tryCraftAxe, tryCraftPickaxe, tryCraftBackpack, tryPlaceShelter, tryEquipTool } from './crafting.js';
import { showHint, toggleInventory, closeInventory, isInventoryOpen, toggleCraftMenu, closeCraftMenu, isCraftMenuOpen, openPause, closePause } from './ui.js';

export function bindControls() {
  window.addEventListener('keydown', e => {
    state.keys[e.key.toLowerCase()] = true;
    if (!state.running || state.gameOver) return;
    if (e.key === 'e' || e.key === 'E') tryInteract();
    if (e.key === ' ') tryAttack();
    if (e.key === '1') tryCraftSpear();
    if (e.key === '2') tryPlaceCampfire();
    if (e.key === '3') { if (state.player.hasAxe) tryEquipTool('axe'); else tryCraftAxe(); }
    if (e.key === '4') { if (state.player.hasPickaxe) tryEquipTool('pickaxe'); else tryCraftPickaxe(); }
    if (e.key === '5') tryCraftBackpack();
    if (e.key === '6') tryPlaceShelter();
  });
  window.addEventListener('keyup', e => { state.keys[e.key.toLowerCase()] = false; });
  window.addEventListener('keydown', e => {
    if (!state.running || state.gameOver) return;
    if (e.key === 'q' || e.key === 'Q') handleManualEat();
    if (e.key === 'i' || e.key === 'I') toggleInventory();
    if (e.key === 'c' || e.key === 'C') toggleCraftMenu();
    if (e.key === 'Escape') {
      if (isInventoryOpen()) closeInventory();
      else if (isCraftMenuOpen()) closeCraftMenu();
      else if (state.paused) closePause();
      else openPause();
    }
  });

  // Rueda del mouse: acerca/aleja la cámara de forma suave (interpolada en update()).
  canvas.addEventListener('wheel', e => {
    if (!state.running || state.gameOver || state.paused) return;
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.0012);
    state.targetZoom = clamp(state.targetZoom * factor, ZOOM_MIN, ZOOM_MAX);
  }, { passive: false });

  // Hotbar: cada slot dispara la misma acción que su tecla numérica.
  const HOTBAR_ACTIONS = {
    spear: tryCraftSpear,
    campfire: tryPlaceCampfire,
    axe: () => { if (state.player.hasAxe) tryEquipTool('axe'); else tryCraftAxe(); },
    pickaxe: () => { if (state.player.hasPickaxe) tryEquipTool('pickaxe'); else tryCraftPickaxe(); },
    backpack: tryCraftBackpack,
    shelter: tryPlaceShelter
  };
  document.querySelectorAll('#hotbar .hotSlot[data-action]').forEach(el => {
    el.addEventListener('click', () => {
      if (!state.running || state.gameOver || state.paused) return;
      const action = HOTBAR_ACTIONS[el.dataset.action];
      if (action) action();
    });
    // Soltar una herramienta arrastrada desde el inventario: si coincide con
    // este slot y está craftada, queda equipada ("en la mano"); cualquier
    // otra cosa (materiales, herramientas que no van acá) se rechaza.
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      el.classList.add('dragOver');
    });
    el.addEventListener('dragleave', () => el.classList.remove('dragOver'));
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('dragOver');
      if (!state.running || state.gameOver || state.paused) return;
      const type = e.dataTransfer.getData('text/plain');
      const action = el.dataset.action;
      if (action === 'spear' && type === 'spear' && state.player.hasSpear) {
        tryEquipTool('spear');
      } else if (action === 'axe' && type === 'axe' && state.player.hasAxe) {
        tryEquipTool('axe');
      } else if (action === 'pickaxe' && type === 'pickaxe' && state.player.hasPickaxe) {
        tryEquipTool('pickaxe');
      } else {
        SoundFX.craftFail();
        showHint('Eso no se puede colocar ahí');
      }
    });
  });
  document.getElementById('invToggleBtn').addEventListener('click', () => toggleInventory());

  // Menú de crafteo completo (tecla C): el grid se reconstruye cada vez que
  // se abre o cambia el estado (ver renderCraftGrid en ui.js), así que el
  // listener se delega en el contenedor en vez de ponerse por-slot como en
  // la hotbar (que es estática). Reutiliza las mismas acciones.
  document.getElementById('craftGrid').addEventListener('click', e => {
    if (!state.running || state.gameOver || state.paused) return;
    const slot = e.target.closest('.craftSlot[data-action]');
    if (!slot) return;
    const action = HOTBAR_ACTIONS[slot.dataset.action];
    if (action) action();
  });
}
