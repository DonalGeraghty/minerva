# Minerva

Minerva is a private personal finance dashboard built with React and Vite. It reads your own Google Sheets finance workbook through the shared Janus API and adds a rules editor on top. It shares Janus accounts, encrypted AI-provider credentials, and provider/model selection with Aether and Nyx. The former Garmin dashboard has been removed.

## Tabs

- **Rules (`/rules`, also `/`):** the account-owned finance rule set. Lists, searches and filters rules; adds, edits, enables/disables and deletes them individually (deletes are soft and kept in version history); and imports a rules CSV with a preview step (create/update/unchanged counts, held-for-review and conflicting rows) before an explicit commit. CSV and lossless JSON exports are available, and any previous rule-set version can be restored from the history panel.
- **Account (`/account`):** connect, replace or disconnect your Google Sheets finance workbook, manage shared account settings, and sign out.

## Finance connection

Before the Rules tab works, connect your own workbook on the Account page: paste a Google OAuth access token with the read-only `https://www.googleapis.com/auth/spreadsheets.readonly` scope (for example from the [OAuth 2.0 Playground](https://developers.google.com/oauthplayground)) and the workbook ID from your Sheets URL. Janus stores the token KMS-encrypted per account — the same model as the AI provider keys — and only ever reads the workbook; your ChatGPT workflow keeps writing the ledger. Until a connection exists, finance routes return `403 finance_not_connected` and the Rules tab shows a connect link. Playground access tokens expire after about an hour; use "Replace token" in Account when that happens. The browser only ever sees safe metadata (workbook ID, token last four).

The architecture is `Minerva -> Janus API -> Google Sheets (read-only)`. Janus uses Cloud KMS for credentials and Firestore for account-owned rules and settings. No new Google Cloud service or dependency is required.

## Demo

The local preview (`npm run dev`) offers a demo account that never contacts Janus for finance or stores any data.

## Development

```bash
npm run check   # eslint + vitest
npm run build   # vite build + bundle verification
```

For local development, point `VITE_JANUS_API_URL` at a Janus instance and provide that instance with working Firestore/KMS credentials.
