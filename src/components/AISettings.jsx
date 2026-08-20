import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { getAISettings, saveAISelection } from '../services/aiSettings.js'
import ProviderKeySettings from './ProviderKeySettings.jsx'

export default function AISettings() {
  const { logout, user } = useAuth()
  const [settings, setSettings] = useState(null)
  const [selection, setSelection] = useState({ provider: '', model: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const unauthorized = useCallback((error) => {
    if (error.status !== 401) return false
    logout()
    return true
  }, [logout])

  useEffect(() => {
    if (user?.isDemo) {
      setLoading(false)
      return undefined
    }
    let active = true
    getAISettings()
      .then((data) => {
        if (!active) return
        setSettings(data)
        const provider = data.providers.find((item) => item.id === data.selection?.provider) || data.providers[0]
        setSelection({ provider: provider?.id || '', model: data.selection?.model || provider?.models?.[0]?.id || '' })
      })
      .catch((error) => { if (active && !unauthorized(error)) setMessage({ type: 'error', text: error.message }) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [unauthorized, user?.isDemo])

  const provider = useMemo(
    () => settings?.providers.find((item) => item.id === selection.provider),
    [settings, selection.provider],
  )

  const selectProvider = (providerId) => {
    const next = settings.providers.find((item) => item.id === providerId)
    const savedModel = settings.selection?.provider === providerId ? settings.selection.model : ''
    setSelection({ provider: providerId, model: savedModel || next.models?.[0]?.id || '' })
    setMessage(null)
  }

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const saved = await saveAISelection(selection)
      setSettings((current) => ({ ...current, selection: saved }))
      setSelection(saved)
      setMessage({ type: 'success', text: 'Minerva’s AI profile has been updated.' })
    } catch (error) {
      if (!unauthorized(error)) setMessage({ type: 'error', text: error.message })
    } finally {
      setSaving(false)
    }
  }

  const credentialChanged = (providerId, credential) => {
    setSettings((current) => ({
      ...current,
      providers: current.providers.map((item) => item.id === providerId ? { ...item, credential } : item),
    }))
  }

  if (user?.isDemo) return (
    <section className="settings-card demo-ai-card">
      <header className="settings-heading"><div><p className="settings-kicker">Demo account</p><h2>Local learning space.</h2></div><p>No connection</p></header>
      <p>Demo mode uses seeded cards stored in this browser. It does not connect to Janus or save API keys.</p>
    </section>
  )

  return (
    <>
      <section className="settings-card">
        <header className="settings-heading">
          <div><p className="settings-kicker">AI profile</p><h2>Choose the mind.</h2></div>
          <p>{loading ? 'Loading providers…' : 'Shared through Janus'}</p>
        </header>
        {!loading && provider && (
          <form className="ai-profile-form" onSubmit={save}>
            <fieldset className="provider-picker" disabled={saving}>
              <legend>Provider</legend>
              <div>
                {settings.providers.map((item) => (
                  <label key={item.id} className={selection.provider === item.id ? 'is-active' : ''}>
                    <input type="radio" name="provider" checked={selection.provider === item.id} onChange={() => selectProvider(item.id)} />
                    <span><strong>{item.name}</strong><small>{item.credential?.configured ? 'Connected' : 'API key required'}</small></span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="model-picker-row">
              <label htmlFor="ai-model">Model<select id="ai-model" value={selection.model} onChange={(event) => setSelection((current) => ({ ...current, model: event.target.value }))}>{provider.models.map((model) => <option key={model.id} value={model.id}>{model.name || model.id}</option>)}</select></label>
              <button className="secondary-button" type="submit" disabled={saving || !provider.credential?.configured}>{saving ? 'Saving…' : 'Save profile'}</button>
            </div>
          </form>
        )}
        {message && <p className={`settings-message is-${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}>{message.text}</p>}
      </section>
      {!loading && settings?.providers?.length > 0 && (
        <div className="provider-key-grid">
          {settings.providers.map((item) => <ProviderKeySettings key={item.id} provider={item} selected={settings.selection?.provider === item.id} onChange={credentialChanged} onUnauthorized={unauthorized} />)}
        </div>
      )}
    </>
  )
}
