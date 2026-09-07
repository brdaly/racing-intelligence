import { env } from 'cloudflare:workers';

export { isIsoDate, isShortText, isTimestamp } from '@/lib/validation';

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

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}
