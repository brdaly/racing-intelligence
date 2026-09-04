# Racing Intelligence

**Status: Labs/Prototype** — This repository is in active development as a hardened prototype. It demonstrates evidence-governed decision systems with audit trails but is not production-ready for deployment. Authentication, database connectivity, and live data integration must be completed before production use.

An evidence-governed racing dashboard that separates current publication status from historical performance. It is designed to publish a small, verified board of UK and Irish win-single candidates, reconcile official results, and update performance trends and lessons without treating AI output as the source of truth.

The production site is currently owner-only at [daly-racing-intelligence.brendandaly.chatgpt.site](https://daly-racing-intelligence.brendandaly.chatgpt.site). The custom domain `racing.dalyventures.com` is reserved but remains dependent on DNS validation.

## What it includes

- Current-board publication with evidence, price, confidence, risk, and verification metadata.
- A fail-closed state when fresh racecards, runners, prices, or approval are unavailable.
- Historical P&L, ROI, daily trends, confidence and odds-band breakdowns, and outlier sensitivity.
- A governed learning register with `adopted`, `watchlist`, and `quarantined` states.
- Protected board-publish and daily-close workflows with validation and audit events.
- A Cloudflare D1 schema and migrations for boards, races, opinions, sources, results, tickets, performance, and lessons.

## Decision and data flow

```text
approved sources
      ↓
normalized observations
      ↓
deterministic validation
      ↓
provisional board
      ↓
human approval
      ↓
published snapshot
      ↓
official-result reconciliation → daily performance → governed lessons
```

AI may explain verified records; it does not create factual race data or bypass approval. Notional recommendations remain separate from actual user betting activity.

## Current data state

The repository contains a reconciled historical seed covering 27 recorded days, 179 stake-positive recommendations, 129 settled records, and 50 unresolved records. Unresolved items are excluded from performance totals. No licensed live racecard, odds, or results feed is connected, so the current board correctly remains paused rather than presenting archived prices as live.

## Technology

- Next.js-compatible Vinext application
- React 19 and TypeScript
- Cloudflare Workers and D1
- Drizzle ORM and versioned SQLite migrations
- OpenAI Sites deployment metadata

## Local setup

Requirements: Node.js 22.13 or newer and pnpm 11.19.

```bash
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev
```

Set `DASHBOARD_UPDATE_TOKEN` in `.env` only when testing the protected update routes. Use a long random value and never commit `.env`.

## Validation

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

GitHub Actions runs all validation checks for pushes to `main` and pull requests, including security audits.

## API surface

Public read routes:

- `GET /api/v1/health`
- `GET /api/v1/current-board`
- `GET /api/v1/dashboard/summary`
- `GET /api/v1/dashboard/timeseries`
- `GET /api/v1/lessons`

Protected write routes:

- `POST /api/v1/publish`
- `POST /api/v1/daily-close`

Write requests require `Authorization: Bearer <DASHBOARD_UPDATE_TOKEN>`, explicit approval in the validated payload, and a configured D1 binding. Invalid or unauthorized requests fail without publishing changes.

## Database and deployment

- Schema: `db/schema.ts`
- Migrations: `drizzle/`
- Logical Sites bindings: `.openai/hosting.json`
- Local migration generation: `pnpm db:generate`

Production secrets are configured in the hosting environment, never in source control. A live-data integration must use a licensed source with explicit website-publication rights and retain source, observation time, verification status, and change history.

## Responsible-use boundary

This project provides racing analysis and decision support. It is not wagering execution software, does not guarantee outcomes, and must not publish unverified runners, prices, results, or market claims. Singles remain the core decision unit; multiples should only be derived from independently qualified selections.
