import { useState } from 'react'
import { Link } from 'react-router-dom'
import Brand from '../components/Brand.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { createFlashcard } from '../services/flashcards.js'
import { askMinerva } from '../services/minerva.js'
import { createDemoFlashcard, createDemoResponse } from '../services/demoStore.js'

function requestId() {
  return globalThis.crypto?.randomUUID?.() || `00000000-0000-4000-8000-${Math.random().toString(16).slice(2).padEnd(12, '0').slice(0, 12)}`
}

function errorDetails(error) {
  if (error.code === 'provider_key_required') return { message: error.message, account: true }
  if (error.code === 'provider_key_invalid') return { message: 'Your selected provider key needs to be replaced.', account: true }
  if (error.code === 'provider_billing_required') return { message: 'Your selected AI account needs available API credit.', account: true }
  if (error.code === 'provider_rate_limited') return { message: 'Minerva is busy right now. Try again shortly.', account: false }
  return { message: error.message || 'Minerva could not answer that.', account: false }
}

export default function AskPage() {
  const { logout, user } = useAuth()
  const [message, setMessage] = useState('')
  const [sourceMessage, setSourceMessage] = useState('')
  const [response, setResponse] = useState(null)
  const [draft, setDraft] = useState(null)
  const [tagsText, setTagsText] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [showAccount, setShowAccount] = useState(false)
  const [saved, setSaved] = useState(null)

  const submit = async (event) => {
    event.preventDefault()
    const submitted = message.trim()
    if (!submitted || busy) return
    setBusy('ask')
    setError('')
    setShowAccount(false)
    setResponse(null)
    setDraft(null)
    setSaved(null)
    try {
      const result = user?.isDemo ? createDemoResponse(submitted) : await askMinerva(submitted)
      setResponse(result)
      setSourceMessage(submitted)
      setMessage('')
      if (result.kind === 'card_draft' && result.card) {
        setDraft({ front: result.card.front, back: result.card.back })
        setTagsText((result.card.suggested_tags || []).join(', '))
      }
    } catch (requestError) {
      if (requestError.status === 401) return logout()
      const details = errorDetails(requestError)
      setError(details.message)
      setShowAccount(details.account)
    } finally {
      setBusy('')
    }
  }

  const turnIntoCard = () => {
    setDraft({ front: sourceMessage, back: response.reply })
    setTagsText('')
    setSaved(null)
  }

  const save = async (event) => {
    event.preventDefault()
    if (!draft?.front.trim() || !draft?.back.trim() || busy) return
    setBusy('save')
    setError('')
    try {
      const payload = {
        front: draft.front.trim(),
        back: draft.back.trim(),
        tags: tagsText.split(',').map((tag) => tag.trim()).filter(Boolean),
        sourceMessage,
      }
      const card = user?.isDemo ? createDemoFlashcard(payload) : await createFlashcard(payload, requestId())
      setSaved(card)
    } catch (requestError) {
      if (requestError.status === 401) return logout()
      setError(requestError.message || 'Could not add this card to the rotation.')
    } finally {
      setBusy('')
    }
  }

  return (
    <main className="page ask-page">
      <Brand />
      <section className="ask-hero">
        <p className="eyebrow">A quiet system for active recall</p>
        <h1>Ask. Capture.<br />Remember.</h1>
        <p>Ask a question, or tell Minerva what you want to remember. Every card waits for your review before it joins the rotation.</p>
      </section>

      <form className="ask-composer" onSubmit={submit}>
        <label htmlFor="minerva-message">What would you like to learn?</label>
        <textarea
          id="minerva-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
              event.preventDefault()
              event.currentTarget.form.requestSubmit()
            }
          }}
          placeholder="Add a Hindi flashcard asking what कल means…"
          rows="6"
          maxLength="2000"
          disabled={Boolean(busy)}
        />
        <div className="composer-actions"><span>Ctrl/⌘ + Enter to send</span><button className="primary-button" type="submit" disabled={Boolean(busy) || !message.trim()}>{busy === 'ask' ? 'Thinking…' : 'Ask Minerva'} <span aria-hidden="true">→</span></button></div>
      </form>

      {error && <div className="message-error" role="alert"><p>{error}</p>{showAccount && <Link to="/account">Open Account</Link>}</div>}

      {response && (
        <section className="minerva-response" aria-live="polite">
          <header><div><p className="eyebrow">{response.kind === 'card_draft' ? 'Draft ready' : response.kind === 'clarification' ? 'One question' : 'Minerva answers'}</p><h2>{response.kind === 'card_draft' ? 'Review before saving.' : 'A considered answer.'}</h2></div>{response.kind === 'answer' && !draft && <button className="secondary-button" type="button" onClick={turnIntoCard}>Turn into flashcard</button>}</header>
          <p className="response-copy">{response.reply}</p>

          {draft && (
            <form className="card-draft-form" onSubmit={save}>
              <div className="card-draft-grid">
                <label htmlFor="card-front"><span>Front · prompt</span><textarea id="card-front" value={draft.front} onChange={(event) => setDraft((current) => ({ ...current, front: event.target.value }))} rows="4" maxLength="500" disabled={Boolean(saved)} /></label>
                <label htmlFor="card-back"><span>Back · answer</span><textarea id="card-back" value={draft.back} onChange={(event) => setDraft((current) => ({ ...current, back: event.target.value }))} rows="6" maxLength="4000" disabled={Boolean(saved)} /></label>
              </div>
              <label className="tag-field" htmlFor="card-tags"><span>Tags · separated by commas</span><input id="card-tags" value={tagsText} onChange={(event) => setTagsText(event.target.value)} placeholder="computing, javascript" disabled={Boolean(saved)} /></label>
              <footer><p>{saved ? 'Saved. This card is now due in your rotation.' : 'Nothing is stored until you confirm.'}</p><button className="primary-button" type="submit" disabled={Boolean(busy) || Boolean(saved) || !draft.front.trim() || !draft.back.trim()}>{busy === 'save' ? 'Adding…' : saved ? 'Added to rotation' : 'Add to rotation'} <span aria-hidden="true">✓</span></button></footer>
            </form>
          )}
        </section>
      )}
    </main>
  )
}
