---
version: 1
slug: 'src-renderer-src-app-tsx'
primary_target: 'src/renderer/src/App.tsx'
related_targets: []
---

Scope: DayliOS menubar window (Today + History), renderer at src/renderer. Mode: Operate.
Audience: the owner, many short visits per workday 07:00–17:00. Task: capture, complete, edit, delete up to 8 tasks; triage yesterday's leftovers; browse history by period.
Constraints: max 8 tasks/day, Spanish UI, keyboard-first, DESIGN.md palette/Nunito/radii pinned. No projects, tags, sprints.

## Direction contract

THESIS: The day is an eight-segment meter. Refuses the generic checklist-with-a-badge; the ceiling is drawn, not counted.

OWN-WORLD: Night #131313 ground, surface #1C1C1E rows at 20px radius, Nunito 800 numerals. Eight pill segments: mint = done, apricot = pending, hairline outline = free slot. Butter only for "De ayer". Candy-rose for destructive.

STORY: Open → see instantly how full and how done the day is → type and Enter → check off → segment turns mint. Yesterday's leftovers wait folded below, one tap to bring to today.

FIRST VIEWPORT: Top: weekday + date left, big "5/8" right in Nunito 800. Under it, full-width 8-segment meter. Capture field directly under the meter, focused on open (⌘N anywhere). Task rows below. "De ayer (n)" collapsible tray at list end. Bottom segmented control Hoy · Historial.

FORM: Pip meter, position 7 on the ordered list, seed key 89454426. Signature interaction: completing a task fills its segment with a mint sweep and the numerator ticks; at 8/8 the meter glows once.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
