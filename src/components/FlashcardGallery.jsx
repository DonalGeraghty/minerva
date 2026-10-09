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
  const focusedPlane = useRef(null)
  const [now, setNow] = useState(() => Date.now())
  const [coarsePointer, setCoarsePointer] = useState(() => window.matchMedia?.('(pointer: coarse)').matches || false)
  const mobile = coarsePointer || viewport.width <= 720
  const gesture = useRef(null), touches = useRef(new Map()), suppressedClick = useRef(false)
  const motion = useRef({ frame: 0, x: 0, y: 0, time: 0 })
  const stopInertia = useCallback(() => {
    cancelAnimationFrame(motion.current.frame)
    motion.current.frame = 0; motion.current.x = 0; motion.current.y = 0
  }, [])
  const stopMotion = useCallback(() => { stopInertia(); stopAnimation() }, [stopInertia, stopAnimation])
  const clearFocus = useCallback(() => { focusedPlane.current = null; setFocused(null) }, [])

  useLayoutEffect(() => {
    const element = stage.current
    const measure = () => {
      const box = element.getBoundingClientRect()
      const width = element.clientWidth || box.width || 1000
      const next = { width, height: element.clientHeight || box.height || 620, mobile: coarsePointer || width <= 720 }
      setViewport((current) => current.width === next.width && current.height === next.height && current.mobile === next.mobile ? current : next)
      if (focusedPlane.current) animateTo(focusGalleryCamera(focusedPlane.current, next), true)
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(element)
    const wheel = (event) => {
      event.preventDefault(); stopMotion(); clearFocus()
      const box = element.getBoundingClientRect()
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? box.height || 620 : 1)
      move((current) => zoomGallery(current, -Math.max(-240, Math.min(240, delta)) * 1.8,
        { x: event.clientX - box.left - box.width / 2, y: event.clientY - box.top - box.height / 2 }))
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => { observer?.disconnect(); element.removeEventListener('wheel', wheel); stopMotion() }
  }, [animateTo, clearFocus, coarsePointer, move, stopMotion])

  useEffect(() => {
    const media = window.matchMedia?.('(pointer: coarse)')
    const update = (event) => setCoarsePointer(event.matches)
    media?.addEventListener('change', update)
    return () => media?.removeEventListener('change', update)
  }, [])

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

  const pan = (x, y) => { stopMotion(); clearFocus(); move((current) => ({ ...current, x: current.x + x, y: current.y + y })) }
  const zoom = (travel) => { stopMotion(); clearFocus(); move((current) => zoomGallery(current, travel)) }
  const reset = () => { stopMotion(); clearFocus(); move(INITIAL_GALLERY_CAMERA) }
  const activate = (plane, keyboard) => {
    if (!keyboard && suppressedClick.current) return
    if (focused?.key === plane.key) { setFocused((current) => ({ ...current, flipped: !current.flipped })); return }
    stopMotion()
    focusedPlane.current = plane
    setFocused({ key: plane.key, plane, flipped: false })
    stage.current.style.setProperty('--look-x', '0px'); stage.current.style.setProperty('--look-y', '0px')
    const box = stage.current.getBoundingClientRect()
    const width = stage.current.clientWidth || box.width || viewport.width
    const measured = { width, height: stage.current.clientHeight || box.height || viewport.height, mobile: coarsePointer || width <= 720 }
    animateTo(focusGalleryCamera(plane, measured), reducedMotion)
  }
  const finishPointer = (event, cancelled = false) => {
    touches.current.delete(event.pointerId)
    if (gesture.current?.pinch) {
      gesture.current = null; setDragging(false); stopMotion()
      try { event.currentTarget.releasePointerCapture(event.pointerId) } catch { /* Capture may have ended. */ }
      return
    }
    if (!gesture.current || event.pointerId !== gesture.current.id) return
    const ended = gesture.current, moved = ended.moved
    gesture.current = null; setDragging(false)
    try { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) } catch { /* Capture may have ended. */ }
    if (!moved) {
      stopInertia()
      if (!cancelled && event.pointerType === 'touch' && ended.hit) {
        activate(ended.hit, true)
        suppressedClick.current = true
      }
      return
    }
    if (cancelled || reducedMotion || event.timeStamp - motion.current.time > 100) { stopMotion(); return }
    motion.current.time = 0
    const drift = (time) => {
      const elapsed = motion.current.time ? Math.min(2, Math.max(0.25, (time - motion.current.time) / 16.67)) : 1
      motion.current.time = time
      const friction = ended.touch ? 0.8 : 0.88
      motion.current.x *= friction ** elapsed; motion.current.y *= friction ** elapsed
      if (Math.abs(motion.current.x) + Math.abs(motion.current.y) < 0.15) { motion.current.frame = 0; return }
      const x = motion.current.x * elapsed, y = motion.current.y * elapsed
      move((current) => ({ ...current, x: current.x + x, y: current.y + y }))
      motion.current.frame = requestAnimationFrame(drift)
    }
    motion.current.frame = requestAnimationFrame(drift)
  }

  const visiblePlanes = galleryLayout(camera, cards.length, { ...viewport, mobile })
  const planes = focused
    ? [...visiblePlanes.filter((plane) => plane.key !== focused.key), projectGalleryPlane(focused.plane, camera, viewport)] : visiblePlanes
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
    <div ref={stage} className={`gallery-stage${mobile ? ' is-mobile' : ''}${dragging ? ' is-dragging' : ''}${reducedMotion ? ' is-reduced-motion' : ''}${focused ? ' has-focused-card' : ''}`}
      role="region" tabIndex={0} aria-label="Infinite flashcard gallery" aria-describedby="gallery-instructions" data-camera-depth={camera.depth} data-camera-x={camera.x} data-camera-y={camera.y}
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
            stopMotion(); clearFocus(); suppressedClick.current = true; setDragging(true)
            gesture.current = { pinch: { camera: getCamera(), start: [...touches.current.values()], viewport: { width: box.width || viewport.width, height: box.height || viewport.height } } }
            for (const id of touches.current.keys()) { try { event.currentTarget.setPointerCapture(id) } catch { /* Capture is optional. */ } }
            return
          }
        }
        const hitKey = event.target.closest('[data-plane-key]')?.dataset.planeKey
        const box = event.currentTarget.getBoundingClientRect()
        const hit = planes.find((plane) => plane.key === hitKey) || pickGalleryPlane(planes, { x: event.clientX - box.left, y: event.clientY - box.top }, viewport, focused?.key)
        const touch = event.pointerType === 'touch'
        gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false,
          touch, hit, scale: touch ? Math.max(0.85, Math.min(1.25, hit?.scale || 1)) : Math.max(0.2, hit?.scale || 1) }
        if (touch) { try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* Capture is optional. */ } }
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
          stopMotion(); clearFocus(); current.moved = true; suppressedClick.current = true; setDragging(true)
          try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* Gesture continues inside the stage. */ }
        }
        event.preventDefault()
        const x = -(event.clientX - current.x) / current.scale, y = -(event.clientY - current.y) / current.scale
        current.x = event.clientX; current.y = event.clientY
        const time = event.timeStamp, elapsed = Math.max(8, time - motion.current.time)
        const limit = current.touch ? 12 : 24
        motion.current.x = Math.max(-limit, Math.min(limit, x * 16.67 / elapsed)); motion.current.y = Math.max(-limit, Math.min(limit, y * 16.67 / elapsed)); motion.current.time = time
        move((value) => ({ ...value, x: value.x + x, y: value.y + y }))
      }}
      onPointerUp={(event) => finishPointer(event)} onPointerCancel={(event) => finishPointer(event, true)}
      onLostPointerCapture={(event) => { if (event.target === event.currentTarget) finishPointer(event, true) }}
      onPointerLeave={(event) => { event.currentTarget.style.setProperty('--look-x', '0px'); event.currentTarget.style.setProperty('--look-y', '0px') }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && focused) { event.preventDefault(); event.stopPropagation(); stopMotion(); clearFocus(); return }
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
