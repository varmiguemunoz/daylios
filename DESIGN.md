---
name: DayliOS
description: macOS menubar app for the day's tasks, with a ceiling of eight, in pastel on night.
colors:
  night: '#131313'
  surface: '#1C1C1E'
  surface-raised: '#262628'
  hairline: '#303033'
  milk: '#F3F1EE'
  milk-soft: '#A6A29D'
  milk-faint: '#6E6B67'
  ink-on-pastel: '#1A1A1A'
  apricot-peach: '#FFCBA9'
  apricot-soft: 'color-mix(in srgb, #FFCBA9 58%, #1C1C1E)'
  candy-rose: '#F6A9BD'
  mint-ok: '#A8E6CF'
  butter-warning: '#FBE39A'
  coral-exceeded: '#F4A3A3'
  cat-comida: '#F6C58F'
  cat-super: '#A9DDA3'
  cat-transporte: '#9FC2F7'
  cat-casa: '#E6ADE8'
  cat-salud: '#F79E97'
  cat-entretenimiento: '#E2E38C'
  cat-suscripciones: '#97DDD4'
  cat-otros: '#CFCBC6'
  cat-ingreso: '#B9E6C5'
typography:
  display:
    fontFamily: 'Nunito'
    fontSize: '52px'
    fontWeight: 800
    lineHeight: 1.08
    letterSpacing: '-1px'
  headline:
    fontFamily: 'Nunito'
    fontSize: '36px'
    fontWeight: 800
    lineHeight: 1.17
    letterSpacing: '-0.6px'
  body:
    fontFamily: 'Nunito'
    fontSize: '17px'
    fontWeight: 400
    lineHeight: 1.41
  title:
    fontFamily: 'Nunito'
    fontSize: '22px'
    fontWeight: 800
    lineHeight: 1.27
    letterSpacing: '-0.3px'
  label:
    fontFamily: 'Nunito'
    fontSize: '17px'
    fontWeight: 700
    lineHeight: 1.3
  caption:
    fontFamily: 'Nunito'
    fontSize: '14px'
    fontWeight: 400
    lineHeight: 1.36
  list:
    fontFamily: 'Nunito'
    fontSize: '15px'
    fontWeight: 400
    lineHeight: 1.36
  micro:
    fontFamily: 'Nunito'
    fontSize: '13px'
    fontWeight: 700
    lineHeight: 1.25
rounded:
  sm: '12px'
  md: '20px'
  lg: '24px'
  xl: '28px'
  pill: '999px'
spacing:
  xs: '4px'
  sm: '8px'
  md: '12px'
  lg: '16px'
  xl: '24px'
  xxl: '32px'
  huge: '48px'
