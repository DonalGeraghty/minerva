import { useState } from 'react'
import {
  deleteAIProviderCredential,
  saveAIProviderCredential,
} from '../services/aiSettings.js'

const PROVIDER_LINKS = {
  openai: ['https://platform.openai.com/api-keys', 'Create an OpenAI API key', 'sk-…'],
  mistral: ['https://console.mistral.ai/api-keys/', 'Create a Mistral API key', 'Enter your Mistral API key'],
  anthropic: ['https://console.anthropic.com/settings/keys', 'Create a Claude API key', 'sk-ant-…'],
}

export default function ProviderKeySettings({ provider, selected, onChange, onUnauthorized }) {
  const [apiKey, setApiKey] = useState('')
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState(null)
  const presentation = PROVIDER_LINKS[provider.id] || []
  const configured = Boolean(provider.credential?.configured)

  const save = async (event) => {
    event.preventDefault()
    if (!apiKey.trim()) return
    setBusy('save')
    setMessage(null)
    try {
      const result = await saveAIProviderCredential(provider.id, apiKey.trim())
      onChange(provider.id, result.credential || { configured: true })
      setApiKey('')
      setMessage({ type: 'success', text: result.warning?.message || `${provider.name} is connected.` })
    } catch (error) {
      if (!onUnauthorized(error)) setMessage({ type: 'error', text: error.message })
    } finally {
      setBusy('')
    }
  }

  const remove = async () => {
    if (!window.confirm(`Remove your ${provider.name} API key?`)) return
    setBusy('delete')
    setMessage(null)
    try {
      await deleteAIProviderCredential(provider.id)
      onChange(provider.id, { configured: false })
      setMessage({ type: 'success', text: `${provider.name} was disconnected.` })
    } catch (error) {
      if (!onUnauthorized(error)) setMessage({ type: 'error', text: error.message })
    } finally {
      setBusy('')
    }
  }

  return (
    <section className={`provider-key-card${selected ? ' is-selected' : ''}`}>
      <header className="provider-key-heading">
        <div>
          <p className="settings-kicker">Provider key</p>
          <h3>{provider.name}</h3>
        </div>
        <span className={`connection-state${configured ? ' is-connected' : ''}`}>
          {configured ? `Connected ••••${provider.credential.last_four || ''}` : 'Not connected'}
        </span>
      </header>
      <p className="provider-key-copy">Checked with {provider.name}, encrypted by Janus Gate, and never shown again.</p>
      {presentation[0] && <a className="provider-key-link" href={presentation[0]} target="_blank" rel="noreferrer">{presentation[1]} ↗</a>}
      <form className="provider-key-form" onSubmit={save}>
        <label htmlFor={`${provider.id}-key`}>{configured ? 'Replace API key' : 'Enter API key'}</label>
        <div className="provider-key-input-row">
          <input
            id={`${provider.id}-key`}
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={presentation[2] || 'Enter API key'}
            autoComplete="off"
            spellCheck="false"
            disabled={Boolean(busy)}
          />
          <button className="secondary-button" type="submit" disabled={Boolean(busy) || !apiKey.trim()}>
            {busy === 'save' ? 'Checking…' : configured ? 'Replace' : 'Connect'}
          </button>
        </div>
      </form>
      {configured && <button className="provider-remove" type="button" onClick={remove} disabled={Boolean(busy)}>{busy === 'delete' ? 'Removing…' : 'Remove key'}</button>}
      {message && <p className={`settings-message is-${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}>{message.text}</p>}
    </section>
  )
}
