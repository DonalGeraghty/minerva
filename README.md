# Minerva

Minerva is an AI-assisted flashcard and active-recall application built with React and Vite. It shares Janus Gate accounts, encrypted provider credentials, and provider/model selection with Aether and Nyx.

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

The frontend tests cover confirmation-only card creation and the due-card review flow. Janus Gate contains API, isolation, scheduling, idempotency, and account-deletion tests.

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
