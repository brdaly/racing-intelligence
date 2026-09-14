-- Natural keys for the three tables a protected write could previously duplicate.
--
-- `cards`, `races` and `lessons` had no unique constraint, so every republish of
-- a board minted a second row for the same meeting and the same race, and every
-- re-close of a day appended a second copy of the same lesson. The indexes at the
-- foot of this migration make that impossible; the statements above them make the
-- indexes creatable on a database that already carries the duplicates.
--
-- Collapsing rule: for `cards` and `races` the earliest row wins, because its id
-- is the one existing children already reference. For `lessons` the latest row
-- wins, because a re-close is a revision of the lesson, not a copy of it.

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

-- Results carry their own natural key of (race, horse), so a repoint can collide
-- with a result already recorded against the surviving race. OR IGNORE leaves
-- those rows where they are; the delete below removes them, and they are exact
-- duplicates of the result that survived.
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

DELETE FROM race_results
WHERE race_id IN (
  SELECT id FROM races
  WHERE rowid NOT IN (SELECT MIN(rowid) FROM races GROUP BY card_id, post_time, race_name)
);--> statement-breakpoint

DELETE FROM races
WHERE rowid NOT IN (SELECT MIN(rowid) FROM races GROUP BY card_id, post_time, race_name);--> statement-breakpoint

-- Keep the most recent revision of each lesson; rowid order is insertion order,
-- and a re-close appends, so the highest rowid is the latest approval.
DELETE FROM lessons
WHERE rowid NOT IN (SELECT MAX(rowid) FROM lessons GROUP BY lesson_date, title);--> statement-breakpoint

CREATE UNIQUE INDEX `idx_cards_portfolio_region_meeting` ON `cards` (`portfolio_id`,`region`,`meeting`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_lessons_date_title` ON `lessons` (`lesson_date`,`title`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_races_card_post_time_name` ON `races` (`card_id`,`post_time`,`race_name`);
