# Diseño · Contactos (UX)

## Modelo

Migración `AddContactProject1728500000000`:

```sql
ALTER TABLE contacts ADD COLUMN project_id TEXT NULL;
CREATE INDEX idx_contacts_project ON contacts (project_id);
```

`prospect_id` se queda y se edita como hoy (`ContactInput.prospect`). Validación: `projectId` debe pertenecer a `clientId`; cambiar de cliente limpia el
proyecto.

`src/shared/consultora.ts`:

```ts
interface ContactFilter { /* … */ tags?: string[]; inPipeline?: boolean } // `tag` queda como alias
interface ContactDetail { /* … */ project: { id: string; name: string } | null
  prospect: { id: string; company: string; stage: string; pipeline: string } | null
  runs: AutomationRunBrief[]  /* módulo 7; vacío hasta entonces */ }
interface ConvertInput { pipeline?: string; stage?: string; company?: string; valueUsd?: number | null }
ConsultoraApi.convertContact(id, input: ConvertInput): Promise<{ contact; prospect }>
ConsultoraApi.detachContactProspect(id): Promise<Contact>
```

`ContactService.list`: `tags` → `HAVING COUNT(DISTINCT tag) = n`; `inPipeline` →
`prospect_id IS [NOT] NULL`; búsqueda incluye `phone`. `promote` pasa a `convert` (alias interno).

## UI

Estructura atómica:

- `molecules/Initials` · círculo 32px surface-raised con iniciales milk-soft (no hay fotos).
- `organisms/ContactFilters` · contenido del `Drawer`: `Chips` (suscripción), `TagChecklist` (lista con
  casilla circular, nombre y conteo; buscador si hay más de 10), `Select` fuente y empresa,
  `SegmentedToggle` En pipeline. Pie: «Limpiar filtros» quiet.
- `organisms/ConvertToProspectModal` · `Modal size="sm"`: pipeline (`Select`, oculto si hay uno),
  etapa (`Chips` de etapas abiertas), empresa (input prellenado), valor (input numérico). Primario
  apricot «Crear prospecto».
- `organisms/ContactHeader`, `organisms/ContactSidebar` (secciones colapsables), `organisms/Timeline`.
- `molecules/InlineField` · etiqueta micro milk-soft + valor; clic → input en el sitio; Enter/blur
  guarda; Esc cancela.

`Contacts.tsx`: cabecera (`Page` title + meta) → fila con `SearchField` (flex) + `FilterButton` →
lista. Estado de filtros en un objeto `filters` + `activeCount(filters)` (pura, en `lib.ts`).

`Contact.tsx` (layout, ventana 1100, contenido 880):

```
┌ cabecera ────────────────────────────────────────────────────────────┐
│ Nombre (headline editable)                         [Email][LinkedIn] │
│ CEO · Acme  ·  Suscrito                  [Convertir en prospecto][⋯] │
├──────────────── principal 1fr ───────────┬──── lateral 300px ────────┤
│ Notas (MarkdownField)                    │ Datos  (InlineField x4)   │
│ Actividad (Timeline: eventos+reuniones)  │ Empresa (cliente·proyecto)│
│                                          │ En pipeline / Convertir   │
│                                          │ Tags (TagEditor)          │
│                                          │ Email marketing (1 línea) │
│                                          │ Formulario (colapsado)    │
│                                          │ Automatizaciones          │
└──────────────────────────────────────────┴───────────────────────────┘
```

Brief impeccable (Operate, refinamiento sobre el mundo actual):

- Trabajo principal: saber quién es y qué sigue con esta persona en 3 segundos, y actuar (escribir,
  convertir) en un clic. Notas y actividad son lo que se lee; los datos son referencia.
- Jerarquía: nombre > relación (empresa, pipeline) > acciones > referencia. El estado de suscripción
  es una pill pequeña; `none` no muestra nada (calma por defecto, DESIGN.md).
- Lateral en surface al 50% con secciones sin tarjeta (label micro + contenido), separadas por 20px.
- Una sola acción primaria apricot por pantalla: «Convertir en prospecto» (o «Ver en pipeline»).
- Borrar vive en «Más», en dos pasos.
- Anti-objetivos: tarjetas grandes de formulario, dos selectores de empresa, chips de estado en
  pastel para tags.
- Estados: sin email (Email deshabilitado con tooltip), sin empresa («Asignar empresa»), sin notas
  (placeholder), sin actividad (no se muestra la sección), error de sync Resend (línea coral en Email
  marketing).

## MCP

`list_contacts { tags?, client?, in_pipeline?, status?, source?, query?, page? }` ·
`convert_contact { id, pipeline?, stage?, company?, value_usd? }` (+ alias `promote_contact`) ·
`detach_contact_prospect { id }` · `delete_contact { id, confirm: true }` · `save_contact` con
`project`.