components:
  button-primary:
    textColor: '{colors.ink-on-pastel}'
    rounded: '{rounded.md}'
    height: '60px'
    typography: '{typography.label}'
  button-secondary:
    backgroundColor: '{colors.surface-raised}'
    textColor: '{colors.milk}'
    rounded: '{rounded.md}'
    height: '60px'
  transaction-card:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.milk}'
    rounded: '{rounded.xl}'
    padding: '16px'
  input-email:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.milk}'
    rounded: '{rounded.lg}'
    height: '60px'
  icon-button:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.milk}'
    rounded: '{rounded.pill}'
    size: '48px'
  meter-segment-done:
    backgroundColor: '{colors.mint-ok}'
    rounded: '{rounded.pill}'
    height: '12px'
  meter-segment-pending:
    backgroundColor: '{colors.apricot-soft}'
    rounded: '{rounded.pill}'
    height: '12px'
  meter-segment-free:
    rounded: '{rounded.pill}'
    height: '12px'
  meter-sm:
    rounded: '{rounded.pill}'
    height: '6px'
    width: '92px'
  task-row:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.milk}'
    typography: '{typography.body}'
    rounded: '{rounded.md}'
    padding: '4px 6px 4px 14px'
    height: '46px'
  task-row-hover:
    backgroundColor: '{colors.surface-raised}'
  task-row-done:
    textColor: '{colors.milk-soft}'
  capture-field:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.milk}'
    typography: '{typography.body}'
    rounded: '{rounded.lg}'
    padding: '0 20px'
    height: '60px'
  yesterday-tray:
    textColor: '{colors.butter-warning}'
    typography: '{typography.caption}'
    rounded: '{rounded.md}'
    height: '48px'
  yesterday-tray-count:
    backgroundColor: '{colors.butter-warning}'
    textColor: '{colors.ink-on-pastel}'
    typography: '{typography.micro}'
    rounded: '{rounded.pill}'
    height: '24px'
  yesterday-tray-bring:
    backgroundColor: '{colors.butter-warning}'
    textColor: '{colors.ink-on-pastel}'
    typography: '{typography.caption}'
    rounded: '{rounded.pill}'
    padding: '0 14px'
    height: '36px'
  period-chip:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.milk-soft}'
    typography: '{typography.caption}'
    rounded: '{rounded.pill}'
    padding: '0 12px'
    height: '36px'
  period-chip-active:
    backgroundColor: '{colors.apricot-peach}'
    textColor: '{colors.ink-on-pastel}'
  tab-switcher:
    backgroundColor: '{colors.surface}'
    rounded: '{rounded.pill}'
    padding: '4px'
  tab-switcher-item:
    textColor: '{colors.milk-soft}'
    typography: '{typography.caption}'
    rounded: '{rounded.pill}'
    padding: '0 20px'
    height: '40px'
  tab-switcher-item-active:
    backgroundColor: '{colors.surface-raised}'
    textColor: '{colors.milk}'
  undo-toast:
    backgroundColor: '{colors.surface-raised}'
    textColor: '{colors.milk}'
    typography: '{typography.caption}'
    rounded: '{rounded.pill}'
    padding: '0 6px 0 20px'
    height: '48px'
  undo-toast-action:
    textColor: '{colors.apricot-peach}'
    typography: '{typography.caption}'
    rounded: '{rounded.pill}'
    padding: '0 16px'
    height: '36px'
---

# Design System: DayliOS

## Overview

**Creative North Star: "The Day Drawn in Eight"**

