# Minerva

Minerva is being repurposed as a personal Garmin dashboard built with React and Vite. The first milestone adds a Garmin steps Overview and secure connection controls; existing Ask and Flashcards screens remain available during the transition. It shares Janus accounts, encrypted AI-provider credentials, and provider/model selection with Aether and Nyx.

## Garmin milestone: connection and steps

- **Overview (`/`):** daily steps and an available goal for a selected local calendar date. Missing measurements are shown as unavailable; zero steps remains zero.
- **Account (`/account`):** connect, replace, or disconnect a Garmin personal API key. Janus validates the key, encrypts both key and access token with the existing Cloud KMS key, and stores only encrypted credentials in Firestore. The browser sees safe connection metadata only.
- **Freshness:** each steps response shows its last successful update, relative and exact times, a manual Refresh control, and a saved-data warning when refresh fails. Content remains visible during refresh. The app does not poll Garmin in the background.
- **Caching:** Janus reuses fresh account/connection/date-scoped Firestore results. Ranges ending within the recent four-day UTC window use a 15-minute freshness window; older ranges use 24 hours. A manual refresh bypasses freshness, subject to the shared connection refresh lock, a 10-second cooldown, and Garmin rate-limit delays. Steps requests accept at most 28 inclusive days; the current card requests one selected date.
- **Disconnect:** stored secrets are removed, saved history is retained, and reconnecting starts a new cache generation. Disconnect does not revoke the key at Garmin. Shared account deletion removes all Garmin credentials and cache documents as well as the account's other data.
- **Demo:** Garmin requests and credential entry are disabled in the local demo; existing flashcard demo functionality remains available.

Deploy the updated Janus service before this frontend. Existing Firestore access and `AI_KMS_KEY_NAME` configuration are reused; no new Google Cloud service or dependency is required. For local development, point `VITE_JANUS_API_URL` at the updated Janus instance and provide that instance with working Firestore/KMS credentials. Garmin has no plaintext or in-memory credential fallback.

Generate your personal key on [Garmin Connect](https://connect.garmin.com/app/settings/personalApiToken), then enter it in Account. Do not place the key in Vite environment variables or browser storage. Access tokens are renewed server-side; an expired/revoked Garmin connection prompts replacement without ending your Janus session.

The automated checks cover the integration with synthetic Garmin responses and mocked external services. A live Garmin smoke test requires a connected account and configured Google Cloud access.

## Planned repurpose: Garmin dashboard

Minerva will become a dedicated personal Garmin dashboard, replacing its flashcard interface. The connection/steps milestone above is implemented; the remaining endpoint coverage, saved overview preferences, and complete flashcard-interface replacement are planned. The repository, existing deployment, shared Janus login, and account controls will be retained. Aether will remain the habit tracker.

See [Garmin dashboard implementation plan](GARMIN_PLAN.md) for endpoint coverage, credential handling, caching, build sequence, and completion criteria.

- **Overview:** configurable cards for chosen measurements, with visibility and ordering saved to the account and Reset to defaults.
- **Activities:** searchable, paginated history, activity details, associated workouts, and original file downloads.
- **Health:** sleep, heart rate, HRV, stress, Body Battery, steps, hydration, SpO2, fitness age, weight, nutrition, women's health, profile settings, and the remaining documented API data.
- **Account:** Garmin connection and replacement/disconnection, dashboard preferences, and existing shared account settings.

The architecture is `Minerva -> Janus API -> Garmin Personal API`. Janus will use existing Cloud KMS encryption for credentials and the existing Firestore database for account-owned cached responses and preferences. No additional Google Cloud service is needed for the initial design.

Every section/card will have independent loading and error handling, its own last-successful-update time, a Refresh control, and a clear notice when saved data is shown after a Garmin failure. Detailed sections remain available when their overview cards are hidden. The first release covers all 26 endpoints in Janus's `garmin_swagger.md`.

The transition will retain existing flashcards and review history in Janus. Removing those records or retiring flashcard endpoints is a separate decision. Shared account deletion still affects data across Minerva, Aether, and Nyx; clearing only Garmin data will be a separate action. Garmin-to-AI analysis and automatic habit completion are later features.

The flashcard flow, demo instructions, and backend requirements below describe the retained Ask (`/ask`) and Flashcards (`/flashcards`) features during the transition.

## Product flow

1. Ask Minerva a question or request a flashcard in natural language.
2. Review and edit the structured front, back, and suggested tags.
3. Add the card to the rotation explicitly; AI responses are never saved automatically.
4. Review due cards and rate recall as Again, Hard, Good, or Easy.
5. Search, filter, edit, or delete the complete card library.

## Local development

Minerva uses Node.js 24 LTS. With `nvm` installed:

```bash
nvm install
nvm use
npm ci
npm run dev
```

Copy `.env.example` to `.env` when running Janus Gate locally. Otherwise Minerva uses the deployed Janus API.

### Local demo account

The development server also includes a browser-only demo account with seeded Hindi, computing, and history cards:

```text
Email: demo@minerva.local
Password: minerva-demo
```

Use the **Use demo account** button, or sign in with those credentials. The demo is not included in production builds, calls no AI provider, stores no API keys, and keeps its cards only in browser storage.

## Janus Gate requirements

Deploy the accompanying Janus Gate changes before deploying Minerva. They add:

- `POST /api/minerva/respond`
- Flashcard create/list/update/delete endpoints
- The due-card endpoint and review scheduler
- User-scoped Firestore `flashcards` and `flashcard_reviews` collections
- Account-deletion cleanup for both collections

Provider keys remain encrypted by Janus Gate and never reach the browser after submission.

## Quality checks

```bash
npm run check
npm run build
```

The frontend tests cover Garmin connection/replacement/disconnection, steps freshness and refresh failures, missing/zero measurements, obsolete requests after date changes, demo isolation, and the retained card flows. Janus contains Garmin API/cache/credential lifecycle tests alongside existing API, isolation, scheduling, idempotency, and account-deletion tests.

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

1. Create a GitHub repository for Minerva, initialize this folder as its Git repository, and push the `main` branch. This workspace is not currently connected to a GitHub remote.
2. Create an Artifact Registry Docker repository named `minerva` in `europe-west1` in the `donal-geraghty-home` project.
3. Create `minerva-github-deployer@donal-geraghty-home.iam.gserviceaccount.com` (or choose another deployer identity) with permissions to deploy Cloud Run revisions, write to that Artifact Registry repository, and act as the Cloud Run runtime service account when one is configured. The usual roles are `roles/run.admin`, `roles/artifactregistry.writer`, and `roles/iam.serviceAccountUser`.
4. Configure GitHub OpenID Connect / Workload Identity Federation for this repository and grant that identity access to the deployer service account.
5. In the GitHub repository, add the Actions variable `GCP_WORKLOAD_IDENTITY_PROVIDER` with the full workload-identity-provider resource name. Add `GCP_SERVICE_ACCOUNT` only if you chose a name other than the default Minerva deployer account.
6. Optionally add `VITE_JANUS_API_URL` as a GitHub Actions variable if Minerva should use a different Janus Gate URL. The deployed Janus URL is the default.
7. If you are not using Workload Identity Federation, instead add a `GCP_SA_KEY` Actions secret containing a deployer service-account JSON key. This is a fallback; workload identity is preferred.

Then push to `main` (or run **Deploy Minerva to Cloud Run** manually from the Actions tab). The workflow publishes the resulting Cloud Run URL in its run summary.
