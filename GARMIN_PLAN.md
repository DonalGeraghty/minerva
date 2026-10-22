# Garmin dashboard implementation plan

Status: connection and steps milestone deployed and verified by the user. Study UI and related backend endpoints are now retired locally; sleep and recent activity cards are now implemented locally; full Garmin endpoint coverage remains planned. This plan covers repurposing Minerva and adding Garmin integration in the sibling Janus API repository. It supersedes the earlier proposal to add a Garmin tab to Aether.

### First milestone delivered

The sleep card now includes a seven-day duration chart ending on the selected date, recorded-night average, and selectable nightly score/stage details. Missing nights remain gaps. Janus fetches the window with one bounded history request and caches it independently of the single-day sleep response; Sleep refresh updates the whole seven-day window.

Recent activities now show heart rate and calories beside duration/distance, with expandable movement, training/recovery, sport metrics, recorded heart-rate zone bars, and strength exercise summaries. These use fields already preserved by Janus's activity search response, without additional endpoint requests.

The current frontend has Garmin Overview at `/` and connection controls in Account. Legacy study URLs redirect to Overview. Janus implements connection GET/PUT/DELETE, steps/sleep/activity GET, and independent-resource POST refresh, with encrypted key/token persistence, generation checks, account deletion cleanup, bounded date ranges, refresh locking/backoff, and stale-data fallback. Synthetic integration and UI tests exercise this path. Saved dashboard preferences, the remaining resources, and Garmin-only cache clearing remain future work in this plan. Ask, Flashcards, Gallery, scheduling/drafting code, and card-context endpoints have been removed; historical records retain account-deletion cleanup.

## 1. Scope and agreed behaviour

Repurpose Minerva from flashcards into a dedicated Garmin dashboard, with Garmin Overview as its home screen and a Garmin connection section in Account. Use `Minerva -> Janus -> Garmin`, with the existing Firestore database for account-owned cached data and dashboard preferences, and the existing Cloud KMS encryption machinery for credentials. Retain the Minerva repository, Cloud Run service, and deployment pipeline. No additional Google Cloud service is required for the initial implementation. Aether remains focused on habits; a new name or visual identity can follow later.

The first release covers every endpoint in Janus's `garmin_swagger.md`. Group data into Overview, Activities, Heart and recovery, Sleep, Daily health, Weight, Nutrition, Women's health, and Profile. Load sections on demand, with date selection, charts for suitable measurements, detail tables, and expandable response inspection. Missing measurements display as unavailable, never as zero.

Three explicit requirements apply throughout:

1. **Clear freshness indicators:** show relative text such as "Updated 12 minutes ago", an exact timestamp on inspection, a Refresh control, and a clear notice when saved data is displayed after a Garmin failure.
2. **Independent sections:** give each resource its own data, loading, refresh, and error state. A failed sleep request must leave steps, activities, and other successful resources usable. Apply the same isolation to overview cards.
3. **Remember dashboard preferences:** support every section and let the user show, hide, and reorder overview cards. Save preferences to the Janus account so they survive reloads and work across devices. Provide Reset to defaults; hiding a card does not remove its detailed section or delete its data.

## 2. Confirm the API contract

Create a resource registry in Janus covering all 26 documented endpoints. For each resource, record its Garmin path, accepted parameters, response shape, section, cache strategy, and empty-data behaviour.

| Data family | Endpoints to cover |
| --- | --- |
| Activities | Activity search; activity details; associated workouts; original activity file download |
| Heart | Heart-rate zones; daily heart rate |
| HRV | Daily details; date-range summaries |
| Sleep | Daily details; date-range summaries |
| Daily summaries | Single-day summary; date-range summaries |
| Daily health | Steps; stress; hydration; Body Battery; daily SpO2; fitness age |
| Weight | All measurements; range measurements; effective weight goals |
| Nutrition | Daily food logs |
| Women's health | Cycle summary; day view |
| Profile and wellness activity | User settings; wellness activity summaries by date range |

