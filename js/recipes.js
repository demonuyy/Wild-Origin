import { countItem, removeItem } from './config.js';

// Tabla central de recetas de crafteo.
//
// Antes cada costo (madera/piedra) vivía duplicado en dos lugares: la
// validación real en crafting.js (if wood >= X && stone >= Y) y una copia
// paralela en ui.js (antes HOTBAR_CONFIG, hoy CRAFT_CONFIG) solo para pintar el número en la hotbar.
// Si alguien cambiaba un costo en uno y se olvidaba del otro, la UI mentía
// sobre lo que realmente costaba craftear algo. Ahora los dos leen de acá.
//
// Agregar una receta nueva (v0.3+: horno, arco, etc.) es agregar una entrada
// acá; crafting.js y ui.js no necesitan tocar números.
export const RECIPES = {
  spear: { label: 'Lanza', cost: { wood: 4, stone: 2 } },
  campfire: { label: 'Fogata', cost: { wood: 6, stone: 0 } },
  axe: { label: 'Hacha', cost: { wood: 5, stone: 3 } },
  pickaxe: { label: 'Pico', cost: { wood: 5, stone: 3 } },
  backpack: { label: 'Mochila', cost: { wood: 8, stone: 4 } },
  shelter: { label: 'Refugio', cost: { wood: 15, stone: 8 } }
};

// `player` ya no se usa acá (el inventario es global en config.js), se deja
// el parámetro para no tener que tocar los call sites en crafting.js. Las
// claves de `cost` (wood, stone) son directamente ids de ITEMS.
export function canAfford(player, cost) {
  return Object.entries(cost).every(([id, qty]) => countItem(id) >= qty);
}

export function payCost(player, cost) {
  Object.entries(cost).forEach(([id, qty]) => removeItem(id, qty));
}

// Arma el texto "<b>Lanza:</b> Necesitás 4 madera y 2 piedra" a partir de la
// receta, para que crafting.js no tenga que redactar cada mensaje a mano.
export function costHint(recipeId) {
  const r = RECIPES[recipeId];
  const parts = [];
  if (r.cost.wood) parts.push(`${r.cost.wood} madera`);
  if (r.cost.stone) parts.push(`${r.cost.stone} piedra`);
  return `<b>${r.label}:</b> Necesitás ${parts.join(' y ')}`;
}
