export const INITIAL_GALLERY_CAMERA = { x: 0, y: 0, depth: 0 }
export const GALLERY_FOCAL_LENGTH = 1100
export const GALLERY_CARD_WIDTH = 278
export const GALLERY_FOCUSED_HEIGHT = 300
export const MAX_GALLERY_PLANES = 160
export const MAX_MOBILE_GALLERY_PLANES = 48
export const GALLERY_CELL_WIDTH = 460
export const GALLERY_CELL_HEIGHT = 350
const LAYER_SPACING = 860

export function zoomGallery(camera, travel, anchor = { x: 0, y: 0 }) {
  // Travel through repeated depth layers instead of enlarging one finite wall.
  // There is no end-stop; anchor movement remains local and numerically stable.
  return { x: camera.x + anchor.x * travel / GALLERY_FOCAL_LENGTH,
    y: camera.y + anchor.y * travel / GALLERY_FOCAL_LENGTH, depth: camera.depth + travel }
}

export function pinchGallery(camera, start, current, viewport) {
  const distance = (points) => Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
  const centre = (points) => ({ x: (points[0].x + points[1].x) / 2 - viewport.width / 2,
    y: (points[0].y + points[1].y) / 2 - viewport.height / 2 })
  const first = centre(start), next = centre(current)
  const result = zoomGallery(camera, Math.log(Math.max(0.01, distance(current)) / Math.max(1, distance(start))) * GALLERY_FOCAL_LENGTH, first)
  return { ...result, x: result.x - (next.x - first.x), y: result.y - (next.y - first.y) }
}

export function projectGalleryPlane(plane, camera, viewport) {
  const distance = plane.worldZ - camera.depth
  const scale = GALLERY_FOCAL_LENGTH / (GALLERY_FOCAL_LENGTH + distance)
  const x = plane.worldX - camera.x, y = plane.worldY - camera.y
  return { ...plane, x, y, z: -distance, scale,
    focusable: scale > 0.22 && Math.abs(x * scale) < viewport.width / 2 - Math.min(85, GALLERY_CARD_WIDTH * scale / 2) &&
      Math.abs(y * scale) < viewport.height / 2 - Math.min(65, 208 * scale / 2) }
}

export function pickGalleryPlane(planes, point, viewport, focusedKey = null, offset = { x: 0, y: 0 }) {
  // Screen-space fallback gives small, distant cards a forgiving target without
  // allowing clicks through a nearer card that visibly covers the same point.
  let hit = null
  for (const plane of planes) {
    if (plane.scale <= 0) continue
    const x = viewport.width / 2 + plane.x * plane.scale + offset.x
    const y = viewport.height / 2 + plane.y * plane.scale + offset.y
    const width = GALLERY_CARD_WIDTH * plane.scale / 2 + 7
    const height = (plane.key === focusedKey ? GALLERY_FOCUSED_HEIGHT : 208) * plane.scale / 2 + 7
    if (Math.abs(point.x - x) > width || Math.abs(point.y - y) > height) continue
    if (!hit || plane.z > hit.z) hit = plane
  }
  return hit
}

export function focusGalleryCamera(plane, viewport) {
  const mobile = viewport.mobile ?? viewport.width <= 720
  const fit = Math.min(viewport.width * 0.82 / GALLERY_CARD_WIDTH, viewport.height * 0.78 / GALLERY_FOCUSED_HEIGHT, mobile ? 1.15 : Infinity)
  const distance = GALLERY_FOCAL_LENGTH * (1 / Math.max(0.2, fit) - 1)
  return { x: plane.worldX, y: plane.worldY, depth: plane.worldZ - distance }
}

export function galleryLayout(camera, count, viewport = { width: 1000, height: 620 }) {
  if (!count) return []
  const mobile = viewport.mobile ?? viewport.width <= 720
  const nearRange = mobile ? 500 : 780, farRange = mobile ? 2200 : 3000
  const firstLayer = Math.floor((camera.depth - nearRange) / LAYER_SPACING)
  const lastLayer = Math.floor((camera.depth + farRange) / LAYER_SPACING)
  const budget = Math.floor((mobile ? MAX_MOBILE_GALLERY_PLANES : MAX_GALLERY_PLANES) / (lastLayer - firstLayer + 1))
  const planes = []
  for (let layer = firstLayer; layer <= lastLayer; layer++) {
    const distance = layer * LAYER_SPACING - camera.depth
    const scale = GALLERY_FOCAL_LENGTH / Math.max(200, GALLERY_FOCAL_LENGTH + distance)
    const columns = Math.min(mobile ? 5 : 10, Math.ceil(viewport.width / (2 * GALLERY_CELL_WIDTH * scale)) + 1)
    const rows = Math.min(mobile ? 4 : 7, Math.ceil(viewport.height / (2 * GALLERY_CELL_HEIGHT * scale)) + 1)
    const centreColumn = Math.round(camera.x / GALLERY_CELL_WIDTH), centreRow = Math.round(camera.y / GALLERY_CELL_HEIGHT)
    const candidates = []
    for (let row = centreRow - rows; row <= centreRow + rows; row++) {
      for (let column = centreColumn - columns; column <= centreColumn + columns; column++) {
        const seed = (Math.imul(column, 73856093) ^ Math.imul(row, 19349663) ^ Math.imul(layer, 83492791)) >>> 0
        const plane = projectGalleryPlane({ key: `${layer}:${column}:${row}`, index: seed % count,
          worldX: column * GALLERY_CELL_WIDTH + (seed % 81 - 40) + (((layer % 3 + 3) % 3) - 1) * 145,
          worldY: row * GALLERY_CELL_HEIGHT + ((seed >>> 7) % 71 - 35) + ((layer % 2 + 2) % 2 ? 125 : -85),
          worldZ: layer * LAYER_SPACING + ((seed >>> 13) % 260),
          rotateX: ((seed >>> 16) % 7) - 3, rotateY: ((seed >>> 20) % 11) - 5,
        }, camera, viewport)
        if (plane.z > nearRange || plane.z < -(farRange + 250) || plane.scale <= 0) continue
        if (Math.abs(plane.x * plane.scale) > viewport.width / 2 + GALLERY_CARD_WIDTH * plane.scale ||
          Math.abs(plane.y * plane.scale) > viewport.height / 2 + 220 * plane.scale) continue
        candidates.push(plane)
      }
    }
    candidates.sort((a, b) => Math.hypot(a.x * a.scale, a.y * a.scale) - Math.hypot(b.x * b.scale, b.y * b.scale))
    planes.push(...candidates.slice(0, budget))
  }
  return planes.sort((a, b) => Math.hypot(a.x * a.scale, a.y * a.scale) - Math.hypot(b.x * b.scale, b.y * b.scale))
}
