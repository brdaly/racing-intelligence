import { env } from 'cloudflare:workers';
import { dailyPerformance as fallback } from '@/lib/dashboard-data';
import { isStaleTimestamp } from '@/lib/freshness';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await env.DB.prepare(`
      SELECT date, recommendations, settled, unresolved, settled_stake_cents,
             gross_return_cents, profit_loss_cents, roi, wins, losses, voids,
             fully_settled, data_as_of
      FROM daily_performance
      ORDER BY date
    `).all();
    if (rows.results.length) {
      const latest = rows.results.at(-1) as { data_as_of?: string } | undefined;
      return Response.json({ data: rows.results, verification_status: 'database', is_stale: isStaleTimestamp(latest?.data_as_of), schema_version: '1.0.0' }, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60' } });
    }
  } catch {
    // Fall through to launch snapshot.
  }
  return Response.json({ data: fallback, verification_status: 'audited_archive_fallback', is_stale: true, schema_version: '1.0.0' }, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60' } });
}
