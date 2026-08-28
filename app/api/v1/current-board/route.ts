import { env } from 'cloudflare:workers';
import { boardEntries, boardMeta } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const snapshot = await env.DB.prepare(`
      SELECT id, board_date, version, status, verification_status, data_as_of,
             published_at, conflict_count
      FROM board_snapshots
      WHERE status = 'published'
      ORDER BY board_date DESC, version DESC
      LIMIT 1
    `).first<Record<string, string | number>>();

    if (snapshot) {
      const rows = await env.DB.prepare(`
        SELECT bm.rank, o.horse_name, r.post_time, c.meeting AS track, r.race_name,
               o.tier, o.confidence, o.observed_odds, o.fair_odds, o.minimum_odds,
               o.verdict, o.why_ranked, o.biggest_risk, o.verification_status
        FROM board_members bm
        JOIN opinions o ON o.id = bm.opinion_id
        JOIN races r ON r.id = o.race_id
        JOIN cards c ON c.id = r.card_id
        WHERE bm.snapshot_id = ? AND bm.member_status = 'published'
        ORDER BY bm.rank
      `).bind(snapshot.id).all();

      return Response.json({
        data: rows.results,
        data_as_of: snapshot.data_as_of,
        published_at: snapshot.published_at,
        board_version: snapshot.version,
        schema_version: '1.0.0',
        verification_status: snapshot.verification_status,
        is_stale: false,
        unresolved_conflict_count: snapshot.conflict_count,
        source: 'database',
      }, { headers: { 'Cache-Control': 'no-store' } });
    }
  } catch {
    // The first release remains useful before the database migration is seeded.
  }

  return Response.json({
    data: boardEntries,
    data_as_of: boardMeta.dataAsOf,
    published_at: null,
    board_version: 0,
    schema_version: '1.0.0',
    verification_status: boardMeta.verificationStatus,
    is_stale: true,
    unresolved_conflict_count: boardMeta.conflictCount,
    source: 'audited_archive_fallback',
  }, { headers: { 'Cache-Control': 'no-store' } });
}
