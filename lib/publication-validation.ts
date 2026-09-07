import { isIsoDate, isShortText, isTimestamp } from '@/lib/validation';

export type PublishEntry = {
  rank: number;
  horse: string;
  region: string;
  track: string;
  raceTime: string;
  raceName: string;
  tier: string;
  confidence: string;
  observedOdds: string;
  fairOdds: string;
  minimumOdds: string;
  verdict: string;
  whyRanked: string;
  biggestRisk: string;
  priceVerifiedAt: string;
  actionable: boolean;
  source: {
    name: string;
    url?: string;
    dataType: string;
    reliabilityTier: string;
    observedAt: string;
    verificationStatus: string;
  };
};

export type PublishPayload = {
  approved: boolean;
  boardDate: string;
  dataAsOf: string;
  approvedBy: string;
  changeSummary: string;
  conflictCount: number;
  notionalCapCents?: number;
  entries: PublishEntry[];
};

export function validatePublishPayload(payload: unknown): payload is PublishPayload {
  if (!payload || typeof payload !== 'object') return false;
  const value = payload as Partial<PublishPayload>;
  if (value.approved !== true || !isIsoDate(value.boardDate) || !isTimestamp(value.dataAsOf)) return false;
  if (!isShortText(value.approvedBy, 100) || !isShortText(value.changeSummary, 500)) return false;
  if (!Number.isInteger(value.conflictCount) || Number(value.conflictCount) < 0 || Number(value.conflictCount) > 25) return false;
  if (!Array.isArray(value.entries) || value.entries.length < 1 || value.entries.length > 20) return false;

  const ranks = new Set<number>();
  for (const entry of value.entries) {
    if (!entry || !Number.isInteger(entry.rank) || entry.rank < 1 || entry.rank > 20 || ranks.has(entry.rank)) return false;
    ranks.add(entry.rank);
    if (![entry.horse, entry.region, entry.track, entry.raceTime, entry.raceName, entry.tier, entry.confidence, entry.observedOdds, entry.fairOdds, entry.minimumOdds, entry.verdict].every((item) => isShortText(item, 180))) return false;
    if (!isShortText(entry.whyRanked, 1200) || !isShortText(entry.biggestRisk, 1200) || !isTimestamp(entry.priceVerifiedAt) || typeof entry.actionable !== 'boolean') return false;
    if (!entry.source || !isShortText(entry.source.name, 180) || !isShortText(entry.source.dataType, 120) || !isShortText(entry.source.reliabilityTier, 80) || !isTimestamp(entry.source.observedAt) || !isShortText(entry.source.verificationStatus, 80)) return false;
    if (entry.source.url && (entry.source.url.length > 1000 || !/^https:\/\//.test(entry.source.url))) return false;
  }

  return true;
}
