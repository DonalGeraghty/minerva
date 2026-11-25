import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { deleteFinanceConnection, getFinanceConnection, saveFinanceConnection } from '../services/financeConnection.js'
import { getSyncStatus, syncNow } from '../services/finance.js'
import { Link } from 'react-router-dom'
import './FinanceConnectionSettings.css'

export default function FinanceConnectionSettings() {
  const { user, logout } = useAuth()
  const [connection, setConnection] = useState(null)
  const [workbookId, setWorkbookId] = useState('')
  const [busy, setBusy] = useState(true)
  const [message, setMessage] = useState(null)
  const [sync, setSync] = useState(null)
  const [importing, setImporting] = useState(false)
  const [reload, setReload] = useState(0)
  const pending = useRef(null)

  useEffect(() => {
    const controller = new AbortController()
    pending.current = controller
    setBusy(true)
    setMessage(null)
    const readStatus = user?.isDemo
      ? getSyncStatus(controller.signal).then((result) => ({ connection: { connected: true }, sync: result.sync }))
      : getFinanceConnection(controller.signal)
    readStatus.then(async (result) => {
      if (!controller.signal.aborted) {
        setConnection(result.connection)
        const savedWorkbook = result.connection?.workbook_id || result.connection?.approved_workbook_id
        if (savedWorkbook) setWorkbookId(savedWorkbook)
        if (result.connection?.connected) {
          const status = result.sync ? result : await getSyncStatus(controller.signal)
          if (!controller.signal.aborted) setSync(status.sync)
        } else setSync(null)
      }
    }).catch((error) => {
      if (controller.signal.aborted) return
      if (error.status === 401) logout()
      else setMessage({ error: true, text: error.message })
    }).finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => { controller.abort(); pending.current?.abort() }
  }, [user?.accountId, user?.isDemo, logout, reload])

  async function importData(signal) {
    setImporting(true)
    setMessage({ text: 'Importing transactions from your workbook…' })
    try {
      const result = await syncNow(signal)
      if (signal.aborted) return
      setSync({ ...result.sync, last_success_at: result.sync.fetched_at, sync_required: false })
      setMessage({ text: `Import complete: ${result.sync.row_count} transactions imported. Next, import your ChatGPT-created rules in Rules.` })
    } finally { if (!signal.aborted) setImporting(false) }
  }

  async function retryImport() {
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    setBusy(true)
    try {
      await importData(controller.signal)
    } catch (error) {
      if (controller.signal.aborted) return
      if (error.status === 401) logout()
      else {
        setSync((current) => current ? { ...current, stale: true } : null)
        setMessage({ error: true, text: `Data import failed. ${error.message} You can retry below.` })
      }
    } finally { if (!controller.signal.aborted) setBusy(false) }
  }

  async function change(event, remove = false) {
    event.preventDefault()
    if (remove && !window.confirm('Disconnect Google Sheets and clear imported data? Your rules are retained. To revoke Google access too, remove the reader email from the Sheet’s sharing settings.')) return
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    setBusy(true)
    setMessage(null)
    let saved = false
    try {
      const result = remove
        ? await deleteFinanceConnection(controller.signal)
        : await saveFinanceConnection(workbookId.trim(), controller.signal)
      if (!controller.signal.aborted) {
        setConnection(result.connection)
        setSync(null)
        if (remove) setMessage({ text: 'Google Sheets disconnected. Saved rules are retained.' })
        else {
          saved = true
          await importData(controller.signal)
        }
      }
    } catch (error) {
      if (controller.signal.aborted) return
      if (error.status === 401) logout()
      else setMessage({ error: true, text: saved ? `Workbook connected, but data import failed. ${error.message} Retry the import below.` : error.message })
    } finally { if (!controller.signal.aborted) setBusy(false) }
  }

  async function copyReader() {
    try {
      await navigator.clipboard.writeText(connection.service_account_email)
      setMessage({ text: 'Reader address copied. Share your Sheet with this address as Viewer.' })
    } catch {
      setMessage({ text: 'Select the reader address above and copy it manually.' })
    }
  }

  return <section className="app-panel finance-connection" aria-labelledby="finance-connection-title">
    <header><div><p className="eyebrow">Connections</p><h2 id="finance-connection-title">Google Sheets.</h2></div><span className="status-badge">{user?.isDemo ? 'Demo' : busy ? 'Working…' : connection?.connected ? 'Connected' : connection ? 'Not connected' : 'Unavailable'}</span></header>
    <ol className="finance-setup-flow" aria-label="Finance setup steps"><li><strong>1. Import data</strong><span>Connect your Google Sheet here.</span></li><li><strong>2. Import rules</strong><span>Upload your ChatGPT-created CSV in Rules.</span></li><li><strong>3. Review your finances</strong><span>Rules interpret the ledger; charts use those results.</span></li></ol>
    {user?.isDemo ? <p>This demo already contains synthetic transactions. Demo mode never sends Google credentials.</p> : <>
      <p>Share your finance workbook with the reader below as <strong>Viewer</strong>, then connect it here. Access renews automatically. Your ChatGPT workflow can keep updating the Sheet.</p>
      {connection?.service_account_email ? <div className="finance-reader-address"><label htmlFor="finance-reader-email">Share with this reader</label><input id="finance-reader-email" value={connection.service_account_email} readOnly onFocus={(event) => event.target.select()} /><button className="secondary-button" type="button" onClick={copyReader}>Copy reader email</button></div> : !busy && connection && <p role="note">Automatic Sheet access has not been configured yet.</p>}
      {connection?.service_account_email && !connection.approved_workbook_id && <p role="note">Your workbook needs approval for this Minerva account before you can connect it.</p>}
      {connection?.connected && <p>Workbook <strong>{connection.workbook_id}</strong>. {connection.mode === 'access_token' ? 'Your existing token connection is still active. Connect below to switch to automatic access.' : 'Connected with automatic access.'}</p>}
      <form onSubmit={change}>
        <label htmlFor="finance-workbook-id">Spreadsheet link or ID</label>
        <input id="finance-workbook-id" type="text" autoComplete="off" maxLength={2048} value={workbookId} onChange={(event) => setWorkbookId(event.target.value)} disabled={busy} placeholder="https://docs.google.com/spreadsheets/d/…" required />
        <div className="form-actions"><button className="primary-button" disabled={busy || !workbookId.trim() || !connection?.service_account_ready}>{importing ? 'Importing data…' : 'Connect and import'}</button>
          {connection?.connected && <button className="secondary-button" type="button" disabled={busy} onClick={(event) => change(event, true)}>Disconnect</button>}
          {!connection && !busy && <button className="secondary-button" type="button" onClick={() => setReload((value) => value + 1)}>Retry connection status</button>}</div>
      </form>
    </>}
    {message && <p className={`settings-message${message.error ? ' is-error' : ''}`} role={message.error ? 'alert' : 'status'}>{message.text}</p>}
    {connection?.connected && <div className="finance-import-status" aria-label="Data import status"><div><h3>{importing ? 'Import in progress' : sync?.snapshot_id ? sync.stale ? 'Saved import · refresh needed' : 'Data imported' : 'Import needed'}</h3>
      {sync?.snapshot_id ? <p>{sync.row_count} transactions · last imported {new Date(sync.last_success_at || sync.fetched_at).toLocaleString('en-IE', { timeZone: 'Europe/Dublin' })}{sync.coverage?.first_month && <> · {sync.coverage.first_month} to {sync.coverage.last_month}</>}</p> : <p>{importing ? 'Reading your Sheet. Completion will be confirmed here.' : 'Import your workbook before reviewing the ledger.'}</p>}
      {sync?.warnings?.length > 0 && <p>{sync.warnings.length} import warning(s). Review the dashboard’s data-quality details.</p>}</div>
      <div className="form-actions"><button className="secondary-button" type="button" onClick={retryImport} disabled={busy}>{importing ? 'Importing…' : sync?.snapshot_id ? 'Import latest data' : 'Import data'}</button><Link className="secondary-button" to="/rules">Import your rules →</Link><Link className="secondary-button" to="/transactions">View ledger</Link></div></div>}
  </section>
}
