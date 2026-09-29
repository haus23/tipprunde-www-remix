# Agent Guide

Remix 3 (RC) app — not Remix 2, not React Router. Read `node_modules/remix/INDEX.md`
and the guides there before using unfamiliar `remix/*` APIs.

- Architecture, caching policy, domain rules and Worker integration: `docs/architecture.md`
- Before committing: `npm run check`; after build-related changes also
  `npm run deploy:dry-run` and `node scripts/browser-smoke.ts` against `npm run preview`
- Browser-reachable code lives only in `app/**/public/**` (asset boundary in `remix.json`)
- Domain rules belong in `app/data/tipprunde.ts` with tests; never interpret API ids
