import { env } from 'cloudflare:workers';
import { lessons as fallback } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const allowed = new Set(['adopted', 'watchlist', 'quarantined']);
  const selected = status && allowed.has(status) ? status : null;
  try {
    const statement = selected
      ? env.DB.prepare('SELECT * FROM lessons WHERE status = ? ORDER BY lesson_date DESC').bind(selected)
      : env.DB.prepare('SELECT * FROM lessons ORDER BY lesson_date DESC');
    const rows = await statement.all();
    if (rows.results.length) {
      return Response.json({ data: rows.results, verification_status: 'database', is_stale: false, schema_version: '1.0.0' }, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60' } });
    }
  } catch {
    // Fall through to launch snapshot.
  }
  return Response.json({ data: selected ? fallback.filter((item) => item.status === selected) : fallback, verification_status: 'audited_archive_fallback', is_stale: true, schema_version: '1.0.0' }, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60' } });
}
