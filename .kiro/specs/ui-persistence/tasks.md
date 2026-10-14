# Tareas · A1 Persistencia de la interfaz

## Fase 1 · Almacén

- [x] 1. `services/ui-state.ts` con carga, versión, escritura atómica, espera, límites y pruebas.
- [x] 2. IPC `ui:load` y `ui:patch`, preload `window.api.ui`, tipos en `src/shared/ui-state.ts`.
- [x] 3. `main.tsx` espera el estado; caché, `useUiState` y `useScrollMemory`.
- [x] 4. Migración desde `localStorage`; `prefs` sobre el almacén.

## Fase 2 · Menubar

- [x] 5. Pestañas montadas a la vez con carga perezosa; detalles encima de la lista.
- [x] 6. Pantalla guardada por id y restaurada al reiniciar, con caída a la pestaña.
- [x] 7. Periodo, rango y página de Historial; página de Notas; borrador de captura; madres
      desplegadas en el almacén.
- [x] 8. Scroll recordado en Hoy, Historial y Notas.
- [x] 9. Fijar la ventana: botón, IPC, comportamiento sin ocultar, mover, alto y posición guardados.

## Fase 3 · Consultora

- [x] 10. Pila, futuro y memoria por sección; `chrome.replaceWithRoot()` en las fichas.
- [x] 11. Tamaño, posición, pantalla y maximizado con la comprobación de pantallas.
- [x] 12. Filtros, búsqueda, página, vista y orden de las listas; scroll en `Page`.
- [x] 13. Viewport por board y scroll por nota.

## Fase 4 · Cierre

- [x] 14. «Restablecer el diseño de las ventanas» en Ajustes.
- [x] 15. Revisión estática; README y DESIGN.md.

## Checklist

- [ ] En Historial elijo «7 días», bajo hasta la mitad, voy a Hoy y vuelvo: mismo periodo y scroll
- [ ] Escribo «Llamar a» en la captura, cambio a Notas y vuelvo: el texto sigue ahí
- [ ] Abro una tarea de la mitad de la lista y al volver la lista sigue en ese punto
- [ ] Reinicio la app con una nota abierta y al abrir el popover estoy en esa nota
- [ ] Fijo la ventana, la muevo, cambio a otra app y sigue visible; reinicio y sigue fijada en su sitio
- [ ] En Consultora cierro en el Pipeline en vista Lista y al abrir estoy ahí; atrás me lleva al
      cliente que tenía antes
