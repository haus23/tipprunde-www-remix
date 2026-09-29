# Architektur und Entscheidungen

Stand: Remix **3.0.0-rc.4** (neueste RC unter `remix@next` am 29.09.2026; keine
Beta/Nightly). Die Version ist in `package.json` exakt gepinnt und im Lockfile
aufgelöst.

## 1. Überblick

```txt
Browser ──► Cloudflare: Static Assets (/assets/*, /favicon.svg)
        └─► Worker fetch() ─► router.fetch(request)
               middleware: httpCache → render → provideAssets → unterbau → errorPages
               controller: current/* | championship/* → actions/pages/*
               └─► Unterbau-Client (validiert) ─► SWR-Cache ─► unterbau.runde.tips/api/v1
```

| Entscheidung | Begründung / Folge |
| --- | --- |
| **Server-Rendering für alle Inhalte** (`render()` aus `remix/middleware/render`) | Erste Ansicht ohne JavaScript vollständig nutzbar, Tabellen sind reines HTML. |
| **Keine Frames mit Fallback, kein SPA-Modus** | Jede Seite braucht ihre Daten vollständig; Streaming-Fallbacks brächten Layout-Sprünge ohne Nutzen. Die Remix-Runtime übernimmt dennoch die Navigation *in place* (Navigation API): Links und GET-Formulare laden nur HTML nach und gleichen das DOM ab. |
| **Vier kleine Client-Entries** | `entry.ts` (Runtime, Frame-Resolver), `AppStatus` (Fortschritt, Offline, Revalidierung, Fokus), `ChampionshipSwitcher` (Disclosure), `SelectNavigator` (Auswahl → URL). Alles andere bleibt Server-HTML. |
| **Native Elemente** statt Custom-Widgets | `<details>` für den Turnierwechsel, `<select>`+GET-Formular für Spieler/Spiel, `<a>` für Prev/Next. Funktioniert ohne JS, mit Tastatur und Touch; `remix/ui/select` wäre JS-pflichtig gewesen und bietet keine Gruppen. |
| **Router-Fabrik** `createAppRouter({ assets, api })` | Derselbe Router läuft im Node-Dev-Server, im Worker und in Tests; nur Assets und API-Zugang werden injiziert. |
| **Middleware nur mit konkretem Bedarf** | `unterbau()` liefert einen request-bezogenen, typisierten API-Client (`context.api`) inkl. Revalidierungsmodus und `waitUntil`; `httpCache()` setzt Cache-Header/ETag; `errorPages()` macht aus Upstream-Ausfällen 503-Seiten; `provideAssets()` stellt Script-Entry-Metadaten bereit. |
| **Validierung mit `remix/data-schema`** | Jede API-Antwort wird gegen die OpenAPI-Verträge geprüft; Verstöße werden kontrolliert als 502-Seite gezeigt statt als Laufzeitfehler. |
| **Keine weiteren Laufzeitabhängigkeiten** | Nur `remix`. Icons sind handgezeichnete Inline-SVGs; keine State-/Cache-Bibliothek nötig (siehe 2). Dev-Werkzeuge: TypeScript, esbuild (Worker-Bundle), Wrangler. |
| **CSS**: Tokens + Basis inline im `<head>`, Komponenten per `css()` (Layer `rmx`) | Keine Stylesheet-Anfrage vor dem ersten Paint. Nur Baseline-„widely available“-Features (Custom Properties, `@layer`, `color-mix`, Nesting über `css()`, `dvh`, `prefers-*`), keine Polyfills. Hell/Dunkel über `prefers-color-scheme`. |

## 2. Datenabruf, Caching und Revalidierung

### Server (Worker-Isolate bzw. Node-Prozess)

`app/data/swr-cache.ts`, Parameter in `app/data/unterbau.ts`:

| Alter eines API-Werts | normale Navigation | Hintergrund-Revalidierung des Browsers (`X-Tipprunde-Revalidate: 1`) |
| --- | --- | --- |
| ≤ 15 s (`FRESH_MS`) | aus dem Cache | aus dem Cache |
| 15 s – 5 min (`STALE_MS`) | sofort aus dem Cache, parallel Neuladen per `ctx.waitUntil` | wartet auf frische Daten |
| > 5 min | wartet auf frische Daten | wartet auf frische Daten |
| Neuladen scheitert (Netz, 5xx, ungültige Antwort) | bis 1 h alte Daten mit Hinweis „Datendienst antwortet nicht“, sonst 503-Seite | ebenso |

