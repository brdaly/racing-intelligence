export type BoardEntry = {
  rank: number;
  horse: string;
  raceTime: string;
  track: string;
  raceName: string;
  tier: 'Tier 1' | 'Tier 2';
  confidence: 'B' | 'C';
  observedOdds: string;
  fairOdds: string;
  minimumPrice: string;
  verdict: string;
  why: string;
  risk: string;
  status: 'archived';
};

export const boardMeta = {
  boardDate: '2026-08-15',
  label: 'Saturday 15 August 2026',
  dataAsOf: '2026-08-15T13:05:00+01:00',
  priceWindow: '12:45–13:05 BST',
  verificationStatus: 'archived_with_conflict',
  stale: true,
  publishedCount: 0,
  conflictCount: 1,
  note: 'The latest research board is archived. It is not a current recommendation and one runner-status conflict remained open at capture time.',
};

export const boardEntries: BoardEntry[] = [
  {
    rank: 1,
    horse: 'Dubai Honour',
    raceTime: '13:25',
    track: 'Newbury',
    raceName: 'Geoffrey Freer Stakes · Group 3',
    tier: 'Tier 1',
    confidence: 'B',
    observedOdds: '7/4',
    fairOdds: '6/5',
    minimumPrice: '6/4',
    verdict: 'Class edge · low-chaos shape',
    why: 'Official rating 118, six pounds clear; Group 1 performer dropping two grades in a small field.',
    risk: 'Eight years old, 126-day break and quick ground. Runner-status conflict affected race shape and Rule 4 exposure.',
    status: 'archived',
  },
  {
    rank: 2,
    horse: 'Rogue Jewel',
    raceTime: '14:20',
    track: 'Ripon',
    raceName: 'Hornblower EBF Novice · Class 2',
    tier: 'Tier 1',
    confidence: 'B',
    observedOdds: '8/15',
    fairOdds: '1/2',
    minimumPrice: '1/2',
    verdict: '17-point RPR edge · five runners',
    why: 'The only winner in the race and materially clear on Racing Post ratings in a low-complexity field.',
    risk: 'The price left little margin and one lightly raced rival had meaningful upside.',
    status: 'archived',
  },
  {
    rank: 3,
    horse: 'Filibustering',
    raceTime: '16:05',
    track: 'Perth',
    raceName: 'Stone of Destiny Handicap Hurdle · Class 2',
    tier: 'Tier 2',
    confidence: 'C',
    observedOdds: '7/2',
    fairOdds: '3/1',
    minimumPrice: '7/2',
    verdict: 'Price-conditioned · do not shorten',
    why: 'Two consecutive wins and joint-top official rating in an exposed field.',
    risk: 'Top weight, weaker speed figure and unexplained market drift made the case conditional.',
    status: 'archived',
  },
  {
    rank: 4,
    horse: 'Norcross Brow',
    raceTime: '17:00',
    track: 'Newmarket',
    raceName: 'Betway Handicap · Class 5',
    tier: 'Tier 2',
    confidence: 'C',
    observedOdds: '11/4',
    fairOdds: '5/2',
    minimumPrice: '11/4',
    verdict: 'Small, value-only position',
    why: 'Progressive form, course-distance evidence and a five-pound claim supported a narrow edge.',
    risk: 'Low-grade handicap with several live rivals; never multiple material.',
    status: 'archived',
  },
  {
    rank: 5,
    horse: 'Witness Stand',
    raceTime: '15:10',
    track: 'Newbury',
    raceName: 'Hungerford Stakes · Group 2',
    tier: 'Tier 2',
    confidence: 'C',
    observedOdds: '7/1',
    fairOdds: '6/1',
    minimumPrice: '7/1',
    verdict: 'Win-only · no multiples',
    why: 'Course-distance form and a plausible uncontested-lead scenario created the value case.',
    risk: 'Wide-open race and a place-heavy recent profile; the price edge was thin.',
    status: 'archived',
  },
];

