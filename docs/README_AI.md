# REGLAS PARA IA

Este documento debe leerse antes de modificar el código.

## Objetivo

Agregar contenido sin romper mecánicas existentes.

Nunca eliminar sistemas sin autorización.

Siempre mantener la compatibilidad con partidas anteriores (cuando exista guardado).

---

## Reglas

NO modificar valores porque sí.

NO cambiar nombres de variables existentes.

NO eliminar funciones.

NO cambiar controles.

NO duplicar código.

NO crear sistemas nuevos si pueden reutilizar uno existente.

---

## Organización

Cada sistema debe tener una única responsabilidad.

Ejemplo:

Jugador
↓

solo controla al jugador.

Inventario
↓

solo controla objetos.

UI
↓

solo dibuja información.

---

## Antes de agregar una función

Preguntarse:

¿Existe ya una función parecida?

¿Se puede reutilizar?

¿Rompe alguna mecánica?

¿Hace el juego más divertido?

---

## Estructura de módulos (actualizada)

game.js es solo el orquestador: bucle principal, reset/continue de partida,
y binding de los MENÚS (title/pause/settings).

render.js: todo lo que se dibuja en pantalla (jugador, minimapa, oscuridad
día/noche). No toca estado del jugador ni recursos.

input.js: binding de controles DE JUEGO (teclado, rueda del mouse, hotbar).
No confundir con el binding de menús, que sigue en game.js.

recipes.js: tabla central de costos de crafteo (RECIPES). Si se agrega un
ítem crafteable nuevo, se agrega ACÁ, no como números sueltos en crafting.js
ni en ui.js. Los dos leen de esta tabla para no desincronizarse.

save.js: soporta versionado (`SAVE_VERSION` + `migrateSaveData()`) y backup
automático ante un guardado corrupto. Si se le agrega un campo nuevo a
`state.player` o a las entidades del mundo, revisar si `migrateSaveData()`
necesita una migración para que las partidas guardadas antes de ese cambio
sigan cargando bien.

---

## Inventario (ítems reales, no contadores sueltos)

Desde la migración a `player.inventory`, TODO ítem (recurso, comida o
herramienta) es una entrada `{ id, qty }` en `state.player.inventory`, y
`ITEMS` (en config.js) es la única tabla que describe cada id posible
(label, icono, cuánto se apila, categoría `resource`/`food`/`tool`).

NO volver a agregar campos sueltos tipo `player.wood` o `player.hasAxe`.
Para agregar un ítem nuevo (carne, hierro, etc. del roadmap v0.3+):
1. Agregarlo a `ITEMS` en config.js.
2. Si es crafteable, agregar su receta a `RECIPES` en recipes.js (las claves
   de `cost` son ids de `ITEMS`).
3. Usar `addItem`/`removeItem`/`hasItem`/`countItem` (exportadas desde
   config.js) para todo lo demás — nunca tocar `player.inventory` a mano
   desde otro módulo.

`invTotal()`/`capFor()` ya suman solo las categorías `resource`/`food`
contra la capacidad (las herramientas nunca ocupan capacidad, igual que
antes). Si se agrega un ítem que no es ni recurso apilable ni herramienta
(por ejemplo algo con su propia lógica de cantidad máxima), revisar si esas
dos funciones siguen aplicando tal cual.

---

## Hotbar (casillas reales, no acciones de crafteo)

La hotbar (abajo de la pantalla) dejó de ser 6 acciones de crafteo fijas
siempre visibles. Ahora es `player.hotbar`: un array de `HOTBAR_SIZE` (6)
casillas, cada una `null` o un id de `ITEMS` que el jugador YA posee.

- Craftear vive enteramente en el menú de crafteo (tecla `C` / `craftGrid`
  en ui.js), que sigue leyendo de `RECIPES` como siempre.