- Parallele Anfragen desselben Endpunkts werden zusammengefasst; maximal 500 Einträge (LRU).
- 4xx-Antworten (z. B. 404 Turnier) werden nie durch alte Daten verdeckt.
- Die API liefert keine `Cache-Control`-Header; der Client verlässt sich nicht darauf,
  hält eigene Daten höchstens 15 s für „frisch“ und verlängert den internen
  API-Cache damit kaum. Es gibt keinen persistenten Cache (KV, Cache API).
- Die Fußzeile zeigt den „Datenstand“ (ältester verwendeter API-Wert).

### HTTP

- HTML: `Cache-Control: no-cache` + schwacher ETag über den Seiteninhalt
  (Hydration-IDs ausgenommen, die sich bei jedem Rendern ändern) → Revalidierung
  endet oft in `304`. Fehlerseiten: `no-store`.
- `/assets/*` (fingerprinted Module): `public, max-age=31536000, immutable`
  (`dist/client/_headers`); Favicon 1 Tag.

### Browser (`app/ui/public/freshness.ts`, `app-status.tsx`)

Eine Seite gilt nach **15 s** als veraltet. Dann wird sie im Hintergrund neu
geladen (`frames.top.reload()` mit Revalidierungs-Header; sichtbarer Inhalt
bleibt, bis das neue HTML abgeglichen ist), wenn

- der Tab wieder sichtbar wird oder das Fenster den Fokus erhält,
- die Netzwerkverbindung zurückkommt (`online`; nach einer gescheiterten Navigation erzwungen),
- die Seite aus dem Back/Forward-Cache kommt (`pageshow`),
- bei **laufenden** Turnieren zusätzlich alle **60 s**, solange der Tab sichtbar und online ist.

Navigationen laden immer neues HTML vom Server. Offline zeigt ein Hinweis
„Keine Verbindung“, gescheiterte Ladevorgänge bieten „Erneut laden“.

## 3. Routing und Standardauswahlen

`app/routes.ts` (typisierter Vertrag, `remix routes` zeigt ihn):

```txt
current      GET /  /spieler  /spiel           → actions/current/controller.tsx
championship GET /:slug  /:slug/spieler  /:slug/spiel → actions/championship/controller.tsx
assets       GET /assets/*path                 → nur im Node-Dev-Server relevant
```

Beide Controller rufen dieselben Seitenfunktionen (`actions/pages/*`) auf, einmal
mit dem aktuellen Turnier, einmal mit dem Slug. Links bleiben in der „URL-Familie“
der Seite (`/spieler?name=…` bzw. `/wm2026/spieler?name=…`). Der Turnierwechsel
führt zur gleichen Ansicht **ohne** Auswahlparameter; das aktuelle Turnier wird
über die kurzen URLs adressiert.

Regeln (`app/data/tipprunde.ts`, alle mit Tests):

| Thema | Regel |
| --- | --- |
| aktuelles Turnier | veröffentlicht (`published`) und höchste `nr` – unabhängig von der API-Reihenfolge |
| Slug | muss in der geladenen Turnierliste existieren, sonst 404 ohne Detailabrufe |
| gewertet | genau dann, wenn `result !== ''` (überall dieselbe Funktion `isEvaluated`) |
| Spieler-Standard | kleinster vorhandener `rank`, bei Gleichstand der erste in API-Reihenfolge; ohne Ranking der erste gelieferte Teilnehmer |
| `?name=` | wird mit `ChampionshipPlayer.playerId` (Mitglieds-ID) verglichen; unbekannt → Standard |
| Spiel-Standard | zeitlich letztes gewertetes Spiel: höchstes `date`, bei gleichem Datum höhere `nr`, Spiele ohne Datum zählen als früher; ohne gewertetes Spiel die kleinste `nr`; ohne Spiele Empty State und **kein** `match-tips`-Aufruf |
| `?nr=` | nur positive Ganzzahlen, die als Spiel existieren; sonst Standard |
| Prev/Next | direkte Nachbarn nach `nr` aufsteigend (Lücken erlaubt); am Rand wird kein Link angeboten |
| Punkteschnitt | reguläre `points` ÷ Anzahl gewerteter Spiele (keine Zusatzpunkte, keine Tippanzahl) |
| Tabelle | `rank` unverändert aus der API; wiederholte Ränge nur visuell unterdrückt (für Screenreader weiter vorhanden) |
| Zusatzpunkte | Spalte und Werte nur bei `extraPointsPublished: true`; sonst werden reguläre `points` gezeigt, `extraPoints`/`totalPoints` nie |

