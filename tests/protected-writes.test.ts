import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { POST as dailyClose } from '@/app/api/v1/daily-close/route';
import { POST as publish } from '@/app/api/v1/publish/route';
import { createTestDatabase, type TestDatabase } from './support/d1';

/**
 * The two protected write paths, driven end to end against real SQLite.
 *
 * The property under test is that repeating a governed write revises what is
 * stored rather than adding a second copy of it. Republishing a board is
 * ordinary practice — a price moves, a runner is withdrawn — and before this
 * suite each republication minted a fresh `cards` and `races` row for the same
 * physical meeting and race, so the history of a race silently forked in two.
 */

const TOKEN = 'test-update-token';
const LESSONS_ON_THE_DAY = 'SELECT id, observation, status FROM lessons WHERE lesson_date = ?';

type Entry = Record<string, unknown>;

function entry(overrides: Entry = {}): Entry {
  return {
    rank: 1,
    horse: 'Galway Star',
    region: 'IE',
    track: 'Leopardstown',
    raceTime: '14:05',
    raceName: 'Irish Champion Stakes',
    tier: 'Tier 1',
    confidence: 'High',
    observedOdds: '5/2',
    fairOdds: '2/1',
    minimumOdds: '9/4',
    verdict: 'Back at 5/2 or better.',
    whyRanked: 'Strongest closing sectionals in the field.',
    biggestRisk: 'Soft ground would blunt the turn of foot.',
    priceVerifiedAt: '2026-09-14T09:00:00Z',
    actionable: true,
    source: {
      name: 'Racing Post',
      url: 'https://www.racingpost.com/racecards/2026-09-14',
      dataType: 'racecard',
      reliabilityTier: 'primary',
      observedAt: '2026-09-14T08:30:00Z',
      verificationStatus: 'verified',
    },
    ...overrides,
  };
}

function board(overrides: Record<string, unknown> = {}) {
  return {
    approved: true,
    boardDate: '2026-09-14',
    dataAsOf: '2026-09-14T08:30:00Z',
    approvedBy: 'brdaly',
    changeSummary: 'Board published.',
    conflictCount: 0,
    entries: [entry()],
    ...overrides,
  };
}

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

