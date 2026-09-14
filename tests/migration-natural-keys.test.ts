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

function duplicatedDatabase() {
  const database = createTestDatabase({ through: '0001' });
  const run = (sql: string, ...values: (string | number | null)[]) =>
    database.sqlite.prepare(sql).run(...values);

  run("INSERT INTO portfolios (id, decision_date, currency, notional_cap_cents, status, created_at) VALUES ('p1', '2026-09-14', 'USD', 10000, 'active', '2026-09-14T08:00:00Z')");

  // Two cards for one meeting and two races for one race: the first publish and
  // the republish that followed it.
  for (const [id] of [['card-first'], ['card-second']]) {
    run("INSERT INTO cards (id, portfolio_id, card_date, region, meeting, status) VALUES (?, 'p1', '2026-09-14', 'IE', 'Leopardstown', 'verified')", id);
  }
  run("INSERT INTO races (id, card_id, post_time, race_name, status, last_observed_at) VALUES ('race-first', 'card-first', '14:05', 'Irish Champion Stakes', 'confirmed', '2026-09-14T08:30:00Z')");
  run("INSERT INTO races (id, card_id, post_time, race_name, status, last_observed_at) VALUES ('race-second', 'card-second', '14:05', 'Irish Champion Stakes', 'confirmed', '2026-09-14T12:00:00Z')");

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
  run("INSERT INTO race_results (id, race_id, horse_name, outcome, finish_position, official_at) VALUES ('result-second', 'race-second', 'Galway Star', 'win', 1, '2026-09-14T15:05:00Z')");
  run("INSERT INTO race_results (id, race_id, horse_name, outcome, finish_position, official_at) VALUES ('result-other', 'race-second', 'Cork Harbour', 'lose', 4, '2026-09-14T14:20:00Z')");

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
