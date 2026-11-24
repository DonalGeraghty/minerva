import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Brand from '../components/Brand.jsx'
import PeriodPicker from '../components/PeriodPicker.jsx'
import { Bars, NetTrendChart, WaterfallChart } from '../components/financeCharts.jsx'
import { eur, getCashflow, getCategories, getSummary, getSyncStatus, getTrends, syncNow } from '../services/finance.js'

function Freshness({ status }) {
  if (!status?.sync?.last_success_at) return null
  const when = new Date(status.sync.last_success_at).toLocaleString()
  return (
    <p className="finance-freshness">
      Ledger synced <time dateTime={status.sync.last_success_at}>{when}</time>
      {status.sync.stale && <strong className="is-negative"> · showing saved data (latest sync failed: {status.sync.error})</strong>}
      {!status.sync.stale && status.sync.coverage?.last_month && <> · coverage through {status.sync.coverage.last_month}</>}
    </p>
  )
}

export default function DashboardPage() {
  const [period, setPeriod] = useState('this_month')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [status, setStatus] = useState(null)
  const [summary, setSummary] = useState(null)
  const [flow, setFlow] = useState([])
  const [trend, setTrend] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async (signal) => {
    setLoading(true)
    setError('')
    setErrorCode('')
    setNotice('')
    try {
      const [syncStatus, summaryData, flowData, trendData, categoryData] = await Promise.all([
        getSyncStatus(signal),
        getSummary(period, start, end, signal),
        getCashflow(period, start, end, 'month', signal),
        getTrends(period, start, end, signal),
        getCategories(period, start, end, signal),
      ])
      setStatus(syncStatus)
      setSummary(summaryData)
      setFlow(flowData.cashflow || [])
      setTrend(trendData.trends || [])
      setCategories((categoryData.categories || []).filter((c) => Number(c.total) < 0))
    } catch (requestError) {
      if (requestError.name === 'AbortError') return
      setError(requestError.message || 'Could not load the finance dashboard')
      setErrorCode(requestError.code || '')
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [period, start, end])

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  const sync = async () => {
    setSyncing(true)
    setError('')
    setNotice('')
    try {
      const result = await syncNow()
      setNotice(`Synced ${result.sync.row_count} rows into snapshot ${result.sync.snapshot_id.slice(0, 8)}…`)
      await load()
    } catch (requestError) {
      setError(requestError.message || 'Sync failed')
      setErrorCode(requestError.code || '')
    } finally {
      setSyncing(false)
    }
  }

  const syncRequired = errorCode === 'sync_required'
  const notConnected = errorCode === 'finance_not_connected'
  const totals = summary?.summary?.adjusted_totals

  return (
    <main className="page finance-page">
      <Brand />
      <section className="page-hero">
        <p className="eyebrow">Finance &middot; dashboard</p>
        <h1>Money.</h1>
        <p>Read-only views of your Google Sheets ledger through Janus. The ChatGPT workflow keeps writing; Minerva never does.</p>
      </section>

      <section className="app-panel" aria-label="Dashboard controls">
        <header>
          <div><p className="settings-kicker">Period</p><h2>Overview</h2></div>
          <div className="form-actions">
            <PeriodPicker period={period} setPeriod={setPeriod} start={start} setStart={setStart} end={end} setEnd={setEnd} />
            <button className="secondary-button" type="button" onClick={sync} disabled={syncing || loading}>
              {syncing ? 'Syncing…' : 'Sync ledger'}
            </button>
          </div>
        </header>
        <Freshness status={status} />
        {error && (
          <p className="settings-message is-error" role="alert">
            {error}
            {notConnected && <> <Link to="/account">Connect your workbook in Account.</Link></>}
            {syncRequired && <> <button className="secondary-button" type="button" onClick={sync}>Sync now</button></>}
          </p>
        )}
        {notice && <p className="settings-message is-success" role="status">{notice}</p>}

        {loading && !summary ? <p role="status">Loading dashboard…</p> : totals && (
          <>
            <div className="finance-cards" role="group" aria-label="Totals">
              <div className="finance-card"><span>Income</span><strong>{eur(totals.income)}</strong></div>
              <div className="finance-card"><span>Spending</span><strong className="is-negative">{eur(totals.spending)}</strong></div>
              <div className="finance-card"><span>Refunds</span><strong>{eur(totals.refunds)}</strong></div>
              <div className="finance-card"><span>Net</span><strong className={Number(totals.net) < 0 ? 'is-negative' : ''}>{eur(totals.net)}</strong></div>
              <div className="finance-card"><span>Transfers</span><strong>{eur(totals.transfers)}</strong></div>
              <div className="finance-card"><span>Investments</span><strong>{eur(totals.investment)}</strong></div>
            </div>
            {summary.summary.provisional && <p className="settings-message">Sinking fund opening balance is unverified — results are provisional.</p>}
            {summary.summary.gaps?.length > 0 && <p className="settings-message">Missing months in range (gaps, not zero): {summary.summary.gaps.join(', ')}</p>}
            {summary.summary.receipt_conflicts?.length > 0 && <ul className="finance-warnings">{summary.summary.receipt_conflicts.map((w) => <li key={w}>{w}</li>)}</ul>}
            {summary.meta?.warnings?.length > 0 && <details className="finance-warnings"><summary>Data-quality warnings ({summary.meta.warnings.length})</summary><ul>{summary.meta.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></details>}
          </>
        )}
      </section>

      {!loading && totals && (
        <>
          <section className="app-panel" aria-labelledby="waterfall-heading">
            <header><div><p className="settings-kicker">Cash flow</p><h2 id="waterfall-heading">Monthly net.</h2></div></header>
            <WaterfallChart data={flow} />
            <p className="finance-meta">Snapshot {summary.meta.snapshot_id?.slice(0, 8)}… · rule set v{summary.meta.rule_set_version} · source {summary.meta.source}</p>
          </section>
          <section className="app-panel" aria-labelledby="trend-heading">
            <header><div><p className="settings-kicker">Trend</p><h2 id="trend-heading">Net over time.</h2></div></header>
            <NetTrendChart points={trend} />
          </section>
          <section className="app-panel" aria-labelledby="categories-heading">
            <header><div><p className="settings-kicker">Spending</p><h2 id="categories-heading">Top categories.</h2></div></header>
            <Bars items={categories} title="Spending by category" />
          </section>
        </>
      )}
    </main>
  )
}