export const auditedSummary = {
  firstRecommendationDate: '2026-05-18',
  lastRecommendationDate: '2026-07-25',
  totalOpinions: 180,
  stakePositiveOpinions: 179,
  settledTickets: 129,
  unsettledTickets: 50,
  settledStake: 1835,
  unsettledStake: 818,
  grossReturn: 1906.44,
  profitLoss: 71.44,
  roi: 0.0389,
  winRate: 0.3145,
  wins: 39,
  losses: 85,
  voids: 5,
  fullySettledDayProfitLoss: -61.33,
  fullySettledDayRoi: -0.0412,
  maxDrawdown: 275,
  profitFactor: 1.0593,
  displayedWorkbookProfitLoss: -33.19,
  missingProfitLossFormulaRows: 13,
  sourceRows: 521,
  dataAsOf: '2026-07-25',
  auditAsOf: '2026-08-26',
};

export const dailyPerformance = [
  { date: '23 May', isoDate: '2026-05-23', profitLoss: 39.88, cumulative: 39.88, settled: 10, complete: true },
  { date: '28 May', isoDate: '2026-05-28', profitLoss: 30.31, cumulative: 70.19, settled: 7, complete: true },
  { date: '30 May', isoDate: '2026-05-30', profitLoss: -100, cumulative: -29.81, settled: 7, complete: true },
  { date: '31 May', isoDate: '2026-05-31', profitLoss: -85, cumulative: -114.81, settled: 7, complete: true },
  { date: '01 Jun', isoDate: '2026-06-01', profitLoss: -2, cumulative: -116.81, settled: 6, complete: false },
  { date: '02 Jun', isoDate: '2026-06-02', profitLoss: -88, cumulative: -204.81, settled: 5, complete: true },
  { date: '03 Jun', isoDate: '2026-06-03', profitLoss: 110.37, cumulative: -94.44, settled: 6, complete: true },
  { date: '04 Jun', isoDate: '2026-06-04', profitLoss: -44, cumulative: -138.44, settled: 6, complete: true },
  { date: '05 Jun', isoDate: '2026-06-05', profitLoss: 1.2, cumulative: -137.24, settled: 6, complete: false },
  { date: '06 Jun', isoDate: '2026-06-06', profitLoss: -5.74, cumulative: -142.98, settled: 7, complete: true },
  { date: '07 Jun', isoDate: '2026-06-07', profitLoss: -41.6, cumulative: -184.58, settled: 6, complete: true },
  { date: '08 Jun', isoDate: '2026-06-08', profitLoss: 97.32, cumulative: -87.26, settled: 7, complete: false },
  { date: '09 Jun', isoDate: '2026-06-09', profitLoss: 57.82, cumulative: -29.44, settled: 9, complete: true },
  { date: '11 Jun', isoDate: '2026-06-11', profitLoss: 36.25, cumulative: 6.81, settled: 6, complete: false },
  { date: '13 Jun', isoDate: '2026-06-13', profitLoss: -37, cumulative: -30.19, settled: 6, complete: true },
  { date: '14 Jun', isoDate: '2026-06-14', profitLoss: 28.25, cumulative: -1.94, settled: 6, complete: true },
  { date: '15 Jun', isoDate: '2026-06-15', profitLoss: 36.7, cumulative: 34.76, settled: 7, complete: true },
  { date: '16 Jun', isoDate: '2026-06-16', profitLoss: 136.68, cumulative: 171.44, settled: 8, complete: true },
  { date: '17 Jun', isoDate: '2026-06-17', profitLoss: -100, cumulative: 71.44, settled: 7, complete: true },
];

