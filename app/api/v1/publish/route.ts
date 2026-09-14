import { env } from 'cloudflare:workers';
import { validatePublishPayload } from '@/lib/publication-validation';
import { isAuthorized, jsonError } from '@/lib/server-auth';
import { commitGovernedWrite } from '@/lib/update-runs';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) return jsonError('Update authorization failed.', 401);
  let payload: unknown;
  try { payload = await request.json(); } catch { return jsonError('Request body must be valid JSON.', 400); }
  if (!validatePublishPayload(payload)) return jsonError('Board payload failed validation.', 422);

  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  try {
    const versionRow = await env.DB.prepare('SELECT COALESCE(MAX(version), 0) AS version FROM board_snapshots WHERE board_date = ?').bind(payload.boardDate).first<{ version: number }>();
    const version = Number(versionRow?.version ?? 0) + 1;
    const portfolioId = `portfolio:${payload.boardDate}`;
    const snapshotId = crypto.randomUUID();
    const statements: D1PreparedStatement[] = [
      env.DB.prepare('INSERT OR IGNORE INTO portfolios (id, decision_date, currency, notional_cap_cents, status, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(portfolioId, payload.boardDate, 'USD', payload.notionalCapCents ?? 10000, 'active', startedAt),
      env.DB.prepare("UPDATE board_snapshots SET status = 'superseded' WHERE board_date = ? AND status = 'published'").bind(payload.boardDate),
      env.DB.prepare('INSERT INTO board_snapshots (id, portfolio_id, board_date, version, status, verification_status, data_as_of, published_at, conflict_count, approved_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(snapshotId, portfolioId, payload.boardDate, version, 'published', payload.conflictCount ? 'published_with_disclosed_conflict' : 'verified', payload.dataAsOf, startedAt, payload.conflictCount, payload.approvedBy),
    ];

    // Republishing a board must reuse the meeting and race rows the earlier
    // publication created. Their ids are the identity that results and prior
    // opinions hang off, so a second row for the same race forks the history of
    // that race in two without either half being wrong on its face.
    // Keys are JSON tuples rather than joined strings. `isShortText` permits
    // "|" in a region or a meeting, so "UK|Flat" + "Ascot" and "UK" +
    // "Flat|Ascot" would otherwise collapse to one key, and the second meeting
    // would reuse the first one's card and hang its races off the wrong track.
    const keyOf = (...parts: string[]) => JSON.stringify(parts);

    const cardIds = new Map<string, string>();
    const raceIds = new Map<string, string>();
    const cardKeysById = new Map<string, string>();
    const storedObservations = new Map<string, string | null>();

    const existingCards = await env.DB.prepare('SELECT id, region, meeting FROM cards WHERE portfolio_id = ?')
      .bind(portfolioId)
      .all<{ id: string; region: string; meeting: string }>();
    for (const card of existingCards.results) {
      const cardKey = keyOf(card.region, card.meeting);
      cardIds.set(cardKey, card.id);
      cardKeysById.set(card.id, cardKey);
    }

    const existingRaces = await env.DB.prepare(`
      SELECT r.id, r.card_id, r.post_time, r.race_name, r.last_observed_at
      FROM races r
      JOIN cards c ON c.id = r.card_id
      WHERE c.portfolio_id = ?
    `)
      .bind(portfolioId)
      .all<{ id: string; card_id: string; post_time: string; race_name: string; last_observed_at: string | null }>();
    for (const race of existingRaces.results) {
      const cardKey = cardKeysById.get(race.card_id);
      if (cardKey) raceIds.set(keyOf(cardKey, race.post_time, race.race_name), race.id);
      storedObservations.set(race.id, race.last_observed_at);
    }

    const sortedEntries = [...payload.entries].sort((a, b) => a.rank - b.rank);

    // `last_observed_at` records the latest observation of a race, so it is
    // taken from the newest entry for that race rather than from whichever one
    // happens to be ranked first. Compared as instants: `isTimestamp` accepts
    // any format `Date.parse` understands, so two of them need not sort the
    // same way as strings.
    const latestObservation = new Map<string, string>();
    for (const entry of sortedEntries) {
      const raceKey = keyOf(keyOf(entry.region, entry.track), entry.raceTime, entry.raceName);
      const seen = latestObservation.get(raceKey);
      if (!seen || Date.parse(entry.source.observedAt) > Date.parse(seen)) {
        latestObservation.set(raceKey, entry.source.observedAt);
      }
    }

    for (const entry of sortedEntries) {
      const cardKey = keyOf(entry.region, entry.track);
      let cardId = cardIds.get(cardKey);
      if (!cardId) {
        cardId = crypto.randomUUID();
        cardIds.set(cardKey, cardId);
        statements.push(env.DB.prepare('INSERT INTO cards (id, portfolio_id, card_date, region, meeting, status) VALUES (?, ?, ?, ?, ?, ?)').bind(cardId, portfolioId, payload.boardDate, entry.region, entry.track, 'verified'));
      }
      const raceKey = keyOf(cardKey, entry.raceTime, entry.raceName);
      const observedAt = latestObservation.get(raceKey) ?? entry.source.observedAt;
      let raceId = raceIds.get(raceKey);
      if (!raceId) {
        raceId = crypto.randomUUID();
        raceIds.set(raceKey, raceId);
        statements.push(env.DB.prepare('INSERT INTO races (id, card_id, post_time, race_name, status, last_observed_at) VALUES (?, ?, ?, ?, ?, ?)').bind(raceId, cardId, entry.raceTime, entry.raceName, 'confirmed', observedAt));
      } else if (storedObservations.has(raceId)) {
        // Reusing the row means the column has to keep meaning what it says:
        // the latest observation of this race, never an older one.
        const stored = storedObservations.get(raceId) ?? null;
        storedObservations.delete(raceId);
        if (stored === null || !(Date.parse(stored) >= Date.parse(observedAt))) {
          statements.push(env.DB.prepare('UPDATE races SET last_observed_at = ? WHERE id = ?').bind(observedAt, raceId));
        }
      }
      const logicalId = `${payload.boardDate}:${entry.track}:${entry.raceTime}:${entry.horse}`;
      const opinionId = crypto.randomUUID();
      const contextId = crypto.randomUUID();
      const sourceId = crypto.randomUUID();
      statements.push(
        env.DB.prepare('INSERT INTO opinions (id, logical_id, version, race_id, horse_name, tier, confidence, observed_odds, fair_odds, minimum_odds, verdict, why_ranked, biggest_risk, verification_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(opinionId, logicalId, version, raceId, entry.horse, entry.tier, entry.confidence, entry.observedOdds, entry.fairOdds, entry.minimumOdds, entry.verdict, entry.whyRanked, entry.biggestRisk, 'verified', startedAt),
        env.DB.prepare('INSERT INTO decision_contexts (id, opinion_id, bet_context, stage, colour, operating_state, eligibility, price_verified_at, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(contextId, opinionId, 'win_single', 'B', entry.tier === 'Tier 1' ? 'Green' : 'Amber', entry.actionable ? 'BETTABLE' : 'PUBLISHED_NON_ACTIONABLE', entry.actionable ? 'eligible' : 'ineligible', entry.priceVerifiedAt, entry.actionable ? 'Publication gates passed.' : 'Published for evidence, not action.'),
        env.DB.prepare('INSERT INTO source_observations (id, entity_type, entity_id, source_name, source_url, data_type, reliability_tier, observed_at, verification_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(sourceId, 'opinion', opinionId, entry.source.name, entry.source.url ?? null, entry.source.dataType, entry.source.reliabilityTier, entry.source.observedAt, entry.source.verificationStatus),
        env.DB.prepare('INSERT INTO board_members (id, snapshot_id, opinion_id, rank, member_status) VALUES (?, ?, ?, ?, ?)').bind(crypto.randomUUID(), snapshotId, opinionId, entry.rank, 'published'),
      );
    }
    statements.push(
      env.DB.prepare('INSERT INTO publication_events (id, snapshot_id, event_type, event_at, actor, previous_version, change_summary) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), snapshotId, 'publish', startedAt, payload.approvedBy, version > 1 ? version - 1 : null, payload.changeSummary),
    );
    await commitGovernedWrite(env.DB, {
      runId,
      runType: 'board_publish',
      startedAt,
      inputAsOf: payload.dataAsOf,
      statements,
      recordsAccepted: payload.entries.length,
      errorSummary: 'Database write failed; details withheld.',
    });
    return Response.json({ snapshot_id: snapshotId, board_version: version, published_at: startedAt, records_accepted: payload.entries.length }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return jsonError('Publication failed closed; no board was published.', 503);
  }
}
