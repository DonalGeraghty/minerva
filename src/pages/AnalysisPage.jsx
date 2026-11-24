import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Brand from '../components/Brand.jsx'
import PeriodPicker from '../components/PeriodPicker.jsx'
import { Bars } from '../components/financeCharts.jsx'
import { getCashflow, getCategories, getMerchants, getTrends, eur, monthLabel } from '../services/finance.js'

export default function AnalysisPage() {
  const [period, setPeriod] = useState('last_6')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [categorySteps, setCategorySteps] = useState([])
  const [categories, setCategories] = useState([])
  const [merchants, setMerchants] = useState([])
  const [trends, setTrends] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    Promise.all([
      getCashflow(period, start, end, 'category', controller.signal),
      getCategories(period, start, end, controller.signal),
      getMerchants(period, start, end, controller.signal),
      getTrends(period, start, end, controller.signal),
    ]).then(([flow, cats, merch, tr]) => {
      setCategorySteps(flow.cashflow || [])
      setCategories((cats.categories || []).filter((c) => Number(c.total) < 0))
      setMerchants((merch.merchants || []).filter((m) => Number(m.total) < 0))
      setTrends(tr.trends || [])
    }).catch((requestError) => {
      if (requestError.name === 'AbortError') return
      setError(requestError.message || 'Could not load analysis')
      setErrorCode(requestError.code || '')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [period, start, end])

  return (
    <main className="page finance-page">
      <Brand />
      <section className="page-hero">
        <p className="eyebrow">Finance &middot; analysis</p>
        <h1>Analysis.</h1>
        <p>Category waterfall, merchant and category aggregates — all computed server-side by Janus.</p>
      </section>
      <section className="app-panel" aria-label="Analysis controls">
        <div className="form-actions"><PeriodPicker period={period} setPeriod={setPeriod} start={start} setStart={setStart} end={end} setEnd={setEnd} /></div>
        {error && <p className="settings-message is-error" role="alert">{error}{errorCode === 'finance_not_connected' && <> <Link to="/account">Connect your workbook in Account.</Link></>}</p>}
        {loading ? <p role="status">Loading analysis…</p> : (
          <>
            <section aria-labelledby="cat-waterfall">
              <h2 id="cat-waterfall" className="finance-subheading">Category steps by month</h2>
              {categorySteps.length === 0 ? <p className="finance-empty">No category movements.</p> : (
                <table className="finance-table">
                  <thead><tr><th>Month</th>{[...new Set(categorySteps.flatMap((s) => Object.keys(s.categories)))].slice(0, 8).map((c) => <th key={c}>{c}</th>)}</tr></thead>
                  <tbody>
                    {categorySteps.map((s) => (
                      <tr key={s.month}>
                        <td>{monthLabel(s.month)}</td>
                        {[...new Set(categorySteps.flatMap((x) => Object.keys(x.categories)))].slice(0, 8).map((c) => (
                          <td key={c} className={Number(s.categories[c] || 0) < 0 ? 'is-negative' : ''}>{s.categories[c] ? eur(s.categories[c]) : '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
            <div className="finance-two-col">
              <section aria-labelledby="analysis-categories"><h2 id="analysis-categories" className="finance-subheading">Categories</h2><Bars items={categories} title="Spending by category" /></section>
              <section aria-labelledby="analysis-merchants"><h2 id="analysis-merchants" className="finance-subheading">Merchants</h2><Bars items={merchants} title="Spending by merchant" /></section>
            </div>
            <section aria-labelledby="analysis-trends">
              <h2 id="analysis-trends" className="finance-subheading">Monthly totals</h2>
              <table className="finance-table">
                <thead><tr><th>Month</th><th>Income</th><th>Spending</th><th>Refunds</th><th>Net</th></tr></thead>
                <tbody>
                  {trends.map((t) => (
                    <tr key={t.month}><td>{monthLabel(t.month)}</td><td>{eur(t.income)}</td><td className="is-negative">{eur(t.spending)}</td><td>{eur(t.refunds)}</td><td className={Number(t.net) < 0 ? 'is-negative' : ''}>{eur(t.net)}</td></tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}
      </section>
    </main>
  )
}
