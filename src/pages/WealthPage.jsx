import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Brand from '../components/Brand.jsx'
import { eur, getBudgets, getNetWorth, getSinkingFunds } from '../services/finance.js'

export default function WealthPage() {
  const [worth, setWorth] = useState(null)
  const [sinking, setSinking] = useState(null)
  const [budgets, setBudgets] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([getNetWorth(controller.signal), getSinkingFunds(controller.signal), getBudgets(controller.signal)])
      .then(([w, s, b]) => { setWorth(w.net_worth); setSinking(s.sinking_funds); setBudgets(b.budgets) })
      .catch((requestError) => {
        if (requestError.name === 'AbortError') return
        setError(requestError.message || 'Could not load wealth data')
        setErrorCode(requestError.code || '')
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [])

  return (
    <main className="page finance-page">
      <Brand />
      <section className="page-hero">
        <p className="eyebrow">Finance &middot; wealth</p>
        <h1>Net worth.</h1>
        <p>Assets minus liabilities from the dated snapshot tab. Subtotals are never double counted.</p>
      </section>
      {error && <p className="settings-message is-error" role="alert">{error}{errorCode === 'finance_not_connected' && <> <Link to="/account">Connect your workbook in Account.</Link></>}</p>}
      {loading ? <p role="status">Loading wealth…</p> : (
        <>
          <section className="app-panel" aria-labelledby="networth-heading">
            <header><div><p className="settings-kicker">Snapshot tab</p><h2 id="networth-heading">Net worth.</h2></div></header>
            {!worth?.available ? <p className="settings-message">{worth?.reason || 'Net worth unavailable.'}</p> : (
              <>
                <div className="finance-cards" role="group" aria-label="Latest balances">
                  <div className="finance-card"><span>Assets</span><strong>{eur(worth.latest.assets)}</strong></div>
                  <div className="finance-card"><span>Liabilities</span><strong className="is-negative">{eur(worth.latest.liabilities)}</strong></div>
                  <div className="finance-card"><span>Net worth ({worth.latest.date})</span><strong className={Number(worth.latest.net) < 0 ? 'is-negative' : ''}>{eur(worth.latest.net)}</strong></div>
                </div>
                <table className="finance-table">
                  <caption>History</caption>
                  <thead><tr><th>Date</th><th>Assets</th><th>Liabilities</th><th>Net</th></tr></thead>
                  <tbody>
                    {[...worth.history].reverse().map((h) => (
                      <tr key={h.date}><td>{h.date}</td><td>{eur(h.assets)}</td><td className="is-negative">{eur(h.liabilities)}</td><td className={Number(h.net) < 0 ? 'is-negative' : ''}>{eur(h.net)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </section>
          <section className="app-panel" aria-labelledby="sinking-heading">
            <header><div><p className="settings-kicker">Sinking fund</p><h2 id="sinking-heading">Recognised balance.</h2></div></header>
            {sinking && (
              <>
                {sinking.provisional && <p className="settings-message">Opening recognised balance is not verified — exclusions are provisional.</p>}
                <p>Current recognised balance: <strong>{eur(sinking.current_recognised_balance)}</strong></p>
                {Object.keys(sinking.months).length > 0 && (
                  <table className="finance-table">
                    <caption>Monthly sinking fund activity</caption>
                    <thead><tr><th>Month</th><th>Contributions</th><th>Bills</th><th>Covered</th><th>Released</th></tr></thead>
                    <tbody>
                      {Object.entries(sinking.months).map(([m, e]) => (
                        <tr key={m}><td>{m}</td><td>{eur(e.contributions)}</td><td className="is-negative">{eur(e.bills)}</td><td>{eur(e.covered)}</td><td>{eur(e.released)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </section>
          <section className="app-panel" aria-labelledby="budgets-heading">
            <header><div><p className="settings-kicker">Budgets</p><h2 id="budgets-heading">Budget comparisons.</h2></div></header>
            <p>{budgets?.available ? 'Budget data available.' : budgets?.reason || 'Budgets unavailable until verified budget data exists.'}</p>
          </section>
        </>
      )}
    </main>
  )
}
