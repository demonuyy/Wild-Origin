# 🌲 Wild Origin

Wild Origin es un juego de supervivencia en 2D donde el jugador comienza sin herramientas ni conocimientos y debe sobrevivir, evolucionar y construir una civilización en un mundo vivo.

## Estado del proyecto

Versión actual:
v0.2 (en desarrollo, gran parte de la v0.2 del roadmap ya implementada)

Estado:
🟢 En desarrollo

## Objetivos

- Crear un survival divertido.
- Que el mundo se sienta vivo.
- Agregar contenido de forma ordenada.
- Evitar código innecesario.
- Poder publicar una versión jugable en el futuro.

## Mecánicas actuales

- Movimiento (con sprint usando Shift, consume energía)
- Hambre
- Sed
- Energía (Stamina)
- Vida (con regeneración pasiva de día si hambre/sed están altas)
- Día y noche (fases: amanecer, día, atardecer, noche, madrugada, con oscuridad dinámica)
- Inventario (con capacidad máxima y panel propio, tecla "I")
- Hotbar real (teclas 1-6 o clic): solo muestra los objetos que ya tenés, se arma arrastrando ítems desde el inventario y clickeando/arrastrando se equipan, comen o reordenan
- Menú de crafteo (tecla "C"): todas las recetas disponibles en un solo panel
- Lobos (IA: deambulan o persiguen, huyen del fuego y refugios)
- Ciervos (huyen del jugador)
- Árboles
- Rocas
- Bayas (los arbustos se regeneran con el tiempo)
- Fogata (con duración limitada y luz que ahuyenta lobos)
- Refugio (zona segura, permite dormir y saltar al amanecer)
- Lanza
- Hacha
- Pico
- Mochila
- Combate cuerpo a cuerpo (ataque con Espacio, cooldown, retroceso al golpear)
- Mundo infinito generado por chunks (procedural, con semilla, sin costuras entre biomas)
- Cámara con zoom (rueda del mouse)
- Minimapa
- Menú de pausa y panel de ajustes (volumen general, de efectos y de ambiente por separado)
- Sistema de audio con samples reales (pasos, hachazos, picazos, comer, beber, ambiente día/noche, pájaros, viento)
- Guardado automático de la partida en el navegador (localStorage), con guardado manual desde el menú de pausa y botón "Continuar partida" en el título para cargarla.

## Tecnologías

HTML

CSS

JavaScript

Canvas API

## Motor

Motor propio desarrollado en JavaScript.
