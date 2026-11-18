# Contributing to IronLog

IronLog is a fork of [openGym](https://github.com/DuarteSantos8/openGym) and keeps its working
rules: stay dependency-light, keep training logic in pure helpers under `frontend/src/lib/` with a
unit test beside each, and write user-facing text plain and human, without em dashes.

- Frontend: `cd frontend && npm ci && npm test`. API: `cd api && npm ci && npm test`.
- A new `t()` string goes into every pack in `frontend/src/locales/`, then run
  `node scripts/check-locales.mjs` and `node scripts/check-source-strings.mjs --strict` in `frontend/`.
- State fields that sync per day are stamped maps, listed in both `frontend/src/lib/sync-merge.js`
  and `api/sync-stamps.js`. Change both together.
- Do not add or replace anything in `catalogue/media/`: those files are licensed separately, see
  [NOTICE.md](NOTICE.md).

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) explains how the pieces fit together, and
[CLAUDE.md](CLAUDE.md) is the same map written for coding assistants.
