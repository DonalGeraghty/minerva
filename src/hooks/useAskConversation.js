import { useStoredState, useTabSession } from '../context/TabSessionContext.jsx'
import { financeChat } from '../services/finance.js'

const EMPTY_CHAT = { messages: [], input: '', busy: false, error: '', errorCode: '', meta: null }

export function useAskConversation() {
  const session = useTabSession()
  const [chat, setChat] = useStoredState(session, 'ask', EMPTY_CHAT)
  const setInput = (input) => setChat((current) => ({ ...current, input }))
  const newConversation = () => {
    session.requests.ask?.abort()
    session.requests.ask = null
    setChat({ ...EMPTY_CHAT })
    session.positions.delete('ask')
  }
  const ask = async (event) => {
    event.preventDefault()
    const current = session.get('ask', EMPTY_CHAT)
    const question = current.input.trim()
    if (!question || current.busy) return
    const controller = new AbortController()
    session.requests.ask = controller
    const messages = [...current.messages, { role: 'user', content: question }]
    setChat({ ...current, messages, input: '', busy: true, error: '', errorCode: '' })
    try {
      const history = current.messages.map(({ role, content }) => ({ role, content }))
      const result = await financeChat(question, history, controller.signal)
      if (!controller.signal.aborted && session.requests.ask === controller) {
        setChat((state) => ({ ...state, messages: [...messages, { role: 'assistant', content: result.answer, meta: result.meta }], meta: result.meta }))
      }
    } catch (error) {
      if (!controller.signal.aborted && session.requests.ask === controller) {
        setChat((state) => ({ ...state, error: error.message || 'Could not get an answer', errorCode: error.code || '' }))
      }
    } finally {
      if (session.requests.ask === controller) {
        session.requests.ask = null
        setChat((state) => ({ ...state, busy: false }))
      }
    }
  }
  return { ...chat, setInput, ask, newConversation }
}
