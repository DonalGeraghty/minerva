import { useCallback, useEffect, useRef, useState } from 'react'
import { INITIAL_GALLERY_CAMERA } from '../services/galleryLayout.js'

export default function useGalleryCamera() {
  const [camera, setCamera] = useState(INITIAL_GALLERY_CAMERA)
  const current = useRef(INITIAL_GALLERY_CAMERA)
  const publishFrame = useRef(0)
  const animationFrame = useRef(0)
  const stopAnimation = useCallback(() => { cancelAnimationFrame(animationFrame.current); animationFrame.current = 0 }, [])
  const getCamera = useCallback(() => current.current, [])
  const move = useCallback((change) => {
    stopAnimation()
    current.current = typeof change === 'function' ? change(current.current) : change
    if (!publishFrame.current) publishFrame.current = requestAnimationFrame(() => {
      publishFrame.current = 0; setCamera(current.current)
    })
  }, [stopAnimation])
  const animateTo = useCallback((target, immediate = false) => {
    stopAnimation(); cancelAnimationFrame(publishFrame.current); publishFrame.current = 0
    if (immediate) { current.current = target; setCamera(target); return }
    const start = current.current
    let started = null
    const tick = (now) => {
      if (started === null) started = now
      const amount = Math.max(0, Math.min(1, (now - started) / 320)), eased = 1 - (1 - amount) ** 3
      current.current = Object.fromEntries(['x', 'y', 'depth'].map((key) => [key, start[key] + (target[key] - start[key]) * eased]))
      setCamera(current.current)
      if (amount < 1) animationFrame.current = requestAnimationFrame(tick)
      else animationFrame.current = 0
    }
    animationFrame.current = requestAnimationFrame(tick)
  }, [stopAnimation])
  useEffect(() => () => {
    cancelAnimationFrame(publishFrame.current); cancelAnimationFrame(animationFrame.current)
    publishFrame.current = 0; animationFrame.current = 0
  }, [])
  return { camera, move, animateTo, stopAnimation, getCamera }
}