### IDs

- `ChampionshipPlayer.id` (Teilnahme) = `Tip.playerId` = Schlüssel in `match-tips`/`current-tips`.
- `ChampionshipPlayer.playerId` (Mitglied) = `?name=` bei `player-tips` und in der Spieler-URL.
- IDs werden nur verglichen und in URLs eingesetzt, nie interpretiert.

### Darstellung von Tipps (`describeTip`)

| Zustand | Tipp | Punkte |
| --- | --- | --- |
| Spiel nicht gewertet | Tipp bzw. „–“ | leer („noch nicht gewertet“) |
| gewertet, kein Tipp (fehlt oder `tip: ''`) | „kein Tipp“ | 0 (gedämpft) |
| gewertet, Tipp mit Punkten | Tipp + ★ Joker / ◎ einziger Treffer | Punkte, auch 0 |
| gewertet, Tipp ohne `points` | Tipp | „–“ („nicht berechnet“), niemals 0 |

## 4. Cloudflare-Worker-Integration

Remix 3 RC bringt für Workers nur den portablen Fetch-Router mit (vgl.
`packages/fetch-router/demos/cf-workers` im Remix-Repository); es gibt keinen
Adapter und keine Worker-Unterstützung für `remix/assets`, das Browser-Module zur
Laufzeit mit nativen Node-Compilern übersetzt. Die projektspezifische Integration
ist deshalb ein **Build-Schritt** (`scripts/build.ts`, geprüft mit rc.4):

1. `createAssetServer` (Konfiguration aus `remix.json`, `fingerprint`, `minify`)
   liefert `getScriptEntry()` für `entry.ts` und jedes Modul mit `clientEntry(`.
2. Alle referenzierten Module werden nach `dist/client` geschrieben. Dateinamen
   `name.@hash.ts` werden zu `name.hash.js` (Cloudflare leitet `@` sonst auf `%40`
   um und liefert `.ts` nicht als JavaScript aus). Verzeichnisse bleiben
   unverändert, damit relative Importe weiter auf die Import-Map-Schlüssel zeigen;
   nur die Import-Map-*Werte* werden umgeschrieben, Modulinhalte bleiben unberührt.
3. esbuild bündelt `worker/worker.ts` als ES-Modul (`platform: neutral`), bettet
   das Manifest als `virtual:tipprunde-assets` ein, ersetzt in `app/**/public/**`
   `import.meta.url` durch `file:///<Projektpfad>` (in einem Bundle hätten sonst
   alle Module dieselbe URL) und behält Funktionsnamen (`keepNames`), weil
   `clientEntry()` sie als Export-Namen nutzt.
4. `worker/manifest-assets.ts` implementiert `getScriptEntry()` für
   `render({ assets })` aus dem Manifest. Wrangler lädt das fertige Bundle
   (`no_bundle: true`); Static Assets werden vor dem Worker ausgeliefert.

Der Worker-Entry nutzt nur Web-APIs (`fetch`, `Request`/`Response`,
`crypto.subtle`, `Intl`, `AbortSignal.timeout`) und reicht `ctx.waitUntil`
über `app/lifetime.ts` an den Cache weiter. Der Build bricht ab, falls das
Bundle Node-Module importiert; `scripts/audit-worker.ts` prüft zusätzlich das
Dry-Run-Ergebnis auf Node-, React- und Remix-2-Spuren.

## 5. Befunde: API-Vertrag, reale Daten, Legacy-App