export const breakdowns = {
  region: [
    { label: 'US', tickets: 15, roi: 0.3625, profitLoss: 77.58, note: 'Tote-price and small-sample risk' },
    { label: 'UK', tickets: 87, roi: -0.0005, profitLoss: -0.61, note: 'Largest and most stable sample' },
    { label: 'Ireland', tickets: 27, roi: -0.0154, profitLoss: -5.53, note: 'Close to flat' },
  ],
  confidence: [
    { label: 'High · 8–10', tickets: 6, roi: 1.2734, profitLoss: 134.98, note: 'Promising, not yet calibrated' },
    { label: 'Medium · 5–7', tickets: 108, roi: -0.097, profitLoss: -156.14, note: 'Primary improvement target' },
    { label: 'Speculative · 1–4', tickets: 15, roi: 0.7782, profitLoss: 92.6, note: 'Outlier-sensitive' },
  ],
  odds: [
    { label: '1.01–2.00', tickets: 15, roi: -0.2976, profitLoss: -55.35, note: 'Short prices compressed margin' },
    { label: '2.01–5.00', tickets: 77, roi: 0.2249, profitLoss: 277.79, note: 'Best observed band' },
    { label: '5.01–10.00', tickets: 28, roi: -0.2399, profitLoss: -83, note: 'Low conversion' },
    { label: '10.01+', tickets: 9, roi: -1, profitLoss: -68, note: 'No winners in sample' },
  ],
};

export const lessons = [
  {
    date: '18 Jul 2026',
    status: 'adopted',
    title: 'Price is part of the selection, not an afterthought.',
    observation: 'A strong horse at a compressed price repeatedly became a poor decision. Every public card now carries fair, minimum and abort prices.',
    evidence: 'Observed odds bands; short-price settled ROI was −29.8%.',
    action: 'Fail the publication gate when the executable price crosses its floor.',
  },
  {
    date: '18 Jul 2026',
    status: 'watchlist',
    title: 'Medium confidence is doing too much work.',
    observation: 'The broad 5–7 band contained 108 settled tickets and returned −9.7%, while higher and lower bands were driven by much smaller samples.',
    evidence: 'Confidence-band audit of 129 settled tickets.',
    action: 'Split the band by race shape, price quality and evidence depth before changing stakes.',
  },
  {
    date: '18 Jul 2026',
    status: 'adopted',
    title: 'Keep multiples subordinate to standalone win cases.',
    observation: 'A ticket does not exist unless every leg independently clears the win, price and structure gates.',
    evidence: 'Historical Yankee failures and the refined no-filler rule.',
    action: 'Publish “no ticket” instead of manufacturing a fourth leg.',
  },
  {
    date: '18 Jul 2026',
    status: 'watchlist',
    title: 'Headline ROI is not robust yet.',
    observation: 'The corrected settled result is positive, but removing one large winning ticket changes ROI from +3.9% to −2.4%.',
    evidence: 'Outlier sensitivity audit; 129 settled tickets.',
    action: 'Show sensitivity beside headline performance until the sample matures.',
  },
  {
    date: '25 Aug 2026',
    status: 'quarantined',
    title: 'The 73-opinion historical claims remain hypotheses.',
    observation: 'The underlying row-level dataset and calculation method were not supplied with the historical summary.',
    evidence: 'Source-stack migration review.',
    action: 'Do not display the claims as established trends until reproduced.',
  },
];

export const methodology = [
  { number: '01', title: 'Observe', text: 'Ingest licensed declarations, conditions, prices and results with timestamps and source identity.' },
  { number: '02', title: 'Validate', text: 'Reject stale, duplicated, contradictory or incomplete evidence. Uncertainty stays visible.' },
  { number: '03', title: 'Score', text: 'Deterministic rules calculate race quality, fair price, structure and confidence.' },
  { number: '04', title: 'Review', text: 'AI explains the evidence and risks; it does not decide what is true or settle a result.' },
  { number: '05', title: 'Approve', text: 'A human confirms the locked board snapshot before anything is framed as a selection.' },
  { number: '06', title: 'Reconcile', text: 'Official results settle the record. Daily learning is reviewed before a rule changes.' },
];
