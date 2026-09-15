# Minerva

Minerva is an AI-assisted flashcard and active-recall application built with React and Vite. It shares [Janus API](https://github.com/DonalGeraghty/janus-api) accounts, encrypted provider credentials, and provider/model selection with [Aether](https://github.com/DonalGeraghty/aether) and [Nyx](https://github.com/DonalGeraghty/nyx). See [Overall architecture](#overall-architecture) below for how the four services fit together.

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

Copy `.env.example` to `.env` when running Janus API locally. Otherwise Minerva uses the deployed Janus API.

The full-resolution generated icon is retained in `artwork/`. Regenerate the optimized favicon, Apple touch icon, and UI icon with `npm run icons`.

### Local demo account

The development server also includes a browser-only demo account with seeded Hindi, computing, and history cards:

```text
Email: demo@minerva.local
Password: minerva-demo
```

Use the **Use demo account** button, or sign in with those credentials. The demo is not included in production builds, calls no AI provider, stores no API keys, and keeps its cards only in browser storage.

## Janus API requirements

Minerva depends on this Janus API functionality, already implemented and deployed:

- `POST /api/minerva/respond`
- Flashcard create/list/update/delete endpoints
- The due-card endpoint and review scheduler
- User-scoped Firestore `flashcards` and `flashcard_reviews` collections
- Account-deletion cleanup for both collections

Provider keys remain encrypted by Janus API and never reach the browser after submission.

## Quality checks

```bash
npm run check
npm run build
```

The frontend tests cover confirmation-only card creation and the due-card review flow. Janus API contains API, isolation, scheduling, idempotency, and account-deletion tests. The production build also verifies that development-only demo fixtures are absent and that public icon assets stay within their size budgets.

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

- [Janus API](https://github.com/DonalGeraghty/janus-api) — shared Flask backend for authentication, encrypted AI-provider credentials, and workout/nutrition/flashcard storage
- [Aether](https://github.com/DonalGeraghty/aether) — sibling frontend for workout tracking
- [Nyx](https://github.com/DonalGeraghty/nyx) — sibling frontend for nutrition tracking

## Overall architecture

Minerva is one of three independently deployed React/Vite frontends built around a single shared backend, [Janus API](https://github.com/DonalGeraghty/janus-api). All four services run as separate Cloud Run services in the same Google Cloud project (`donal-geraghty-home`, region `europe-west1`).

```text
Aether (React/Vite, Cloud Run)   ─┐
Minerva (React/Vite, Cloud Run)  ─┼─▶ Janus API (Flask, Cloud Run) ─┬─▶ Firestore
Nyx (React/Vite, Cloud Run)      ─┘                                 │     (users, credentials, nutrition,
                                                                     │      workouts, flashcards)
                                                                     ├─▶ Cloud KMS
                                                                     │     (encrypts each user's provider key)
                                                                     ├─▶ OpenAI / Mistral AI / Anthropic
                                                                     │     (called with the user's own key)
                                                                     └─▶ Cloud Scheduler
                                                                           (Web Push reminders, every 5 minutes)
```

- All three frontends build the same way: a Node build stage produces a Vite bundle, served by an `nginx:alpine` container on port `8080` with SPA fallback and immutable asset caching. Each has its own Artifact Registry repository and its own `deploy-gcp.yml` workflow that builds, pushes, and runs `gcloud run deploy`, preferring Workload Identity Federation with a `GCP_SA_KEY` secret as a fallback — the pattern described above under "First GitHub Actions deployment."
- Janus API deploys differently: it builds directly from source with `gcloud run deploy --source .`, so it has no Artifact Registry step and authenticates with a static `GCP_SA_KEY` secret rather than Workload Identity Federation.
- Minerva points at Janus API via the `VITE_JANUS_API_URL` build argument (see "Local development" above). Because Aether and Nyx point at the same Janus API deployment and Firestore project, a single account's login session, encrypted AI-provider keys, and selected provider/model are shared across all three apps — only each app's own flashcard, workout, or nutrition data stays separate.
- Minerva calls Janus API's `/api/minerva/*` and `/api/flashcards/*` endpoints, plus the shared `/api/auth/*` and `/api/user/*` endpoints for account and AI-credential management. Aether and Nyx call their own equivalent endpoints on the same backend.
