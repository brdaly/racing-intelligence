-- Natural keys for the three tables a protected write could previously duplicate.
--
-- `cards`, `races` and `lessons` had no unique constraint, so every republish of
-- a board minted a second row for the same meeting and the same race, and every
-- re-close of a day appended a second copy of the same lesson. The indexes at the
-- foot of this migration make that impossible; the statements above them make the
-- indexes creatable on a database that already carries the duplicates.
--
-- Collapsing rule: the EARLIEST row survives in all three tables, because its id
-- is the one existing children and citations already reference. Content that only
-- the later rows carry — a corrected result, a newer observation, a revised
-- lesson — is copied onto the survivor before the duplicates are deleted. The
-- order below matters: every carry-across happens while its source row is still
-- there.

-- Repoint every race at the earliest card for its (portfolio, region, meeting).
UPDATE races
SET card_id = (
  SELECT canonical.id
  FROM cards existing
  JOIN cards canonical
    ON canonical.portfolio_id = existing.portfolio_id
   AND canonical.region = existing.region
   AND canonical.meeting = existing.meeting
  WHERE existing.id = races.card_id
  ORDER BY canonical.rowid
  LIMIT 1
)
WHERE EXISTS (SELECT 1 FROM cards existing WHERE existing.id = races.card_id);--> statement-breakpoint

DELETE FROM cards
WHERE rowid NOT IN (SELECT MIN(rowid) FROM cards GROUP BY portfolio_id, region, meeting);--> statement-breakpoint

-- Repoint every opinion at the earliest race for its (card, post time, name).
UPDATE opinions
SET race_id = (
  SELECT canonical.id
  FROM races existing
  JOIN races canonical
    ON canonical.card_id = existing.card_id
   AND canonical.post_time = existing.post_time
   AND canonical.race_name = existing.race_name
  WHERE existing.id = opinions.race_id
  ORDER BY canonical.rowid
  LIMIT 1
)
WHERE EXISTS (SELECT 1 FROM races existing WHERE existing.id = opinions.race_id);--> statement-breakpoint

-- Results carry their own natural key of (race, horse), so a repoint collides
-- with a result already recorded against the surviving race. OR IGNORE leaves
-- those rows where they are.
UPDATE OR IGNORE race_results
SET race_id = (
  SELECT canonical.id
  FROM races existing
  JOIN races canonical
    ON canonical.card_id = existing.card_id
   AND canonical.post_time = existing.post_time
   AND canonical.race_name = existing.race_name
  WHERE existing.id = race_results.race_id
  ORDER BY canonical.rowid
  LIMIT 1
)
WHERE EXISTS (SELECT 1 FROM races existing WHERE existing.id = race_results.race_id);--> statement-breakpoint

-- A result that could not be repointed is not automatically a copy of the one
-- holding its place. The later publication's row can carry a corrected outcome,
-- finish position or official time, and deleting it unread would discard the
-- correction and keep the obsolete record. The authoritative one is carried onto
-- the survivor first, judged by official time: as an instant where SQLite can
-- parse it, by text and then insertion order only as tiebreaks, because these
-- values are constrained to what the publisher sent and nothing more.
--
-- Where a race has no duplicates this selects the row's own values, so it is a
-- no-op rather than a special case.
UPDATE race_results
SET (outcome, finish_position, official_at, source_observation_id) = (
  SELECT newest.outcome, newest.finish_position, newest.official_at, newest.source_observation_id
  FROM race_results newest
  JOIN races duplicate ON duplicate.id = newest.race_id
  JOIN races survivor ON survivor.id = race_results.race_id
  WHERE duplicate.card_id = survivor.card_id
    AND duplicate.post_time = survivor.post_time
    AND duplicate.race_name = survivor.race_name
    AND newest.horse_name = race_results.horse_name
  ORDER BY julianday(newest.official_at) DESC, newest.official_at DESC, newest.rowid DESC
  LIMIT 1
)
WHERE race_id IN (
  SELECT id FROM races
  WHERE rowid IN (SELECT MIN(rowid) FROM races GROUP BY card_id, post_time, race_name)
);--> statement-breakpoint

DELETE FROM race_results
WHERE race_id IN (
  SELECT id FROM races
  WHERE rowid NOT IN (SELECT MIN(rowid) FROM races GROUP BY card_id, post_time, race_name)
);--> statement-breakpoint

-- The surviving race is the earliest row, but the newest observation of that
-- race sits on the last publication that named it. Keeping the earliest value
-- would move race freshness backwards, contradicting the monotonic guarantee the
-- publish route now makes, so the newest is carried across first.
UPDATE races
SET last_observed_at = (
  SELECT best.last_observed_at
  FROM races best
  WHERE best.card_id = races.card_id
    AND best.post_time = races.post_time
    AND best.race_name = races.race_name
    AND best.last_observed_at IS NOT NULL
  ORDER BY julianday(best.last_observed_at) DESC, best.last_observed_at DESC
  LIMIT 1
)
WHERE rowid IN (SELECT MIN(rowid) FROM races GROUP BY card_id, post_time, race_name)
  AND EXISTS (
    SELECT 1 FROM races other
    WHERE other.card_id = races.card_id
      AND other.post_time = races.post_time
      AND other.race_name = races.race_name
      AND other.last_observed_at IS NOT NULL
  );--> statement-breakpoint

DELETE FROM races
WHERE rowid NOT IN (SELECT MIN(rowid) FROM races GROUP BY card_id, post_time, race_name);--> statement-breakpoint

-- Lessons collapse onto the earliest row as well, so the id assigned at first
-- approval survives. That is what the daily-close upsert does, and what anything
-- already citing a lesson depends on. The latest revision's content is copied
-- onto it first, because a re-close revises the lesson rather than restating it.
UPDATE lessons
SET (observation, evidence, action, status, rule_version, source_ref, approved_at) = (
  SELECT latest.observation, latest.evidence, latest.action, latest.status,
         latest.rule_version, latest.source_ref, latest.approved_at
  FROM lessons latest
  WHERE latest.lesson_date = lessons.lesson_date
    AND latest.title = lessons.title
  ORDER BY latest.rowid DESC
  LIMIT 1
)
WHERE rowid IN (SELECT MIN(rowid) FROM lessons GROUP BY lesson_date, title);--> statement-breakpoint

DELETE FROM lessons
WHERE rowid NOT IN (SELECT MIN(rowid) FROM lessons GROUP BY lesson_date, title);--> statement-breakpoint

CREATE UNIQUE INDEX `idx_cards_portfolio_region_meeting` ON `cards` (`portfolio_id`,`region`,`meeting`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_lessons_date_title` ON `lessons` (`lesson_date`,`title`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_races_card_post_time_name` ON `races` (`card_id`,`post_time`,`race_name`);
