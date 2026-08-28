import { env } from 'cloudflare:workers';
import { boardMeta } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  let database = 'unavailable';
  try {
    await env.DB.prepare('SELECT name FROM sqlite_schema WHERE type = ? LIMIT 1').bind('table').first();
    database = 'ready';
  } catch {
    database = 'unavailable';
  }

  return Response.json({
    status: boardMeta.stale ? 'degraded' : 'ok',
    database,
    current_board: false,
    verification_status: 'awaiting_current_inputs',
    archive_data_as_of: boardMeta.dataAsOf,
    is_stale: true,
    unresolved_conflict_count: boardMeta.conflictCount,
    schema_version: '1.0.0',
  }, { headers: { 'Cache-Control': 'no-store' } });
}
