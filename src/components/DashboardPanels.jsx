import { useEffect, useState } from 'react'
import { dashboardPanels, defaultPanels, savePanelPreferences } from '../services/garminHealth.js'

export default function DashboardPanels({ preferences, logout }) {
  const { current, setState, key, retry } = preferences
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => { setMessage(''); setSaving(false) }, [key])
  if (!current) return <p role="status">Loading dashboard preferences…</p>
  async function save() {
    setSaving(true)
    setMessage('')
    try {
      await savePanelPreferences(current.panels)
      setMessage('Panel choices saved to your account.')
    } catch (error) {
      if (error.status === 401) logout()
      else setMessage('Could not save panel choices. Your current choices are still visible; try again.')
    } finally { setSaving(false) }
  }
  return <details className="garmin-panel dashboard-panel-manager"><summary>Manage panels</summary>
    <p>Choose the panels on your dashboard, then save your choices to your account. Activities always has its own tab.</p>
    <fieldset disabled={saving}><legend>Visible panels</legend><div className="dashboard-panel-options">{dashboardPanels.map(([id, title]) => <label key={id}><input type="checkbox" checked={current.panels.includes(id)} onChange={(event) => setState((previous) => previous?.key === key ? { ...previous, panels: event.target.checked ? [...previous.panels, id] : previous.panels.filter((item) => item !== id) } : previous)} />{title}</label>)}</div></fieldset>
    <div className="garmin-actions"><button type="button" className="primary-button" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save panel choices'}</button><button type="button" className="secondary-button" disabled={saving} onClick={() => setState((previous) => ({ ...previous, panels: defaultPanels }))}>Reset to defaults</button></div>
    {current.message && <p role="alert">{current.message} <button type="button" className="secondary-button" onClick={retry}>Retry saved panels</button></p>}
    {message && <p role="status">{message}</p>}
  </details>
}