| Befund | Umgang |
| --- | --- |
| `player-tips?name=<unbekannt>` liefert **406** „Unknown account“; laut OpenAPI wäre 404 („Teilnehmer nicht gefunden“) zu erwarten. | Auswahl wird vorher gegen die Teilnehmerliste geprüft; beide Status werden kontrolliert behandelt. |
| `match-tips?nr=abc` liefert 404 (nicht 406). | `nr` wird vorher validiert. |
| Die Legacy-App zeigt bei abgeschlossenen Turnieren die Zusatzpunkte-Spalte unabhängig von `extraPointsPublished`. | Auftrag befolgt: nur bei `true`. In den aktuellen Daten haben alle abgeschlossenen Turniere `true`, sichtbar ändert sich nichts. |
| Legacy wählt als Standardspieler `players[0]`, der Auftrag den kleinsten `rank`. | Auftrag befolgt; da die API nach Rang sortiert, identisch bis auf geteilte Ränge (dann erster in API-Reihenfolge). |
| `current-tips` enthält für noch nicht gespielte Spiele vereinzelt Tipp-Objekte mit `tip: ''` (z. B. hr2627, Spiel 37). | Als „kein Tipp“ dargestellt; es wird nicht abgeleitet, ob Tipps verborgen sind. |
| `extraPoints` wird auch bei `extraPointsPublished: false` geliefert (hr2627). | Wird nie angezeigt, auch nicht indirekt über `totalPoints`. |
| Spieldaten sind nicht nach Datum sortiert (rr2526: Nr. 70 am 26.04., Nr. 71 am 24.04.). | Standardspiel nach Datum, nicht nach `nr`. |
| Abgeschlossenes Turnier mit ungewerteten Spielen (hr2324, vier Spiele ohne Ergebnis). | Als „offen“/„noch nicht gewertet“ dargestellt. |
| In wm2026 hat bei mindestens einem gewerteten Spiel ein Teilnehmer keinen Tipp. | „kein Tipp“ mit 0 Punkten, getrennt von „0:0 · 0“. |
| Die API sendet ETags, aber keine `Cache-Control`-Header. | Eigene Frischeregeln (siehe 2). |

Bewusste, nur darstellungsbezogene Entscheidungen: Spielerauswahl alphabetisch
sortiert (Legacy: Tabellenreihenfolge); Tipptabelle eines Spiels in
Tabellenreihenfolge ohne Sortierfunktion; aktuelle Tipps als zusätzliche
Tabellenspalten statt Popover je Zeile.

## 6. Bekannte RC-Einschränkungen und vertagte Punkte

- **Assets auf Workers**: siehe 4; die Integration hängt an Details von
  `remix/assets` (Fingerprint-Format, Import-Map-Aufbau, Namensauflösung von
  `clientEntry`) und muss bei RC-Updates geprüft werden (`npm run build` +
  `node scripts/browser-smoke.ts`).
- **Navigation vor Antwort**: Die Runtime übernimmt die neue URL, bevor das HTML
  geladen ist. Scheitert das (offline), zeigen URL und Inhalt kurz
  Unterschiedliches; ein Hinweis erscheint und beim `online`-Ereignis wird
  automatisch nachgeladen.
- **Fokus**: Die Navigation API setzt den Fokus nach In-Place-Navigationen auf
  `<body>`. Tabs, Prev/Next und Auswahllisten (`data-keep-focus`) erhalten ihn zurück.
- **Browser ohne Navigation API** fallen auf normale Dokumentnavigationen zurück
  (volle Funktion, nur ohne In-Place-Update).
- **Hydration-IDs** sind je Rendern zufällig; der ETag ignoriert sie.
- **Client-Bundle**: Die Remix-Runtime wird unbündelt als ~55 Module
  (≈ 52 KiB gzip) mit `modulepreload` ausgeliefert, danach dauerhaft gecacht.
- **Tooling**: Node ≥ 24.3; `remix test` deckt Server-Tests ab, Browser-Tests
  laufen über das optionale `scripts/browser-smoke.ts`.
- Vertagt: Sortierbare Tipptabellen, Regeln-/Zusatzfragen-Ansicht (Endpunkte
  `rules` etc. werden nicht genutzt), persistenter Edge-Cache.
