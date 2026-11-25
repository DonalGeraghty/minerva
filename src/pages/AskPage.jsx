import { Link } from 'react-router-dom'
import Brand from '../components/Brand.jsx'
import { useTabScroll } from '../context/TabSessionContext.jsx'
import { useAskConversation } from '../hooks/useAskConversation.js'
import './AskPage.css'

export default function AskPage() {
  const { messages, input, busy, error, errorCode, meta, setInput, ask, newConversation } = useAskConversation()
  useTabScroll('ask')

  return (
    <main className="page finance-page ask-page">
      <Brand />
      <section className="page-hero">
        <p className="eyebrow">Finance &middot; ask AI</p>
        <h1>Ask.</h1>
        <p>Ask questions about your synced ledger. Janus computes every figure server-side; your selected AI provider only reads the bounded context. Your conversation stays available while you use this app. It clears when you sign out, refresh, or start a new conversation.</p>
      </section>
      <section className="app-panel" aria-label="Finance chat">
        <button className="secondary-button" type="button" onClick={newConversation} disabled={!messages.length && !input}>New conversation</button>
        <p id="finance-chat-privacy" className="settings-message">{meta?.privacy || 'Your question and financial data from your imported workbook are sent to your selected AI provider. Review the provider’s privacy settings before sending.'}</p>
        {meta && <p className="finance-meta">Snapshot {meta.snapshot_id?.slice(0, 8)}… · rule set v{meta.rule_set_version} · {meta.provider}/{meta.model} · synced {new Date(meta.fetched_at).toLocaleString()}{meta.stale ? ' · stale' : ''} · coverage {meta.coverage?.first_month || '—'} to {meta.coverage?.last_month || '—'}</p>}
        <div className="chat-log" data-tab-scroll="chat" aria-live="polite">
          {messages.length === 0 && <p className="finance-empty">No questions yet. Try “How much did I spend on groceries last month?”</p>}
          {messages.map((m, i) => (
            <div key={i} className={`chat-bubble is-${m.role}`}><strong>{m.role === 'user' ? 'You' : 'Minerva'}</strong><p>{m.content}</p>{m.meta && <small className="chat-answer-meta">Snapshot {m.meta.snapshot_id?.slice(0, 8)}… · rule set v{m.meta.rule_set_version} · {m.meta.provider}/{m.meta.model} · {m.meta.fetched_at}{m.meta.stale ? ' · stale' : ''}</small>}</div>
          ))}
          {busy && <div className="chat-bubble is-assistant"><strong>Minerva</strong><p>Thinking…</p></div>}
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
