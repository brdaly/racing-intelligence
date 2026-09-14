import { describe, expect, it } from 'vitest';
import { createTestDatabase } from './support/d1';

/**
 * Migration 0002 has to run against the database the defect already produced.
 *
 * A unique index cannot be created over rows that already violate it, so the
 * migration collapses the duplicates first. This suite builds a database in
 * exactly that state — the shape a republished board leaves behind — and then
 * applies the migration to it.
 */

const MIGRATION = '0002_glamorous_swordsman.sql';

type Fixture = {
  /** `official_at` on the later row, which is the correction. */
  correctionOfficialAt?: string;
  /** `last_observed_at` on the earlier and the later race row. */
  observations?: [string, string];
  /** Attach a source observation to the result that cannot be repointed. */
  observeResult?: boolean;
  /** Attach a source observation to the later revision of the lesson. */
  observeLesson?: boolean;
};

function duplicatedDatabase({
  correctionOfficialAt = '2026-09-14T15:05:00Z',
  observations = ['2026-09-14T08:30:00Z', '2026-09-14T12:00:00Z'],
  observeResult = false,
  observeLesson = false,
}: Fixture = {}) {
  const database = createTestDatabase({ through: '0001' });
  const run = (sql: string, ...values: (string | number | null)[]) =>
    database.sqlite.prepare(sql).run(...values);

  run("INSERT INTO portfolios (id, decision_date, currency, notional_cap_cents, status, created_at) VALUES ('p1', '2026-09-14', 'USD', 10000, 'active', '2026-09-14T08:00:00Z')");

  // Two cards for one meeting and two races for one race: the first publish and
  // the republish that followed it.
  for (const [id] of [['card-first'], ['card-second']]) {
    run("INSERT INTO cards (id, portfolio_id, card_date, region, meeting, status) VALUES (?, 'p1', '2026-09-14', 'IE', 'Leopardstown', 'verified')", id);
  }
  run("INSERT INTO races (id, card_id, post_time, race_name, status, last_observed_at) VALUES ('race-first', 'card-first', '14:05', 'Irish Champion Stakes', 'confirmed', ?)", observations[0]);
  run("INSERT INTO races (id, card_id, post_time, race_name, status, last_observed_at) VALUES ('race-second', 'card-second', '14:05', 'Irish Champion Stakes', 'confirmed', ?)", observations[1]);

  // One opinion on each fork of the same race.
  for (const [id, raceId, version] of [['op-1', 'race-first', 1], ['op-2', 'race-second', 2]] as const) {
    run(
      "INSERT INTO opinions (id, logical_id, version, race_id, horse_name, tier, confidence, observed_odds, fair_odds, minimum_odds, verdict, why_ranked, biggest_risk, verification_status, created_at) VALUES (?, '2026-09-14:Leopardstown:14:05:Galway Star', ?, ?, 'Galway Star', 'Tier 1', 'High', '5/2', '2/1', '9/4', 'Back it.', 'Sectionals.', 'Ground.', 'verified', '2026-09-14T08:30:00Z')",
      id, version, raceId,
    );
  }

  // A result recorded against each fork for the same horse — the pair that
  // cannot both survive a repoint — plus one that can move across cleanly.
  // The later row is a correction: the first reading had the wrong position.
  run("INSERT INTO race_results (id, race_id, horse_name, outcome, finish_position, official_at) VALUES ('result-first', 'race-first', 'Galway Star', 'lose', 2, '2026-09-14T14:20:00Z')");
  run("INSERT INTO race_results (id, race_id, horse_name, outcome, finish_position, official_at) VALUES ('result-second', 'race-second', 'Galway Star', 'win', 1, ?)", correctionOfficialAt);
  run("INSERT INTO race_results (id, race_id, horse_name, outcome, finish_position, official_at) VALUES ('result-other', 'race-second', 'Cork Harbour', 'lose', 4, '2026-09-14T14:20:00Z')");

  if (observeResult) {
    run("INSERT INTO source_observations (id, entity_type, entity_id, source_name, data_type, reliability_tier, observed_at, verification_status) VALUES ('obs-correction', 'race_result', 'result-second', 'Racing Post', 'result', 'primary', '2026-09-14T15:05:00Z', 'verified')");
    run("INSERT INTO source_observations (id, entity_type, entity_id, source_name, data_type, reliability_tier, observed_at, verification_status) VALUES ('obs-unrelated', 'opinion', 'result-second', 'Racing Post', 'racecard', 'primary', '2026-09-14T08:30:00Z', 'verified')");
  }

  if (observeLesson) {
    run("INSERT INTO source_observations (id, entity_type, entity_id, source_name, data_type, reliability_tier, observed_at, verification_status) VALUES ('obs-lesson', 'lesson', 'lesson-second', 'Daily close', 'lesson', 'primary', '2026-09-14T22:00:00Z', 'verified')");
  }

  // The same lesson approved twice by two closes of the same day.
  for (const [id, observation] of [['lesson-first', 'First reading.'], ['lesson-second', 'Revised reading.']]) {
    run("INSERT INTO lessons (id, lesson_date, title, observation, evidence, action, status, rule_version, approved_at) VALUES (?, '2026-09-14', 'Check the going first', ?, 'Settled tickets.', 'Gate on going.', 'adopted', 'v2', '2026-09-14T22:00:00Z')", id, observation);
  }

  return database;
}