- La hotbar es solo para USAR lo que ya se tiene: click (o la tecla 1-6 de
  esa casilla) llama a `useItem(id)` (crafting.js), que equipa si es
  herramienta, come si es comida, o avisa si es un material sin uso directo.
- `assignHotbar`/`clearHotbarSlot`/`swapHotbarSlots`/`pruneHotbar` (todas en
  config.js) son el único lugar que toca `player.hotbar` directamente,
  mismo criterio que `addItem`/`removeItem` para `player.inventory`.
- Al craftear una herramienta nueva se llama a `autoAssignHotbar(id)` para
  que quede en la primera casilla libre sin que el jugador tenga que
  arrastrarla a mano. Si se agrega un ítem craftable nuevo (v0.3+), conviene
  hacer lo mismo después de `addItem`.
- El panel de inventario (`invGrid2`) también quedó manipulable: click usa
  el ítem (mismo `useItem`), y arrastrar reordena posiciones dentro del
  panel (`reorderInventory` si se suelta sobre otra casilla ocupada,
  `moveInventoryToEnd` si se suelta sobre una vacía, ambas sobre
  `player.invOrder`) o asigna/desasigna de la hotbar.
- El arrastre (hotbar ↔ inventario, y reordenar dentro del inventario) usa
  **Pointer Events** (`pointerdown`/`pointermove`/`pointerup` sobre
  `window`), no el drag&drop nativo de HTML5 (`draggable`, `dragstart`,
  `dragover`, `drop`). Se migró de uno a otro porque el nativo tiene
  comportamiento inconsistente entre navegadores (Safari/Firefox tienen
  quirks con `dataTransfer`) y no anda en absoluto con touch sin polyfills;
  Pointer Events sí es uniforme entre mouse y dedo. `slotInfoFromElement()`
  (input.js) es el único lugar que traduce un elemento del DOM a
  `{ container, id, slotIndex }`, y `resolveDrop()` el único que decide qué
  hacer al soltar — si se agrega un tercer contenedor arrastrable en el
  futuro, esos dos son los que hay que tocar.
- "Usar" un ítem (click para equipar/comer) se resuelve DIRECTO en el mismo
  handler de `pointerup`, no en un listener de `click` aparte. Antes había
  dos mecanismos separados (Pointer Events para arrastrar + `click` nativo
  para usar) que tenían que coordinarse con un flag de "suprimir el próximo
  click" — esa coordinación entre dos sistemas de eventos distintos era en
  sí misma una fuente de bugs sutiles entre navegadores. Ahora hay un único
  mecanismo: si `pointerup` nunca superó `DRAG_THRESHOLD`, fue un click; si
  lo superó pero terminó soltando sobre la misma casilla de origen (mano
  temblorosa/trackpad), también se trata como click.
- El panel de inventario tiene 2 filas de 5 (10 casillas) por defecto y pasa
  a 4 filas (20) apenas `hasItem('backpack')` es true (`invSlotCount()` en
  ui.js + clase `.expanded` en CSS). Si en el futuro se agrega otro ítem que
  también debería agrandar el inventario, ese es el lugar a tocar.

---

## Durabilidad de herramientas

Lanza/hacha/pico/antorcha tienen `durability` en `ITEMS` (config.js); la
mochila no (es pasiva, no se gasta con nada). Cuando un ítem tiene
`durability`, `addItem()` le crea un slot con ese campo al máximo apenas se
craftea. `damageTool(id, amount)` (config.js) es el único lugar que la
descuenta: si llega a 0, saca el ítem del inventario entero y lo desequipa
si estaba puesto. `repairTool(id)` la restaura al máximo (usado por
`tryRepairTool` en crafting.js, que cobra la mitad del costo original).

Ojo con el TIPO de desgaste: lanza/hacha/pico se gastan por USO (un golpe
que conecta, `damageTool(id, 1)`); la antorcha se gasta por TIEMPO equipada
(`damageTool('torch', dt)` en el loop de `updatePlayer`, player.js) — no por
golpe. Si se agrega una herramienta nueva con durabilidad, definir cuál de
los dos criterios le corresponde.

