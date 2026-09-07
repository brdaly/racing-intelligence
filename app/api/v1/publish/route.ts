import { env } from 'cloudflare:workers';
import { validatePublishPayload } from '@/lib/publication-validation';
import { isAuthorized, jsonError } from '@/lib/server-auth';

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
      env.DB.prepare('INSERT INTO update_runs (id, run_type, started_at, status, input_as_of, records_accepted, records_rejected) VALUES (?, ?, ?, ?, ?, 0, 0)').bind(runId, 'board_publish', startedAt, 'running', payload.dataAsOf),
      env.DB.prepare('INSERT OR IGNORE INTO portfolios (id, decision_date, currency, notional_cap_cents, status, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(portfolioId, payload.boardDate, 'USD', payload.notionalCapCents ?? 10000, 'active', startedAt),
      env.DB.prepare("UPDATE board_snapshots SET status = 'superseded' WHERE board_date = ? AND status = 'published'").bind(payload.boardDate),
      env.DB.prepare('INSERT INTO board_snapshots (id, portfolio_id, board_date, version, status, verification_status, data_as_of, published_at, conflict_count, approved_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(snapshotId, portfolioId, payload.boardDate, version, 'published', payload.conflictCount ? 'published_with_disclosed_conflict' : 'verified', payload.dataAsOf, startedAt, payload.conflictCount, payload.approvedBy),
    ];

    const cardIds = new Map<string, string>();
    const raceIds = new Map<string, string>();
    for (const entry of [...payload.entries].sort((a, b) => a.rank - b.rank)) {
      const cardKey = `${entry.region}|${entry.track}`;
      let cardId = cardIds.get(cardKey);
      if (!cardId) {
        cardId = crypto.randomUUID();
        cardIds.set(cardKey, cardId);
        statements.push(env.DB.prepare('INSERT INTO cards (id, portfolio_id, card_date, region, meeting, status) VALUES (?, ?, ?, ?, ?, ?)').bind(cardId, portfolioId, payload.boardDate, entry.region, entry.track, 'verified'));
      }
      const raceKey = `${cardKey}|${entry.raceTime}|${entry.raceName}`;
      let raceId = raceIds.get(raceKey);
      if (!raceId) {
        raceId = crypto.randomUUID();
        raceIds.set(raceKey, raceId);
        statements.push(env.DB.prepare('INSERT INTO races (id, card_id, post_time, race_name, status, last_observed_at) VALUES (?, ?, ?, ?, ?, ?)').bind(raceId, cardId, entry.raceTime, entry.raceName, 'confirmed', entry.source.observedAt));
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
      env.DB.prepare('UPDATE update_runs SET completed_at = ?, status = ?, records_accepted = ? WHERE id = ?').bind(new Date().toISOString(), 'succeeded', payload.entries.length, runId),
    );
    await env.DB.batch(statements);
    return Response.json({ snapshot_id: snapshotId, board_version: version, published_at: startedAt, records_accepted: payload.entries.length }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    try {
      await env.DB.prepare('UPDATE update_runs SET completed_at = ?, status = ?, records_rejected = 1, error_summary = ? WHERE id = ?').bind(new Date().toISOString(), 'failed', 'Database write failed; details withheld.', runId).run();
    } catch { /* The database may not be initialized yet. */ }
    return jsonError('Publication failed closed; no board was published.', 503);
  }
}
