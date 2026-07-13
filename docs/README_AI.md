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

## Tests

`tests/` tiene tests unitarios de crafting.js, inventory.js y save.js
(recolección de recursos, costos de crafteo, guardado/carga). Se corren con
`npm test` (o `node --test "tests/*.test.js"`), no necesitan navegador.

Si se agrega o cambia una receta, un costo, o una regla de recolección,
conviene actualizar/agregar el test correspondiente en el mismo cambio.

---

## Filosofía

La simplicidad es mejor que la complejidad.

Cada nueva mecánica debe tener un propósito.

Todo debe sentirse conectado con el resto del juego.

Nunca agregar características únicamente para aumentar la cantidad de contenido.
