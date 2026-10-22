import { apiRequest } from './request.js'

// Bound all Garmin requests from this browser, including newly revealed cards.
const pending = []
let active = 0
function pump() {
  while (active < 2 && pending.length) {
    const task = pending.shift()
    task.signal?.removeEventListener('abort', task.cancel)
    if (task.signal?.aborted) { task.reject(new DOMException('Aborted', 'AbortError')); continue }
    active += 1
    Promise.resolve().then(task.run).then(task.resolve, task.reject).finally(() => { active -= 1; pump() })
  }
}

export function queuedGarminRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const task = { run: () => apiRequest(path, options), resolve, reject, signal: options.signal }
    task.cancel = () => {
      const index = pending.indexOf(task)
      if (index >= 0) { pending.splice(index, 1); reject(new DOMException('Aborted', 'AbortError')) }
    }
    if (task.signal?.aborted) { reject(new DOMException('Aborted', 'AbortError')); return }
    task.signal?.addEventListener('abort', task.cancel, { once: true })
    pending.push(task)
    pump()
  })
}
