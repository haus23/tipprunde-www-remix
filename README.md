# runde.tips – Web-Client (Remix 3)

Öffentlicher Web-Client der Haus-23-Tipprunde. Er liest ausschließlich aus der
öffentlichen Unterbau-API (`https://unterbau.runde.tips/api/v1`) und zeigt
Tabelle, Spieler- und Spielansicht aller veröffentlichten Turniere.

- **Remix 3.0.0-rc.4** (`remix@next`, exakt gepinnt, aufgelöst in `package-lock.json`)
- serverseitig gerendertes HTML, wenige hydrierte Client-Entries (`remix/ui`)
- läuft als **Cloudflare Worker** (ES-Module-Worker + Workers Static Assets)

Weiterführend: [Architektur und Entscheidungen](docs/architecture.md) ·
[Deployment](docs/deployment.md)

## URLs

| URL | Ansicht |
| --- | --- |
| `/` | Tabelle des aktuellen Turniers (veröffentlicht, höchste `nr`) |
| `/spieler[?name=:playerId]` | Tipps eines Spielers, Standard: Tabellenführer |
| `/spiel[?nr=:matchNr]` | Tipps zu einem Spiel, Standard: zeitlich letztes gewertetes Spiel |
| `/:slug` | Tabelle des Turniers mit der API-ID `slug`, z. B. `/wm2026` |
| `/:slug/spieler[?name=…]` | wie oben, für das gewählte Turnier |
| `/:slug/spiel[?nr=…]` | wie oben, für das gewählte Turnier |

Ungültige oder veraltete `name`/`nr`-Werte fallen auf die Standardauswahl zurück;
unbekannte Turniere liefern eine 404-Seite.

## Lokale Entwicklung

Voraussetzungen: **Node.js ≥ 24.3** (Vorgabe von Remix 3 RC) und npm.

```sh
npm install          # npm ≥ 11 meldet übersprungene Install-Skripte (esbuild, workerd) – sie werden nicht benötigt
npm run dev          # Node-Entwicklungsserver auf http://localhost:44100
```

Der Entwicklungsserver (`server.ts`) kompiliert Browser-Module bei Bedarf mit
`remix/assets` und startet bei Serveränderungen neu. Die API-Adresse lässt sich
mit `UNTERBAU_API_URL=… npm run dev` überschreiben.

### Prüfungen

```sh
npm run check        # remix doctor --strict + TypeScript + Tests (alles in einem)
npm run lint         # remix doctor --strict (Projekt-, Routen- und Controller-Konventionen)
npm run typecheck    # tsc --noEmit
npm test             # remix test: Domänenregeln, Cache, API-Client, Router-Integration
npm run verify:api   # validiert die Live-Antworten aller Turniere gegen die Schemas
```

Browser-Smoke-Test (optional, Playwright ist bewusst keine Projektabhängigkeit):

```sh
npm i --no-save playwright && npx playwright install chromium
npm run preview                                   # in einem zweiten Terminal
node scripts/browser-smoke.ts http://127.0.0.1:8787
```

### Production Build und Worker lokal

```sh
npm run build        # dist/client (Static Assets) + dist/worker/index.js
npm run preview      # wrangler dev: baut und startet den Worker lokal in workerd (Port 8787)
npm run deploy:dry-run  # wrangler deploy --dry-run + Bundle-Audit (keine Node-/React-Abhängigkeiten)
```

## Projektstruktur

```txt
app/
  routes.ts                 URL-Vertrag (typisiert, für Server und Browser)
  router.tsx                Router-Fabrik: Middleware + Controller
  actions/                  Controller je Route-Map, Seiten in actions/pages/
  actions/public/entry.ts   Browser-Runtime (run(), Frame-Resolver)
  data/                     API-Schemas, Unterbau-Client, SWR-Cache, Fachregeln
  middleware/               API-Kontext, HTTP-Caching, Fehlerseiten
  ui/                       Layout, Tabellenbausteine; ui/public/ = Client-Entries
server.ts, server/          Node-Entwicklungsserver
worker/                     Cloudflare-Worker-Entry und Manifest-Assets
scripts/                    Build, Worker-Audit, API- und Browser-Prüfungen
test/                       Router-Integrationstests mit Fake-API
```