describe('migration 0002', () => {
  it('collapses duplicate meetings and races onto the earliest row', () => {
    const database = duplicatedDatabase();
    expect(database.count('cards')).toBe(2);
    expect(database.count('races')).toBe(2);

    database.applyMigration(MIGRATION);

    expect(database.rows<{ id: string }>('SELECT id FROM cards')).toEqual([{ id: 'card-first' }]);
    expect(database.rows<{ id: string }>('SELECT id FROM races')).toEqual([{ id: 'race-first' }]);
  });

  it('repoints the opinions of the removed race, so no opinion is lost or orphaned', () => {
    const database = duplicatedDatabase();

    database.applyMigration(MIGRATION);

    const opinions = database.rows<{ id: string; race_id: string }>('SELECT id, race_id FROM opinions ORDER BY version');
    expect(opinions).toEqual([
      { id: 'op-1', race_id: 'race-first' },
      { id: 'op-2', race_id: 'race-first' },
    ]);
  });

  it('moves results across, and keeps only one row per horse on the surviving race', () => {
    const database = duplicatedDatabase();

    database.applyMigration(MIGRATION);

    const results = database.rows<{ id: string; race_id: string; horse_name: string }>('SELECT id, race_id, horse_name FROM race_results ORDER BY horse_name');
    expect(results).toEqual([
      { id: 'result-other', race_id: 'race-first', horse_name: 'Cork Harbour' },
      { id: 'result-first', race_id: 'race-first', horse_name: 'Galway Star' },
    ]);
  });

  it('carries a corrected result onto the survivor instead of discarding it', () => {
    const database = duplicatedDatabase();

    database.applyMigration(MIGRATION);

    // The row that could not be repointed held the later official time and the
    // corrected outcome. Deleting it unread would have kept the obsolete
    // reading, which is the one failure a governed store cannot make quietly.
    const [result] = database.rows<{ outcome: string; finish_position: number; official_at: string }>(
      "SELECT outcome, finish_position, official_at FROM race_results WHERE horse_name = 'Galway Star'",
    );
    expect(result).toEqual({ outcome: 'win', finish_position: 1, official_at: '2026-09-14T15:05:00Z' });
  });

  it('leaves an uncontested result exactly as it was', () => {
    const database = duplicatedDatabase();

    database.applyMigration(MIGRATION);

    const [result] = database.rows<{ outcome: string; finish_position: number; official_at: string }>(
      "SELECT outcome, finish_position, official_at FROM race_results WHERE horse_name = 'Cork Harbour'",
    );
    expect(result).toEqual({ outcome: 'lose', finish_position: 4, official_at: '2026-09-14T14:20:00Z' });
  });

  it('carries the newest observation onto the surviving race', () => {
    const database = duplicatedDatabase();

    database.applyMigration(MIGRATION);

    // 12:00 was on the row being deleted. Keeping the survivor's own 08:30 would
    // move freshness backwards, against the publish route's own guarantee.
    const [race] = database.rows<{ last_observed_at: string }>('SELECT last_observed_at FROM races');
    expect(race.last_observed_at).toBe('2026-09-14T12:00:00Z');
  });

  it('keeps the first approval id while applying the latest revision', () => {
    const database = duplicatedDatabase();

    database.applyMigration(MIGRATION);

    // The content is the revision; the id is the one assigned at first approval,
    // which is what the daily-close upsert preserves and what a citation of the
    // lesson resolves against.
    const lessons = database.rows<{ id: string; observation: string }>("SELECT id, observation FROM lessons WHERE lesson_date = '2026-09-14'");
    expect(lessons).toEqual([{ id: 'lesson-first', observation: 'Revised reading.' }]);
  });

  it('leaves the seeded launch history untouched', () => {
    const database = duplicatedDatabase();
    const seeded = "SELECT id FROM lessons WHERE lesson_date < '2026-09-01' ORDER BY id";
    const before = database.rows(seeded);
    expect(before).toHaveLength(5);

    database.applyMigration(MIGRATION);

    expect(database.rows(seeded)).toEqual(before);
  });

  it('refuses a duplicate once the natural keys exist', () => {
    const database = duplicatedDatabase();
    database.applyMigration(MIGRATION);

    expect(() =>
      database.sqlite
        .prepare("INSERT INTO cards (id, portfolio_id, card_date, region, meeting, status) VALUES ('card-third', 'p1', '2026-09-14', 'IE', 'Leopardstown', 'verified')")
        .run(),
    ).toThrow(/UNIQUE/i);
  });
});

