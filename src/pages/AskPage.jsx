import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Brand from '../components/Brand.jsx'
import { financeChat } from '../services/finance.js'

export default function AskPage() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState('')
  const [meta, setMeta] = useState(null)
  const abort = useRef(null)

  const ask = async (event) => {
    event.preventDefault()
    const question = input.trim()
    if (!question || busy) return
    abort.current?.abort()
    const controller = new AbortController()
    abort.current = controller
    setBusy(true)
    setError('')
    setErrorCode('')
    const next = [...messages, { role: 'user', content: question }]
    setMessages(next)
    setInput('')
    try {
      const result = await financeChat(question, messages, controller.signal)
      setMessages([...next, { role: 'assistant', content: result.answer }])
      setMeta(result.meta)
    } catch (requestError) {
      if (requestError.name === 'AbortError') return
      setError(requestError.message || 'Could not get an answer')
      setErrorCode(requestError.code || '')
      setMessages(next)
    } finally {
      if (abort.current === controller) setBusy(false)
    }
  }

  return (
    <main className="page finance-page">
      <Brand />
      <section className="page-hero">
        <p className="eyebrow">Finance &middot; ask AI</p>
        <h1>Ask.</h1>
        <p>Ask questions about your synced ledger. Janus computes every figure server-side; your selected AI provider only reads the bounded context. Answers are not stored.</p>
      </section>
      <section className="app-panel" aria-label="Finance chat">
        {meta?.privacy && <p className="settings-message">{meta.privacy}</p>}
        {meta && <p className="finance-meta">Snapshot {meta.snapshot_id?.slice(0, 8)}… · rule set v{meta.rule_set_version} · {meta.provider}/{meta.model} · synced {new Date(meta.fetched_at).toLocaleString()}{meta.stale ? ' · stale' : ''} · coverage {meta.coverage?.first_month || '—'} to {meta.coverage?.last_month || '—'}</p>}
        <div className="chat-log" aria-live="polite">
          {messages.length === 0 && <p className="finance-empty">No questions yet. Try “How much did I spend on groceries last month?”</p>}
          {messages.map((m, i) => (
            <div key={i} className={`chat-bubble is-${m.role}`}><strong>{m.role === 'user' ? 'You' : 'Minerva'}</strong><p>{m.content}</p></div>
          ))}
          {busy && <div className="chat-bubble is-assistant"><strong>Minerva</strong><p>Thinking…</p></div>}
        </div>
        {error && (
          <p className="settings-message is-error" role="alert">
            {error}
            {errorCode === 'sync_required' && <> <Link to="/">Sync the ledger on the Dashboard first.</Link></>}
            {errorCode === 'provider_key_required' && <> <Link to="/account">Connect your AI provider in Account.</Link></>}
            {(errorCode === 'finance_not_connected') && <> <Link to="/account">Connect your workbook in Account.</Link></>}
          </p>
        )}
        <form onSubmit={ask} className="chat-form">
          <label htmlFor="chat-input" className="sr-only">Ask a finance question</label>
          <input id="chat-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about your finances…" maxLength={4000} disabled={busy} required />
          <button className="primary-button" type="submit" disabled={busy || !input.trim()}>{busy ? 'Asking…' : 'Ask'}</button>
        </form>
      </section>
    </main>
  )
}
