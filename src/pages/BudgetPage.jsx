import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Brand from '../components/Brand.jsx'
import BudgetChart from '../components/BudgetChart.jsx'
import { useTabScroll, useTabState } from '../context/TabSessionContext.jsx'
import { useBudgetPlan } from '../hooks/useBudgetPlan.js'
import { getBudgetContext } from '../services/finance.js'
import { eurCents, monthLabel } from '../lib/finance.js'
import { BUDGET_MODES, budgetView } from '../lib/budget.js'
import './BudgetPage.css'

const currentMonth = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Dublin', year: 'numeric', month: '2-digit' }).formatToParts(new Date()).filter((part) => ['year', 'month'].includes(part.type)).map((part) => part.value).join('-')

export default function BudgetPage() {
  const [live, setLive] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const month = live?.context.month || currentMonth()
  const assessment = useBudgetPlan(month)
  const result = assessment.result
  const plan = result?.plan
  const [mode, setMode] = useTabState(`budget.mode.${month}`, 'balanced')
  const [selected, setSelected] = useTabState(`budget.category.${month}`, null)
  useTabScroll('budget', !loading)
  useEffect(() => {
    const controller = new AbortController()
    getBudgetContext(controller.signal).then((value) => { if (!controller.signal.aborted) setLive(value) })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [])
  // Assessments include the evidence used by AI, including when completed off-tab.
  const evidence = result && (!live || Date.parse(result.meta.fetched_at) > Date.parse(live.meta.fetched_at)) ? result : live
  const context = evidence?.context
  let view = null, viewError = ''
  try { if (context) view = budgetView(context, plan, mode) }
  catch (failure) { viewError = failure.message }
  const changed = !!plan && !!live && (result.meta.snapshot_id !== live.meta.snapshot_id || result.meta.rule_set_version !== live.meta.rule_set_version) && evidence === live
  return <main className="page budget-page">
    <Brand />
    <header className="budget-hero"><h1>Budget</h1><p className="eyebrow">{monthLabel(month)}{context && <> · {context.days_remaining} {context.days_remaining === 1 ? 'day' : 'days'} left this month</>}</p></header>
    <section className="budget-canvas" aria-label="Monthly budget">
      <div className="budget-toolbar">
        <div className="budget-modes" role="group" aria-label="Savings approach">{BUDGET_MODES.map((item) => <button key={item.id} type="button" aria-pressed={mode === item.id} onClick={() => setMode(item.id)}>{item.label}</button>)}</div>
        <button className="primary-button budget-update" type="button" disabled={assessment.busy || loading || !context || !!evidence?.meta.stale} onClick={() => assessment.generate()}>{assessment.busy ? 'Updating…' : 'Update with AI'}<span aria-hidden="true"> ↗</span></button>
      </div>
      <div className="budget-outlook" aria-live="polite">
        {view && plan ? <><p>{view.projectedSavings < 0 ? 'Your plan is short by' : 'On track to have'}</p><h2 className={view.projectedSavings < 0 ? 'is-negative' : ''}>{eurCents(Math.abs(view.projectedSavings))}<span>{view.projectedSavings < 0 ? ' this month.' : ' left this month.'}</span></h2></> : <><p>The rest of {monthLabel(month)}</p><h2>Make room for what’s next.</h2><p>Update with AI to set spending limits from your recent history.</p></>}
        {plan?.approaches[mode]?.analysis && <p className="budget-analysis" aria-label={`AI assessment for ${BUDGET_MODES.find((item) => item.id === mode).label}`}><span>{result.meta.demo ? 'Demo view' : 'AI view'} · </span>{plan.approaches[mode].analysis}</p>}
      </div>
      {loading && <p role="status" className="budget-note">Reading your latest spending…</p>}
      {error && <p role="alert" className="budget-note is-warning">{error.message} <Link to="/account">Check your import →</Link></p>}
      {viewError && <p role="alert" className="budget-note is-warning">{viewError}</p>}
      {assessment.busy && <p role="status" className="budget-note">Assessing your recent history. You can leave this tab while it finishes.</p>}
      {assessment.error && <div role="alert" className="budget-note is-warning"><p>{assessment.error}</p>{assessment.validationReason && <details><summary>What prevented this plan</summary><p>{assessment.validationReason}</p></details>}{['provider_key_required', 'budget_provider_unavailable', 'settings_service_unavailable', 'credential_service_unavailable'].includes(assessment.errorCode) && <Link to="/account">Check Account →</Link>}</div>}
      {evidence?.meta.stale && <p className="budget-note is-warning">Your import needs updating in <Link to="/account">Account</Link> before AI can reassess.</p>}
      {changed && <p className="budget-note">Spending has updated. Limits stay fixed until you update with AI.</p>}
      {view && <BudgetChart rows={view.rows} plan={plan} context={context} selected={selected} onSelect={setSelected} />}
      <footer className="budget-footer"><span>{result?.meta.demo ? 'Illustrative demo · no AI call' : plan ? 'AI estimates · limits stay fixed until you update' : 'Six months of history. One view of what’s ahead.'}</span><span>{context?.latest_transaction_date ? `Recorded through ${new Date(`${context.latest_transaction_date}T12:00:00`).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}` : 'No recorded transactions'}</span></footer>
      {context && (context.missing_months.length > 0 || context.provisional) && <p className="budget-data-note">{context.missing_months.length > 0 && 'Some historical months are missing. '}{context.provisional && 'Accounting is provisional. '}Estimates reflect the available imported data.</p>}
    </section>
  </main>
}
