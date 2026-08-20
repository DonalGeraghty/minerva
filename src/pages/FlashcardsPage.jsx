import { useCallback, useEffect, useMemo, useState } from 'react'
import Brand from '../components/Brand.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import {
  deleteFlashcard,
  listDueFlashcards,
  listFlashcards,
  reviewFlashcard,
  updateFlashcard,
} from '../services/flashcards.js'
import {
  deleteDemoFlashcard,
  listDemoCards,
  listDemoDueCards,
  reviewDemoFlashcard,
  updateDemoFlashcard,
} from '../services/demoStore.js'

function requestId() {
  return globalThis.crypto?.randomUUID?.() || `00000000-0000-4000-8000-${Math.random().toString(16).slice(2).padEnd(12, '0').slice(0, 12)}`
}

function formatDue(value) {
  if (!value) return 'Due now'
  const date = new Date(value)
  if (Number.isNaN(date.getTime()) || date <= new Date()) return 'Due now'
  return `Due ${new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' }).format(date)}`
}

export default function FlashcardsPage() {
  const { logout, user } = useAuth()
  const isDemo = Boolean(user?.isDemo)
  const [view, setView] = useState('review')
  const [cards, setCards] = useState([])
  const [dueCards, setDueCards] = useState([])
  const [tag, setTag] = useState('')
  const [search, setSearch] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const handleError = useCallback((requestError, fallback) => {
    if (requestError.status === 401) {
      logout()
      return
    }
    setError(requestError.message || fallback)
  }, [logout])

  const loadAll = useCallback(async () => {
    try {
      setCards(isDemo ? listDemoCards() : await listFlashcards())
    } catch (requestError) {
      handleError(requestError, 'Could not load your flashcards.')
    }
  }, [handleError, isDemo])

  const loadDue = useCallback(async () => {
    try {
      setDueCards(isDemo ? listDemoDueCards({ tag }) : await listDueFlashcards({ tag }))
      setRevealed(false)
    } catch (requestError) {
      handleError(requestError, 'Could not load your review rotation.')
    }
  }, [handleError, isDemo, tag])

  useEffect(() => {
    setLoading(true)
    Promise.all([loadAll(), loadDue()]).finally(() => setLoading(false))
  }, [loadAll, loadDue])

  const tags = useMemo(() => [...new Set(cards.flatMap((card) => card.tags || []))].sort(), [cards])
  const filteredCards = useMemo(() => {
    const query = search.trim().toLowerCase()
    return cards.filter((card) => {
      if (tag && !card.tags?.includes(tag)) return false
      return !query || `${card.front} ${card.back} ${(card.tags || []).join(' ')}`.toLowerCase().includes(query)
    })
  }, [cards, search, tag])
  const current = dueCards[0]

  const rate = async (rating) => {
    if (!current || busy) return
    setBusy(rating)
    setError('')
    try {
      const updated = isDemo ? reviewDemoFlashcard(current.id, rating) : await reviewFlashcard(current.id, rating, requestId())
      setCards((items) => items.map((card) => card.id === updated.id ? updated : card))
      setDueCards((items) => items.slice(1))
      setRevealed(false)
    } catch (requestError) {
      handleError(requestError, 'Could not record that review.')
    } finally {
      setBusy('')
    }
  }

  const saveEdit = async (event) => {
    event.preventDefault()
    setBusy('edit')
    setError('')
    try {
      const payload = {
        front: editing.front,
        back: editing.back,
        tags: editing.tagsText.split(',').map((item) => item.trim()).filter(Boolean),
      }
      const updated = isDemo ? updateDemoFlashcard(editing.id, payload) : await updateFlashcard(editing.id, payload)
      setCards((items) => items.map((card) => card.id === updated.id ? updated : card))
      setDueCards((items) => items.map((card) => card.id === updated.id ? updated : card))
      setEditing(null)
    } catch (requestError) {
      handleError(requestError, 'Could not update that flashcard.')
    } finally {
      setBusy('')
    }
  }

  const remove = async (card) => {
    setBusy(`delete-${card.id}`)
    setError('')
    try {
      if (isDemo) deleteDemoFlashcard(card.id)
      else await deleteFlashcard(card.id)
      setCards((items) => items.filter((item) => item.id !== card.id))
      setDueCards((items) => items.filter((item) => item.id !== card.id))
    } catch (requestError) {
      handleError(requestError, 'Could not delete that flashcard.')
    } finally {
      setBusy('')
    }
  }

  return (
    <main className="page flashcards-page">
      <Brand />
      <header className="flashcards-hero">
        <div><p className="eyebrow">Your knowledge, in rotation</p><h1>Flashcards.</h1><p>Review what is due, or refine everything you have chosen to remember.</p></div>
        <div className="due-stat"><strong>{dueCards.length}</strong><span>due now</span></div>
      </header>

      <div className="view-tabs" role="tablist" aria-label="Flashcard view">
        <button type="button" role="tab" aria-selected={view === 'review'} onClick={() => setView('review')}>Review</button>
        <button type="button" role="tab" aria-selected={view === 'library'} onClick={() => setView('library')}>All cards <span>{cards.length}</span></button>
      </div>
      {error && <p className="page-error" role="alert">{error}</p>}

      {view === 'review' && (
        <section className="review-view">
          {tags.length > 0 && <div className="tag-filter" aria-label="Filter review by tag"><button type="button" className={!tag ? 'is-active' : ''} onClick={() => setTag('')}>All</button>{tags.map((item) => <button type="button" key={item} className={tag === item ? 'is-active' : ''} onClick={() => setTag(item)}>{item}</button>)}</div>}
          {loading ? <div className="empty-state">Preparing your rotation…</div> : current ? (
            <article className={`review-card${revealed ? ' is-revealed' : ''}`}>
              <div className="review-card-meta"><span>{current.tags?.[0] || 'uncategorised'}</span><span>{dueCards.length} remaining</span></div>
              <div className="review-card-face"><p>{revealed ? 'Answer' : 'Prompt'}</p><h2>{revealed ? current.back : current.front}</h2></div>
              {!revealed ? <button className="primary-button reveal-button" type="button" onClick={() => setRevealed(true)}>Reveal answer</button> : (
                <div className="rating-row" aria-label="Rate your recall">
                  {[
                    ['again', 'Again', '10 min'],
                    ['hard', 'Hard', '1+ day'],
                    ['good', 'Good', 'Growing'],
                    ['easy', 'Easy', 'Longest'],
                  ].map(([value, label, hint]) => <button key={value} type="button" onClick={() => rate(value)} disabled={Boolean(busy)}><strong>{busy === value ? 'Saving…' : label}</strong><span>{hint}</span></button>)}
                </div>
              )}
            </article>
          ) : <div className="empty-state"><strong>You are caught up.</strong><p>{tag ? `No ${tag} cards are due right now.` : 'Nothing else is due. Come back when Minerva brings a card into rotation.'}</p></div>}
        </section>
      )}

      {view === 'library' && (
        <section className="library-view">
          <div className="library-tools"><label htmlFor="card-search">Search<input id="card-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Question, answer, or tag" /></label><label htmlFor="tag-select">Tag<select id="tag-select" value={tag} onChange={(event) => setTag(event.target.value)}><option value="">All tags</option>{tags.map((item) => <option key={item} value={item}>{item}</option>)}</select></label></div>
          {filteredCards.length ? <div className="card-library">{filteredCards.map((card) => (
            <article key={card.id} className="library-card">
              <header><div className="card-tags">{card.tags?.length ? card.tags.map((item) => <span key={item}>{item}</span>) : <span>uncategorised</span>}</div><span>{formatDue(card.due_at)}</span></header>
              <h2>{card.front}</h2><p>{card.back}</p>
              <footer><span>{card.review_count || 0} reviews</span><div><button type="button" onClick={() => setEditing({ ...card, tagsText: (card.tags || []).join(', ') })}>Edit</button><button className="delete-button" type="button" onClick={() => remove(card)} disabled={busy === `delete-${card.id}`}>{busy === `delete-${card.id}` ? 'Deleting…' : 'Delete'}</button></div></footer>
            </article>
          ))}</div> : <div className="empty-state"><strong>No cards found.</strong><p>Try a different search or ask Minerva to create your first card.</p></div>}
        </section>
      )}

      {editing && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null) }}>
          <section className="edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-card-title">
            <header><div><p className="settings-kicker">Card editor</p><h2 id="edit-card-title">Refine the memory.</h2></div><button type="button" onClick={() => setEditing(null)} aria-label="Close editor">×</button></header>
            <form onSubmit={saveEdit}><label htmlFor="edit-front">Front<textarea id="edit-front" value={editing.front} onChange={(event) => setEditing((currentEdit) => ({ ...currentEdit, front: event.target.value }))} rows="4" /></label><label htmlFor="edit-back">Back<textarea id="edit-back" value={editing.back} onChange={(event) => setEditing((currentEdit) => ({ ...currentEdit, back: event.target.value }))} rows="7" /></label><label htmlFor="edit-tags">Tags<input id="edit-tags" value={editing.tagsText} onChange={(event) => setEditing((currentEdit) => ({ ...currentEdit, tagsText: event.target.value }))} /></label><div><button className="secondary-button" type="button" onClick={() => setEditing(null)}>Cancel</button><button className="primary-button" type="submit" disabled={busy === 'edit' || !editing.front.trim() || !editing.back.trim()}>{busy === 'edit' ? 'Saving…' : 'Save changes'}</button></div></form>
          </section>
        </div>
      )}
    </main>
  )
}
