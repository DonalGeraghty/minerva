import { useStoredState, useTabSession } from '../context/TabSessionContext.jsx'
import { createBudgetPlan } from '../services/finance.js'

const EMPTY_BUDGET = { result: null, busy: false, progress: null, error: '', errorCode: '', validationReason: '' }

export function useBudgetPlan(month) {
  const session = useTabSession()
  const stateKey = `budget.plan.${month}`
  const [state, setState] = useStoredState(session, stateKey, EMPTY_BUDGET)
  const generate = async () => {
    if (session.get(stateKey, EMPTY_BUDGET).busy) return
    session.requests.budget?.abort()
    const controller = new AbortController()
    session.requests.budget = controller
    setState((current) => ({ ...current, busy: true, progress: 'starting', error: '', errorCode: '', validationReason: '' }))
    try {
      const result = await createBudgetPlan(controller.signal, (progress) => {
        if (!controller.signal.aborted && session.active && session.requests.budget === controller) setState((current) => ({ ...current, progress }))
      })
      if (!controller.signal.aborted && session.active) setState((current) => ({ ...current, result }))
    } catch (error) {
      if (!controller.signal.aborted && session.active) setState((current) => ({ ...current, error: error.message || 'Could not assess your budget.', errorCode: error.code || '', validationReason: error.validationReason || '' }))
    } finally {
      if (session.requests.budget === controller) session.requests.budget = null
      if (session.active) setState((current) => ({ ...current, busy: false, progress: null }))
    }
  }
  return { ...state, generate }
}
