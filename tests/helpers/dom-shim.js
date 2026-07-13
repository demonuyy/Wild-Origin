// El juego entero está pensado para correr en un navegador: config.js pide
// el <canvas id="game"> apenas se importa, y ui.js/audio.js tocan
// document/window cuando se llaman. Para poder testear la LÓGICA pura de
// crafting.js/inventory.js (matemática de recursos, permisos de herramienta,
// etc.) sin levantar un navegador real ni sumar una dependencia pesada tipo
// jsdom, este archivo define un DOM falso mínimo: solo lo que el código
// necesita para no explotar, sin intentar simular un navegador de verdad.
//
// Importar este archivo ANTES que cualquier módulo del juego (ver los tests)
// asegura que document/window ya existan cuando config.js se evalúe.

function makeFakeCtx() {
  const gradient = { addColorStop() {} };
  return new Proxy({}, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return () => gradient;
      }
      // Cualquier otro método de canvas (fillRect, beginPath, arc, etc.):
      // no-op. No nos importa lo que se dibuja, solo que no tire error.
      return () => {};
    },
    set(target, prop, value) { target[prop] = value; return true; }
  });
}

function makeFakeElement() {
  const el = {
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      toggle(c, force) {
        const on = force !== undefined ? force : !this._set.has(c);
        if (on) this._set.add(c); else this._set.delete(c);
      },
      contains(c) { return this._set.has(c); }
    },
    style: {},
    dataset: {},
    children: [],
    textContent: '',
    innerHTML: '',
    value: '',
    checked: false,
    width: 0,
    height: 0,
    draggable: false,
    appendChild() {},
    removeChild() {},
    remove() {},
    querySelector() { return makeFakeElement(); },
    querySelectorAll() { return []; },
    addEventListener() {},
    removeEventListener() {},
    getContext() { return makeFakeCtx(); }
  };
  return el;
}

if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    getElementById() { return makeFakeElement(); },
    createElement() { return makeFakeElement(); },
    querySelectorAll() { return []; },
    addEventListener() {}
  };
}

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
}

if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    addEventListener() {},
    innerWidth: 1024,
    innerHeight: 768
  };
}

// localStorage: usado por save.js. Un mock en memoria alcanza para tests.
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  };
}

export {};
