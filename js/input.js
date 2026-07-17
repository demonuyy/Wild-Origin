// Binding de los controles "de juego": teclado, rueda del mouse, hotbar e
// inventario. Antes vivía adentro de game.js junto con el resto (loop,
// render, menús). El binding de los MENÚS (title/pause/settings) se queda en
// game.js porque está atado a resetGame()/continueGame(), que son funciones
// locales de ese módulo; separarlas hubiese significado pasar varios
// callbacks de un lado a otro sin ganar mucha claridad a cambio.
import { state, canvas, ZOOM_MIN, ZOOM_MAX, clamp, hasItem, assignHotbar, clearHotbarSlot, swapHotbarSlots, moveInventorySlot } from './config.js';
import { SoundFX } from './audio.js';
import { tryInteract, tryAttack, handleManualEat } from './player.js';
import { tryCraftSpear, tryPlaceCampfire, tryCraftAxe, tryCraftPickaxe, tryCraftBackpack, tryPlaceShelter, tryEquipTool, useItem, tryRepairTool } from './crafting.js';
import { toggleInventory, closeInventory, isInventoryOpen, toggleCraftMenu, closeCraftMenu, isCraftMenuOpen, openPause, closePause, updateEquipUI } from './ui.js';

// ---------- Arrastre de la hotbar/inventario ----------
// Antes esto usaba drag&drop nativo de HTML5 (draggable="true" +
// dragstart/dragover/drop). Se sacó por completo: ese mecanismo es poco
// confiable entre navegadores (Safari y Firefox tienen quirks conocidos con
// dataTransfer, y no funciona en absoluto con touch/mobile sin polyfills),
// lo cual explicaba que mover un ítem funcionara en un lugar y no en otro
// según el navegador. Pointer Events (pointerdown/move/up) son un único
// mecanismo que anda igual con mouse, trackpad y dedo.
//
// slotInfoFromElement() es el único lugar que traduce "qué elemento del DOM
// es este" a { container, id, slotIndex } tanto para la hotbar como para el
// inventario, así que soltar de un lado al otro es simétrico.
function slotInfoFromElement(el) {
  if (!el) return null;
  const hotSlot = el.closest && el.closest('.hotSlot[data-slot-index]');
  if (hotSlot) {
    return { container: 'hotbar', el: hotSlot, slotIndex: Number(hotSlot.dataset.slotIndex), id: hotSlot.dataset.itemId || null };
  }
  const invSlot = el.closest && el.closest('.invSlot2');
  if (invSlot) {
    return { container: 'inventory', el: invSlot, id: invSlot.dataset.itemId || null, slotIndex: Number(invSlot.dataset.slotIndex) };
  }
  return null;
}

// Distancia mínima (px) para considerar que el puntero se está arrastrando
// y no simplemente clickeando con la mano un poco temblorosa.
const DRAG_THRESHOLD = 6;

let dragState = null;
// Se pone en true justo después de soltar un drag real, para que el 'click'
// que el navegador dispara igual al terminar el gesto no dispare también
// "usar ítem" encima del reordenamiento que acaba de pasar.
let suppressNextClick = false;

function clearDragVisuals() {
  document.querySelectorAll('.dragOver').forEach(el => el.classList.remove('dragOver'));
  document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
}

function resolveDrop(target) {
  if (!dragState) return;
  const info = slotInfoFromElement(target);
  if (info) {
    if (info.container === 'hotbar') {
      if (dragState.origin === 'inventory') {
        assignHotbar(info.slotIndex, dragState.id);
        SoundFX.equipClank();
      } else if (dragState.origin === 'hotbar') {
        swapHotbarSlots(dragState.slotIndex, info.slotIndex);
      }
    } else if (info.container === 'inventory') {
      if (dragState.origin === 'hotbar') {
        // Soltar un ítem de la hotbar sobre el inventario: lo saca de la
        // hotbar (el ítem sigue existiendo, solo deja de estar asignado).
        clearHotbarSlot(dragState.slotIndex);
      } else if (dragState.origin === 'inventory') {
        // Soltar sobre cualquier casilla del inventario (vacía u ocupada
        // por otro ítem) mueve el ítem EXACTAMENTE a esa posición: si
        // estaba vacía, el origen queda vacío; si tenía otro ítem, ambos
        // intercambian lugar. Así se puede reorganizar libremente,
        // dejando huecos donde el jugador quiera.
        moveInventorySlot(dragState.slotIndex, info.slotIndex);
      }
    }
    updateEquipUI();
  }
}

