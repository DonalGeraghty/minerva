import { lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import Brand from '../components/Brand.jsx'
import { useTabScroll } from '../context/TabSessionContext.jsx'
import { useAskConversation } from '../hooks/useAskConversation.js'
import { monthLabel } from '../lib/finance.js'
import './AskPage.css'

const ChatMarkdown = lazy(() => import('../components/ChatMarkdown.jsx'))

export default function AskPage() {
  const { messages, input, busy, error, errorCode, meta, setInput, ask, newConversation } = useAskConversation()
  useTabScroll('ask')

  return (
    <main className="page finance-page ask-page">
      <Brand />
      <section className="page-hero">
        <p className="eyebrow">Your finance agent · Read-only</p>
        <h1>Ask Minerva.</h1>
        <p>A question is enough. Minerva checks the relevant dates, categories and transactions to find your answer. Your conversation stays here as you move between tabs and clears on refresh or sign-out.</p>
      </section>
      <section className="app-panel" aria-label="Finance chat">
        <button className="secondary-button" type="button" onClick={newConversation} disabled={!messages.length && !input}>New conversation</button>
        <p id="finance-chat-privacy" className="settings-message">{meta?.privacy || 'Your question and the relevant financial results from your imported workbook are sent to your selected AI provider. Minerva can read your ledger; it cannot change it.'}</p>
        {meta && <p className="finance-meta">Snapshot {meta.snapshot_id?.slice(0, 8)}… · rule set v{meta.rule_set_version} · {meta.provider}/{meta.model} · synced {new Date(meta.fetched_at).toLocaleString()}{meta.stale ? ' · stale' : ''} · coverage {meta.coverage?.first_month || '—'} to {meta.coverage?.last_month || '—'}</p>}
        <div className="chat-log" data-tab-scroll="chat" aria-live="polite">
          {messages.length === 0 && <p className="finance-empty">No questions yet. Try “How much did I spend on groceries last month?”</p>}
          {messages.map((m, i) => (
            <div key={i} className={`chat-bubble is-${m.role}`}><strong className="chat-speaker">{m.role === 'user' ? 'You' : 'Minerva'}</strong>{m.role === 'assistant' ? <Suspense fallback={<p>{m.content}</p>}><ChatMarkdown>{m.content}</ChatMarkdown></Suspense> : <p>{m.content}</p>}{m.meta?.sources?.length > 0 && <details className="chat-sources"><summary>Checked {m.meta.sources.length} {m.meta.sources.length === 1 ? 'source' : 'sources'}</summary><ul>{m.meta.sources.map((source, index) => <li key={index}>{source.label}{source.category && ` · ${source.category}`}{source.merchant && ` · ${source.merchant}`}{source.period?.start && ` · ${monthLabel(source.period.start)}${source.period.end !== source.period.start ? ` – ${monthLabel(source.period.end)}` : ''}`}{source.comparison_period && ` compared with ${monthLabel(source.comparison_period.start)} – ${monthLabel(source.comparison_period.end)}`}</li>)}</ul></details>}{m.meta && <small className="chat-answer-meta">Snapshot {m.meta.snapshot_id?.slice(0, 8)}… · rule set v{m.meta.rule_set_version} · {m.meta.provider}/{m.meta.model} · {m.meta.fetched_at}{m.meta.stale ? ' · stale' : ''}</small>}</div>
          ))}
          {busy && <div className="chat-bubble is-assistant"><strong className="chat-speaker">Minerva</strong><p>Checking your ledger…</p></div>}
        </div>
        {error && (
          <p className="settings-message is-error" role="alert">
            {error}
            {errorCode === 'sync_required' && <> <Link to="/account">Import your ledger in Account.</Link></>}
            {errorCode === 'provider_key_required' && <> <Link to="/account">Connect your AI provider in Account.</Link></>}
            {(errorCode === 'finance_not_connected') && <> <Link to="/account">Connect your workbook in Account.</Link></>}
          </p>
        )}
        <form onSubmit={ask} className="chat-form">
          <label htmlFor="chat-input" className="sr-only">Ask a finance question</label>
          <input id="chat-input" aria-describedby="finance-chat-privacy" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about your finances…" maxLength={4000} disabled={busy} required />
          <button className="primary-button" type="submit" disabled={busy || !input.trim()}>{busy ? 'Asking…' : 'Ask'}</button>
        </form>
      </section>
    </main>
  )
}
