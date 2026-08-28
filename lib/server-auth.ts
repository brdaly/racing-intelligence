import { env } from 'cloudflare:workers';

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}

export async function isAuthorized(request: Request) {
  const expected = env.DASHBOARD_UPDATE_TOKEN;
  const header = request.headers.get('authorization');
  if (!expected || !header?.startsWith('Bearer ')) return false;
  const [actualHash, expectedHash] = await Promise.all([digest(header.slice(7)), digest(expected)]);
  let difference = 0;
  for (let index = 0; index < expectedHash.length; index += 1) difference |= actualHash[index] ^ expectedHash[index];
  return difference === 0;
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value));
}

export function isShortText(value: unknown, max = 300): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}