// bindDragSource() se llama una vez por contenedor (hotbar e inventario) y
// queda escuchando para siempre; como las casillas se reconstruyen
// dinámicamente en cada render, delega en el contenedor en vez de atar el
// listener a cada casilla.
function bindDragSource(containerEl, containerType) {
  containerEl.addEventListener('pointerdown', e => {
    if (!state.running || state.gameOver || state.paused) return;
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
    const info = slotInfoFromElement(e.target);
    if (!info || !info.id) return;
    dragState = {
      origin: containerType,
      id: info.id,
      slotIndex: info.slotIndex,
      sourceEl: info.el,
      startX: e.clientX,
      startY: e.clientY,
      moved: false
    };
  });
}

export function bindControls() {
  window.addEventListener('keydown', e => {
    state.keys[e.key.toLowerCase()] = true;
    if (!state.running || state.gameOver) return;
    if (e.key === 'e' || e.key === 'E') tryInteract();
    if (e.key === ' ') tryAttack();
    // 1-6 usan la hotbar real: si esa casilla tiene algo asignado, se
    // equipa/come/etc (ver useItem en crafting.js). Si está vacía no hace
    // nada; craftear ahora vive enteramente en el menú de crafteo (tecla C).
    if (/^[1-6]$/.test(e.key)) {
      const idx = Number(e.key) - 1;
      const id = state.player.hotbar[idx];
      if (id) useItem(id);
    }
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

  const hotbarEl = document.getElementById('hotbarSlots');
  const invGrid = document.getElementById('invGrid2');
  bindDragSource(hotbarEl, 'hotbar');
  bindDragSource(invGrid, 'inventory');

  // Seguimiento del drag en curso: una vez que arrancó (pointerdown sobre una
  // casilla con algo adentro), se sigue en window para poder soltar en
  // CUALQUIER casilla, sea del mismo contenedor o del otro.
  window.addEventListener('pointermove', e => {
    if (!dragState) return;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    if (!dragState.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      dragState.moved = true;
      dragState.sourceEl.classList.add('dragging');
    }
    if (!dragState.moved) return;
    document.querySelectorAll('.dragOver').forEach(el => el.classList.remove('dragOver'));
    const hovered = document.elementFromPoint(e.clientX, e.clientY);
    const info = slotInfoFromElement(hovered);
    if (info) info.el.classList.add('dragOver');
  });

  window.addEventListener('pointerup', e => {
    if (!dragState) return;
    if (dragState.moved) {
      resolveDrop(document.elementFromPoint(e.clientX, e.clientY));
      suppressNextClick = true;
    }
    clearDragVisuals();
    dragState = null;
  });

  window.addEventListener('pointercancel', () => {
    clearDragVisuals();
    dragState = null;
  });

  hotbarEl.addEventListener('click', e => {
    if (suppressNextClick) { suppressNextClick = false; return; }
    if (!state.running || state.gameOver || state.paused) return;
    const slot = e.target.closest('.hotSlot[data-slot-index]');
    if (!slot || !slot.dataset.itemId) return;
    useItem(slot.dataset.itemId);
  });

  document.getElementById('invToggleBtn').addEventListener('click', () => toggleInventory());

  invGrid.addEventListener('click', e => {
    if (suppressNextClick) { suppressNextClick = false; return; }
    if (!state.running || state.gameOver || state.paused) return;
    const slot = e.target.closest('.invSlot2.filled');
    if (!slot || !slot.dataset.itemId) return;
    useItem(slot.dataset.itemId);
  });

  // ---------- Menú de crafteo completo (tecla C) ----------
  // El grid se reconstruye cada vez que se abre o cambia el estado (ver
  // renderCraftGrid en ui.js), así que el listener se delega en el
  // contenedor en vez de ponerse por-slot.
  const CRAFT_ACTIONS = {
    spear: tryCraftSpear,
    campfire: tryPlaceCampfire,
    axe: () => { if (hasItem('axe')) tryEquipTool('axe'); else tryCraftAxe(); },
    pickaxe: () => { if (hasItem('pickaxe')) tryEquipTool('pickaxe'); else tryCraftPickaxe(); },
    backpack: tryCraftBackpack,
    shelter: tryPlaceShelter
  };
  document.getElementById('craftGrid').addEventListener('click', e => {
    if (!state.running || state.gameOver || state.paused) return;
    // El botón de reparar es un elemento propio adentro de la casilla: si
    // el click cayó ahí, repara y no sigue (no queremos que además
    // equipe/guarde la herramienta con el mismo click).
    const repairBtn = e.target.closest('.repairBtn');
    if (repairBtn) {
      const slot = repairBtn.closest('.craftSlot[data-action]');
      if (slot) tryRepairTool(slot.dataset.action);
      return;
    }
    const slot = e.target.closest('.craftSlot[data-action]');
    if (!slot) return;
    const action = CRAFT_ACTIONS[slot.dataset.action];
    if (action) action();
  });
}
