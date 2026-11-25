import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react'

const TabSessionContext = createContext(null)

function createSession() {
  const values = new Map()
  const listeners = new Set()
  return {
    active: true,
    requests: {},
    positions: new Map(),
    activate() { this.active = true },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    get(key, initial) { return values.has(key) ? values.get(key) : initial },
    set(key, update, initial) {
      if (!this.active) return
      const next = typeof update === 'function' ? update(this.get(key, initial)) : update
      values.set(key, next)
      listeners.forEach((listener) => listener())
    },
    dispose() {
      this.active = false
      Object.values(this.requests).forEach((controller) => controller?.abort())
      this.requests = {}
      values.clear()
      this.positions.clear()
    },
  }
}

export function TabSessionProvider({ children }) {
  const [session] = useState(createSession)
  useEffect(() => {
    session.activate()
    return () => session.dispose()
  }, [session])
  return <TabSessionContext.Provider value={session}>{children}</TabSessionContext.Provider>
}

export function useTabSession() {
  const provided = useContext(TabSessionContext)
  const [local] = useState(() => provided ? null : createSession())
  useEffect(() => {
    if (!local) return
    local.activate()
    return () => local.dispose()
  }, [local])
  return provided || local
}

export function useStoredState(session, key, initial) {
  const getSnapshot = useCallback(() => session.get(key, initial), [session, key, initial])
  const value = useSyncExternalStore(session.subscribe, getSnapshot)
  const setValue = useCallback((next) => session.set(key, next, initial), [session, key, initial])
  return [value, setValue]
}

export function useTabState(key, initial) {
  return useStoredState(useTabSession(), key, initial)
}

// Restore after asynchronous page content has arrived, rather than clamping a
// saved position against a short loading screen. Named inner scrollers are saved too.
export function useTabScroll(key, ready = true) {
  const session = useTabSession()
  useLayoutEffect(() => {
    if (!ready) return
    const saved = session.positions.get(key)
    const root = document.querySelector('main')
    const elements = () => [...(root?.querySelectorAll('[data-tab-scroll]') || [])]
    const restored = new WeakSet()
    const restoreInner = () => {
      for (const element of elements()) {
        if (restored.has(element)) continue
        restored.add(element)
        const position = saved?.inner[element.dataset.tabScroll]
        if (position) { element.scrollLeft = position.left; element.scrollTop = position.top }
      }
    }
    const restore = requestAnimationFrame(() => {
      if (window.scrollY !== (saved?.window || 0)) window.scrollTo(0, saved?.window || 0)
      restoreInner()
    })
    const save = () => session.positions.set(key, {
      window: window.scrollY,
      inner: { ...session.positions.get(key)?.inner, ...Object.fromEntries(elements().map((element) => [element.dataset.tabScroll, { left: element.scrollLeft, top: element.scrollTop }])) },
    })
    const observer = new MutationObserver(restoreInner)
    if (root) observer.observe(root, { childList: true, subtree: true })
    document.addEventListener('scroll', save, true)
    return () => {
      cancelAnimationFrame(restore)
      observer.disconnect()
      document.removeEventListener('scroll', save, true)
      if (session.active) save()
    }
  }, [session, key, ready])
}
