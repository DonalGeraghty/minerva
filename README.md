# Minerva

Minerva is a private personal finance dashboard built with React and Vite. It reads your own Google Sheets finance workbook through the shared Janus API and adds a rules editor on top. It shares Janus accounts, encrypted AI-provider credentials, and provider/model selection with Aether and Nyx. The former Garmin dashboard has been removed.

## Tabs

- **Dashboard (`/`):** a D3 monthly net waterfall, with a six-month default and selectable presets/custom whole-month ranges. The waterfall builds a running net from zero and shows a gold period total. Select a month to replace the chart with its income, spending categories and refunds, ending at the same monthly net. Back to months restores the original waterfall and date range. Month columns support mouse, touch, and keyboard navigation; category bars and totals are informational. It reconciles in exact cents against Janus monthly totals and rejects mixed snapshot/rule versions. Import controls live in Account; data notes, gaps and stale indicators remain visible.
- **Budget (`/budget`):** AI-assisted mid-month planning using this month and six complete prior months. Generate Save more, Balanced and More breathing room in one assessment, compare spending bars with limit/forecast markers, edit limits and income/bill assumptions, add upcoming context, and reassess explicitly. Actuals refresh against fixed targets. Projections protect expected bills, disclose funding gaps and avoid counting received income twice. Plans and edits survive tab navigation in the current account session.
- **Ledger (`/transactions`):** filterable, paginated transaction table (month, type, category, merchant, search, sorting) with the rule that interpreted each row and excluded/review flags.
- **Rules (`/rules`):** the account-owned finance rule set. Lists, searches and filters rules; adds, edits, enables/disables and deletes them individually (deletes are soft and kept in version history); and imports a rules CSV with a preview step (create/update/unchanged counts, held-for-review and conflicting rows) before an explicit commit. CSV and lossless JSON exports are available, and any previous rule-set version can be restored from the history panel.
- **Ask (`/ask`):** chat with your selected AI provider about the synced ledger. Janus computes a bounded read-only context server-side (the model never calculates) and returns the answer plus provenance (snapshot ID, rule-set version, provider/model, freshness, coverage). Prompts and answers are not stored on the server. The current conversation stays in browser memory during navigation; each answer retains its original provenance.
- **Account (`/account`):** connect, replace or disconnect your Google Sheets finance workbook, manage shared account settings, and sign out.
- **Instructions (`/instructions`):** a human setup guide and copyable/downloadable LLM brief covering navigation, Sheet sharing and approval, ledger columns, manual/CSV rules, supported actions, review-first activation, and provider API-key/model setup. Includes a synthetic example CSV and official provider links. The rule brief uses the application's existing field/operator enums.

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

Connect the workbook in Account: copy the displayed reader email, share your Sheet with it as **Viewer**, paste the spreadsheet link or ID, then choose **Connect and import**. Access renews automatically; no token entry is required. The server must first approve the workbook for your existing Janus account. Knowing another user's spreadsheet link does not grant access.

Janus uses a dedicated, keyless service account with read-only Sheets scope. Setup and administrator approval commands are documented in the Janus repository. Until configuration and approval are complete, Account explains what is missing and disables Connect. Existing token connections can still import data until successfully migrated through the new form.

Connecting verifies access and the ledger header before replacing a saved connection. Import success is confirmed separately with the transaction count. Failed verification preserves the existing connection; failed imports can be retried. Disconnect clears imported data and retains rules. To revoke the reader's Google access too, remove its email from the Sheet's sharing settings.

The architecture is `Minerva -> Janus API -> Google Sheets (read-only)`. Your ChatGPT workflow keeps writing the ledger.

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

## Budget planning

Open Budget and review the import date, latest transaction date and history gaps. Add optional upcoming context and a monthly unallocated cash cushion, then choose **Plan the rest of this month**. Relevant financial history and notes are sent to your selected provider; configure its key/model in Account. Predictions show evidence and confidence. Seasonal reasoning is labelled separately from historical evidence. Cash snapshot totals may include savings and are not added to spending money.

The three approaches are generated together; switching between them makes no further AI call. You can edit category limits, correct expected payments, or add known income/bills. **Update plan** regenerates all approaches and explains changed category limits. **Refresh actual spending** reads the latest Janus import without moving targets; importing the workbook itself remains in Account. Newly recorded income consumes the original outstanding income forecast, and expected bills remain reserved even if an edited limit is too low. Category bars show gross spending; refunds/credits contribute to overall savings.

Plans are session-only and clear on refresh/sign-out. The local demo is explicitly illustrative and does not call AI. Deploy the Janus Budget endpoints before this frontend.

## Tab session state

Switching tabs preserves the Ask conversation and unfinished question, Dashboard period and category drilldown, Ledger filters/sort/page, Rules filters and unfinished edits/import previews, and the Instructions audience. Ask requests can finish while another tab is open. **New conversation** clears the chat and cancels any pending answer. Reports reload on return so imports and rule changes are reflected without resetting your choices. Rule drafts retain the revision they were originally opened against.

This state is held only in memory for the signed-in account. Refreshing, closing the app, signing out or switching accounts clears it; passwords and API-key entry fields are never retained across tabs. Page and named chart/table/chat scroll positions are restored when their content is ready.

## Responsive layout

Dashboard, Ledger and Rules expand across large desktop windows. Waterfalls measure their container and keep a bounded height with readable labels; on small screens, additional columns scroll horizontally inside the chart. Mobile filters stack, and the Ledger table has its own horizontal scroll area. Account forms and reading pages keep a comfortable line length.

## Development

Source organisation: `src/pages` contains the tab screens, `src/components` holds reusable UI, `src/services` contains Janus API requests, and `src/lib/finance.js` contains shared currency/month formatting and period choices. Tests live beside the code they exercise.

```bash
npm run check   # eslint + vitest
npm run build   # vite build + bundle verification
```

For local development, point `VITE_JANUS_API_URL` at a Janus instance and provide that instance with working Firestore/KMS credentials.
