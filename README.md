# Minerva

Minerva is a personal Garmin dashboard built with React and Vite. It provides steps, sleep, recent activities, and secure Garmin connection controls. It shares Janus accounts, encrypted AI-provider credentials, and provider/model selection with Aether and Nyx.

## Garmin overview

- **Overview (`/`):** a shared calendar-date selector and independent steps, sleep, and recent-activity cards. Steps show the daily total and available goal. Sleep shows main sleep duration, overall score out of 100 when returned, and deep/light/REM/awake durations. Missing measurements are unavailable; recorded zero values remain zero.
- **Recent activities:** the latest five activities in the 28 calendar days ending on the selected date, inclusive. Summaries show name/type, recorded local start time, duration, and distance in kilometres. Multisport child activities are excluded. Empty history and missing sleep have explicit empty states.
- **Account (`/account`):** connect, replace, or disconnect a Garmin personal API key. Janus validates the key, encrypts both key and access token with the existing Cloud KMS key, and stores only encrypted credentials in Firestore. The browser sees safe connection metadata only.
- **Freshness:** every card shows its own successful update time, manual Refresh control, returned-data inspection, and saved-data warning when refresh fails. Existing content remains visible during refresh. A failed or pending card leaves the others usable. The app does not poll Garmin in the background.
- **Caching:** Janus reuses account/connection/resource/date-scoped Firestore results. Recent data uses 15-minute freshness; older data uses 24 hours. Each resource has a refresh lock and minimum 10-second cooldown, allowing the three cards to load independently. Actual Garmin rate-limit delays apply across the connection. Manual refresh affects only its own card. Steps and sleep request the selected date; activities request a bounded 28-day range.
- **Disconnect:** stored secrets are removed, saved history is retained, and reconnecting starts a new cache generation. Disconnect does not revoke the key at Garmin. Shared account deletion removes all Garmin credentials and cache documents as well as the account's other data.
- **Demo:** The local preview has no Garmin connection, seeded study content, or credential entry.

Deploy the updated Janus service before this frontend. Existing Firestore access and `AI_KMS_KEY_NAME` configuration are reused; no new Google Cloud service or dependency is required. For local development, point `VITE_JANUS_API_URL` at the updated Janus instance and provide that instance with working Firestore/KMS credentials. Garmin has no plaintext or in-memory credential fallback.

