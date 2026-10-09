import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { focusGalleryCamera, galleryLayout, INITIAL_GALLERY_CAMERA, pickGalleryPlane, pinchGallery, projectGalleryPlane, zoomGallery } from '../services/galleryLayout.js'
import useGalleryCamera from '../hooks/useGalleryCamera.js'
import GalleryWallCard from './GalleryWallCard.jsx'

export default function FlashcardGallery({ cards, reducedMotion = false }) {
  const stage = useRef(null), shell = useRef(null)
  const { camera, move, animateTo, stopAnimation, getCamera } = useGalleryCamera()
  const [viewport, setViewport] = useState({ width: 1000, height: 620 })
  const [dragging, setDragging] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [focused, setFocused] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  const gesture = useRef(null), touches = useRef(new Map()), suppressedClick = useRef(false)
  const motion = useRef({ frame: 0, x: 0, y: 0, time: 0 })
  const stopInertia = useCallback(() => {
    cancelAnimationFrame(motion.current.frame)
    motion.current.frame = 0; motion.current.x = 0; motion.current.y = 0
  }, [])
  const stopMotion = useCallback(() => { stopInertia(); stopAnimation() }, [stopInertia, stopAnimation])

  useLayoutEffect(() => {
    const element = stage.current
    const measure = () => setViewport({ width: element.clientWidth || 1000, height: element.clientHeight || 620 })
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(element)
    const wheel = (event) => {
      event.preventDefault(); stopMotion(); setFocused(null)
      const box = element.getBoundingClientRect()
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? box.height || 620 : 1)
      move((current) => zoomGallery(current, -Math.max(-240, Math.min(240, delta)) * 1.8,
        { x: event.clientX - box.left - box.width / 2, y: event.clientY - box.top - box.height / 2 }))
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => { observer?.disconnect(); element.removeEventListener('wheel', wheel); stopMotion() }
  }, [move, stopMotion])

  useEffect(() => {
    const cancel = () => {
      suppressedClick.current = Boolean(gesture.current?.moved || gesture.current?.pinch)
      touches.current.clear(); gesture.current = null; setDragging(false); stopMotion()
    }
    const hidden = () => { if (document.hidden) cancel() }
    window.addEventListener('blur', cancel); document.addEventListener('visibilitychange', hidden)
    return () => { window.removeEventListener('blur', cancel); document.removeEventListener('visibilitychange', hidden) }
  }, [stopMotion])
  useEffect(() => { if (reducedMotion) stopMotion() }, [reducedMotion, stopMotion])
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer) }, [])
  useEffect(() => {
    if (!expanded) return undefined
    const previousOverflow = document.body.style.overflow, previousFocus = document.activeElement
    document.body.style.overflow = 'hidden'
    const escape = (event) => { if (event.key === 'Escape' && !document.querySelector('dialog[open]')) setExpanded(false) }
    window.addEventListener('keydown', escape)
    return () => {
      document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', escape)
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [expanded])

  const pan = (x, y) => { stopMotion(); setFocused(null); move((current) => ({ ...current, x: current.x + x, y: current.y + y })) }
  const zoom = (travel) => { stopMotion(); setFocused(null); move((current) => zoomGallery(current, travel)) }
  const reset = () => { stopMotion(); setFocused(null); move(INITIAL_GALLERY_CAMERA) }
  const activate = (plane, keyboard) => {
    if (!keyboard && suppressedClick.current) return
    if (focused?.key === plane.key) { setFocused((current) => ({ ...current, flipped: !current.flipped })); return }
    stopMotion()
    setFocused({ key: plane.key, plane, flipped: false })
    stage.current.style.setProperty('--look-x', '0px'); stage.current.style.setProperty('--look-y', '0px')
    animateTo(focusGalleryCamera(plane, viewport), reducedMotion)
  }
  const finishPointer = (event, cancelled = false) => {
    touches.current.delete(event.pointerId)
    if (gesture.current?.pinch) {
      gesture.current = null; setDragging(false); stopMotion()
      try { event.currentTarget.releasePointerCapture(event.pointerId) } catch { /* Capture may have ended. */ }
      return
    }
    if (!gesture.current || event.pointerId !== gesture.current.id) return
    const moved = gesture.current.moved
    gesture.current = null; setDragging(false)
    try { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) } catch { /* Capture may have ended. */ }
    if (!moved) { stopInertia(); return }
    if (cancelled || reducedMotion || event.timeStamp - motion.current.time > 100) { stopMotion(); return }
    motion.current.time = 0
    const drift = (time) => {
      const elapsed = motion.current.time ? Math.min(2, Math.max(0.25, (time - motion.current.time) / 16.67)) : 1
      motion.current.time = time
      motion.current.x *= 0.88 ** elapsed; motion.current.y *= 0.88 ** elapsed
      if (Math.abs(motion.current.x) + Math.abs(motion.current.y) < 0.15) { motion.current.frame = 0; return }
      const x = motion.current.x * elapsed, y = motion.current.y * elapsed
      move((current) => ({ ...current, x: current.x + x, y: current.y + y }))
      motion.current.frame = requestAnimationFrame(drift)
    }
    motion.current.frame = requestAnimationFrame(drift)
  }

  const visiblePlanes = galleryLayout(camera, cards.length, viewport)
  const planes = focused && !visiblePlanes.some((plane) => plane.key === focused.key)
    ? [...visiblePlanes, projectGalleryPlane(focused.plane, camera, viewport)] : visiblePlanes
  return <div ref={shell} className={`flashcard-gallery${expanded ? ' is-expanded' : ''}`}
    role={expanded ? 'dialog' : undefined} aria-modal={expanded || undefined} aria-label={expanded ? 'Expanded flashcard gallery' : undefined}
    onKeyDown={(event) => {
      if (!expanded || event.key !== 'Tab') return
      const controls = [...shell.current.querySelectorAll('button:not(:disabled):not([tabindex="-1"]), [tabindex="0"]')]
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus() }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus() }
    }}>
    <div className="gallery-controls" role="group" aria-label="Gallery navigation">
      <div><span className="gallery-control-caption">Explore</span>{[['left', '←', -220, 0], ['right', '→', 220, 0], ['up', '↑', 0, -180], ['down', '↓', 0, 180]].map(([label, icon, x, y]) => <button type="button" key={label} aria-label={`Explore ${label}`} onClick={() => pan(x, y)}>{icon}</button>)}</div>
      <div><button type="button" aria-label="Zoom out" onClick={() => zoom(-240)}>−</button><span className="gallery-zoom-caption">Zoom</span><button type="button" aria-label="Zoom in" onClick={() => zoom(240)}>+</button><button type="button" aria-label="Reset view" onClick={reset}>Reset</button><button type="button" className="gallery-expand-button" aria-label={expanded ? 'Exit expanded view' : 'Expand gallery'} onClick={() => { stopMotion(); setExpanded((value) => !value) }}>{expanded ? 'Exit' : 'Expand'} <span aria-hidden="true">⤢</span></button></div>
    </div>
    <div ref={stage} className={`gallery-stage${dragging ? ' is-dragging' : ''}${reducedMotion ? ' is-reduced-motion' : ''}${focused ? ' has-focused-card' : ''}`}
      role="region" tabIndex={0} aria-label="Infinite flashcard gallery" aria-describedby="gallery-instructions" data-camera-depth={camera.depth}
      onClick={(event) => {
        if (event.target.closest('[data-plane-key]') || suppressedClick.current || event.detail === 0) return
        const box = event.currentTarget.getBoundingClientRect()
        const lookX = focused || reducedMotion ? 0 : parseFloat(event.currentTarget.style.getPropertyValue('--look-x')) || 0
        const lookY = focused || reducedMotion ? 0 : parseFloat(event.currentTarget.style.getPropertyValue('--look-y')) || 0
        const hit = pickGalleryPlane(planes, { x: event.clientX - box.left, y: event.clientY - box.top }, viewport, focused?.key, { x: lookX, y: lookY })
        if (hit) activate(hit, false)
      }}
      onPointerDown={(event) => {
        if (event.button !== 0 || (!event.isPrimary && event.pointerType !== 'touch')) return
        if (event.pointerType === 'touch' && touches.current.size >= 2) return
        stopInertia(); suppressedClick.current = false
        if (event.pointerType === 'touch') {
          const box = event.currentTarget.getBoundingClientRect()
          touches.current.set(event.pointerId, { x: event.clientX - box.left, y: event.clientY - box.top })
          if (touches.current.size === 2) {
            stopMotion(); setFocused(null); suppressedClick.current = true; setDragging(true)
            gesture.current = { pinch: { camera: getCamera(), start: [...touches.current.values()], viewport: { width: box.width || viewport.width, height: box.height || viewport.height } } }
            for (const id of touches.current.keys()) { try { event.currentTarget.setPointerCapture(id) } catch { /* Capture is optional. */ } }
            return
          }
        }
        const hitKey = event.target.closest('[data-plane-key]')?.dataset.planeKey
        const hit = planes.find((plane) => plane.key === hitKey)
        gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false, scale: Math.max(0.2, hit?.scale || 1) }
        motion.current.time = event.timeStamp
      }}
      onPointerMove={(event) => {
        if (event.pointerType === 'touch' && touches.current.has(event.pointerId)) {
          const box = event.currentTarget.getBoundingClientRect()
          touches.current.set(event.pointerId, { x: event.clientX - box.left, y: event.clientY - box.top })
        }
        if (gesture.current?.pinch && touches.current.size === 2) {
          event.preventDefault()
          const pinch = gesture.current.pinch
          move(pinchGallery(pinch.camera, pinch.start, [...touches.current.values()], pinch.viewport)); return
        }
        if (!gesture.current) {
          if (focused || reducedMotion || event.pointerType !== 'mouse') return
          const box = event.currentTarget.getBoundingClientRect()
          event.currentTarget.style.setProperty('--look-x', `${((event.clientX - box.left) / Math.max(1, box.width) - 0.5) * -14}px`)
          event.currentTarget.style.setProperty('--look-y', `${((event.clientY - box.top) / Math.max(1, box.height) - 0.5) * -10}px`)
          return
        }
        const current = gesture.current
        if (event.pointerId !== current.id) return
        if (!current.moved && Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < 6) return
        if (!current.moved) {
          stopMotion(); setFocused(null); current.moved = true; suppressedClick.current = true; setDragging(true)
          try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* Gesture continues inside the stage. */ }
        }
        event.preventDefault()
        const x = -(event.clientX - current.x) / current.scale, y = -(event.clientY - current.y) / current.scale
        current.x = event.clientX; current.y = event.clientY
        const time = event.timeStamp, elapsed = Math.max(8, time - motion.current.time)
        motion.current.x = Math.max(-24, Math.min(24, x * 16.67 / elapsed)); motion.current.y = Math.max(-24, Math.min(24, y * 16.67 / elapsed)); motion.current.time = time
        move((value) => ({ ...value, x: value.x + x, y: value.y + y }))
      }}
      onPointerUp={(event) => finishPointer(event)} onPointerCancel={(event) => finishPointer(event, true)} onLostPointerCapture={(event) => finishPointer(event, true)}
      onPointerLeave={(event) => { event.currentTarget.style.setProperty('--look-x', '0px'); event.currentTarget.style.setProperty('--look-y', '0px') }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && focused) { event.preventDefault(); event.stopPropagation(); stopMotion(); setFocused(null); return }
        if (event.target !== event.currentTarget) return
        const moves = { ArrowLeft: [-180, 0], ArrowRight: [180, 0], ArrowUp: [0, -160], ArrowDown: [0, 160] }
        if (moves[event.key]) { event.preventDefault(); pan(...moves[event.key]) }
        else if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(240) }
        else if (event.key === '-') { event.preventDefault(); zoom(-240) }
        else if (event.key === 'Home') { event.preventDefault(); reset() }
      }}>
      <div className="gallery-world">{planes.map((plane) => <GalleryWallCard key={plane.key} card={cards[plane.index]} plane={plane} focused={focused?.key === plane.key} flipped={focused?.key === plane.key && focused.flipped} now={now} onActivate={activate} />)}</div>
      <span className="gallery-vignette" aria-hidden="true" />
    </div>
    <span className="gallery-announcement" role="status">{focused ? `${focused.flipped ? (cards[focused.plane.index].back ? 'Answer shown.' : 'Blank answer side.') : 'Card centred. Click again to flip.'}` : ''}</span>
    <p id="gallery-instructions" className="gallery-hint">Drag to explore · Scroll or pinch to travel deeper · Click once to centre a card, again to flip. Keyboard: arrows to move, +/− to zoom, Home to reset.</p>
  </div>
}
