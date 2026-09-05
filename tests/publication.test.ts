import { describe, expect, it } from 'vitest';
import { validatePublishPayload, type PublishPayload } from '@/lib/publication-validation';

function validPayload(): PublishPayload {
  return {
    approved: true,
    boardDate: '2026-09-04',
    dataAsOf: '2026-09-04T10:00:00Z',
    approvedBy: 'owner-id',
    changeSummary: 'Validated publication test.',
    conflictCount: 0,
    entries: [
      {
        rank: 1,
        horse: 'Test Horse',
        region: 'USA',
        track: 'Test Track',
        raceTime: '14:00',
        raceName: 'Test Race',
        tier: 'Tier 1',
        confidence: '85%',
        observedOdds: '2.5',
        fairOdds: '2.2',
        minimumOdds: '2.0',
        verdict: 'Strong',
        whyRanked: 'Good recent form.',
        biggestRisk: 'Weather.',
        actionable: true,
        priceVerifiedAt: '2026-09-04T10:00:00Z',
        source: {
          name: 'Test Source',
          url: 'https://example.com/evidence',
          dataType: 'official',
          reliabilityTier: 'high',
          observedAt: '2026-09-04T10:00:00Z',
          verificationStatus: 'verified',
        },
      },
    ],
  };
}

describe('validatePublishPayload', () => {
  it('accepts a complete approved board', () => {
    expect(validatePublishPayload(validPayload())).toBe(true);
  });

  it('rejects an unapproved board', () => {
    expect(validatePublishPayload({ ...validPayload(), approved: false })).toBe(false);
  });

  it('rejects a missing freshness timestamp', () => {
    expect(validatePublishPayload({ ...validPayload(), dataAsOf: undefined })).toBe(false);
  });

  it('rejects a calendar date that only looks like ISO format', () => {
    expect(validatePublishPayload({ ...validPayload(), boardDate: '2026-02-30' })).toBe(false);
  });

  it('rejects a source without verification status', () => {
    const payload = validPayload();
    const source = { ...payload.entries[0].source };
    Reflect.deleteProperty(source, 'verificationStatus');
    payload.entries[0].source = source as PublishPayload['entries'][number]['source'];
    expect(validatePublishPayload(payload)).toBe(false);
  });

  it('rejects an empty board', () => {
    expect(validatePublishPayload({ ...validPayload(), entries: [] })).toBe(false);
  });

  it.each([0, 21, -1])('rejects an out-of-bounds rank: %i', (rank) => {
    const payload = validPayload();
    payload.entries[0].rank = rank;
    expect(validatePublishPayload(payload)).toBe(false);
  });

  it('rejects duplicate ranks', () => {
    const payload = validPayload();
    payload.entries.push({ ...payload.entries[0], horse: 'Second Horse' });
    expect(validatePublishPayload(payload)).toBe(false);
  });

  it('rejects a non-HTTPS source URL', () => {
    const payload = validPayload();
    payload.entries[0].source.url = 'http://example.com/evidence';
    expect(validatePublishPayload(payload)).toBe(false);
  });

  it.each([-1, 26, 1.5])('rejects an invalid conflict count: %s', (conflictCount) => {
    expect(validatePublishPayload({ ...validPayload(), conflictCount })).toBe(false);
  });
});
