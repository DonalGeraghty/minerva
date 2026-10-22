import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Brand from '../components/Brand.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { freshnessText, getGarminSteps, localDate } from '../services/garmin.js'

export default function GarminPage() {
  const { user, logout } = useAuth()
  const [request, setRequest] = useState(() => ({ date: localDate(), refresh: false, version: 0 }))
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(true)
  const [now, setNow] = useState(Date.now)
  const [retryAt, setRetryAt] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setBusy(true)
    setError(null)
    if (user?.isDemo) {
      setBusy(false)
      return () => controller.abort()
    }
    getGarminSteps(request.date, { refresh: request.refresh, signal: controller.signal }).then((data) => {
      if (controller.signal.aborted) return
      setResult({ ...data, date: request.date })
      setNow(Date.now())
      setRetryAt(Date.now() + (data.meta.warning?.retry_after || (data.meta.source === 'garmin' ? 10 : 0)) * 1000)
    }).catch((failure) => {
      if (controller.signal.aborted) return
      if (failure.status === 401) logout()
      else {
        if (['garmin_connection_changed', 'garmin_connection_required', 'account_unavailable'].includes(failure.code)) setResult(null)
        setError(failure)
        setRetryAt(Date.now() + (failure.retryAfter || 0) * 1000)
      }
    }).finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [request, user?.accountId, user?.isDemo, logout])

  const current = result?.date === request.date ? result : null
  const row = current?.data.find((item) => item.calendarDate === request.date)
  const value = row?.totalSteps
  const steps = typeof value === 'number' && value >= 0 ? value : null
  const warning = error?.message || current?.meta.warning?.message
  const cooldown = Math.max(0, Math.ceil((retryAt - now) / 1000))
  const reconnect = ['garmin_connection_required', 'garmin_reconnect_required'].includes(error?.code || current?.meta.warning?.code)
  const stale = current && (error || current.meta.stale || now / 1000 >= current.meta.fresh_until)
  const refresh = () => setRequest((previous) => ({ ...previous, refresh: true, version: previous.version + 1 }))

  return <main className="page garmin-page"><Brand />
    <section className="garmin-hero"><p className="eyebrow">Garmin · your daily movement</p><h1>Overview.</h1><p>Your first Garmin view. Steps are available now; more health and activity sections will follow.</p></section>
    {user?.isDemo ? <section className="garmin-panel"><h2>Connect your Garmin account.</h2><p>Sign in with a real Janus account to connect Garmin and view your own measurements. This demo does not contact Garmin.</p></section> : <section className="garmin-panel" aria-labelledby="steps-heading" aria-busy={busy}>
      <header><h2 id="steps-heading">Daily steps</h2><span className="garmin-badge">{busy ? 'Loading…' : stale ? 'Needs refresh' : current ? 'Up to date' : 'Not loaded'}</span></header>
      <div className="garmin-controls"><label htmlFor="garmin-date">Calendar date<input id="garmin-date" type="date" value={request.date} max={localDate()} required onChange={(event) => { if (event.target.value) setRequest({ date: event.target.value, refresh: false, version: 0 }) }} /></label>
        <button className="secondary-button" type="button" disabled={busy || cooldown > 0} onClick={refresh}>{busy && current ? 'Refreshing…' : cooldown ? `Refresh in ${cooldown}s` : 'Refresh steps'}</button></div>
      {current && <>
        <p className="garmin-step-total">{steps === null ? '—' : steps.toLocaleString()} <span>steps</span></p>
        {steps === null ? <p>No steps measurement is available for this date.</p> : typeof row?.stepGoal === 'number' && row.stepGoal > 0 && <p>Daily goal: {row.stepGoal.toLocaleString()} steps</p>}
        <p className="garmin-freshness"><time dateTime={new Date(current.meta.fetched_at * 1000).toISOString()} title={new Date(current.meta.fetched_at * 1000).toLocaleString()}>{freshnessText(current.meta.fetched_at, now)}</time><span>{stale ? 'Saved data · may be out of date' : current.meta.source === 'cache' ? 'Saved copy' : 'Fetched from Garmin'}</span></p>
        <details><summary>Exact update time and returned data</summary><p>{new Date(current.meta.fetched_at * 1000).toLocaleString()}</p><pre>{JSON.stringify(current.data, null, 2)}</pre></details>
      </>}
      {busy && !current && <p role="status">Loading steps…</p>}
      {warning && <p className="settings-message is-error" role="alert">{current ? 'Showing saved data. ' : ''}{warning}</p>}
      {reconnect && <p><Link to="/account">{error?.code === 'garmin_connection_required' ? 'Connect Garmin in Account' : 'Replace your Garmin key in Account'}</Link></p>}
      {!current && error && !reconnect && <p>Your other account features remain available. You can retry this section.</p>}
    </section>}
  </main>
}
