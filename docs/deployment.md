# Deployment auf Cloudflare Workers

## Voraussetzungen

- Node.js ≥ 24.3, `npm install`
- Cloudflare-Konto; Anmeldung mit `npx wrangler login` oder per
  `CLOUDFLARE_API_TOKEN` (+ `CLOUDFLARE_ACCOUNT_ID`) in CI

## Ablauf

```sh
npm run check           # doctor, TypeScript, Tests
npm run deploy:dry-run  # Build + wrangler deploy --dry-run + Bundle-Audit
npm run deploy          # wrangler deploy (führt scripts/build.ts selbst aus)
```

`wrangler.jsonc` enthält:

- `main: dist/worker/index.js` mit `no_bundle: true` (Bundle aus `scripts/build.ts`)
- `build.command` – Wrangler baut vor `dev` und `deploy` automatisch
- `assets.directory: dist/client` – fingerprinted Browser-Module, Favicon, `_headers`
- `vars.UNTERBAU_API_URL` – Basis-URL der Lese-API (für Tests/Staging überschreibbar)

Eigene Domain: in `wrangler.jsonc` z. B.
`"routes": [{ "pattern": "runde.tips", "custom_domain": true }]` ergänzen.

## Nach dem Deployment prüfen

```sh
curl -I https://<worker>/                      # 200, Cache-Control: no-cache, ETag
curl -I https://<worker>/wm2026/spiel?nr=3     # Deep Link
node scripts/browser-smoke.ts https://<worker> # optional, benötigt Playwright
```

Logs: `npx wrangler tail` (Observability ist aktiviert).
