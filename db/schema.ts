import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const portfolios = sqliteTable('portfolios', {
  id: text('id').primaryKey(),
  decisionDate: text('decision_date').notNull(),
  currency: text('currency').notNull().default('USD'),
  notionalCapCents: integer('notional_cap_cents').notNull(),
  status: text('status').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [uniqueIndex('idx_portfolios_decision_date').on(table.decisionDate)]);

export const cards = sqliteTable('cards', {
  id: text('id').primaryKey(),
  portfolioId: text('portfolio_id').notNull().references(() => portfolios.id),
  cardDate: text('card_date').notNull(),
  region: text('region').notNull(),
  meeting: text('meeting').notNull(),
  status: text('status').notNull(),
}, (table) => [index('idx_cards_portfolio').on(table.portfolioId), index('idx_cards_date').on(table.cardDate)]);

export const races = sqliteTable('races', {
  id: text('id').primaryKey(),
  cardId: text('card_id').notNull().references(() => cards.id),
  postTime: text('post_time').notNull(),
  raceName: text('race_name').notNull(),
  raceCode: text('race_code'),
  going: text('going'),
  fieldSize: integer('field_size'),
  status: text('status').notNull(),
  lastObservedAt: text('last_observed_at'),
}, (table) => [index('idx_races_card_post_time').on(table.cardId, table.postTime), index('idx_races_status').on(table.status)]);

export const opinions = sqliteTable('opinions', {
  id: text('id').primaryKey(),
  logicalId: text('logical_id').notNull(),
  version: integer('version').notNull(),
  raceId: text('race_id').notNull().references(() => races.id),
  horseName: text('horse_name').notNull(),
  tier: text('tier'),
  confidence: text('confidence'),
  observedOdds: text('observed_odds'),
  fairOdds: text('fair_odds'),
  minimumOdds: text('minimum_odds'),
  verdict: text('verdict').notNull(),
  whyRanked: text('why_ranked').notNull(),
  biggestRisk: text('biggest_risk').notNull(),
  verificationStatus: text('verification_status').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [uniqueIndex('idx_opinions_logical_version').on(table.logicalId, table.version), index('idx_opinions_race').on(table.raceId)]);

export const decisionContexts = sqliteTable('decision_contexts', {
  id: text('id').primaryKey(),
  opinionId: text('opinion_id').notNull().references(() => opinions.id),
  betContext: text('bet_context').notNull(),
  stage: text('stage').notNull(),
  colour: text('colour').notNull(),
  operatingState: text('operating_state').notNull(),
  eligibility: text('eligibility').notNull(),
  priceVerifiedAt: text('price_verified_at'),
  reason: text('reason'),
}, (table) => [index('idx_decision_contexts_opinion').on(table.opinionId)]);

export const boardSnapshots = sqliteTable('board_snapshots', {
  id: text('id').primaryKey(),
  portfolioId: text('portfolio_id').notNull().references(() => portfolios.id),
  boardDate: text('board_date').notNull(),
  version: integer('version').notNull(),
  status: text('status').notNull(),
  verificationStatus: text('verification_status').notNull(),
  dataAsOf: text('data_as_of').notNull(),
  publishedAt: text('published_at'),
  conflictCount: integer('conflict_count').notNull().default(0),
  approvedBy: text('approved_by'),
}, (table) => [uniqueIndex('idx_board_snapshots_date_version').on(table.boardDate, table.version), index('idx_board_snapshots_status_date').on(table.status, table.boardDate)]);

export const boardMembers = sqliteTable('board_members', {
  id: text('id').primaryKey(),
  snapshotId: text('snapshot_id').notNull().references(() => boardSnapshots.id),
  opinionId: text('opinion_id').notNull().references(() => opinions.id),
  rank: integer('rank').notNull(),
  memberStatus: text('member_status').notNull(),
}, (table) => [uniqueIndex('idx_board_members_snapshot_rank').on(table.snapshotId, table.rank), index('idx_board_members_opinion').on(table.opinionId)]);

export const sourceObservations = sqliteTable('source_observations', {
  id: text('id').primaryKey(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  sourceName: text('source_name').notNull(),
  sourceUrl: text('source_url'),
  dataType: text('data_type').notNull(),
  reliabilityTier: text('reliability_tier').notNull(),
  observedAt: text('observed_at').notNull(),
  verificationStatus: text('verification_status').notNull(),
  payloadHash: text('payload_hash'),
}, (table) => [index('idx_source_observations_entity').on(table.entityType, table.entityId), index('idx_source_observations_observed_at').on(table.observedAt)]);

export const raceResults = sqliteTable('race_results', {
  id: text('id').primaryKey(),
  raceId: text('race_id').notNull().references(() => races.id),
  horseName: text('horse_name').notNull(),
  outcome: text('outcome').notNull(),
  finishPosition: integer('finish_position'),
  officialAt: text('official_at').notNull(),
  sourceObservationId: text('source_observation_id').references(() => sourceObservations.id),
}, (table) => [uniqueIndex('idx_race_results_race_horse').on(table.raceId, table.horseName)]);

export const tickets = sqliteTable('tickets', {
  id: text('id').primaryKey(),
  portfolioId: text('portfolio_id').notNull().references(() => portfolios.id),
  snapshotId: text('snapshot_id').notNull().references(() => boardSnapshots.id),
  ticketType: text('ticket_type').notNull(),
  activityType: text('activity_type').notNull(),
  notionalStakeCents: integer('notional_stake_cents').notNull(),
  status: text('status').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [index('idx_tickets_portfolio').on(table.portfolioId), index('idx_tickets_activity_type').on(table.activityType)]);

export const ticketLegs = sqliteTable('ticket_legs', {
  id: text('id').primaryKey(),
  ticketId: text('ticket_id').notNull().references(() => tickets.id),
  opinionId: text('opinion_id').notNull().references(() => opinions.id),
  legNumber: integer('leg_number').notNull(),
}, (table) => [uniqueIndex('idx_ticket_legs_ticket_number').on(table.ticketId, table.legNumber)]);

export const ticketSettlements = sqliteTable('ticket_settlements', {
  id: text('id').primaryKey(),
  ticketId: text('ticket_id').notNull().references(() => tickets.id),
  grossReturnCents: integer('gross_return_cents').notNull(),
  profitLossCents: integer('profit_loss_cents').notNull(),
  settledAt: text('settled_at').notNull(),
  verificationStatus: text('verification_status').notNull(),
}, (table) => [uniqueIndex('idx_ticket_settlements_ticket').on(table.ticketId)]);

export const dailyPerformance = sqliteTable('daily_performance', {
  date: text('date').primaryKey(),
  recommendations: integer('recommendations').notNull(),
  settled: integer('settled').notNull(),
  unresolved: integer('unresolved').notNull(),
  settledStakeCents: integer('settled_stake_cents').notNull(),
  grossReturnCents: integer('gross_return_cents').notNull(),
  profitLossCents: integer('profit_loss_cents').notNull(),
  roi: real('roi'),
  wins: integer('wins').notNull(),
  losses: integer('losses').notNull(),
  voids: integer('voids').notNull(),
  fullySettled: integer('fully_settled', { mode: 'boolean' }).notNull(),
  dataAsOf: text('data_as_of').notNull(),
}, (table) => [index('idx_daily_performance_data_as_of').on(table.dataAsOf)]);

export const lessons = sqliteTable('lessons', {
  id: text('id').primaryKey(),
  lessonDate: text('lesson_date').notNull(),
  title: text('title').notNull(),
  observation: text('observation').notNull(),
  evidence: text('evidence').notNull(),
  action: text('action').notNull(),
  status: text('status').notNull(),
  ruleVersion: text('rule_version').notNull(),
  sourceRef: text('source_ref'),
  approvedAt: text('approved_at'),
}, (table) => [index('idx_lessons_status_date').on(table.status, table.lessonDate)]);

export const publicationEvents = sqliteTable('publication_events', {
  id: text('id').primaryKey(),
  snapshotId: text('snapshot_id').references(() => boardSnapshots.id),
  eventType: text('event_type').notNull(),
  eventAt: text('event_at').notNull(),
  actor: text('actor').notNull(),
  previousVersion: integer('previous_version'),
  changeSummary: text('change_summary').notNull(),
}, (table) => [index('idx_publication_events_snapshot').on(table.snapshotId), index('idx_publication_events_time').on(table.eventAt)]);

export const updateRuns = sqliteTable('update_runs', {
  id: text('id').primaryKey(),
  runType: text('run_type').notNull(),
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
  status: text('status').notNull(),
  inputAsOf: text('input_as_of'),
  recordsAccepted: integer('records_accepted').notNull().default(0),
  recordsRejected: integer('records_rejected').notNull().default(0),
  errorSummary: text('error_summary'),
}, (table) => [index('idx_update_runs_status_started').on(table.status, table.startedAt)]);
