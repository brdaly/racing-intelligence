import { env } from 'cloudflare:workers';
import { auditedSummary } from '@/lib/dashboard-data';
import { isStaleTimestamp } from '@/lib/freshness';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const row = await env.DB.prepare(`
      SELECT COUNT(*) AS days,
             SUM(recommendations) AS recommendations,
             SUM(settled) AS settled,
             SUM(unresolved) AS unresolved,
             SUM(settled_stake_cents) AS settled_stake_cents,
             SUM(gross_return_cents) AS gross_return_cents,
             SUM(profit_loss_cents) AS profit_loss_cents,
             SUM(wins) AS wins, SUM(losses) AS losses, SUM(voids) AS voids,
             MAX(data_as_of) AS data_as_of
      FROM daily_performance
    `).first<Record<string, number | string | null>>();

    if (row && Number(row.settled) > 0) {
      const settledStake = Number(row.settled_stake_cents) / 100;
      const profitLoss = Number(row.profit_loss_cents) / 100;
      return Response.json({
        ...row,
        settled_stake: settledStake,
        gross_return: Number(row.gross_return_cents) / 100,
        profit_loss: profitLoss,
        roi: settledStake ? profitLoss / settledStake : null,
        verification_status: 'database_aggregate',
        is_stale: isStaleTimestamp(row.data_as_of),
        schema_version: '1.0.0',
      }, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60' } });
    }
  } catch {
    // Fall through to the reconciled launch snapshot.
  }

  return Response.json({
    ...auditedSummary,
    verification_status: 'audited_archive_fallback',
    is_stale: true,
    schema_version: '1.0.0',
  }, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60' } });
}
