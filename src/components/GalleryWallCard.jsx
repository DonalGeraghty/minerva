import { memo } from 'react'

const CardFaces = memo(function CardFaces({ card, focused, flipped, due }) {
  const blank = !card.back
  return <span className={`gallery-card-turn${flipped ? ' is-flipped' : ''}`}>
    <span className="gallery-card-face gallery-card-front" aria-hidden={flipped}>
      <span className="gallery-plane-header"><span className="gallery-plane-tag">{card.tags?.[0] || 'Uncategorised'}</span><span className={`gallery-card-status${due ? ' is-due' : ''}`}>{due ? 'Due now' : 'Scheduled'}</span></span>
      <span className="gallery-face-body">{card.front}</span>
      <span className="gallery-plane-footer">{focused ? 'Click again to reveal' : 'Click to focus'} <span className="gallery-open-icon" aria-hidden="true">{focused ? '↻' : '↗'}</span></span>
    </span>
    {focused && <span className="gallery-card-face gallery-card-back" aria-hidden={!flipped}>
      {!blank && <><span className="gallery-plane-tag">Answer</span><span className="gallery-face-body">{card.back}</span><span className="gallery-plane-footer">Click to show prompt <span aria-hidden="true">↻</span></span></>}
    </span>}
  </span>
})

export default function GalleryWallCard({ card, plane, focused, flipped, now, onActivate }) {
  const due = !card.due_at || new Date(card.due_at).getTime() <= now
  return <button type="button" className={`gallery-plane${focused ? ' is-focused' : ''}`} tabIndex={focused || plane.focusable ? 0 : -1}
    data-plane-key={plane.key} data-plane-scale={plane.scale} data-focused={focused || undefined} data-side={flipped ? 'back' : 'front'}
    aria-label={`${focused ? 'Flip' : 'Focus'} flashcard: ${card.front}`} aria-pressed={focused ? flipped : undefined}
    onClick={(event) => onActivate(plane, event.detail === 0)}
    style={{ '--card-depth': focused ? 1 : Math.max(0.35, Math.min(1, plane.scale)), zIndex: focused ? 10000 : Math.round(4000 + plane.z),
      transform: `translate3d(calc(-50% + ${plane.x * plane.scale}px), calc(-50% + ${plane.y * plane.scale}px), 0) scale(${plane.scale}) rotateZ(${focused ? 0 : plane.rotateY * 0.3}deg)` }}>
    <CardFaces card={card} focused={focused} flipped={flipped} due={due} />
  </button>
}