describe('migration 0002, on the cases the data itself cannot settle', () => {
  it('chooses the correction by revision order, not by the time it corrects', () => {
    // `official_at` is one of the fields a correction changes, so it cannot say
    // which revision is authoritative: here the correction moves it EARLIER.
    // Ordering by it would keep the erroneous row and delete the fix.
    const database = duplicatedDatabase({ correctionOfficialAt: '2026-09-14T13:00:00Z' });

    database.applyMigration(MIGRATION);

    const [result] = database.rows<{ outcome: string; finish_position: number; official_at: string }>(
      "SELECT outcome, finish_position, official_at FROM race_results WHERE horse_name = 'Galway Star'",
    );
    expect(result).toEqual({ outcome: 'win', finish_position: 1, official_at: '2026-09-14T13:00:00Z' });
  });

  it('refuses to run when a duplicated race mixes timestamp formats', () => {
    // Two formats cannot be ordered against each other in SQL, and whichever
    // rule is chosen loses the newer value in one of the two arrangements. The
    // migration stops instead of guessing.
    const database = duplicatedDatabase({
      observations: ['2026-09-14T12:00:00Z', 'Sep 14, 2026 13:00:00 UTC'],
    });

    expect(() => database.applyMigration(MIGRATION)).toThrow(/a_duplicated_race_has_a_last_observed_at_that_is_not_utc_iso_8601__rewrite_those_values_then_run_this_again/);
  });

  it('refuses before changing anything, so the refusal is recoverable', () => {
    const database = duplicatedDatabase({
      observations: ['Sep 14, 2026 13:00:00 UTC', '2026-09-14T12:00:00Z'],
    });
    const before = database.rows('SELECT id FROM races ORDER BY id');

    expect(() => database.applyMigration(MIGRATION)).toThrow();

    // The mirror arrangement of the case above, and the one an insertion-order
    // fallback got wrong: the survivor holds the newer unreadable value.
    expect(database.rows('SELECT id FROM races ORDER BY id')).toEqual(before);
    expect(database.count('cards')).toBe(2);
    expect(database.rows("SELECT id FROM lessons WHERE lesson_date = '2026-09-14'")).toHaveLength(2);
  });

  it('does not refuse over an unreadable timestamp on a race with no duplicate', () => {
    const database = createTestDatabase({ through: '0001' });
    database.sqlite.prepare("INSERT INTO portfolios (id, decision_date, currency, notional_cap_cents, status, created_at) VALUES ('p2', '2026-09-15', 'USD', 10000, 'active', '2026-09-15T08:00:00Z')").run();
    database.sqlite.prepare("INSERT INTO cards (id, portfolio_id, card_date, region, meeting, status) VALUES ('card-solo', 'p2', '2026-09-15', 'IE', 'Naas', 'verified')").run();
    database.sqlite.prepare("INSERT INTO races (id, card_id, post_time, race_name, status, last_observed_at) VALUES ('race-solo', 'card-solo', '15:10', 'Naas Handicap', 'confirmed', 'Sep 15, 2026 09:00:00 UTC')").run();

    expect(() => database.applyMigration(MIGRATION)).not.toThrow();
    expect(database.rows<{ last_observed_at: string }>('SELECT last_observed_at FROM races')[0].last_observed_at)
      .toBe('Sep 15, 2026 09:00:00 UTC');
  });

  it('still compares instants when both rows are readable', () => {
    const database = duplicatedDatabase({
      observations: ['2026-09-14T12:00:00Z', '2026-09-14T07:00:00Z'],
    });

    database.applyMigration(MIGRATION);

    // The later row carries the older observation, so the earlier row's value
    // is the right one to keep. Insertion order alone would move it backwards.
    const [race] = database.rows<{ last_observed_at: string }>('SELECT last_observed_at FROM races');
    expect(race.last_observed_at).toBe('2026-09-14T12:00:00Z');
  });

  it('repoints a source observation that named the deleted result', () => {
    const database = duplicatedDatabase({ observeResult: true });

    database.applyMigration(MIGRATION);

    // The correction's provenance survived in one direction — the survivor
    // points at the observation — and would have dangled in the other.
    const [observation] = database.rows<{ entity_id: string }>("SELECT entity_id FROM source_observations WHERE id = 'obs-correction'");
    expect(observation.entity_id).toBe('result-first');

    // An observation of a different entity that happens to share the id is not
    // touched: ids are unique within a table, and the index is by type and id.
    const [unrelated] = database.rows<{ entity_id: string }>("SELECT entity_id FROM source_observations WHERE id = 'obs-unrelated'");
    expect(unrelated.entity_id).toBe('result-second');
    expect(database.rows("SELECT id FROM race_results WHERE id = 'result-second'")).toHaveLength(0);
  });
});

