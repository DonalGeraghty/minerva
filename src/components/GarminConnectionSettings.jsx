import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { disconnectGarmin, getGarminConnection, saveGarminConnection } from '../services/garmin.js'

export default function GarminConnectionSettings() {
  const { user, logout } = useAuth()
  const [connection, setConnection] = useState(null)
  const [apiKey, setApiKey] = useState('')
  const [busy, setBusy] = useState(true)
  const [message, setMessage] = useState(null)
  const [reload, setReload] = useState(0)
  const pending = useRef(null)

  useEffect(() => {
    if (user?.isDemo) { setBusy(false); return }
    const controller = new AbortController()
    pending.current = controller
    setBusy(true)
    setMessage(null)
    getGarminConnection(controller.signal).then((result) => {
      if (!controller.signal.aborted) setConnection(result.connection)
    }).catch((error) => {
      if (controller.signal.aborted) return
      if (error.status === 401) logout()
      else setMessage({ error: true, text: error.message })
    }).finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => { controller.abort(); pending.current?.abort() }
  }, [user?.accountId, user?.isDemo, logout, reload])

  async function change(event, remove = false) {
    event.preventDefault()
    if (remove && !window.confirm('Disconnect Garmin? Saved Garmin data is retained. This does not revoke the key at Garmin.')) return
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    const submittedKey = apiKey.trim()
    setApiKey('')
    setBusy(true)
    setMessage(null)
    try {
      const result = remove ? await disconnectGarmin(controller.signal) : await saveGarminConnection(submittedKey, controller.signal)
      if (!controller.signal.aborted) {
        setConnection(result.connection)
        setMessage({ text: remove ? 'Garmin disconnected. Saved history is retained.' : 'Garmin connected. Open Overview to view your data.' })
      }
    } catch (error) {
      if (controller.signal.aborted) return
      if (error.status === 401) logout()
      else setMessage({ error: true, text: error.message })
    } finally { if (!controller.signal.aborted) setBusy(false) }
  }

  return <section className="garmin-panel" aria-labelledby="garmin-connection-title">
    <header><div><p className="eyebrow">Connections</p><h2 id="garmin-connection-title">Garmin.</h2></div><span className="garmin-badge">{user?.isDemo ? 'Demo' : busy ? 'Working…' : connection?.configured ? 'Connected' : connection ? 'Not connected' : 'Unavailable'}</span></header>
    {user?.isDemo ? <p>Connect a real Janus account to link Garmin. Demo mode never sends Garmin credentials.</p> : <>
      <p>Connect your personal Garmin key to view your steps, sleep, and activities. Your key is encrypted by Janus and is never returned to this browser.</p>
      <p><a href="https://connect.garmin.com/app/settings/personalApiToken" target="_blank" rel="noreferrer">Create a Garmin personal API key ↗</a></p>
      {connection?.configured && <p>Saved key ending in <strong>{connection.last_four}</strong>. {connection.verified_at && <>Verified <time dateTime={connection.verified_at}>{new Date(connection.verified_at).toLocaleString()}</time>.</>}</p>}
      {connection?.reconnect_required && <p className="settings-message is-error">Garmin needs a replacement key. Your Janus login is still active.</p>}
      <form onSubmit={change}>
        <label htmlFor="garmin-personal-key">Garmin personal API key</label>
        <input id="garmin-personal-key" type="password" autoComplete="off" maxLength={4096} value={apiKey} onChange={(event) => setApiKey(event.target.value)} disabled={busy} placeholder="Paste your personal API key" required />
        <div className="garmin-actions"><button className="primary-button" disabled={busy || !apiKey.trim()}>{connection?.configured ? 'Replace Garmin key' : 'Connect Garmin'}</button>
          {connection?.configured && <button className="secondary-button" type="button" disabled={busy} onClick={(event) => change(event, true)}>Disconnect Garmin</button>}
          {!connection && !busy && <button className="secondary-button" type="button" onClick={() => setReload((value) => value + 1)}>Retry connection status</button>}</div>
      </form>
      {message && <p className={`settings-message${message.error ? ' is-error' : ''}`} role={message.error ? 'alert' : 'status'}>{message.text}</p>}
    </>}
  </section>
}
