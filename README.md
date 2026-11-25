# Minerva

Minerva is a private personal finance dashboard built with React and Vite. It reads your own Google Sheets finance workbook through the shared Janus API and adds a rules editor on top. It shares Janus accounts, encrypted AI-provider credentials, and provider/model selection with Aether and Nyx. The former Garmin dashboard has been removed.

## Tabs

- **Dashboard (`/`):** one D3 waterfall showing monthly net cash flow, with a six-month default and selectable presets or custom whole-month ranges. Floating green/red columns build a running net from zero; a gold column shows the selected period total. Exact figures are available on hover or keyboard focus. The chart reconciles against the Janus total and rejects mixed snapshot/rule versions. Import controls live in Account; data notes, gaps and stale indicators remain visible.
- **Ledger (`/transactions`):** filterable, paginated transaction table (month, type, category, merchant, search, sorting) with the rule that interpreted each row and excluded/review flags.
- **Rules (`/rules`):** the account-owned finance rule set. Lists, searches and filters rules; adds, edits, enables/disables and deletes them individually (deletes are soft and kept in version history); and imports a rules CSV with a preview step (create/update/unchanged counts, held-for-review and conflicting rows) before an explicit commit. CSV and lossless JSON exports are available, and any previous rule-set version can be restored from the history panel.
- **Ask (`/ask`):** chat with your selected AI provider about the synced ledger. Janus computes a bounded read-only context server-side (the model never calculates) and returns the answer plus provenance (snapshot ID, rule-set version, provider/model, freshness, coverage). Prompts and answers are not stored; each answer shows the privacy note.
- **Account (`/account`):** connect, replace or disconnect your Google Sheets finance workbook, manage shared account settings, and sign out.

## Finance connection

The setup flow is **Account → import Sheet data → Rules → Ledger → Dashboard**.
Connecting or replacing credentials starts a read-only data import automatically.
Account confirms completion with the transaction count and keeps the last import
date and coverage visible. If importing fails, the saved connection remains and
**Import data** retries it. **Import latest data** refreshes an existing import.

Create your rules separately in ChatGPT, then upload the CSV in Rules, review the
preview, and commit the import. Active executable rules apply to the imported data
when you open the ledger or dashboard; no second Sheet import is needed. Review,
disabled and reference-only rules do not execute. Ledger entries preserve the
source values alongside interpreted values. Charts aggregate the same interpreted
ledger in Janus. Source transactions can be viewed before rules are imported.

Before the Rules tab works, connect your own workbook on the Account page: paste a Google OAuth access token with the read-only `https://www.googleapis.com/auth/spreadsheets.readonly` scope (for example from the [OAuth 2.0 Playground](https://developers.google.com/oauthplayground)) and the workbook ID from your Sheets URL. Janus stores the token KMS-encrypted per account — the same model as the AI provider keys — and only ever reads the workbook; your ChatGPT workflow keeps writing the ledger. Until a connection exists, finance routes return `403 finance_not_connected` and the Rules tab shows a connect link. Playground access tokens expire after about an hour; use "Replace token" in Account when that happens. The browser only ever sees safe metadata (workbook ID, token last four).

The architecture is `Minerva -> Janus API -> Google Sheets (read-only)`. Janus uses Cloud KMS for credentials and Firestore for account-owned rules and settings. No new Google Cloud service or dependency is required.

## Demo

Run both apps from the sibling Janus checkout:

```powershell
cd C:\GitHub\janus-api
.\.venv\Scripts\python.exe start_local_demo.py
```

Open http://127.0.0.1:5173 and click **Use demo account**. The login is
`demo@minerva.local` / `minerva-demo`. This uses real local Janus authentication
and finance endpoints with six months of synthetic transactions and wealth data.
The demo has four positive and two negative months, including a bonus, travel,
car repairs and appliance replacement alongside recurring expenses.
All demo changes reset when Janus restarts. AI calls and Google connections are
disabled; no cloud credentials are needed. Ctrl+C stops both apps.

To start the services separately, run `run_demo.py` in Janus, then
`npm run dev:demo` here. The demo command pins Janus to http://127.0.0.1:5000
and Minerva to http://127.0.0.1:5173, overriding any production API URL in `.env`.
Normal `npm run dev` retains the configured API and does not offer the demo button.
Production builds exclude the demo credentials.

## Development

```bash
npm run check   # eslint + vitest
npm run build   # vite build + bundle verification
```

For local development, point `VITE_JANUS_API_URL` at a Janus instance and provide that instance with working Firestore/KMS credentials.