describe('migration 0002, guarding its own recovery path', () => {
  it('refuses a timestamp SQLite and JavaScript read as different instants', () => {
    // Both values pass `isTimestamp`. SQLite reads "2026" as Julian day 2026 —
    // four thousand years BC — while `Date.parse` reads it as 2026-01-01, so
    // ordering by the instant would keep the older ISO row and delete the newer
    // one. A value the two engines disagree about is worse than one SQLite
    // simply refuses, because nothing about it looks wrong.
    const database = duplicatedDatabase({ observations: ['2025-12-31T23:00:00Z', '2026'] });

    expect(() => database.applyMigration(MIGRATION)).toThrow(/not_utc_iso_8601/);
  });

  it('accepts the canonical form the publish route writes, with or without milliseconds', () => {
    const database = duplicatedDatabase({
      observations: ['2026-09-14T08:30:00Z', '2026-09-14T12:00:00.000Z'],
    });

    expect(() => database.applyMigration(MIGRATION)).not.toThrow();
    expect(database.rows<{ last_observed_at: string }>('SELECT last_observed_at FROM races')[0].last_observed_at)
      .toBe('2026-09-14T12:00:00.000Z');
  });

  it('can be run again after it refuses', () => {
    // The refusal leaves the guard table behind under a statement-at-a-time
    // executor, which is how this repository and `wrangler d1 execute` both
    // apply a migration file. Without the drop, the operator's second run stops
    // at "table already exists" rather than re-checking the data they fixed.
    const database = duplicatedDatabase({ observations: ['2025-12-31T23:00:00Z', '2026'] });
    expect(() => database.applyMigration(MIGRATION)).toThrow(/not_utc_iso_8601/);

    expect(() => database.applyMigration(MIGRATION)).toThrow(/not_utc_iso_8601/);

    // And once the values are canonical, the rerun the message asks for works.
    database.sqlite.prepare("UPDATE races SET last_observed_at = '2026-01-01T00:00:00.000Z' WHERE id = 'race-second'").run();
    expect(() => database.applyMigration(MIGRATION)).not.toThrow();
    expect(database.rows<{ last_observed_at: string }>('SELECT last_observed_at FROM races')[0].last_observed_at)
      .toBe('2026-01-01T00:00:00.000Z');
  });

  it('repoints an observation that named a deleted lesson revision', () => {
    const database = duplicatedDatabase({ observeLesson: true });

    database.applyMigration(MIGRATION);

    const [observation] = database.rows<{ entity_id: string }>("SELECT entity_id FROM source_observations WHERE id = 'obs-lesson'");
    expect(observation.entity_id).toBe('lesson-first');
  });
});

describe('migration 0002, applied to a database that already ran a version of it', () => {
  it('can be applied again without failing on the indexes it created', () => {
    // A database that took an earlier version of this file has the natural keys
    // already. Re-running cannot bring back rows that version deleted, but it
    // has to be able to run at all, or the way forward is manual surgery.
    const database = duplicatedDatabase();
    database.applyMigration(MIGRATION);

    expect(() => database.applyMigration(MIGRATION)).not.toThrow();

    expect(database.rows<{ id: string }>('SELECT id FROM races')).toEqual([{ id: 'race-first' }]);
    expect(database.rows<{ id: string }>('SELECT id FROM cards')).toEqual([{ id: 'card-first' }]);
    expect(database.rows("SELECT id FROM lessons WHERE lesson_date = '2026-09-14'")).toHaveLength(1);
  });
});