The copied Swagger has collapsed nested schemas and is formatted Markdown rather than machine-readable OpenAPI. Obtain the full specification where available and inspect representative responses using a connected account before finalising charts. Keep credentials and identifiable health responses out of committed fixtures; use synthetic examples with the verified shapes.

Confirm supported historical ranges, pagination bounds, units, missing-value sentinels, date/timezone semantics, and rate-limit behaviour. Support all documented endpoints even when this account has no data for some of them. Do not infer unsupported fields or promise unlimited historical access.

Use a small server-side HTTP adapter compatible with Janus's existing Python runtime. Garmin's official Python client is a reference; verify runtime and token-cache behaviour before considering it as a dependency. Avoid any shared plaintext token-cache file in the deployed service.

## 3. Janus connection and data storage

### Connection lifecycle

- Add dedicated Garmin connection services and authenticated routes, separate from the AI provider/model catalog. Existing AI persistence currently validates an AI-only provider allowlist, so adding a Garmin UI card alone is insufficient.
- Reuse the existing KMS encryption functions with a Garmin-specific credential context. Validate a new personal key through Garmin's token endpoint before replacing a working key.
- Keep the personal key encrypted in `users/{email}/private/garmin`. Return only safe metadata, such as configured status, last four characters, verification time, and connection state.
- Exchange the personal key for an access token server-side and renew it before expiry. Any persisted access token must also be encrypted and scoped to the account and credential version. Never return or log either secret.
- Invalidate cached access tokens when the personal key changes. Do not treat an upstream Garmin authentication failure as an expired Janus login; return a distinct reconnect-required error.
- Protect reads and writes with Janus's existing account ID/deletion checks. Account deletion, disconnect, and replacement must prevent an in-flight request from restoring deleted credentials or writing data under an obsolete connection.

