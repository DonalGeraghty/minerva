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
  const [drafts, setDrafts] = useState([])
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [showAccount, setShowAccount] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    const submitted = message.trim()
    if (!submitted || busy) return
    setBusy('ask')
    setError('')
    setShowAccount(false)
    setResponse(null)
    setDrafts([])
    try {
      const result = user?.isDemo ? createDemoResponse(submitted) : await askMinerva(submitted)
      setResponse(result)
      setSourceMessage(submitted)
      setMessage('')
      if (result.kind === 'card_draft') {
        const cards = result.cards || (result.card ? [result.card] : [])
        setDrafts(cards.map((card) => ({
          front: card.front,
          back: card.back,
          tagsText: (card.suggested_tags || []).join(', '),
          saved: false,
        })))
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
    setDrafts([{ front: sourceMessage, back: response.reply, tagsText: '', saved: false }])
  }

  const updateDraft = (index, field, value) => {
    setDrafts((items) => items.map((draft, draftIndex) => draftIndex === index ? { ...draft, [field]: value } : draft))
  }

  const save = async (event, index) => {
    event.preventDefault()
    const draft = drafts[index]
    if (!draft?.front.trim() || !draft?.back.trim() || busy || draft.saved) return
    setBusy(`save-${index}`)
    setError('')
    try {
      const payload = {
        front: draft.front.trim(),
        back: draft.back.trim(),
        tags: draft.tagsText.split(',').map((tag) => tag.trim()).filter(Boolean),
        sourceMessage,
      }
      if (user?.isDemo) createDemoFlashcard(payload)
      else await createFlashcard(payload, requestId())
      updateDraft(index, 'saved', true)
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
          <header><div><p className="eyebrow">{response.kind === 'card_draft' ? 'Draft ready' : response.kind === 'clarification' ? 'One question' : 'Minerva answers'}</p><h2>{response.kind === 'card_draft' ? 'Review before saving.' : 'A considered answer.'}</h2></div>{response.kind === 'answer' && drafts.length === 0 && <button className="secondary-button" type="button" onClick={turnIntoCard}>Turn into flashcard</button>}</header>
          <p className="response-copy">{response.reply}</p>

          {drafts.map((draft, index) => (
            <form className="card-draft-form" onSubmit={(event) => save(event, index)} key={index}>
              {drafts.length > 1 && <p className="card-draft-number">Card {index + 1} of {drafts.length}</p>}
              <div className="card-draft-grid">
                <label htmlFor={`card-front-${index}`}><span>Front · prompt</span><textarea id={`card-front-${index}`} value={draft.front} onChange={(event) => updateDraft(index, 'front', event.target.value)} rows="4" maxLength="500" disabled={draft.saved} /></label>
                <label htmlFor={`card-back-${index}`}><span>Back · answer</span><textarea id={`card-back-${index}`} value={draft.back} onChange={(event) => updateDraft(index, 'back', event.target.value)} rows="6" maxLength="4000" disabled={draft.saved} /></label>
              </div>
              <label className="tag-field" htmlFor={`card-tags-${index}`}><span>Tags · separated by commas</span><input id={`card-tags-${index}`} value={draft.tagsText} onChange={(event) => updateDraft(index, 'tagsText', event.target.value)} placeholder="computing, javascript" disabled={draft.saved} /></label>
              <footer><p>{draft.saved ? 'Saved. This card is now due in your rotation.' : 'Nothing is stored until you confirm.'}</p><button className="primary-button" type="submit" disabled={Boolean(busy) || draft.saved || !draft.front.trim() || !draft.back.trim()}>{busy === `save-${index}` ? 'Adding…' : draft.saved ? 'Added to rotation' : 'Add to rotation'} <span aria-hidden="true">✓</span></button></footer>
            </form>
          ))}
        </section>
      )}
    </main>
  )
}
