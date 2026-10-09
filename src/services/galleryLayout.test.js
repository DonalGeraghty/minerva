import { describe, expect, it } from 'vitest'
import { focusGalleryCamera, galleryLayout, GALLERY_CARD_WIDTH, GALLERY_FOCAL_LENGTH, GALLERY_FOCUSED_HEIGHT, INITIAL_GALLERY_CAMERA, MAX_GALLERY_PLANES, pickGalleryPlane, pinchGallery, projectGalleryPlane, zoomGallery } from './galleryLayout.js'

describe('Infinite card wall', () => {
  it('makes distant visible cards focusable and picks their screen-space targets', () => {
    const viewport = { width: 1000, height: 620 }
    const far = projectGalleryPlane({ key: 'far', worldX: 0, worldY: 0, worldZ: 3000 }, INITIAL_GALLERY_CAMERA, viewport)
    expect(far.scale).toBeLessThan(0.3)
    expect(far.focusable).toBe(true)
    expect(pickGalleryPlane([far], { x: 500 + GALLERY_CARD_WIDTH * far.scale / 2 + 5, y: 310 }, viewport)).toBe(far)
    const near = projectGalleryPlane({ key: 'near', worldX: 0, worldY: 0, worldZ: 0 }, INITIAL_GALLERY_CAMERA, viewport)
    expect(pickGalleryPlane([far, near], { x: 500, y: 310 }, viewport)).toBe(near)
    expect(pickGalleryPlane([far], { x: 0, y: 0 }, viewport)).toBeNull()
  })
  it('recycles a bounded visible set at distant camera positions and depth', () => {
    for (const depth of [0, -1000000, 1000000, 1000000000]) {
      const planes = galleryLayout({ x: depth, y: -depth, depth }, 7, { width: 1500, height: 900 })
      expect(planes.length).toBeLessThanOrEqual(MAX_GALLERY_PLANES)
      expect(planes.length).toBeGreaterThan(0)
      expect(new Set(planes.map((plane) => plane.key)).size).toBe(planes.length)
      for (const plane of planes) {
        expect(plane.index).toBeGreaterThanOrEqual(0)
        expect(plane.index).toBeLessThan(7)
        expect(Number.isFinite(plane.x) && Number.isFinite(plane.y) && Number.isFinite(plane.z)).toBe(true)
        expect(plane.scale).toBeGreaterThan(0)
      }
    }
  })

  it('fills the wall with repeated cards even for a one-card library', () => {
    const planes = galleryLayout(INITIAL_GALLERY_CAMERA, 1)
    expect(planes.length).toBeGreaterThan(20)
    expect(planes.every((plane) => plane.index === 0)).toBe(true)
    expect(galleryLayout(INITIAL_GALLERY_CAMERA, 0)).toEqual([])
  })

  it('has no zoom end-stop and preserves the point under the cursor', () => {
    const plane = { worldX: 200, worldY: 100, worldZ: 500 }
    const first = projectGalleryPlane(plane, INITIAL_GALLERY_CAMERA, { width: 1000, height: 620 })
    const anchor = { x: first.x * first.scale, y: first.y * first.scale }
    const camera = zoomGallery(INITIAL_GALLERY_CAMERA, 240, anchor)
    const next = projectGalleryPlane(plane, camera, { width: 1000, height: 620 })
    expect(next.x * next.scale).toBeCloseTo(anchor.x)
    expect(next.y * next.scale).toBeCloseTo(anchor.y)
    expect(zoomGallery(camera, 1000000).depth).toBe(1000240)
    expect(zoomGallery(camera, -1000000).depth).toBe(-999760)
  })

  it('centres and fits a selected card on desktop and mobile', () => {
    const plane = galleryLayout(INITIAL_GALLERY_CAMERA, 4)[0]
    for (const viewport of [{ width: 1000, height: 620 }, { width: 320, height: 380 }]) {
      const camera = focusGalleryCamera(plane, viewport)
      const projection = projectGalleryPlane(plane, camera, viewport)
      expect(projection.x).toBe(0)
      expect(projection.y).toBe(0)
      expect(projection.scale * GALLERY_CARD_WIDTH).toBeLessThanOrEqual(viewport.width * 0.82 + 0.001)
      expect(projection.scale * GALLERY_FOCUSED_HEIGHT).toBeLessThanOrEqual(viewport.height * 0.78 + 0.001)
    }
  })

  it('keeps world positions stable and supports pinch travel without a scale cap', () => {
    const first = galleryLayout(INITIAL_GALLERY_CAMERA, 30)
    const next = galleryLayout({ x: 150, y: 0, depth: 0 }, 30)
    const shared = first.filter((plane) => next.some((other) => other.key === plane.key))
    expect(shared.length).toBeGreaterThan(10)
    for (const plane of shared) {
      const moved = next.find((other) => other.key === plane.key)
      expect(moved.index).toBe(plane.index)
      expect(moved.x).toBe(plane.x - 150)
      expect(moved.worldZ).toBe(plane.worldZ)
    }
    const start = [{ x: 400, y: 250 }, { x: 600, y: 250 }]
    const current = [{ x: 400, y: 290 }, { x: 700, y: 290 }]
    const pinched = pinchGallery(INITIAL_GALLERY_CAMERA, start, current, { width: 1000, height: 500 })
    expect(pinched.depth).toBeCloseTo(Math.log(1.5) * GALLERY_FOCAL_LENGTH)
    expect(pinched.x).toBe(-50)
    expect(pinched.y).toBe(-40)
  })
})