Garmin documents token exchange, personal-key expiry, and access-token lifetime in its [Personal API instructions](https://developer.garmin.com/gc-developer-program/personal/personal-api/) and [FAQ](https://developer.garmin.com/gc-developer-program/personal/personal-faq/).

### Firestore layout

Use the existing database with these proposed account-owned records:

```text
users/{email}/private/garmin                 encrypted credential/token material
users/{email}/garmin_settings/dashboard     visible/ordered cards and default range
users/{email}/garmin_cache/{cache_id}        fetched Garmin data and freshness metadata
```

Cache identity includes resource, validated parameters, date/page/activity ID, schema version, and connection generation. Use deterministic IDs so repeating a request updates the same record. Include `account_id`, `fetched_at`, `fresh_until`, and provenance in each record; retain Garmin dates and units.

Partition daily data and detailed time series into bounded documents. Do not store original FIT/ZIP downloads in Firestore; fetch and return them on demand. Do not place the entire Garmin history in one document. Record successful empty responses distinctly from request failures.

Disconnect removes stored Garmin secrets and stops requests; cached history can remain until explicitly deleted. Provide a separate clear-data action. Include secrets, settings, and all cache documents in account deletion, including any partitioned records. Replacing a connection must never expose the previous Garmin account's cached data as belonging to the new connection.

## 4. Cache and refresh behaviour

On each request, Janus checks the matching cache record. Return fresh data immediately; when missing or stale, attempt a bounded Garmin request and save a successful result. If the attempt fails and a saved copy exists, return it with a stale-data warning and its original successful fetch time. If there is no copy, return a resource-specific error. A storage failure must never be reported as a successful cache save.

Starting defaults, adjustable after observing real responses:

| Resource age/type | Freshness window |
| --- | --- |
| Steps ranges ending within the recent four-day UTC window (including timezone-boundary tolerance) | 15 minutes |
| Older dated records and completed activities | 24 hours |
| Profile and heart-rate zones | 24 hours |
| Original activity files | Download on demand; no Firestore payload cache |

Use a 30-day default range where supported, with bounded requests and paginated activity browsing. Opening the app loads overview resources; opening a detailed section loads that section. Hidden overview cards do not trigger requests solely for the overview. Fetch detailed activity data when selected. Changing dates must not briefly show data for the previous selection as current.

Refresh forces an upstream attempt for the selected section or visible overview cards. It does not trigger every historical endpoint. Suppress duplicate in-flight requests, cap upstream concurrency, and honour rate-limit retry delays even for manual refresh. Keep existing content visible while refreshing. A failed refresh never advances the successful `fetched_at` timestamp.

Return a consistent per-resource envelope with data and metadata: `source` (Garmin/cache), `fetched_at`, `fresh_until`, `stale`, `last_attempt_at`, and a safe warning/error code. An empty successful response is not an outage. Show rate-limit, unavailable, and reconnect-required states distinctly.

Refresh freshness is independent of retention. For the first version, retain requested cached data until explicit clearing or account deletion; do not add automatic TTL deletion. No scheduled jobs or continuous polling are needed. Further retention limits and scheduled synchronisation can be added later if actual usage justifies them.

## 5. Proposed Janus endpoints

All routes require the current Janus account identity; the browser never supplies the owner account ID or email.

| Route | Purpose |
| --- | --- |
| `GET /api/garmin/connection` | Safe connection status |
| `PUT /api/garmin/connection` | Validate, encrypt, and save/replace a personal key |
| `DELETE /api/garmin/connection` | Disconnect and remove stored Garmin secrets |
| `GET /api/garmin/preferences` | Load dashboard preferences/defaults |
| `PUT /api/garmin/preferences` | Save validated overview card choices/order and default range |
| `GET /api/garmin/data/{resource}` | Read a registered resource with bounded, validated parameters |
| `POST /api/garmin/refresh` | Refresh explicitly selected registered resources; return independent outcomes |
| `GET /api/garmin/activities/{activity_id}/file` | Download an original activity file |
| `DELETE /api/garmin/data` | Clear cached Garmin data without deleting retained flashcards or sibling-app data |

The resource registry maps only known Garmin paths and query parameters. Do not expose a proxy accepting arbitrary upstream URLs. Validate preference card IDs, order uniqueness, range bounds, dates, activity IDs, and pagination. Return safe errors rather than raw upstream exception bodies.

## 6. Minerva screens and components

- Replace the Ask/Flashcards product flow with Garmin navigation: Overview (`/`), Activities (`/activities`), Health (`/health`), and Account (`/account`). Health provides all remaining data sections, including nutrition and profile details. Adapt Minerva's existing React Router layout and dock; check narrow screens and keyboard navigation. Redirect legacy `/flashcards` links to Overview without deleting records.
- Add `GarminConnectionSettings` to Account alongside the existing AI settings. Cover not connected, validating, connected, replacement, disconnected, and reconnect-required states. Clear the key input after submission; keep credentials out of browser persistence.
- Add a Garmin API client and account-scoped data hooks using the existing authenticated fetch helper. Cancel or ignore obsolete responses after navigation, account changes, and date changes. Clear client-held health data on logout/account switch.
- Build shared section/card components for loading, empty, unavailable, refreshing, and saved-after-error states. Each card/section reports its own freshness; a single global timestamp must not imply that all resources refreshed successfully.
- Provide default overview cards for steps, sleep, resting heart rate, HRV, stress, Body Battery, weight, and recent activities. Display unavailable cards honestly and allow them to be hidden.
- Add a Manage overview control with labelled visibility toggles, keyboard-accessible ordering controls, save feedback, and Reset to defaults. Persist preferences in Firestore through Janus; keep unsaved edits visible if saving fails and offer retry.
- Expose every data section regardless of overview choices, with date controls, readable units, suitable charts/tables, expandable returned-field inspection, and file downloads where supported. Label the raw response view as an optional detail tool.
- Remove flashcard creation/review/search and flashcard-context controls from the active Minerva interface. Replace flashcard-focused login copy and demo fixtures with Garmin dashboard examples; demo mode must remain isolated and excluded from production builds.
- Retain historical server-side flashcards and review history until explicit account deletion. The user explicitly authorised endpoint retirement after verifying Garmin: remove the study APIs and active implementation, retaining only account-deletion cleanup. Preserve old browser storage without reading or writing it.
- Preserve shared Janus login, account identity, AI-provider credentials/model settings, and account controls. Explain that deleting the shared Janus account removes its data across Minerva, Aether, and Nyx; a Garmin-only clear-data action must not do so.
- Keep Aether habit workflows and Nyx nutrition workflows working. Automatic habit completion and Garmin-to-AI analysis are later features requiring explicit user choices; the first release is a complete data dashboard.

## 7. Build sequence and validation

1. **Contract and adapter:** inventory all endpoints, resolve nested schemas, implement token exchange and the resource registry, and create synthetic response fixtures.
2. **Connection and persistence:** implement encrypted key/token handling, account isolation, cache metadata, cleanup, and connection endpoints.
3. **First vertical slice:** wire Account connection and a steps overview card through the real Janus/cache path. Verify connect, fetch, cache reuse, stale refresh, manual refresh, and failure with a saved copy before expanding.
4. **Full resource coverage:** add all remaining sections, pagination, date navigation, activity details/downloads, and returned-field inspection. Every documented endpoint remains part of the first-release acceptance criteria.
5. **Preferences and product replacement:** implement saved overview configuration, independent card states, exact/relative freshness labels, and mobile/keyboard behaviour. Replace the flashcard routes, navigation, onboarding, context settings, and demo experience while retaining historical data and shared account features.
6. **Verification and rollout:** run meaningful tests and existing repository checks, update Minerva and Janus READMEs with actual behaviour/routes/defaults, and keep Aether's README pointing to Minerva as the Garmin app. Deploy Janus before Minerva when implementation is ready and deployment is authorised. Reuse the existing Minerva deployment configuration; check it against the actual environment before rollout rather than repeating first-time provisioning steps.

Backend tests should cover account isolation, obsolete connection/account writes, failed key replacement, encryption failures, token expiry/revocation, cache key separation, fresh/stale/empty responses, failed refresh timestamp preservation, partial failures, rate limits, parameter bounds, preferences, downloads, and complete deletion. Test time-dependent logic with a controlled clock and mock Garmin/KMS/Firestore boundaries.

Frontend validation should cover per-card failure isolation, retained content during refresh, first-load errors, missing data, stale warnings, preference save/retry/reset, reload/account-switch behaviour, date changes, activity pagination/downloads, and narrow-screen/keyboard navigation. Replace obsolete flashcard-flow tests with meaningful dashboard-flow tests and retain shared account tests. Run Minerva's `npm run check` and `npm run build` and the appropriate Janus test suite. Verify that the repurpose preserves existing flashcard records and sibling-app access. Use a connected account for a final smoke test without committing secrets or personal health responses.

## 8. Completion criteria

- All 26 documented endpoints are reachable through the appropriate dashboard section or action, including endpoints with empty account data.
- The browser communicates with Janus for Garmin integration; secrets remain server-side after submission.
- Fresh repeated requests reuse Firestore data; manual refresh and stale refresh update successful fetch times correctly.
- A Garmin outage retains usable saved data and clearly marks it; one failing resource does not blank successful sections/cards.
- Overview visibility/order survives reload and another signed-in device; hiding cards leaves detailed sections available.
- Invalid or expired Garmin credentials request reconnection without logging the user out of Janus.
- Disconnect, data clearing, account isolation, and account deletion behave as documented.
- Garmin is Minerva's default experience; flashcard product controls are removed and legacy routes redirect appropriately.
- Historical flashcard data is retained, and shared authentication, AI provider settings, Aether habits, and Nyx data continue to work.
- Minerva and Janus READMEs describe implemented behaviour accurately, Aether points to Minerva for Garmin, and the required checks pass.
