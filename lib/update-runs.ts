/**
 * Audit-trail helpers for the two protected write paths.
 *
 * The `update_runs` table is the only record that a publish or daily-close was
 * ever attempted. It has to survive the failure it is meant to describe, which
 * means the row that opens a run cannot live inside the same atomic `D1.batch`
 * as the domain writes: D1 rolls the whole batch back, so an opening row
 * written there disappears along with the work, and the "mark this run failed"
 * UPDATE afterwards then matches nothing.
 *
 * `commitGovernedWrite` enforces the ordering: open the run on its own, apply
 * the domain writes and the success close atomically, and record the failure
 * against the already-committed row if the batch rolls back.
 */

export type RunType = 'board_publish' | 'daily_close';

const OPEN_RUN =
  'INSERT INTO update_runs (id, run_type, started_at, status, input_as_of, records_accepted, records_rejected) VALUES (?, ?, ?, ?, ?, 0, 0)';
const CLOSE_RUN_SUCCEEDED =
  'UPDATE update_runs SET completed_at = ?, status = ?, records_accepted = ? WHERE id = ?';
const CLOSE_RUN_FAILED =
  'UPDATE update_runs SET completed_at = ?, status = ?, records_rejected = 1, error_summary = ? WHERE id = ?';

export type GovernedWrite = {
  runId: string;
  runType: RunType;
  /** Timestamp the run opened at, also used as the write timestamp by callers. */
  startedAt: string;
  /** Freshness stamp of the input the caller validated. */
  inputAsOf: string;
  /** Domain writes, applied atomically with the success close. */
  statements: D1PreparedStatement[];
  /** Records the run accepted, written onto the run when it succeeds. */
  recordsAccepted: number;
  /** Summary stored when the batch rolls back. Must not leak database detail. */
  errorSummary: string;
};

/**
 * Opens the run, applies the domain writes atomically, and closes the run.
 *
 * Resolves once the batch has committed. Rejects if any step fails, having
 * first recorded the failure against the run row where that was possible.
 */
export async function commitGovernedWrite(db: D1Database, write: GovernedWrite): Promise<void> {
  // Outside the batch on purpose: a rolled-back batch must not erase the run.
  await db
    .prepare(OPEN_RUN)
    .bind(write.runId, write.runType, write.startedAt, 'running', write.inputAsOf)
    .run();

  try {
    await db.batch([
      ...write.statements,
      db
        .prepare(CLOSE_RUN_SUCCEEDED)
        .bind(new Date().toISOString(), 'succeeded', write.recordsAccepted, write.runId),
    ]);
  } catch (error) {
    await recordRunFailure(db, write.runId, write.errorSummary);
    throw error;
  }
}

/**
 * Closes a run as failed. Never throws: losing the audit row must not replace
 * the original failure with a different one.
 *
 * @returns whether the failure was recorded.
 */
export async function recordRunFailure(
  db: D1Database,
  runId: string,
  errorSummary: string,
): Promise<boolean> {
  try {
    await db
      .prepare(CLOSE_RUN_FAILED)
      .bind(new Date().toISOString(), 'failed', errorSummary, runId)
      .run();
    return true;
  } catch {
    // The database may not be initialized yet; there is nowhere to record this.
    return false;
  }
}