DayliOS is a small window that drops from the macOS menubar and shows one thing: today, bounded by a ceiling of eight. The ceiling is drawn, not counted. An eight-segment meter under a big Nunito numeral tells the owner at a glance how full and how done the day is, and every other element (capture field, task rows, yesterday's tray) sits in service of that meter.

The world is pastel on night. A near-black ground holds soft, rounded surfaces; color is reserved for meaning. Mint means done, apricot means pending or "act here", butter means yesterday, rose means destructive. Density is desktop-tight for a 400px window: 24px page gutters, rows 4px apart, a denser list size for history. Calm by default, one small reward at completion.

**Key Characteristics:**

- Near-black ground with tonal surfaces, no borders on containers.
- Every color carries a meaning; nothing is tinted for decoration.
- Nunito throughout, heavy (800) for numerals and titles, rounded letterforms matching rounded shapes.
- Pills and generous radii everywhere; no square corners.
- Motion is expo ease-out, short, and always tied to a state change.

## Colors

Soft pastels against a warm-neutral night, each hue bound to one meaning.

### Primary

- **Apricot Peach** (apricot-peach): the action and focus color. Caret, focus ring (2px), capture field focus stroke (70% mix, 1.5px inset), the Enter badge, the active period chip, the active tab icon, the undo action text.
- **Soft Apricot** (apricot-soft): apricot mixed into the surface so it stays pastel but reads as "not yet". Only used for pending meter segments.

### Secondary

- **Mint OK** (mint-ok): done. Filled meter segments and the checked task circle, with ink-on-pastel check marks.

### Tertiary

- **Butter Warning** (butter-warning): yesterday's leftovers only. The tray tint (8% alpha), its title, count badge and "Traer" button, and the "de ayer" / "arrastrada" micro labels (80% alpha).
- **Candy Rose** (candy-rose): destructive intent, and _live recording_. Hover state of delete and dismiss icon buttons (text rose, 15% rose wash); the record dot, the recording timer pill and the «Grabando» status.
- **Coral Exceeded** (coral-exceeded): errors. Inline alert text on a 12% coral wash.

### Neutral

- **Night** (night): window background, scrollbar thumb border, inline edit input fill.
- **Surface** (surface): rows, capture field, chips, tab rail, history day cards.
- **Surface Raised** (surface-raised): hover and active states, undo toast, active tab, disabled pastel buttons.
- **Hairline** (hairline): free meter segments (1.5px inset stroke), row dividers inside history cards, icon-button hover wash.
- **Milk** (milk): primary text.
- **Milk Soft** (milk-soft): secondary text, dates, status lines, placeholders, done-task titles, idle icons.
- **Milk Faint** (milk-faint): unchecked circle strokes and disabled icons/text only.
- **Ink on Pastel** (ink-on-pastel): any text or glyph sitting on a pastel fill.
- **Category pastels** (cat-*): inherited from the owner's palette and preserved as binding. The tasks renderer does not use them today.

### Named Rules

**The One Meaning Rule.** A pastel is never decorative. Mint is done, apricot is act/pending, butter is yesterday or overdue, rose is destroy or live, coral is error. If a color can't name its meaning, it's milk or a surface.

**The Faint Is For Strokes Rule.** Milk-faint (about 3.2:1 on surface) is for strokes and disabled states only, never body or placeholder text. Placeholders use milk-soft.

**The Wash Rule.** Tinted backgrounds are the meaning color at low alpha over surface or night (butter 8%, coral 12%, rose 15%, apricot 10% on hover), never a new hex.

## Typography

**Display Font:** Nunito Variable (with Nunito, ui-rounded, system-ui, sans-serif)
**Body Font:** Nunito Variable, same stack

**Character:** One rounded family doing everything. Weight carries hierarchy: 800 for numerals and titles, 700 for controls, 400 for content. Numerals are tabular app-wide.

### Hierarchy

- **Display** (800, 52px, 1.08): the done count in Today's header. One per screen.
- **Headline** (800, 36px, 1.17): the "/8" denominator and the History title.
- **Title** (800, 22px, 1.27): the task title in Task Detail; h2 inside markdown.
- **Label** (700–800, 17px, 1.3): weekday, history day titles, empty-state lead.
- **Body** (400, 17px, 1.41): task titles in Today, the capture field, inline edit.
- **List** (400, 15px, 1.36): task titles inside history cards and yesterday's tray, where density matters.
- **Caption** (400–800, 14px, 1.36): dates, status lines, chips, tabs, toast, buttons.
- **Micro** (600–800, 13px, 1.25): tray count badge, "de ayer" / "arrastrada" tags, date-field labels.

### Named Rules

**The Weight Not Size Rule.** Inside the 400px window, emphasize with weight (700/800) before reaching for a larger size. List and micro exist so density never needs a size below 13px.

## Layout

A single column in a narrow menubar window. Page gutters are 24px on both sides; scroll areas reserve a stable scrollbar gutter (10px bar + 14px padding) so rows align with the header. Header stack in Today: date/numeral row, meter 16px below, status line 10px below, capture field 20px below. Task rows stack with 4px gaps; history day sections with 20px gaps. The tab switcher is pinned at the bottom, centered. Scrolling lists fade out over their last 20px instead of cutting off.

## Elevation & Depth

Flat and tonal. Depth comes from night → surface → surface-raised, not shadows; containers carry no borders. Strokes are inset box-shadows (1.5–2px) so they never change layout. The only cast shadow is the undo toast, which floats over content.

### Shadow Vocabulary

- **Toast float** (`box-shadow: 0 10px 30px -8px rgb(0 0 0 / 0.7)`): undo toast only.

### Named Rules

**The Tonal Step Rule.** Hover and active move one tonal step up (surface → surface-raised). Nothing lifts, nothing gains a shadow on hover.

## Shapes

Everything is round. Rows use 20px (md), the capture field 24px (lg), small fields and inner items 12px (sm), and every control, chip, badge, segment and toast is a full pill. Checkboxes are circles (26px in Today, 20px in History). The only non-token radius is the 6px Enter key cap in the empty state.

## Components

### Eight-Segment Meter (signature)

The day's ceiling, drawn. Eight equal pill segments in a row.

- **Large (Today):** 12px tall, 6px gaps, full width under the header.
- **Small (History):** 6px tall, 3px gaps, 92px wide, beside each day's "done/total".
- **Done:** mint fill. **Pending:** soft apricot. **Free:** transparent with a 1.5px hairline inset outline.
- **Motion:** the mint fill is a layer scaled on X from the left edge; completing a task sweeps it in (520ms, expo ease-out), uncompleting sweeps it back. Background color changes cross-fade in 240ms.
- **Completion:** on the transition to 8/8 (not on opening an already-complete day) a single soft-light sheen crosses the meter once (1400ms, 120ms delay).
- **Semantics:** exposed as a meter with value, max 8 and a text value ("n hechas de m planificadas, techo 8").

### Task Row

- **Style:** surface, 20px radius, min 46px tall, body type, 26px circle checkbox at left.
- **Unchecked:** 2px milk-faint inset ring; hover turns it apricot. **Checked:** mint circle with ink check; title goes milk-soft with a 50% strike-through.
- **Hover / Focus:** row steps to surface-raised; edit and delete icon buttons (32px) appear. Delete hovers rose.
- **Editing:** inline input on night, 12px radius.
- **Carried tasks:** a butter "de ayer" micro tag under the title.
- **Entry:** new rows slide 6px down into place with a fade (360ms).

### Capture Field

- **Style:** surface, 24px radius, 60px tall, 20px horizontal padding, apricot plus icon, body type. Placeholder in milk-soft.
- **Focus:** 1.5px inset apricot stroke at 70%; no outer glow.
- **Typing:** a 32px apricot circle with an Enter glyph appears at the right.
- **Full day:** surface at 50%, disabled, plus icon milk-faint, placeholder reads the ceiling.

### Yesterday Tray

- **Style:** butter wash (8%) over the list, 20px radius, 48px header. Count badge (butter, ink, micro) + butter caption title + rotating chevron.
- **Action:** a butter pill "Traer" (36px) brings leftovers in; per-item arrow buttons bring one, an X dismisses (rose on hover).
- **Disabled at 8/8:** buttons fall to surface-raised with milk-faint text.
- **Items:** list type, separated by a 1px butter 12% inset line.

### Period Chips

- **Style:** 36px pills, caption bold, 12px horizontal padding, 4px gap, horizontally scrollable with hidden scrollbar.
- **State:** idle is surface / milk-soft, hover surface-raised / milk; selected is apricot / ink. Behaves as a radio group.

### Tab Switcher

- **Style:** a surface pill rail (4px padding) centered at the bottom, holding 40px pill items with a 16px icon and caption bold label.
- **State:** idle milk-soft, hover milk; active is surface-raised with milk text and an apricot icon.

### Undo Toast

- **Style:** surface-raised pill, 48px tall, inset 24px from the window edges and floating above the tab switcher, caption semibold message.
- **Action:** apricot "Deshacer" text button with a milk-soft ⌘Z hint; hover adds a 10% apricot wash.
- **Behavior:** rises 12px into place with a fade (320ms); auto-dismisses after 6s. Deletes happen without confirmation; this is the safety net.

### Detail Screens (Task, Note)

- **Header:** a surface pill back button (36px, apricot chevron + caption bold label) at left; a 36px icon button at right for delete (rose on hover). No tab switcher; Esc goes back.
- **Task title:** title type, 800; click to edit in place on a surface field (12px radius) that grows with content. Done tasks read milk-soft with the 50% strike.
- **Note delete:** two steps. First click turns the icon into a rose pill «¿Borrar?» with ink text; leaving the button resets it.

### Markdown Editor

- **Mode switch:** a small tab-switcher rail (32px items) with «Escribir» / «Ver»; ⌘E toggles. A save label sits at the right: mint check + «Guardado», «Guardando…», or coral «No se guardó».
- **Write:** a bare textarea on night, body type, apricot caret; no card around it.
- **View:** rendered markdown, line-height 1.55. h1 26px, h2 title, h3 label, h4–h6 caption milk-soft. Links apricot with a 45% underline. Inline code on surface-raised (6px radius, system mono); code blocks on surface (12px radius). Quotes on a surface wash, never a colored side border. Task-list boxes are 18px circles that fill mint when checked, matching task rows. Tables scroll horizontally.

### Notes List

- Same skeleton as History: headline title, day headings, surface cards with hairline dividers, pager. An apricot pill «Nueva» sits opposite the title. Each item: list type bold title, micro time at right, caption milk-soft excerpt.

### Consultora Window

- **Shell:** 1100×760, hidden-inset title bar. A 224px sidebar on a 50% surface wash (section items reuse the tab-switcher item look, apricot icon when active; Ajustes pinned at the bottom). A 56px top bar holds the search pill (left) and the record control (right).
- **Pages:** max 880px content, headline title editable in place, caption meta line, quiet actions at the right. Sections are label-weight headings over surface cards with hairline dividers (the History pattern).
- **Markdown fields:** read rendered on surface; double-click or the pencil edits on a surface textarea that grows with content; checklist boxes toggle without editing.
- **Pipeline:** horizontal columns (240px) on a 50% surface wash, cards on surface; overdue next steps in butter; the won column title in mint.
- **Recording:** idle «Grabar reunión» quiet pill with a rose dot; live state is a rose 15% pill with a pulsing dot and tabular timer plus «Detener». Stopping opens a centered sheet (surface, xl radius, toast float shadow) for title, participants and association.

### Voice Pill
- Floating 44px pill, top center of the active display, over everything (also full-screen apps), never takes focus. Surface-raised with the toast float shadow (second and last allowed shadow use).
- Listening: pulsing rose dot (live) + «Escuchando» milk + tabular timer milk-soft. Working: «Escribiendo la nota…» in apricot. Done: mint check + note title, 1.6s, then hides. Error: coral text.

### Motion

All motion uses the expo ease-out curve and runs only in response to a state change.

- **Segment sweep:** scaleX from the left, 520ms.
- **Sheen:** once, only on reaching 8/8.
- **Tick:** a changed number or status line rises from 35% below with a brief blur, 420ms.
- **Row in / toast in:** 360ms / 320ms slide and fade.
- **Reduced motion:** with `prefers-reduced-motion: reduce`, the segment transition is removed and sheen, tick, row-in and toast-in animations do not run; state still changes instantly.

## Do's and Don'ts

### Do:

- **Do** show the day as eight segments: mint done, soft apricot pending, hairline-outlined free.
- **Do** keep text on pastel fills in ink-on-pastel.
- **Do** use milk-soft for secondary text and placeholders.
- **Do** express hover and active as one tonal step up (surface → surface-raised).
- **Do** use the expo ease-out curve for every transition, and disable animations under reduced motion.
- **Do** keep butter exclusive to yesterday's leftovers and rose exclusive to destructive actions.

### Don't:

- **Don't** use milk-faint for body or placeholder text; it is for strokes and disabled states only.
- **Don't** add borders or drop shadows to containers; the undo toast is the only floating surface.
- **Don't** play the 8/8 sheen on load or more than once per completion.
- **Don't** use square corners; every control is a pill or uses the rounded scale.
- **Don't** introduce new tint hexes; wash with the meaning color at low alpha.
