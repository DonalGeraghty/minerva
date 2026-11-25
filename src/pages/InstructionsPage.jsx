import { useTabState, useTabScroll } from '../context/TabSessionContext.jsx'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Brand from '../components/Brand.jsx'
import { downloadText } from '../lib/download.js'
import { EXAMPLE_RULES, LLM_RULE_BRIEF, SHEET_HEADER } from '../lib/ruleGuide.js'
import './InstructionsPage.css'

const providers = [
  ['OpenAI', 'https://platform.openai.com/api-keys', 'https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform'],
  ['Claude / Anthropic', 'https://platform.claude.com/settings/keys', 'https://platform.claude.com/docs/en/get-api-key'],
  ['Mistral', 'https://console.mistral.ai/api-keys/', 'https://docs.mistral.ai/getting-started/quickstarts/studio/activate-and-generate-api-key'],
]

function Chapter({ number, title, id, children }) {
  return <section className="guide-chapter" id={id}><div className="guide-chapter-heading"><span>{number}</span><h2>{title}</h2></div>{children}</section>
}

export default function InstructionsPage() {
  const [audience, setAudience] = useTabState('instructions.audience', 'people')
  const [notice, setNotice] = useState('')
  useTabScroll('instructions', true)
  const brief = useRef(null)
  async function copyBrief() {
    try { await navigator.clipboard.writeText(LLM_RULE_BRIEF); setNotice('LLM brief copied. Paste it into your preferred AI chat, then add anonymised examples.') }
    catch { brief.current?.focus(); brief.current?.select(); setNotice('Select the brief below and copy it manually, or download the text file.') }
  }
  return <main className="page instructions-page">
    <Brand />
    <header className="guide-hero"><div><p className="eyebrow">The Minerva field guide</p><h1>A clearer way<br />to get started.</h1><p>Connect your data. Give it some rules.<br />Find the changes worth your attention.</p></div><div className="guide-orbit" aria-hidden="true"><span>01 <i>Connect</i></span><span>02 <i>Interpret</i></span><span>03 <i>Understand</i></span><b>m.</b></div></header>
    <div className="guide-toolbar"><div className="guide-audience" role="group" aria-label="Guide audience"><button aria-pressed={audience === 'people'} onClick={() => setAudience('people')}>For people</button><button aria-pressed={audience === 'llms'} onClick={() => setAudience('llms')}>For LLMs</button></div><span>A guide for you, and the AI helping you.</span></div>
    {audience === 'people' ? <div className="guide-layout">
      <nav className="guide-contents" aria-label="Instructions contents"><p>IN THIS GUIDE</p>{[['overview', 'Find your way'], ['sheet', 'Connect a Sheet'], ['rules', 'Create & import rules'], ['ai', 'Connect your AI'], ['routine', 'Your next visit']].map(([id, label], index) => <a key={id} href={`#${id}`}><small>0{index + 1}</small>{label}</a>)}<button className="secondary-button" onClick={() => setAudience('llms')}>Get the LLM brief ↗</button></nav>
      <div>
        <Chapter id="overview" number="01" title="Find your way.">
          <p>Minerva turns your Google Sheet into a rule-adjusted ledger and charts. Your Sheet is the source of truth; Minerva reads it through Janus.</p>
          <div className="guide-destinations">{[['/account', 'Account', 'Connect the workbook and your AI provider.'], ['/rules', 'Rules', 'Define how transactions are interpreted.'], ['/transactions', 'Ledger', 'Inspect source values, applied rules and exclusions.'], ['/', 'Dashboard', 'See monthly net cash flow and what changed.'], ['/ask', 'Ask', 'Ask your selected AI about the imported data.']].map(([to, title, text]) => <Link key={to} to={to}><strong>{title}<span>↗</span></strong><p>{text}</p></Link>)}</div>
          <p className="guide-note">You can import data before you have rules. AI credentials are needed for Ask; connecting a Sheet, importing rules and viewing charts work independently.</p>
        </Chapter>
        <Chapter id="sheet" number="02" title="Connect your Sheet.">
          <ol><li>Sign in and open <Link to="/account">Account → Google Sheets</Link>.</li><li>Copy the displayed reader email. In Google Sheets, open <strong>Share</strong>, add that email and choose <strong>Viewer</strong>.</li><li>Ask the Minerva administrator to approve this workbook for your exact Minerva login. Sharing grants Janus Google access; approval links that workbook to your account.</li><li>Paste the spreadsheet link or ID into Account and choose <strong>Connect and import</strong>.</li><li>Wait for <strong>Import complete</strong> and the transaction count. A saved connection alone does not mean data has been imported.</li></ol>
          <p>Access renews automatically. When your Sheet changes, use <strong>Import latest data</strong> in Account. If importing fails, use the retry action; check sharing and approval if access is denied.</p>
          <details><summary>Preparing the spreadsheet</summary><p>The ledger tab must be named <code>combined data</code>. Use these column headings; Janus maps columns by name:</p><pre className="guide-code">{SHEET_HEADER}</pre><p>The required headings are Transaction ID, Date, Amount EUR, Type and Include provisional totals. Include Month as YYYY-MM, stable transaction IDs and the other columns where available. Dates may be native Sheet dates or YYYY-MM-DD. Amount EUR is signed: inflows positive, outflows negative. Type uses Income, Expense, Refund or Transfer. Only inclusion <strong>YES</strong> is eligible; use <strong>NO</strong> for explicit exclusions. Keep unknown values blank.</p><p>An optional <code>snapshot</code> tab supplies balance reports. Raw bank tabs are supporting records, not extra transactions to add to the combined ledger.</p></details>
          <p className="guide-note">Disconnect clears imported data while retaining rules. To revoke Google access too, remove the reader email from the Sheet’s sharing settings.</p>
        </Chapter>
        <Chapter id="rules" number="03" title="Give your data some rules.">
          <p>A rule has a condition and an action: <em>when merchant equals Example Market, set category to Groceries</em>. It changes the interpretation, while preserving the source row.</p>
          <ol><li>Open <Link to="/rules">Rules</Link> and add a rule manually, or use the LLM brief below to generate a CSV in a separate AI chat.</li><li>For a manual rule, choose a stable unique ID, a field/operator/value, an action and priority. Use <strong>Janus</strong> scope for executable rules. Begin in <strong>Review</strong> until you have checked the effect.</li><li>For a CSV, choose the file and inspect the preview. Confirm creates and updates; examine held rows and conflicts before committing.</li><li>Commit the import, then activate only the rules you agree with. Review and disabled rules do not execute.</li><li>Open the Ledger and check affected rows and their interpreted values. The Dashboard uses those results; a second Sheet import is unnecessary.</li></ol>
          <p>If your LLM returns CSV text, save it as a UTF-8 <code>.csv</code> file before choosing it in Rules. The downloadable example shows the expected format and starts in Review.</p>
          <div className="guide-actions"><button className="secondary-button" onClick={() => setAudience('llms')}>Get a prompt for your LLM ↗</button><button className="secondary-button" onClick={() => downloadText('minerva-example-rules.csv', EXAMPLE_RULES)}>Download example CSV</button></div>
          <details><summary>Actions, priority and history</summary><p><strong>Set category</strong> assigns a category; <strong>Classify</strong> assigns a transaction type; <strong>Exclude</strong> removes a row from adjusted totals; <strong>Flag</strong> marks it for review and keeps it in totals. Allocate and reverse are specialised sinking-fund actions that require supporting evidence.</p><p>Higher priorities win within each effect: accounting, category override and review flag. Rule ID breaks ties. Conditions do not chain through other rules’ changes. Source exclusions and integrity checks remain authoritative. Reference policies, including allow/include, are not general row actions.</p><p>Export your current rules before substantial changes. Importing an existing ID updates that rule. History can restore a previous rule-set version; deletions are retained in history.</p></details>
        </Chapter>
        <Chapter id="ai" number="04" title="Connect your AI.">
          <p>These are provider <strong>API keys</strong>. They are separate from your Google Sheets connection. One configured provider is enough to use Ask. Provider and model settings are shared through your Janus account with its sibling apps.</p>
          <div className="guide-provider-grid">{providers.map(([name, keys, docs]) => <div key={name}><strong>{name}</strong><a href={keys} target="_blank" rel="noreferrer">Create an API key ↗</a><a href={docs} target="_blank" rel="noreferrer">Provider setup / billing guide ↗</a></div>)}</div>
          <ol><li>Open your chosen provider’s API console, create a key and check API billing or available credits. Chat subscriptions and API billing are managed separately; check your actual API balance.</li><li>In <Link to="/account">Account</Link>, find that provider’s key card. Paste the key and save it. Janus verifies and encrypts the key; it is not returned to the browser.</li><li>Under <strong>AI profile → Choose the mind</strong>, select the same provider, choose an available model and click <strong>Save profile</strong>.</li><li>Open Ask and try a question about your imported ledger, such as “What changed in my cash flow between the last two completed months?”</li></ol>
          <p>If a key is connected but generation fails, check billing/credit, model access and provider limits. Replace an expired or revoked key in its card. Removing a saved key disconnects that provider; choose and save another configured provider to switch.</p>
          <p className="guide-note">Ask sends your question, recent conversation and a server-prepared financial context to the selected provider. Keep keys out of chats, CSVs and rule descriptions. Use the Ledger to verify answers. The local demo uses synthetic data and disables AI calls and external connection changes.</p>
        </Chapter>
        <Chapter id="routine" number="05" title="A useful next visit."><p>After updating the Sheet, import the latest data in Account. Set the Dashboard period, then review the monthly net waterfall. Open Ledger to inspect the transactions behind the figures.</p><p>Use Ledger filters to investigate a month or category. Check data notes, coverage gaps and review flags before acting.</p><div className="guide-actions"><Link className="primary-button" to="/account">Start in Account ↗</Link><Link className="secondary-button" to="/">See the dashboard</Link></div></Chapter>
      </div>
    </div> : <section className="guide-llm-panel" aria-label="LLM instructions"><div><p className="eyebrow">A brief your assistant can use</p><h2>Better context.<br />Better rules.</h2><p>Copy this into your preferred LLM, then supply your preferences, exported rules and a small anonymised sample. It includes the CSV contract, supported actions and a review-first handoff.</p><div className="guide-actions"><button className="primary-button" onClick={copyBrief}>Copy LLM brief</button><button className="secondary-button" onClick={() => downloadText('minerva-llm-instructions.txt', LLM_RULE_BRIEF, 'text/plain')}>Download brief</button></div><p className="guide-note">The brief is guidance for a separate AI chat. It does not grant access to Minerva or perform an import. You review and activate the resulting rules.</p></div><div><label htmlFor="llm-rule-brief">Minerva instructions for an LLM</label><textarea id="llm-rule-brief" ref={brief} readOnly value={LLM_RULE_BRIEF} spellCheck={false} /></div></section>}
    {notice && <p className="guide-notice" role="status">{notice}</p>}
  </main>
}
