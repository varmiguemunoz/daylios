# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(Electron desktop app for macOS; renderer is web. Lives in the macOS menubar.)

## Stack

Electron + electron-vite + React + TypeScript, Tailwind CSS, local SQLite. A small local MCP server exposes the day's state to Claude Desktop. Decided by the user.

## Users

One person: the owner, using it personally on macOS during a 7:00–17:00 workday. The job is to decide and finish up to eight complex tasks per day, with as little friction as possible between thought and captured task.

## Product Purpose

A daily task tool that shows only today. It exists to keep the day bounded (max 8 tasks), make progress visible (e.g. 5/8), and surface yesterday's unfinished work first thing. Success: the owner actually opens it every day because it is fast and pleasant, and Claude can read the real state of the day without being told.

## Positioning

A single-day ledger with a hard ceiling of eight, designed to be read by an AI assistant as much as by its owner. Not a project manager.

## Operating Context

- Opened from a menubar icon; a small window drops down. Used many times a day in short bursts.
- 07:00: Claude Desktop (scheduled task, configured by the owner, outside this project) reads the day via local files/MCP and prompts the owner if there are fewer than 8 tasks.
- During the day: the owner adds, completes, edits, and deletes tasks in the app only.
- End of day: Claude reads completed vs pending and carries incomplete tasks to the next day.

## Capabilities and Constraints

- Today view is primary; a zone for yesterday's incomplete tasks appears at the start.
- History screen: all tasks, paginated, filterable by period.
- Task detail: click a task to edit its title (inline markdown) and a markdown description.
- Notes: a third tab listing markdown notes by day (same skeleton as History), with a full-screen editor (Write / View).
- Add / complete / edit / delete must be very fast (keyboard-first).
- Visible day counter against the ceiling of 8.
- Local SQLite storage; files/MCP server readable by Claude.
- Consultora window (separate, 1100×760): clients with document folders, projects (objective, deliverables, notes), meetings (screen + mic + system audio recording, OpenAI transcription and structured summary), and a sales pipeline with configurable stages. Its purpose is giving Claude real, current context of Ali Muñoz Advisory via MCP.
- Explicitly out of scope: sprints, complex tags, task views beyond Today, History and Notes; note search, folders or tags; Zoom/Meet/Teams, email, invoicing or multi-user integrations.
- UI language: Spanish (inferred from the owner's brief; confirm).

## Brand Commitments

- Name: DayliOS.
- The owner pinned DESIGN.md: pastel accents on near-black night, Nunito, generous radii. Reference feel: Things 3, Linear, Apple Notes. "If it doesn't look good, I won't use it."
- Note: DESIGN.md's description and `cat-*` colors come from an expense-tracking app; the palette is binding, the expense semantics are not.

## Evidence on Hand

No real task data yet. Demonstration tasks must be labeled as sample data.

## Product Principles

1. Today only. Everything else is secondary and one step away.
2. Eight is the ceiling, and the ceiling is the motivation.
3. Zero-friction capture: typing a task should never take more than one keystroke to start.
4. The state is legible to a machine: what the owner sees, Claude can read.
5. Calm by default, rewarding at completion.
