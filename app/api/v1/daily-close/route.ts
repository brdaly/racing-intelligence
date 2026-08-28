import { env } from 'cloudflare:workers';
import { isAuthorized, isIsoDate, isShortText, isTimestamp, jsonError } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

type LessonInput = { title: string; observation: string; evidence: string; action: string; status: 'adopted' | 'watchlist' | 'quarantined'; sourceRef?: string };
type ClosePayload = {
  approved: boolean; date: string; dataAsOf: string; approvedBy: string;
  recommendations: number; settled: number; unresolved: number; settledStakeCents: number;
  grossReturnCents: number; profitLossCents: number; wins: number; losses: number; voids: number;
  fullySettled: boolean; lessons?: LessonInput[];
};

const whole = (value: unknown, max = 10000000) => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= max;

function validate(payload: unknown): payload is ClosePayload {
  if (!payload || typeof payload !== 'object') return false;
  const value = payload as Partial<ClosePayload>;
  if (value.approved !== true || !isIsoDate(value.date) || !isTimestamp(value.dataAsOf) || !isShortText(value.approvedBy, 100)) return false;
  if (![value.recommendations, value.settled, value.unresolved, value.settledStakeCents, value.grossReturnCents, value.wins, value.losses, value.voids].every((item) => whole(item))) return false;
  if (!Number.isInteger(value.profitLossCents) || Math.abs(Number(value.profitLossCents)) > 10000000 || typeof value.fullySettled !== 'boolean') return false;
  if (Number(value.settled) !== Number(value.wins) + Number(value.losses) + Number(value.voids)) return false;
  if (Number(value.profitLossCents) !== Number(value.grossReturnCents) - Number(value.settledStakeCents)) return false;
  if (Number(value.unresolved) !== Number(value.recommendations) - Number(value.settled)) return false;
  if (value.fullySettled && Number(value.unresolved) !== 0) return false;
  if (value.lessons && (!Array.isArray(value.lessons) || value.lessons.length > 10 || value.lessons.some((lesson) => !isShortText(lesson.title, 180) || !isShortText(lesson.observation, 1200) || !isShortText(lesson.evidence, 1200) || !isShortText(lesson.action, 1200) || !['adopted', 'watchlist', 'quarantined'].includes(lesson.status)))) return false;
  return true;
}

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) return jsonError('Update authorization failed.', 401);
  let payload: unknown;
  try { payload = await request.json(); } catch { return jsonError('Request body must be valid JSON.', 400); }
  if (!validate(payload)) return jsonError('Daily-close payload failed validation.', 422);

  const runId = crypto.randomUUID();
  const now = new Date().toISOString();
  const roi = payload.settledStakeCents ? payload.profitLossCents / payload.settledStakeCents : null;
  try {
    const statements: D1PreparedStatement[] = [
      env.DB.prepare('INSERT INTO update_runs (id, run_type, started_at, status, input_as_of, records_accepted, records_rejected) VALUES (?, ?, ?, ?, ?, 0, 0)').bind(runId, 'daily_close', now, 'running', payload.dataAsOf),
      env.DB.prepare(`
        INSERT INTO daily_performance (date, recommendations, settled, unresolved, settled_stake_cents, gross_return_cents, profit_loss_cents, roi, wins, losses, voids, fully_settled, data_as_of)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(date) DO UPDATE SET recommendations=excluded.recommendations, settled=excluded.settled,
          unresolved=excluded.unresolved, settled_stake_cents=excluded.settled_stake_cents,
          gross_return_cents=excluded.gross_return_cents, profit_loss_cents=excluded.profit_loss_cents,
          roi=excluded.roi, wins=excluded.wins, losses=excluded.losses, voids=excluded.voids,
          fully_settled=excluded.fully_settled, data_as_of=excluded.data_as_of
      `).bind(payload.date, payload.recommendations, payload.settled, payload.unresolved, payload.settledStakeCents, payload.grossReturnCents, payload.profitLossCents, roi, payload.wins, payload.losses, payload.voids, payload.fullySettled ? 1 : 0, payload.dataAsOf),
    ];
    for (const lesson of payload.lessons ?? []) {
      statements.push(env.DB.prepare('INSERT INTO lessons (id, lesson_date, title, observation, evidence, action, status, rule_version, source_ref, approved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), payload.date, lesson.title, lesson.observation, lesson.evidence, lesson.action, lesson.status, 'v2', lesson.sourceRef ?? null, now));
    }
    statements.push(
      env.DB.prepare('INSERT INTO publication_events (id, snapshot_id, event_type, event_at, actor, change_summary) VALUES (?, NULL, ?, ?, ?, ?)').bind(crypto.randomUUID(), 'daily_close', now, payload.approvedBy, `Daily performance and ${payload.lessons?.length ?? 0} learning records approved for ${payload.date}.`),
      env.DB.prepare('UPDATE update_runs SET completed_at = ?, status = ?, records_accepted = ? WHERE id = ?').bind(now, 'succeeded', 1 + (payload.lessons?.length ?? 0), runId),
    );
    await env.DB.batch(statements);
    return Response.json({ date: payload.date, settled: payload.settled, unresolved: payload.unresolved, roi, lessons_accepted: payload.lessons?.length ?? 0, closed_at: now }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    try { await env.DB.prepare('UPDATE update_runs SET completed_at = ?, status = ?, records_rejected = 1, error_summary = ? WHERE id = ?').bind(new Date().toISOString(), 'failed', 'Database write failed; details withheld.', runId).run(); } catch { /* Database may not be initialized. */ }
    return jsonError('Daily close failed closed; no statistics were changed.', 503);
  }
}
