import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { deleteFinanceConnection, getFinanceConnection, saveFinanceConnection } from '../services/financeConnection.js'

export default function FinanceConnectionSettings() {
  const { user, logout } = useAuth()
  const [connection, setConnection] = useState(null)
  const [accessToken, setAccessToken] = useState('')
  const [workbookId, setWorkbookId] = useState('')
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
    getFinanceConnection(controller.signal).then((result) => {
      if (!controller.signal.aborted) {
        setConnection(result.connection)
        if (result.connection?.workbook_id) setWorkbookId(result.connection.workbook_id)
      }
    }).catch((error) => {
      if (controller.signal.aborted) return
      if (error.status === 401) logout()
      else setMessage({ error: true, text: error.message })
    }).finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => { controller.abort(); pending.current?.abort() }
  }, [user?.accountId, user?.isDemo, logout, reload])

  async function change(event, remove = false) {
    event.preventDefault()
    if (remove && !window.confirm('Disconnect Google Sheets? Your saved finance rules are retained. This does not revoke the token at Google.')) return
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    const submittedToken = accessToken.trim()
    setAccessToken('')
    setBusy(true)
    setMessage(null)
    try {
      const result = remove
        ? await deleteFinanceConnection(controller.signal)
        : await saveFinanceConnection(submittedToken, workbookId.trim(), controller.signal)
      if (!controller.signal.aborted) {
        setConnection(result.connection)
        setMessage({ text: remove ? 'Google Sheets disconnected. Saved rules are retained.' : 'Finance workbook connected. Open Rules to manage your rule set.' })
      }
    } catch (error) {
      if (controller.signal.aborted) return
      if (error.status === 401) logout()
      else setMessage({ error: true, text: error.message })
    } finally { if (!controller.signal.aborted) setBusy(false) }
  }

  return <section className="garmin-panel" aria-labelledby="finance-connection-title">
    <header><div><p className="eyebrow">Connections</p><h2 id="finance-connection-title">Google Sheets.</h2></div><span className="garmin-badge">{user?.isDemo ? 'Demo' : busy ? 'Working…' : connection?.connected ? 'Connected' : connection ? 'Not connected' : 'Unavailable'}</span></header>
    {user?.isDemo ? <p>Connect a real Janus account to link your own finance workbook. Demo mode never sends Google credentials.</p> : <>
      <p>Link your own finance workbook in Google Drive. Janus only reads it — your ChatGPT workflow keeps writing the ledger. The access token is encrypted by Janus and is never returned to this browser.</p>
      <p><a href="https://developers.google.com/oauthplayground" target="_blank" rel="noreferrer">Get a read-only OAuth access token (scope spreadsheets.readonly) ↗</a></p>
      {connection?.connected && <p>Workbook <strong>{connection.workbook_id}</strong> · token ending in <strong>{connection.last_four}</strong>.</p>}
      <form onSubmit={change}>
        <label htmlFor="finance-access-token">Google OAuth access token (read-only)</label>
        <input id="finance-access-token" type="password" autoComplete="off" maxLength={2048} value={accessToken} onChange={(event) => setAccessToken(event.target.value)} disabled={busy} placeholder="ya29.…" required={!connection?.connected} />
        <label htmlFor="finance-workbook-id">Finance workbook ID</label>
        <input id="finance-workbook-id" type="text" autoComplete="off" maxLength={128} value={workbookId} onChange={(event) => setWorkbookId(event.target.value)} disabled={busy} placeholder="The long ID in your Sheets URL" required />
        <div className="garmin-actions"><button className="primary-button" disabled={busy || (!connection?.connected && !accessToken.trim())}>{connection?.connected ? 'Replace token' : 'Connect workbook'}</button>
          {connection?.connected && <button className="secondary-button" type="button" disabled={busy} onClick={(event) => change(event, true)}>Disconnect</button>}
          {!connection && !busy && <button className="secondary-button" type="button" onClick={() => setReload((value) => value + 1)}>Retry connection status</button>}</div>
      </form>
      {message && <p className={`settings-message${message.error ? ' is-error' : ''}`} role={message.error ? 'alert' : 'status'}>{message.text}</p>}
    </>}
  </section>
}