## Cadáveres y caza

Matar un lobo/ciervo/conejo (`hitDeer`/`hitRabbit` en animals.js,
lógica de lobo en enemies.js) genera un cadáver en `state.corpses`
(`spawnCorpse`, world.js) con `kind` y `stage: 'fresh'`. `harvestCorpse`
(inventory.js) es el único lugar que sabe qué da cada uno
(`CORPSE_YIELD`): lobo/ciervo tienen DOS etapas (desollar da carne+piel y
pasa a `stage: 'bones'`; juntar huesos recién ahí saca el cadáver del
mundo), el conejo es de una sola etapa (se recolecta entero, sin piel ni
huesos, por ser chico). No requiere ninguna herramienta equipada, a
diferencia de talar/minar.

`state.corpses` NO está atado al sistema de chunks (no se descarga/recarga
al alejarse y volver): vive como una lista simple con un tope
(`MAX_CORPSES`) y se guarda directo en el save, igual que `state.groundItems`
más abajo.

## Tirar y recoger ítems del suelo

`dropItem(id, qty)` (inventory.js) saca del inventario y crea una entrada en
`state.groundItems` (`spawnGroundItem`, world.js); `pickUpGroundItem`
hace lo inverso. Se dispara arrastrando un ítem (hotbar o inventario) y
soltándolo AFUERA de ambos paneles (`resolveDrop`/`isOutsidePanels` en
input.js), o con click derecho sobre la casilla. La durabilidad de una
herramienta viaja con el ítem tirado (`getDurability`/`setDurability` en
config.js) para que tirarla y recogerla no la "repare" gratis.

Mismo criterio que los cadáveres: `state.groundItems` no está atado a
chunks, tiene un tope (`MAX_GROUND_ITEMS`) y se guarda directo en el save.

---

## Audio (samples reales + respaldo sintetizado)

`js/audio.js`: `SAMPLE_FILES` mapea una categoría (ej. `craft`, `rabbitHurt`)
a una lista de archivos bajo `assets/audio/<carpeta>/`; si hay más de uno se
elige al azar (variación). Cada método de `SoundFX` (ej. `craftOk()`,
`rabbitHurt()`) intenta `playRandom(categoría)` y, si el sample no cargó
(404, formato no soportado), cae a un tono/ruido sintetizado como respaldo
— por eso el juego nunca queda mudo aunque falte un archivo.

Para agregar un sonido nuevo: 1) copiar el archivo a la carpeta que
corresponda (`animals/`, `items/`, `player/`, `tools/`, `ui/`, `ambient/`),
2) agregarlo a `SAMPLE_FILES`, 3) exponer/reusar un método de `SoundFX`, con
su respaldo sintetizado, 4) llamarlo desde el lugar del código donde pasa
la acción (no todos los `pickup()`/`craftOk()` genéricos deberían quedar
así para siempre — si el sonido reusado era solo un placeholder porque no
había sample propio todavía, al agregar el sample real conviene separarlo
en su propio método en vez de seguir reusando el genérico).

---

## Tests

`tests/` tiene tests unitarios de crafting.js, inventory.js, save.js, la
hotbar/inventario real (hotbar.test.js), durabilidad (durability.test.js),
conejos/caza/cocinar (rabbits.test.js) y generación de mundo/bioma nieve/oso
(world.test.js). Se corren con `npm test` (o `node --test
"tests/*.test.js"`), no necesitan navegador.

Si se agrega o cambia una receta, un costo, o una regla de recolección,
conviene actualizar/agregar el test correspondiente en el mismo cambio.

---

## Filosofía

La simplicidad es mejor que la complejidad.

Cada nueva mecánica debe tener un propósito.

Todo debe sentirse conectado con el resto del juego.

Nunca agregar características únicamente para aumentar la cantidad de contenido.
