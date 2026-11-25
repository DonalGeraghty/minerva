import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Brand from '../components/Brand.jsx'
import PeriodPicker from '../components/PeriodPicker.jsx'
import CashflowWaterfall from '../components/CashflowWaterfall.jsx'
import { getCashflow, getSummary, getSyncStatus } from '../services/finance.js'
import { eur, monthLabel } from '../lib/finance.js'
import './DashboardPage.css'

export default function DashboardPage() {
  const [period, setPeriod] = useState('last_6')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const rangeError = period === 'custom' && (!start || !end ? 'Choose a start and end month.' : start > end ? 'The start month must be before the end month.' : '')
  useEffect(() => {
    if (rangeError) { setLoading(false); return }
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    const load = async () => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const [summary, cashflow, status] = await Promise.all([
          getSummary(period, start, end, controller.signal), getCashflow(period, start, end, controller.signal), getSyncStatus(controller.signal),
        ])
        if (controller.signal.aborted) return
        if (summary.meta.snapshot_id === cashflow.meta.snapshot_id && summary.meta.rule_set_version === cashflow.meta.rule_set_version && status.sync.snapshot_id === summary.meta.snapshot_id) {
          setData({ summary: summary.summary, flow: cashflow.cashflow || [], meta: summary.meta, status: status.sync })
          return
        }
      }
      throw new Error('Your data changed while loading. Refresh to see one consistent version.')
    }
    load().catch((failure) => {
      if (!controller.signal.aborted) setError({ message: failure.message || 'Could not load cash flow.', code: failure.code })
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [period, start, end, rangeError])
  const selectPeriod = (next) => {
    if (next === 'custom') {
      setStart(data?.summary.period?.start || data?.meta.coverage?.first_month || '')
      setEnd(data?.summary.period?.end || data?.meta.coverage?.last_month || '')
    }
    setPeriod(next)
  }
  const ready = !loading && !error && !rangeError && data
  const warnings = data ? [...(data.meta.warnings || []), ...(data.summary.receipt_conflicts || [])] : []
  const gaps = data?.summary.gaps || []
  const selected = data?.summary.period
  const periodLabel = selected?.start ? `${monthLabel(selected.start)} — ${monthLabel(selected.end)}` : 'All recorded months'
  return <main className="page dashboard-page">
    <Brand />
    <section className="dashboard-hero"><p className="eyebrow">Your finances · dashboard</p><h1>Cash flow.</h1><p>A little perspective on the months that add up.</p></section>
    <section className="cashflow-panel" aria-labelledby="cashflow-heading" aria-busy={loading}>
      <header className="cashflow-heading"><div><p className="cashflow-total-label">Net over this period {ready && data.meta.source === 'local_demo' && <span className="cashflow-demo">Demo data</span>}</p><h2 id="cashflow-heading" className={`cashflow-total${ready && Number(data.summary.adjusted_totals.net) < 0 ? ' is-negative' : ''}`}>{ready && data.flow.length && data.summary.adjusted_totals.net != null ? eur(data.summary.adjusted_totals.net) : '—'}</h2>{ready && <p className="cashflow-period">{periodLabel}</p>}</div><PeriodPicker period={period} setPeriod={selectPeriod} start={start} setStart={setStart} end={end} setEnd={setEnd} /></header>
      {rangeError && <p className="dashboard-message" role="alert">{rangeError}</p>}
      {loading && !rangeError && <div className="cashflow-loading" role="status"><span /><p>Bringing your months into view…</p></div>}
      {error && !rangeError && <div className="dashboard-message is-error" role="alert"><p>{error.message}</p>{['finance_not_connected', 'sync_required'].includes(error.code) ? <Link to="/account">Import your workbook in Account →</Link> : <button className="secondary-button" type="button" onClick={() => window.location.reload()}>Try again</button>}</div>}
      {ready && <>
        <div className="waterfall-legend" aria-label="Chart legend"><span><i className="legend-positive" />Positive month</span><span><i className="legend-negative" />Negative month</span><span><i className="legend-total" />Net total</span></div>
        {gaps.length > 0 && <p className="dashboard-message">No coverage for {gaps.map(monthLabel).join(', ')}. These are gaps, not zero activity; the chart shows recorded months only.</p>}
        {data.status.stale && <p className="dashboard-message">Showing saved data: the latest import failed. <Link to="/account">Refresh your import →</Link></p>}
        <CashflowWaterfall data={data.flow} total={data.summary.adjusted_totals.net} period={data.summary.period} />
        <footer className="cashflow-footer"><p>Each month builds on the last. Running net starts at €0 for this period.</p><div><span>{data.summary.provisional ? 'Provisional figures' : 'Rule-adjusted ledger'}{data.status.last_success_at && <> · Updated {new Date(data.status.last_success_at).toLocaleDateString('en-IE', { timeZone: 'Europe/Dublin', day: 'numeric', month: 'short' })}</>}</span><Link to="/transactions">Explore the ledger ↗</Link></div></footer>
        {(warnings.length > 0 || data.summary.provisional) && <details className="cashflow-quality"><summary>Data notes{warnings.length > 0 ? ` (${warnings.length})` : ''}</summary>{data.summary.provisional && <p>Figures are provisional. The current month may be incomplete and the sinking fund opening balance has not been verified.</p>}{warnings.length > 0 && <ul>{warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>}<p>Applied rule set v{data.meta.rule_set_version}.</p></details>}
      </>}
    </section>
  </main>
}