Generate your personal key on [Garmin Connect](https://connect.garmin.com/app/settings/personalApiToken), then enter it in Account. Do not place the key in Vite environment variables or browser storage. Access tokens are renewed server-side; an expired/revoked Garmin connection prompts replacement without ending your Janus session.

The automated checks cover the integration with synthetic Garmin responses and mocked external services. A live Garmin smoke test requires a connected account and configured Google Cloud access.

## Planned dashboard expansion

Steps, sleep, and recent activity summaries are implemented, and the former study interface has been removed. Remaining endpoint coverage and saved overview preferences are planned. The repository, existing deployment, shared Janus login, and account controls will be retained. Aether will remain the habit tracker.

See [Garmin dashboard implementation plan](GARMIN_PLAN.md) for endpoint coverage, credential handling, caching, build sequence, and completion criteria.

- **Overview:** configurable cards for chosen measurements, with visibility and ordering saved to the account and Reset to defaults.
- **Activities:** searchable, paginated history, activity details, associated workouts, and original file downloads.
- **Health:** sleep, heart rate, HRV, stress, Body Battery, steps, hydration, SpO2, fitness age, weight, nutrition, women's health, profile settings, and the remaining documented API data.
- **Account:** Garmin connection and replacement/disconnection, dashboard preferences, and existing shared account settings.

The architecture is `Minerva -> Janus API -> Garmin Personal API`. Janus will use existing Cloud KMS encryption for credentials and the existing Firestore database for account-owned cached responses and preferences. No additional Google Cloud service is needed for the initial design.

Every section/card will have independent loading and error handling, its own last-successful-update time, a Refresh control, and a clear notice when saved data is shown after a Garmin failure. Detailed sections remain available when their overview cards are hidden. The first release covers all 26 endpoints in Janus's `garmin_swagger.md`.

The former Ask, Flashcards, Gallery, and card-context controls have been removed, along with their client code and Janus endpoints. Old browser links redirect to Overview. Historical flashcards and review records remain stored until explicit account deletion; only legacy deletion support remains in Janus. Shared account deletion still affects data across Minerva, Aether, and Nyx; clearing only Garmin data will be a separate action. Garmin-to-AI analysis and automatic habit completion are later features.

## Product flow

1. Sign in with your shared Janus account.
2. Connect a Garmin personal API key in Account.
3. Open Overview, choose a date, and inspect steps, sleep, and recent activities in its 28-day window.
4. Use Refresh and the update timestamps to understand freshness.
5. Manage Garmin and shared AI connections in Account.

## Local development

Minerva uses Node.js 24 LTS. With `nvm` installed:

```bash
nvm install
nvm use
npm ci
npm run dev
```

Copy `.env.example` to `.env` when running Janus API locally. Otherwise Minerva uses the deployed Janus API.

The full-resolution generated icon is retained in `artwork/`. Regenerate the optimized favicon, Apple touch icon, and UI icon with `npm run icons`.

### Local preview

Development builds offer a local demo identity for previewing the shell and account states. It does not seed study data, read old browser card storage, contact Garmin, or save credentials. Existing legacy browser storage is left untouched. Use a real Janus account for Garmin data.

## Janus API requirements

The backend must provide the Garmin connection and steps endpoints documented above, shared authentication, AI credential/model settings, and complete account-deletion cleanup. The former flashcard, study assistant, and card-context settings endpoints are retired and return 404.

## Quality checks

```bash
npm run check
npm run build
```

The frontend tests cover Garmin connection/replacement/disconnection, steps freshness and refresh failures, missing/zero measurements, obsolete requests after date changes, demo isolation, and redirects from retired study URLs. Janus contains Garmin API/cache/credential lifecycle tests alongside existing API, isolation, scheduling, idempotency, and account-deletion tests.

## Cloud Run

The production container builds the Vite app and serves it through nginx on port `8080`, including SPA fallback and `/health`.

```bash
gcloud run deploy minerva \
  --source . \
  --project donal-geraghty-home \
  --region europe-west1 \
  --allow-unauthenticated \
  --port 8080
```

The GitHub Actions workflow expects an Artifact Registry repository named `minerva`. Configure `GCP_WORKLOAD_IDENTITY_PROVIDER` (and optionally `GCP_SERVICE_ACCOUNT`), or provide the temporary `GCP_SA_KEY` fallback, before the first automated deployment.

### First GitHub Actions deployment

The workflow at `.github/workflows/deploy-gcp.yml` follows the Aether Cloud Run pattern: it checks every pull request and builds, pushes, deploys, then health-checks a publicly accessible Minerva service for pushes to `main` or `master`.

Before the first push, complete these one-time Google Cloud and GitHub steps:

1. Create an Artifact Registry Docker repository named `minerva` in `europe-west1` in the `donal-geraghty-home` project.
2. Create `minerva-github-deployer@donal-geraghty-home.iam.gserviceaccount.com` (or choose another deployer identity) with permissions to deploy Cloud Run revisions, write to that Artifact Registry repository, and act as the Cloud Run runtime service account when one is configured. The usual roles are `roles/run.admin`, `roles/artifactregistry.writer`, and `roles/iam.serviceAccountUser`.
3. Configure GitHub OpenID Connect / Workload Identity Federation for this repository and grant that identity access to the deployer service account.
4. In the GitHub repository, add the Actions variable `GCP_WORKLOAD_IDENTITY_PROVIDER` with the full workload-identity-provider resource name. Add `GCP_SERVICE_ACCOUNT` only if you chose a name other than the default Minerva deployer account.
5. Optionally add `VITE_JANUS_API_URL` as a GitHub Actions variable if Minerva should use a different Janus API URL. The deployed Janus API URL is the default.
6. If you are not using Workload Identity Federation, instead add a `GCP_SA_KEY` Actions secret containing a deployer service-account JSON key. This is a fallback; workload identity is preferred.

Then push to `main` (or run **Deploy Minerva to Cloud Run** manually from the Actions tab). The workflow publishes the resulting Cloud Run URL in its run summary.

## Related projects

- [Janus API](https://github.com/DonalGeraghty/janus-api) — shared Flask backend for authentication, encrypted AI-provider credentials, and Garmin, habit, and nutrition storage
- [Aether](https://github.com/DonalGeraghty/aether) — sibling frontend for habit tracking
- [Nyx](https://github.com/DonalGeraghty/nyx) — sibling frontend for nutrition tracking

## Overall architecture

Minerva is one of three independently deployed React/Vite frontends built around a single shared backend, [Janus API](https://github.com/DonalGeraghty/janus-api). All four services run as separate Cloud Run services in the same Google Cloud project (`donal-geraghty-home`, region `europe-west1`).

```text
Aether (React/Vite, Cloud Run)   ─┐
Minerva (React/Vite, Cloud Run)  ─┼─▶ Janus API (Flask, Cloud Run) ─┬─▶ Firestore
Nyx (React/Vite, Cloud Run)      ─┘                                 │     (users, credentials, nutrition,
                                                                     │      habits, Garmin cache)
                                                                     ├─▶ Cloud KMS
                                                                     │     (encrypts each user's provider key)
                                                                     ├─▶ OpenAI / Mistral AI / Anthropic
                                                                     │     (called with the user's own key)
                                                                     └─▶ Cloud Scheduler
                                                                           (Web Push reminders, every 5 minutes)
```

- All three frontends build the same way: a Node build stage produces a Vite bundle, served by an `nginx:alpine` container on port `8080` with SPA fallback and immutable asset caching. Each has its own Artifact Registry repository and its own `deploy-gcp.yml` workflow that builds, pushes, and runs `gcloud run deploy`, preferring Workload Identity Federation with a `GCP_SA_KEY` secret as a fallback — the pattern described above under "First GitHub Actions deployment."
- Janus API deploys differently: it builds directly from source with `gcloud run deploy --source .`, so it has no Artifact Registry step and authenticates with a static `GCP_SA_KEY` secret rather than Workload Identity Federation.
- Minerva points at Janus API via the `VITE_JANUS_API_URL` build argument (see "Local development" above). Because Aether and Nyx point at the same Janus API deployment and Firestore project, a single account's login session, encrypted AI-provider keys, and selected provider/model are shared across all three apps — Garmin, habit, and nutrition records remain separate.
- Minerva calls Janus API's `/api/garmin/*` endpoints, plus the shared `/api/auth/*` and `/api/user/*` endpoints for account and AI-credential management. Aether and Nyx call their own equivalent endpoints on the same backend.
