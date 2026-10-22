import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Brand from '../components/Brand.jsx'
import FlashcardGallery from '../components/FlashcardGallery.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { listFlashcards } from '../services/flashcards.js'
import { listDemoCards } from '../services/demoStore.js'

function CardPreview({ card, cards, onSelect, onClose }) {
  const dialog = useRef(null)
  const [revealed, setRevealed] = useState(false)
  const index = cards.findIndex((item) => item.id === card.id)
  const navigate = (direction) => { setRevealed(false); onSelect(cards[(index + direction + cards.length) % cards.length]) }
  useEffect(() => {
    const element = dialog.current, previous = document.activeElement
    if (typeof element.showModal === 'function') element.showModal()
    else element.setAttribute('open', '')
    return () => {
      if (typeof element.close === 'function') element.close()
      if (previous?.isConnected) previous.focus()
      else document.querySelector('.gallery-controls button, #gallery-list-tab')?.focus()
    }
  }, [])
  return <dialog ref={dialog} className="gallery-card-dialog" aria-labelledby="gallery-preview-heading"
    onKeyDown={(event) => {
      if (cards.length > 1 && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault(); navigate(event.key === 'ArrowLeft' ? -1 : 1)
      }
    }}
    onCancel={(event) => { event.preventDefault(); onClose() }} onClick={(event) => {
      if (event.target !== event.currentTarget) return
      const box = event.currentTarget.getBoundingClientRect()
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose()
    }}>
    <header><p className="eyebrow">{card.tags?.join(' · ') || 'Your knowledge'}</p><button type="button" aria-label="Close flashcard" onClick={onClose}>×</button></header>
    <nav className="gallery-preview-navigation" aria-label="Browse flashcards"><button type="button" aria-label="Previous flashcard" disabled={cards.length < 2} onClick={() => navigate(-1)}>←</button><span role="status">{index + 1} / {cards.length}</span><button type="button" aria-label="Next flashcard" disabled={cards.length < 2} onClick={() => navigate(1)}>→</button></nav>
    <p className="gallery-preview-side">{revealed ? 'Answer' : 'Prompt'}</p>
    <h2 id="gallery-preview-heading">{revealed ? card.back : card.front}</h2>
    <footer><button type="button" className="primary-button" onClick={() => setRevealed((value) => !value)}>{revealed ? 'Show prompt' : 'Reveal answer'}</button><Link className="secondary-button" to="/flashcards">Review your cards</Link></footer>
    <p className="gallery-hint">Use ←/→ to browse. Your review schedule stays the same.</p>
  </dialog>
}

export default function GalleryPage() {
  const { user, logout } = useAuth()
  const isDemo = Boolean(user?.isDemo)
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('')
  const [selected, setSelected] = useState(null)
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false)
  const [view, setView] = useState(reducedMotion ? 'list' : 'gallery')

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const change = (event) => { setReducedMotion(event.matches); if (event.matches) setView('list') }
    media?.addEventListener('change', change)
    return () => media?.removeEventListener('change', change)
  }, [])
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    Promise.resolve().then(() => isDemo ? listDemoCards() : listFlashcards()).then((data) => {
      if (active) setCards(data)
    }).catch((failure) => {
      if (!active) return
      if (failure.status === 401) logout()
      else setError(failure.message || 'Could not load your flashcards.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [attempt, isDemo, logout, user?.accountId])

  const tags = [...new Set(cards.flatMap((card) => card.tags || []))].sort()
  const search = query.trim().toLowerCase()
  const filtered = cards.filter((card) => (!tag || card.tags?.includes(tag)) && (!search || `${card.front} ${card.back} ${(card.tags || []).join(' ')}`.toLowerCase().includes(search)))
  return <main className="page gallery-page"><Brand />
    <header className="gallery-hero"><div><p className="eyebrow">A field of things worth remembering</p><h1>Your knowledge.</h1><p>Drift through your flashcards. Open one to see what you remember.</p></div><span className="gallery-library-count" role="status">{filtered.length} {filtered.length === 1 ? 'card' : 'cards'}</span></header>
    <div className="library-tools gallery-tools"><label htmlFor="gallery-search">Search flashcards<input id="gallery-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Prompt, answer, or tag" /></label><label htmlFor="gallery-tag">Tag<select id="gallery-tag" value={tag} onChange={(event) => setTag(event.target.value)}><option value="">All tags</option>{tags.map((item) => <option key={item} value={item}>{item}</option>)}</select></label></div>
    <div className="view-tabs" role="tablist" aria-label="Gallery view"><button type="button" id="gallery-explore-tab" role="tab" aria-controls="gallery-content" aria-selected={view === 'gallery'} onClick={() => setView('gallery')}>Explore in 3D</button><button type="button" id="gallery-list-tab" role="tab" aria-controls="gallery-content" aria-selected={view === 'list'} onClick={() => setView('list')}>Card list</button></div>
    <section id="gallery-content" role="tabpanel" aria-labelledby={view === 'gallery' ? 'gallery-explore-tab' : 'gallery-list-tab'}>
      {loading ? <div className="empty-state" role="status">Opening your gallery…</div> : error ? <div className="empty-state"><p role="alert">{error}</p><button type="button" className="secondary-button" onClick={() => setAttempt((value) => value + 1)}>Try again</button></div> : !filtered.length ? <div className="empty-state"><strong>{cards.length ? 'No cards match.' : 'A little knowledge goes a long way.'}</strong><p>{cards.length ? 'Try a different search or tag.' : 'Create your first flashcard to start exploring.'}</p>{cards.length ? <button type="button" className="secondary-button" onClick={() => { setQuery(''); setTag('') }}>Clear filters</button> : <Link className="primary-button" to="/">Ask Minerva</Link>}</div> : view === 'gallery' ? <FlashcardGallery key={`${tag}:${search}`} cards={filtered} reducedMotion={reducedMotion} /> : <div className="gallery-card-list">{filtered.map((card) => <button key={card.id} type="button" className="gallery-list-card" onClick={() => setSelected(card)}><span className="gallery-plane-tag">{card.tags?.join(' · ') || 'Uncategorised'}</span><strong>{card.front}</strong><span className="gallery-plane-footer">Reveal answer ↗</span></button>)}</div>}
    </section>
    {selected && <CardPreview card={selected} cards={filtered} onSelect={setSelected} onClose={() => setSelected(null)} />}
  </main>
}