function post(path: string, body: unknown, { token = TOKEN }: { token?: string } = {}) {
  return new Request(`https://example.com/api/v1/${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

let database: TestDatabase;

beforeEach(() => {
  database = createTestDatabase();
  env.DB = database.db;
  env.DASHBOARD_UPDATE_TOKEN = TOKEN;
});

describe('POST /api/v1/publish', () => {
  it('publishes a board', async () => {
    const response = await publish(post('publish', board()));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ board_version: 1, records_accepted: 1 });
    expect(database.count('cards')).toBe(1);
    expect(database.count('races')).toBe(1);
  });

  it('rejects an unauthenticated caller before touching the database', async () => {
    const response = await publish(post('publish', board(), { token: 'wrong' }));

    expect(response.status).toBe(401);
    expect(database.count('board_snapshots')).toBe(0);
    // The seeded history carries one import run, and no publish run joins it.
    expect(database.rows('SELECT id FROM update_runs WHERE run_type = ?', 'board_publish')).toHaveLength(0);
  });

  it('reuses the meeting and the race when the same board is published again', async () => {
    await publish(post('publish', board()));
    const second = await publish(post('publish', board({ changeSummary: 'Price moved.' })));

    expect(second.status).toBe(201);
    await expect(second.json()).resolves.toMatchObject({ board_version: 2 });

    // The regression: a second publication used to insert a second card and a
    // second race for the same meeting and the same race.
    expect(database.count('cards')).toBe(1);
    expect(database.count('races')).toBe(1);
    expect(database.count('portfolios')).toBe(1);

    // Versioning is deliberate and stays: two snapshots, two opinions, one
    // published board.
    expect(database.count('board_snapshots')).toBe(2);
    expect(database.count('opinions')).toBe(2);
    expect(database.rows('SELECT id FROM board_snapshots WHERE status = ?', 'published')).toHaveLength(1);
  });

  it('keeps both versions of an opinion on one race row, so the history of a race stays whole', async () => {
    await publish(post('publish', board()));
    await publish(post('publish', board({ changeSummary: 'Price moved.' })));

    const raceIds = database.rows<{ race_id: string }>('SELECT DISTINCT race_id FROM opinions');
    expect(raceIds).toHaveLength(1);

    const versions = database.rows<{ version: number; logical_id: string }>(
      'SELECT version, logical_id FROM opinions ORDER BY version',
    );
    expect(versions.map((row) => row.version)).toEqual([1, 2]);
    expect(new Set(versions.map((row) => row.logical_id)).size).toBe(1);
  });

  it('separates meetings, races and board dates that are genuinely different', async () => {
    await publish(post('publish', board({
      entries: [
        entry(),
        entry({ rank: 2, horse: 'Cork Harbour', track: 'Curragh' }),
        entry({ rank: 3, horse: 'Shandon Bell', raceTime: '15:20', raceName: 'Matron Stakes' }),
      ],
    })));
    await publish(post('publish', board({ boardDate: '2026-09-15' })));

    expect(database.count('cards')).toBe(3); // Leopardstown and Curragh on the 14th, Leopardstown on the 15th
    expect(database.count('races')).toBe(4);
    expect(database.count('portfolios')).toBe(2);
  });

  it('moves the last observation of a reused race forward, and never backwards', async () => {
    await publish(post('publish', board()));

    await publish(post('publish', board({
      entries: [entry({ source: { ...(entry().source as object), observedAt: '2026-09-14T12:00:00Z' } })],
    })));
    expect(database.rows<{ last_observed_at: string }>('SELECT last_observed_at FROM races')[0].last_observed_at)
      .toBe('2026-09-14T12:00:00.000Z');

    await publish(post('publish', board({
      entries: [entry({ source: { ...(entry().source as object), observedAt: '2026-09-14T07:00:00Z' } })],
    })));
    expect(database.rows<{ last_observed_at: string }>('SELECT last_observed_at FROM races')[0].last_observed_at)
      .toBe('2026-09-14T12:00:00.000Z');
  });

  it('takes the newest observation in the payload, not the one ranked first', async () => {
    await publish(post('publish', board({
      entries: [
        entry({ rank: 1, source: { ...(entry().source as object), observedAt: '2026-09-14T08:30:00Z' } }),
        entry({ rank: 2, horse: 'Cork Harbour', source: { ...(entry().source as object), observedAt: '2026-09-14T12:00:00Z' } }),
      ],
    })));

    expect(database.rows<{ last_observed_at: string }>('SELECT last_observed_at FROM races')[0].last_observed_at)
      .toBe('2026-09-14T12:00:00.000Z');
  });

  it('compares observations as instants rather than as strings', async () => {
    await publish(post('publish', board({
      entries: [entry({ source: { ...(entry().source as object), observedAt: '2026-09-14T12:00:00Z' } })],
    })));

    // Sorts after the stored value as text, but is four hours earlier. The
    // timestamp format is only constrained to what `Date.parse` accepts, so a
    // string comparison here would move the record backwards.
    await publish(post('publish', board({
      entries: [entry({ source: { ...(entry().source as object), observedAt: 'Sep 14, 2026 08:00:00 UTC' } })],
    })));

    expect(database.rows<{ last_observed_at: string }>('SELECT last_observed_at FROM races')[0].last_observed_at)
      .toBe('2026-09-14T12:00:00.000Z');
  });

  it('fails closed when another publication creates the same meeting between the read and the write', async () => {
    // The natural key turns a concurrent republish from a silent duplication
    // into a refusal. What matters is that the refusal is clean: nothing of the
    // board is written, and the attempt is still on the audit trail.
    const underlying = database.db;
    let raced = false;
    env.DB = {
      ...underlying,
      prepare: (sql: string) => {
        const statement = underlying.prepare(sql);
        if (!sql.includes('FROM cards WHERE portfolio_id')) return statement;
        return {
          ...statement,
          bind: (...values: unknown[]) => {
            const bound = statement.bind(...values);
            return {
              ...bound,
              async all() {
                const result = await bound.all();
                if (!raced) {
                  raced = true;
                  database.sqlite
                    .prepare("INSERT INTO portfolios (id, decision_date, currency, notional_cap_cents, status, created_at) VALUES ('portfolio:2026-09-14', '2026-09-14', 'USD', 10000, 'active', '2026-09-14T08:00:00Z')")
                    .run();
                  database.sqlite
                    .prepare("INSERT INTO cards (id, portfolio_id, card_date, region, meeting, status) VALUES ('card-elsewhere', 'portfolio:2026-09-14', '2026-09-14', 'IE', 'Leopardstown', 'verified')")
                    .run();
                }
                return result;
              },
            };
          },
        } as unknown as D1PreparedStatement;
      },
    } as unknown as D1Database;

    const response = await publish(post('publish', board()));

    expect(response.status).toBe(503);
    expect(database.count('board_snapshots')).toBe(0);
    expect(database.count('opinions')).toBe(0);
    expect(database.rows('SELECT id FROM cards')).toEqual([{ id: 'card-elsewhere' }]);

    // The run that failed is still recorded, which is the point of opening it
    // outside the batch.
    const runs = database.rows<{ status: string; records_rejected: number }>(
      'SELECT status, records_rejected FROM update_runs WHERE run_type = ?', 'board_publish',
    );
    expect(runs).toEqual([{ status: 'failed', records_rejected: 1 }]);
  });

  it('does not confuse two meetings whose region and track share a delimiter', async () => {
    // `isShortText` permits "|", so joined lookup keys would read
    // ("UK|Flat", "Ascot") and ("UK", "Flat|Ascot") as one meeting: the second
    // would reuse the first one's card and hang its race off the wrong track.
    await publish(post('publish', board({
      entries: [
        entry({ rank: 1, region: 'UK|Flat', track: 'Ascot' }),
        entry({ rank: 2, horse: 'Cork Harbour', region: 'UK', track: 'Flat|Ascot' }),
      ],
    })));

    const cards = database.rows<{ region: string; meeting: string }>('SELECT region, meeting FROM cards ORDER BY region');
    expect(cards).toEqual([
      { region: 'UK', meeting: 'Flat|Ascot' },
      { region: 'UK|Flat', meeting: 'Ascot' },
    ]);
    expect(database.count('races')).toBe(2);
  });

  it('stores the observation canonically, whatever format the publisher sent', async () => {
    await publish(post('publish', board({
      entries: [entry({ source: { ...(entry().source as object), observedAt: 'Sep 14, 2026 08:30:00 UTC' } })],
    })));

    // Anything `Date.parse` accepts is publishable, and a value SQLite cannot
    // read is a value no query — or migration — can order against another.
    expect(database.rows<{ last_observed_at: string }>('SELECT last_observed_at FROM races')[0].last_observed_at)
      .toBe('2026-09-14T08:30:00.000Z');
  });

  it('rejects a payload that publishes the same opinion twice rather than failing closed on it', async () => {
    const response = await publish(post('publish', board({
      entries: [entry(), entry({ rank: 2 })],
    })));

    // Two entries for one horse in one race collide on the (logical_id, version)
    // key. That is a malformed board, so it is a 422 and not a 503.
    expect(response.status).toBe(422);
    expect(database.count('board_snapshots')).toBe(0);
  });
});

describe('POST /api/v1/daily-close', () => {
  // Migration 0001 seeds the launch history, so assertions name the day under
  // test rather than counting the whole table.
  const lesson = {
    title: 'Stop backing short-priced favourites on soft ground',
    observation: 'Three of four losses came from favourites on soft.',
    evidence: 'Settled tickets for 2026-09-08 through 2026-09-14.',
    action: 'Require a going check before a Tier 1 verdict.',
    status: 'adopted' as const,
  };

  it('revises a lesson when the day is closed again, rather than appending a copy', async () => {
    await dailyClose(post('daily-close', close({ lessons: [lesson] })));
    const [first] = database.rows<{ id: string; observation: string }>(LESSONS_ON_THE_DAY, '2026-09-14');

    await dailyClose(post('daily-close', close({
      lessons: [{ ...lesson, observation: 'Four of five losses came from favourites on soft.', status: 'watchlist' }],
    })));

    // The regression: re-closing a day used to append a second copy of every
    // lesson, and the lessons endpoint serves them all.
    const stored = database.rows<{ id: string; observation: string; status: string }>(LESSONS_ON_THE_DAY, '2026-09-14');
    expect(stored).toHaveLength(1);
    expect(stored[0].observation).toBe('Four of five losses came from favourites on soft.');
    expect(stored[0].status).toBe('watchlist');
    // The id survives, so anything already citing the lesson still resolves.
    expect(stored[0].id).toBe(first.id);
  });

  it('keeps the daily performance row single and current across a re-close', async () => {
    await dailyClose(post('daily-close', close()));
    await dailyClose(post('daily-close', close({ grossReturnCents: 3000, profitLossCents: 1000 })));

    const performance = database.rows<{ gross_return_cents: number }>('SELECT gross_return_cents FROM daily_performance WHERE date = ?', '2026-09-14');
    expect(performance).toHaveLength(1);
    expect(performance[0].gross_return_cents).toBe(3000);
  });

  it('stores a lesson of the same title drawn from a different day separately', async () => {
    await dailyClose(post('daily-close', close({ lessons: [lesson] })));
    await dailyClose(post('daily-close', close({ date: '2026-09-15', lessons: [lesson] })));

    expect(database.rows('SELECT id FROM lessons WHERE title = ?', lesson.title)).toHaveLength(2);
  });

  it('rejects a close that names the same lesson twice', async () => {
    const response = await dailyClose(post('daily-close', close({
      lessons: [lesson, { ...lesson, action: 'Something else entirely.' }],
    })));

    expect(response.status).toBe(422);
    expect(database.rows('SELECT id FROM lessons WHERE lesson_date = ?', '2026-09-14')).toHaveLength(0);
  });
});
