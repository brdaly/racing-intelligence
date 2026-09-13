import { describe, expect, it } from 'vitest';
import { commitGovernedWrite, recordRunFailure } from '@/lib/update-runs';

/**
 * A D1 stand-in that models the property under test: `batch` is atomic, so
 * nothing it queues is visible unless the whole batch commits. Rows are keyed
 * the way `update_runs` is, by run id.
 */
function fakeD1({ failBatch = false, failEverything = false } = {}) {
  const runs = new Map<string, Record<string, unknown>>();
  const domainWrites: string[] = [];

  const apply = (query: string, values: unknown[]) => {
    if (query.startsWith('INSERT INTO update_runs')) {
      const [id, runType, startedAt, status, inputAsOf] = values as string[];
      runs.set(id, { id, runType, startedAt, status, inputAsOf, recordsAccepted: 0, recordsRejected: 0 });
      return;
    }
    if (query.startsWith('UPDATE update_runs')) {
      // A real UPDATE matches nothing when the row was never committed.
      const runId = values[values.length - 1] as string;
      const row = runs.get(runId);
      if (!row) return;
      if (query.includes('records_rejected')) {
        Object.assign(row, { status: values[1], completedAt: values[0], errorSummary: values[2], recordsRejected: 1 });
      } else {
        Object.assign(row, { status: values[1], completedAt: values[0], recordsAccepted: values[2] });
      }
      return;
    }
    domainWrites.push(query);
  };

  const prepare = (query: string) => ({
    query,
    values: [] as unknown[],
    bind(...values: unknown[]) {
      return { ...this, values };
    },
    async run() {
      if (failEverything) throw new Error('database unavailable');
      apply(this.query, this.values);
      return { success: true };
    },
  });

  const db = {
    prepare,
    async batch(statements: ReturnType<typeof prepare>[]) {
      if (failBatch || failEverything) throw new Error('batch rolled back');
      // Only applied because the batch committed.
      for (const statement of statements) apply(statement.query, statement.values);
      return statements.map(() => ({ success: true }));
    },
  };

  return { db: db as unknown as D1Database, runs, domainWrites };
}

function write(db: D1Database, overrides: Record<string, unknown> = {}) {
  return {
    runId: 'run-1',
    runType: 'board_publish' as const,
    startedAt: '2026-09-13T10:00:00Z',
    inputAsOf: '2026-09-13T09:00:00Z',
    statements: [db.prepare('INSERT INTO board_snapshots (id) VALUES (?)').bind('snapshot-1')],
    recordsAccepted: 3,
    errorSummary: 'Database write failed; details withheld.',
    ...overrides,
  };
}

describe('commitGovernedWrite', () => {
  it('records the run before the batch, so a rollback still leaves a failed run', async () => {
    const { db, runs, domainWrites } = fakeD1({ failBatch: true });

    await expect(commitGovernedWrite(db, write(db))).rejects.toThrow();

    // The regression this guards: when the opening row lived inside the batch,
    // the rollback erased it and the failure UPDATE matched nothing.
    const run = runs.get('run-1');
    expect(run).toBeDefined();
    expect(run?.status).toBe('failed');
    expect(run?.recordsRejected).toBe(1);
    expect(run?.errorSummary).toBe('Database write failed; details withheld.');
    expect(domainWrites).toEqual([]);
  });

  it('closes the run as succeeded in the same batch as the domain writes', async () => {
    const { db, runs, domainWrites } = fakeD1();

    await commitGovernedWrite(db, write(db));

    const run = runs.get('run-1');
    expect(run?.status).toBe('succeeded');
    expect(run?.recordsAccepted).toBe(3);
    expect(run?.completedAt).toEqual(expect.any(String));
    expect(domainWrites).toEqual(['INSERT INTO board_snapshots (id) VALUES (?)']);
  });

  it('opens the run with the run type and the validated input freshness stamp', async () => {
    const { db, runs } = fakeD1({ failBatch: true });

    await expect(
      commitGovernedWrite(db, write(db, { runType: 'daily_close', inputAsOf: '2026-09-12T23:00:00Z' })),
    ).rejects.toThrow();

    expect(runs.get('run-1')).toMatchObject({
      runType: 'daily_close',
      inputAsOf: '2026-09-12T23:00:00Z',
      startedAt: '2026-09-13T10:00:00Z',
    });
  });

  it('propagates the original batch failure rather than a bookkeeping error', async () => {
    const { db } = fakeD1({ failBatch: true });
    await expect(commitGovernedWrite(db, write(db))).rejects.toThrow('batch rolled back');
  });
});

describe('recordRunFailure', () => {
  it('reports failure to record rather than throwing over the original error', async () => {
    const { db } = fakeD1({ failEverything: true });
    await expect(recordRunFailure(db, 'run-1', 'summary')).resolves.toBe(false);
  });

  it('reports success once the run row exists', async () => {
    const { db, runs } = fakeD1();
    await db.prepare('INSERT INTO update_runs (id, run_type, started_at, status, input_as_of, records_accepted, records_rejected) VALUES (?, ?, ?, ?, ?, 0, 0)')
      .bind('run-1', 'daily_close', '2026-09-13T10:00:00Z', 'running', '2026-09-13T09:00:00Z')
      .run();

    await expect(recordRunFailure(db, 'run-1', 'summary')).resolves.toBe(true);
    expect(runs.get('run-1')?.status).toBe('failed');
  });
});
