import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react'
import { createBudgetPlan, financeChat } from '../services/finance.js'

const TabSessionContext = createContext(null)
const EMPTY_CHAT = { messages: [], input: '', busy: false, error: '', errorCode: '', meta: null }
const EMPTY_BUDGET = { result: null, previous: null, busy: false, error: '', errorCode: '', validationReason: '' }

function createSession() {
  const values = new Map()
  const listeners = new Set()
  return {
    active: true,
    request: null,
    budgetRequest: null,
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
      this.request?.abort()
      this.budgetRequest?.abort()
      this.request = null
      this.budgetRequest = null
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

function useSession() {
  const provided = useContext(TabSessionContext)
  const [local] = useState(() => provided ? null : createSession())
  useEffect(() => {
    if (!local) return
    local.activate()
    return () => local.dispose()
  }, [local])
  return provided || local
}

function useStoredState(session, key, initial) {
  const getSnapshot = useCallback(() => session.get(key, initial), [session, key, initial])
  const value = useSyncExternalStore(session.subscribe, getSnapshot)
  const setValue = useCallback((next) => session.set(key, next, initial), [session, key, initial])
  return [value, setValue]
}

export function useTabState(key, initial) {
  return useStoredState(useSession(), key, initial)
}

export function useAskConversation() {
  const session = useSession()
  const [chat, setChat] = useStoredState(session, 'ask', EMPTY_CHAT)
  const setInput = (input) => setChat((current) => ({ ...current, input }))
  const newConversation = () => {
    session.request?.abort()
    session.request = null
    setChat({ ...EMPTY_CHAT })
    session.positions.delete('ask')
  }
  const ask = async (event) => {
    event.preventDefault()
    const current = session.get('ask', EMPTY_CHAT)
    const question = current.input.trim()
    if (!question || current.busy) return
    const controller = new AbortController()
    session.request = controller
    const messages = [...current.messages, { role: 'user', content: question }]
    setChat({ ...current, messages, input: '', busy: true, error: '', errorCode: '' })
    try {
      const history = current.messages.map(({ role, content }) => ({ role, content }))
      const result = await financeChat(question, history, controller.signal)
      if (!controller.signal.aborted && session.request === controller) {
        setChat((state) => ({ ...state, messages: [...messages, { role: 'assistant', content: result.answer, meta: result.meta }], meta: result.meta }))
      }
    } catch (error) {
      if (!controller.signal.aborted && session.request === controller) {
        setChat((state) => ({ ...state, error: error.message || 'Could not get an answer', errorCode: error.code || '' }))
      }
    } finally {
      if (session.request === controller) {
        session.request = null
        setChat((state) => ({ ...state, busy: false }))
      }
    }
  }
  return { ...chat, setInput, ask, newConversation }
}

export function useBudgetPlan(month) {
  const session = useSession()
  const stateKey = `budget.plan.${month}`
  const [state, setState] = useStoredState(session, stateKey, EMPTY_BUDGET)
  const generate = async (body) => {
    if (session.get(stateKey, EMPTY_BUDGET).busy) return
    session.budgetRequest?.abort()
    const controller = new AbortController()
    session.budgetRequest = controller
    setState((current) => ({ ...current, busy: true, error: '', errorCode: '', validationReason: '' }))
    try {
      const result = await createBudgetPlan(body, controller.signal)
      if (!controller.signal.aborted && session.active) setState((current) => ({ ...current, previous: current.result, result }))
    } catch (error) {
      if (!controller.signal.aborted && session.active) setState((current) => ({ ...current, error: error.message || 'Could not assess your budget.', errorCode: error.code || '', validationReason: error.validationReason || '' }))
    } finally {
      if (session.budgetRequest === controller) session.budgetRequest = null
      if (session.active) setState((current) => ({ ...current, busy: false }))
    }
  }
  return { ...state, generate }
}

// Restore after asynchronous page content has arrived, rather than clamping a
// saved position against a short loading screen. Named inner scrollers are saved too.
export function useTabScroll(key, ready = true) {
  const session = useSession()
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
