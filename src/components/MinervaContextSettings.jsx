import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { getMinervaSettings, saveMinervaSettings } from '../services/minervaSettings.js'

export default function MinervaContextSettings() {
  const { logout, user } = useAuth()
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const handleError = useCallback((error) => {
    if (error.status === 401) return logout()
    setMessage({ type: 'error', text: error.message || 'Could not update Minerva’s card context.' })
  }, [logout])

  useEffect(() => {
    if (user?.isDemo) {
      setLoading(false)
      return undefined
    }
    let active = true
    getMinervaSettings()
      .then((settings) => { if (active) setEnabled(Boolean(settings?.include_card_context)) })
      .catch((error) => { if (active) handleError(error) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [handleError, user?.isDemo])

  const change = async (event) => {
    const nextEnabled = event.target.checked
    setSaving(true)
    setMessage(null)
    try {
      const settings = await saveMinervaSettings({ include_card_context: nextEnabled })
      setEnabled(Boolean(settings.include_card_context))
      setMessage({
        type: 'success',
        text: settings.include_card_context
          ? 'Minerva will use your full card library when creating new cards.'
          : 'Minerva will create cards without seeing your existing library.',
      })
    } catch (error) {
      handleError(error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="settings-card minerva-context-card" aria-labelledby="card-context-heading">
      <header className="settings-heading">
        <div><p className="settings-kicker">Card context</p><h2 id="card-context-heading">Remember what you remember.</h2></div>
        <p>{loading ? 'Loading…' : enabled ? 'On' : 'Off'}</p>
      </header>
      <div className="context-setting-row">
        <div><strong>Use existing cards as context</strong><p>When on, Minerva sees your full card library so it can avoid duplicates and build on what you already know.</p></div>
        <label className="toggle-switch">
          <input type="checkbox" aria-label="Use existing cards as context" checked={enabled} onChange={change} disabled={loading || saving || user?.isDemo} />
          <span aria-hidden="true" />
        </label>
      </div>
      {user?.isDemo && <p className="settings-message">Card context is available for signed-in Janus accounts.</p>}
      {message && <p className={`settings-message is-${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}>{message.text}</p>}
    </section>
  )
}
