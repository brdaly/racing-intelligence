# Security policy

## Supported code

Security fixes are applied to the current `main` branch. This project does not
promise support for older commits, forks, or independent deployments.

## Report a vulnerability privately

Report vulnerabilities through GitHub's **Security → Advisories → Report a
vulnerability** form:

<https://github.com/brdaly/racing-intelligence/security/advisories/new>

If that form is unavailable, use <https://dalyventures.com/> to request a secure
reporting channel. Do not open a public issue or discussion for a suspected
vulnerability, and do not include credentials, exploit payloads, personal data,
or account records in any public form.

Include a concise description, the affected path or commit, reproduction steps,
impact, and any suggested remediation. Share only the minimum test data needed
to reproduce the issue. Reports are acknowledged when practical and disclosure
is coordinated after a fix; no response or remediation SLA is offered.

## Controls

- The two protected write routes, `POST /api/v1/publish` and
  `POST /api/v1/daily-close`, require a bearer token compared in constant time
  against `DASHBOARD_UPDATE_TOKEN`, plus explicit approval inside a payload that
  passes schema, range, and arithmetic validation.
- Publication gates reject boards without an HTTPS evidence URL, a verification
  status, a freshness stamp, or a unique rank ordering.
- Repeating a governed write revises what is stored rather than adding a second
  copy of it. `cards`, `races` and `lessons` carry natural keys, so republishing
  a board reuses the meeting and race rows it already created, and re-closing a
  day revises that day's lessons in place. Board versions and their opinions are
  still appended: the version history is the record, and only the newest version
  is `published`.
- Domain writes are applied as a single atomic `D1.batch`. A failure publishes
  nothing and is recorded against an `update_runs` row that is opened outside
  the batch, so the audit trail survives the rollback it describes.
- Read routes derive board freshness from the snapshot's `data_as_of` and fall
  back to the audited archive marked `is_stale` when the database is
  unavailable, rather than serving unmarked data.
- Error responses on the write paths are generic by design and never relay
  database detail.
- Secrets live in the hosting environment, never in source control.
- CI runs `pnpm run audit` over the whole tree and `pnpm run audit:prod` over
  the deployed dependency set on every push and pull request.

## Scope reminders

- Test only systems and accounts you own or are explicitly authorized to test.
- Do not access, alter, retain, or disclose another person's data.
- Automated high-volume testing and denial-of-service testing are out of scope.
- This project is analysis and decision support, not wagering execution
  software. Reports about betting outcomes are not security reports.
