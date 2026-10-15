import type { MigrationInterface, QueryRunner } from 'typeorm'

const SYNC_COLUMNS = `rev TEXT NULL, org_id TEXT NULL, updated_by TEXT NULL`

export class AddAutomations1729600000000 implements MigrationInterface {
  name = 'AddAutomations1729600000000'

  async up(query: QueryRunner): Promise<void> {
    await query.query(`CREATE TABLE IF NOT EXISTS automations (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', draft TEXT NOT NULL,
      version_id TEXT NULL, version_number INTEGER NULL, destructive BOOLEAN NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT NULL, ${SYNC_COLUMNS})`)

    await query.query(`CREATE TABLE IF NOT EXISTS automation_versions (
      id TEXT PRIMARY KEY, automation_id TEXT NOT NULL, number INTEGER NOT NULL, definition TEXT NOT NULL,
      published_at TEXT NOT NULL, published_by TEXT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      ${SYNC_COLUMNS})`)
    await query.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_automation_versions ON automation_versions (automation_id, number)`
    )

    await query.query(`CREATE TABLE IF NOT EXISTS automation_events (
      id TEXT PRIMARY KEY, type TEXT NOT NULL, subject TEXT NOT NULL, payload TEXT NOT NULL DEFAULT '{}',
      cause TEXT NULL, created_at TEXT NOT NULL, processed_at TEXT NULL)`)
    await query.query(
      `CREATE INDEX IF NOT EXISTS idx_aevents_pending ON automation_events (processed_at, created_at)`
    )

    await query.query(`CREATE TABLE IF NOT EXISTS automation_runs (
      id TEXT PRIMARY KEY, automation_id TEXT NOT NULL, version_id TEXT NOT NULL, subject_type TEXT NOT NULL,
      subject_id TEXT NULL, trigger_id TEXT NULL, event TEXT NOT NULL, status TEXT NOT NULL, node_id TEXT NULL,
      next_at TEXT NULL, wait TEXT NULL, attempts INTEGER NOT NULL DEFAULT 0, outputs TEXT NOT NULL DEFAULT '{}',
      depth INTEGER NOT NULL DEFAULT 0, chain TEXT NOT NULL DEFAULT '[]', cause_run_id TEXT NULL,
      late BOOLEAN NOT NULL DEFAULT 0, reason TEXT NULL, origin TEXT NOT NULL DEFAULT 'system',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, finished_at TEXT NULL)`)
    await query.query(
      `CREATE INDEX IF NOT EXISTS idx_aruns_due ON automation_runs (status, next_at)`
    )
    await query.query(
      `CREATE INDEX IF NOT EXISTS idx_aruns_auto ON automation_runs (automation_id, created_at)`
    )
    await query.query(
      `CREATE INDEX IF NOT EXISTS idx_aruns_subject ON automation_runs (subject_type, subject_id, automation_id)`
    )
    await query.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_aruns_open ON automation_runs (automation_id, subject_id)
       WHERE status IN ('active', 'waiting') AND subject_id IS NOT NULL`
    )

    await query.query(`CREATE TABLE IF NOT EXISTS automation_run_steps (
      id TEXT PRIMARY KEY, run_id TEXT NOT NULL, automation_id TEXT NOT NULL, node_id TEXT NOT NULL,
      node_type TEXT NOT NULL, status TEXT NOT NULL, attempt INTEGER NOT NULL DEFAULT 1, message TEXT NULL,
      output TEXT NULL, started_at TEXT NOT NULL, ended_at TEXT NULL)`)
    await query.query(
      `CREATE INDEX IF NOT EXISTS idx_asteps_run ON automation_run_steps (run_id, started_at)`
    )
    await query.query(
      `CREATE INDEX IF NOT EXISTS idx_asteps_node ON automation_run_steps (automation_id, node_id, status)`
    )

    await query.query(`CREATE TABLE IF NOT EXISTS automation_trigger_log (
      id TEXT PRIMARY KEY, automation_id TEXT NOT NULL, trigger_id TEXT NOT NULL, event_id TEXT NOT NULL,
      subject_id TEXT NULL, outcome TEXT NOT NULL, reason TEXT NULL, created_at TEXT NOT NULL)`)
    await query.query(
      `CREATE INDEX IF NOT EXISTS idx_atrigger_log ON automation_trigger_log (automation_id, created_at)`
    )
  }

  async down(query: QueryRunner): Promise<void> {
    for (const table of [
      'automation_trigger_log',
      'automation_run_steps',
      'automation_runs',
      'automation_events',
      'automation_versions',
      'automations'
    ])
      await query.query(`DROP TABLE IF EXISTS ${table}`)
  }
}
