export function isStaleTimestamp(value: unknown, thresholdHours = 36) {
  if (typeof value !== 'string') return true;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return true;
  return Date.now() - timestamp > thresholdHours * 60 * 60 * 1000;
}
