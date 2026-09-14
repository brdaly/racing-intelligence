import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

/**
 * A D1 stand-in backed by real SQLite, running the repository's own migrations.
 *
 * The properties under test here are database properties — unique keys, upsert
 * conflict targets, and the atomicity `commitGovernedWrite` depends on — so a
 * hand-written fake that records statements cannot demonstrate them. Foreign
 * keys are enforced, which is stricter than D1's default and deliberately so: a
 * write that leaves a child pointing at a row that is not there should fail in
 * the test even where production would quietly accept it.
 */

const MIGRATIONS = fileURLToPath(new URL('../../drizzle', import.meta.url));

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

/** node:sqlite binds a narrower set of types than D1 accepts from callers. */
function bindable(values: unknown[]) {
  return values.map((value) => {
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (value === undefined) return null;
    return value;
  }) as (null | number | bigint | string | Uint8Array)[];
}

export type TestDatabase = {
  db: D1Database;
  sqlite: DatabaseSync;
  /** Rows in a table, optionally filtered, as a convenience for assertions. */
  rows: <T = Record<string, unknown>>(sql: string, ...values: unknown[]) => T[];
  count: (table: string) => number;
  applyMigration: (name: string) => void;
};

export function createTestDatabase({ through }: { through?: string } = {}): TestDatabase {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');

  const applyMigration = (name: string) => {
    const sql = readFileSync(path.join(MIGRATIONS, name), 'utf8');
    for (const statement of sql.split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed) sqlite.exec(trimmed);
    }
  };

  for (const name of migrationFiles()) {
    applyMigration(name);
    if (through && name.startsWith(through)) break;
  }

  const run = (sql: string, values: unknown[]) => sqlite.prepare(sql).run(...bindable(values));

  const statement = (sql: string, values: unknown[]) => ({
    sql,
    values,
    bind: (...next: unknown[]) => statement(sql, next),
    async run() {
      run(sql, values);
      return { success: true };
    },
    async first<T>() {
      return (sqlite.prepare(sql).get(...bindable(values)) ?? null) as T | null;
    },
    async all<T>() {
      return { results: sqlite.prepare(sql).all(...bindable(values)) as T[], success: true };
    },
  });

  const db = {
    prepare: (sql: string) => statement(sql, []),
    async batch(statements: ReturnType<typeof statement>[]) {
      // D1 applies a batch atomically, so the test harness must too: a failure
      // part-way through has to leave the database as it was.
      sqlite.exec('BEGIN');
      try {
        for (const item of statements) run(item.sql, item.values);
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
      return statements.map(() => ({ success: true }));
    },
  };

  return {
    db: db as unknown as D1Database,
    sqlite,
    rows: <T = Record<string, unknown>>(sql: string, ...values: unknown[]) =>
      sqlite.prepare(sql).all(...bindable(values)) as T[],
    count: (table: string) =>
      Number((sqlite.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get() as { total: number }).total),
    applyMigration,
  };
}
