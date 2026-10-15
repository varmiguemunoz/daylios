# Tareas · Fundamentos v3

- [ ] 1–3. Bus de eventos: **aplazado al módulo 7** (sin consumidor aún). Se hace solo `afterCommit`
      en `transactionGuard` (lo usa el borrado de clientes).
- [x] 4. Primitivas UI: atoms (`IconButton`, `CountBadge`, `Kbd`), molecules (`ConfirmButton`,
      `SegmentedToggle`, `SearchField`, `FilterButton`), organisms (`Drawer`, `Modal`); barrel y
      re-export en `ui.tsx`
- [x] 5. Reemplazar los borrados en dos pasos existentes de Consultora por `ConfirmButton`
      (Contacto, nota, fuentes) sin cambiar el aspecto
- [x] 6. MCP: extraer `client.ts`; mover herramientas a `tools/*.ts` sin cambiar nombres ni esquemas
- [x] 7. PRODUCT.md (alcance v3) y DESIGN.md (sección «Primitivas v3»)

## Checklist

- [ ] La app arranca igual; Claude ve las mismas herramientas que antes (mismo número y nombres)
- [ ] Drawer y Modal: Esc cierra, el foco vuelve al botón que los abrió
