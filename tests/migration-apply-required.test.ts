import { env } from 'cloudflare:workers';
import { afterEach, describe, expect, it } from 'vitest';
import { POST as dailyClose } from '@/app/api/v1/daily-close/route';
import { createTestDatabase, type TestDatabase } from './support/d1';

/**
 * The natural-key controls live only in migration 0002, and nothing in this
 * repository applies migrations.
 *
 * `drizzle/0000` creates `lessons` with `idx_lessons_status_date` only. The
 * three unique indexes — `idx_lessons_date_title`,
 * `idx_cards_portfolio_region_meeting` and `idx_races_card_post_time_name` —
 * exist nowhere but the last three statements of
 * `drizzle/0002_glamorous_swordsman.sql`, and the daily-close upsert names the
 * first of them in an `ON CONFLICT` clause.
 *
 * So a database that stopped at 0001 does not merely lose idempotency: SQLite
 * refuses the statement outright, and the governed close becomes impossible
 * rather than sloppy. This suite pins that, so the dependency is executable
 * instead of a sentence in SECURITY.md.
 */

const TOKEN = 'test-update-token';

function post(body: unknown) {
  return new Request('https://example.com/api/v1/daily-close', {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const lesson = {
  title: 'Stop backing short-priced favourites on soft ground',
  observation: 'Three of four losses came from favourites on soft.',
  evidence: 'Settled tickets for 2026-09-08 through 2026-09-14.',
  action: 'Require a going check before a Tier 1 verdict.',
  status: 'adopted' as const,
};

function close(overrides: Record<string, unknown> = {}) {
  return {
    approved: true,
    date: '2026-09-14',
    dataAsOf: '2026-09-14T22:00:00Z',
    approvedBy: 'brdaly',
    recommendations: 2,
    settled: 2,
    unresolved: 0,
    settledStakeCents: 2000,
    grossReturnCents: 2500,
    profitLossCents: 500,
    wins: 1,
    losses: 1,
    voids: 0,
    fullySettled: true,
    ...overrides,
  };
}

let database: TestDatabase;

function openAt(through?: string) {
  database = createTestDatabase(through ? { through } : {});
  env.DB = database.db;
  env.DASHBOARD_UPDATE_TOKEN = TOKEN;
  return database;
}

afterEach(() => {
  database?.sqlite.close();
});

describe('a database that never ran migration 0002', () => {
  it('does not carry the three unique indexes at 0001', () => {
    const db = openAt('0001');
    const names = db
      .rows<{ name: string }>("SELECT name FROM sqlite_schema WHERE type = 'index'")
      .map((row) => row.name);

    expect(names).not.toContain('idx_lessons_date_title');
    expect(names).not.toContain('idx_cards_portfolio_region_meeting');
    expect(names).not.toContain('idx_races_card_post_time_name');
  });

  it('refuses every daily close that names a lesson, and writes nothing', async () => {
    const db = openAt('0001');

    const response = await dailyClose(post(close({ lessons: [lesson] })));

    // SQLite raises "ON CONFLICT clause does not match any PRIMARY KEY or
    // UNIQUE constraint", the route fails closed, and the atomic batch rolls
    // the performance row back with it.
    expect(response.status).toBe(503);
    expect(db.rows('SELECT date FROM daily_performance WHERE date = ?', '2026-09-14')).toHaveLength(0);

    // It is not transient: the same payload fails the same way on every retry,
    // so an operator cannot close the day at all.
    expect((await dailyClose(post(close({ lessons: [lesson] })))).status).toBe(503);
  });

  it('accepts the same close once 0002 is applied', async () => {
    const db = openAt('0001');
    db.applyMigration('0002_glamorous_swordsman.sql');

    const response = await dailyClose(post(close({ lessons: [lesson] })));

    expect(response.status).toBe(201);
    expect(db.rows('SELECT date FROM daily_performance WHERE date = ?', '2026-09-14')).toHaveLength(1);
  });

  it('still accepts a close with no lessons at 0001, which is why this went unnoticed', async () => {
    const db = openAt('0001');

    expect((await dailyClose(post(close()))).status).toBe(201);
    expect(db.rows('SELECT date FROM daily_performance WHERE date = ?', '2026-09-14')).toHaveLength(1);
  });
});
