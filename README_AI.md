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

## Filosofía

La simplicidad es mejor que la complejidad.

Cada nueva mecánica debe tener un propósito.

Todo debe sentirse conectado con el resto del juego.

Nunca agregar características únicamente para aumentar la cantidad de contenido.
