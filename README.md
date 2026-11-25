# Minerva

Minerva is a personal finance agent and private dashboard built with React and Vite. It reads your own Google Sheets finance workbook through the shared Janus API and adds a rules editor on top. It shares Janus accounts, encrypted AI-provider credentials, and provider/model selection with Aether and Nyx. The former Garmin dashboard has been removed.

## Tabs

- **Dashboard (`/`):** a D3 monthly net waterfall, with a six-month default and selectable presets/custom whole-month ranges. The waterfall builds a running net from zero and shows a gold period total. Select a month to replace the chart with its income, spending categories and refunds, ending at the same monthly net. Back to months restores the original waterfall and date range. Month columns support mouse, touch, and keyboard navigation; category bars and totals are informational. It reconciles in exact cents against Janus monthly totals and rejects mixed snapshot/rule versions. Import controls live in Account; data notes, gaps and stale indicators remain visible.
- **Budget (`/budget`):** One responsive D3 chart with category spending, AI-set limits and remaining amounts. Switch Save more, Balanced or More flexibility instantly; Update with AI assesses the current month and six prior months. Click a bar for recorded merchants, upcoming bills and the reasoning. Plans and selected modes survive tab navigation in the current account session.
- **Ledger (`/transactions`):** filterable, paginated transaction table (month, type, category, merchant, search, sorting) with the rule that interpreted each row and excluded/review flags.
- **Rules (`/rules`):** the account-owned finance rule set. Lists, searches and filters rules; adds, edits, enables/disables and deletes them individually (deletes are soft and kept in version history); and imports a rules CSV with a preview step (create/update/unchanged counts, held-for-review and conflicting rows) before an explicit commit. CSV and lossless JSON exports are available, and any previous rule-set version can be restored from the history panel.
- **Ask (`/ask`):** ask your selected AI provider about the synced ledger. Minerva chooses read-only Janus tools for exact period/category/merchant totals, breakdowns, comparisons and small transaction pages. Janus performs the calculations against one pinned snapshot/rule version. Replies show sources checked alongside provenance (snapshot ID, rule-set version, provider/model, freshness, coverage). Prompts and answers are not stored on the server. The current conversation stays in browser memory during navigation; each answer retains its original provenance.
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

Budget centres on a single D3 chart and a projected month-end balance. **Update with AI** generates three approaches from the current month and six prior months using your selected provider. Switching **Save more / Balanced / More flexibility** animates the limits and shows a short AI analysis below the projected balance without another AI call. All three paragraphs are generated with the assessment and reflect the evidence available at that update. Click a category for its largest recorded merchants, AI reasoning and reserved bills. Bars share one scale; spending beyond a limit is highlighted. Refunds contribute to the headline balance rather than reducing gross spending bars.

Actuals refresh when you return to the tab; targets stay fixed until reassessment. While assessing, a compact progress message follows backend stages (checking spending, reviewing income/bills, preparing limits, or refining a proposal). Progress survives tab navigation; older JSON-only Janus deployments retain a generic assessment message. Expected bills remain reserved until reassessment, and received forecast income is never counted twice. Existing savings are not added as spending money. Notes, cushion inputs, manual editors, forecast comparison markers and the previous-plan comparison have been removed.

Plans are session-only and clear on refresh/sign-out. The local demo is illustrative and does not call AI. Deploy this frontend before the simplified Janus Budget API, which accepts an empty assessment request. The new frontend also works with the preceding API.

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

## Frontend code layout

`context/TabSessionContext.jsx` owns account-scoped tab state, pending-request cleanup and scroll restoration. The Ask and Budget request flows live in `hooks/useAskConversation.js` and `hooks/useBudgetPlan.js`. API modules in `services/` handle transport; reusable money formatting and file downloads live in `lib/finance.js` and `lib/download.js`. Page and chart styles live beside their components; `styles.css` contains the shared theme and controls.

## Read-only finance agent

Ask starts with a small current-month overview, coverage and freshness. Native tool calling on OpenAI, Anthropic and Mistral lets the model request only relevant results from Janus. Each result labels dates, filters, refunds, coverage gaps and pagination. Questions such as “groceries last month” can retrieve the exact monthly total without sending a transaction dump. The Sources checked detail shows successful queries for each answer.

Janus allows three query rounds, at most six executed queries and two per round, followed by one final answer call. Tool results are limited to 8 KB each and 24 KB across an answer, with a 75-second orchestration deadline and per-call timeouts. The agent has no write, arbitrary SQL, external network or account-selection tools. The local demo still blocks external AI calls. Deploy the Janus agent backend before this branding update; the UI tolerates answers without source metadata.
