import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Brand from '../components/Brand.jsx'
import { useBudgetPlan, useTabScroll, useTabState } from '../context/TabSessionContext.jsx'
import { getBudgetContext } from '../services/finance.js'
import { eur, monthLabel } from '../lib/finance.js'
import { BUDGET_MODES, budgetView, centsText, planChanges } from '../lib/budget.js'
import './BudgetPage.css'

const EMPTY_OBJECT = {}
const EMPTY_ARRAY = []
const amountPattern = /^\d{1,8}(?:\.\d{1,2})?$/
const price = (cents) => eur(centsText(cents))
const currentMonth = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Dublin', year: 'numeric', month: '2-digit' }).formatToParts(new Date()).filter((part) => ['year', 'month'].includes(part.type)).map((part) => part.value).join('-')

function CategoryBar({ row, draft, onEdit, planned }) {
  const scale = Math.max(row.spent, row.limit || 0, row.forecast, 100)
  const percent = (amount) => `${Math.max(0, Math.min(100, amount / scale * 100))}%`
  const invalid = draft != null && !amountPattern.test(draft)
  const label = `${row.category}: ${price(row.spent)} spent${planned ? `, ${price(row.limit)} limit, ${price(Math.abs(row.remaining))} ${row.remaining < 0 ? 'over' : 'left'}` : ''}`
  return <article className={`budget-category${row.remaining < 0 ? ' is-over' : ''}`}>
    <div className="budget-category-heading"><h3>{row.category}{row.suggestion?.fixed && <small>Fixed</small>}</h3><strong>{price(row.spent)} <span>spent</span></strong></div>
    <div className="budget-track" role="img" aria-label={label}>
      {planned && <span className="budget-allowance" style={{ width: percent(row.limit) }} />}
      <span className="budget-spent" style={{ width: percent(row.spent) }} />
      {planned && <><span className="budget-limit-marker" style={{ left: percent(row.limit) }} /><span className="budget-forecast-marker" style={{ left: percent(row.forecast) }} /></>}
    </div>
    <div className="budget-category-numbers"><span>{planned ? <><b>{price(Math.abs(row.remaining))}</b> {row.remaining < 0 ? 'over the limit' : 'left'}{row.remaining > 0 && <> · about {price(row.weekly)} per week</>}</> : 'Generate a plan to add a limit.'}</span>{planned && <span>Likely without changes: {price(row.forecast)}</span>}</div>
    {planned && <div className="budget-category-detail"><label>Monthly limit for {row.category}<span>€ <input type="text" inputMode="decimal" aria-label={`Monthly limit for ${row.category}`} value={draft ?? centsText(row.limit)} onChange={(event) => onEdit(event.target.value)} aria-invalid={invalid} /></span></label><p>{row.suggestion?.reason || 'New spending category since assessment. Add an allowance or update the plan.'}{row.suggestion && <> <small>{row.suggestion.confidence} confidence{row.edited ? ' · Your edited limit' : ''}</small></>}</p></div>}
    {invalid && <p className="budget-note is-warning">Enter a nonnegative EUR amount with up to two decimal places. The original limit is used until this is valid.</p>}
    {row.remaining < row.protectedRemaining && <p className="budget-note is-warning">Expected bills still need {price(row.protectedRemaining)}. That reserve is included in the projection even if your edited limit is lower.</p>}
  </article>
}

export default function BudgetPage() {
  const [live, setLive] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refresh, setRefresh] = useState(0)
  const month = live?.context.month || currentMonth()
  const [year, monthNumber] = month.split('-').map(Number)
  const monthEnd = `${month}-${new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()}`
  const assessment = useBudgetPlan(month)
  const result = assessment.result
  const plan = result?.plan
  const [notes, setNotes] = useTabState(`budget.notes.${month}`, '')
  const [cushion, setCushion] = useTabState(`budget.cushion.${month}`, '0.00')
  const [mode, setMode] = useTabState(`budget.mode.${month}`, 'balanced')
  const [corrections, setCorrections] = useTabState(`budget.assumptions.${plan?.plan_id || month}`, plan?.assumptions || EMPTY_ARRAY)
  const [overrides, setOverrides] = useTabState(`budget.limits.${plan?.plan_id || month}.${mode}`, EMPTY_OBJECT)
  useTabScroll('budget', !loading)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    getBudgetContext(controller.signal).then((value) => { if (!controller.signal.aborted) setLive(value) })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [refresh])
  const context = live?.context
  const validOverrides = Object.fromEntries(Object.entries(overrides).filter(([, value]) => amountPattern.test(value)))
  let view = null, viewError = ''
  try { if (context && !error) view = budgetView(context, plan, mode, validOverrides) }
  catch (failure) { viewError = failure.message }
  const changed = !!plan && !!live && (result.meta.snapshot_id !== live.meta.snapshot_id || result.meta.rule_set_version !== live.meta.rule_set_version)
  const invalidCorrections = corrections.some((item) => !item.label.trim() || !item.category.trim() || !amountPattern.test(item.amount_eur) || !item.due_date.startsWith(month))
  const invalid = !amountPattern.test(cushion) || invalidCorrections
  const updateAssumption = (id, field, value) => setCorrections((items) => items.map((item) => item.id === id ? { ...item, [field]: value } : item))
  const generate = async () => {
    const edited = corrections.filter((item) => {
      const original = plan?.assumptions.find((entry) => entry.id === item.id)
      return item.basis === 'user' || !original || ['label', 'kind', 'category', 'amount_eur', 'due_date', 'status'].some((key) => original[key] !== item[key])
    }).map((item) => ({ ...item, basis: 'user', evidence: 'User-confirmed correction or upcoming payment.' }))
    await assessment.generate({ notes, cushion_eur: cushion, corrections: edited })
    setRefresh((value) => value + 1)
  }
  const addAssumption = () => {
    setCorrections((items) => [...items, { id: crypto.randomUUID(), label: '', category: 'Other', kind: 'bill', amount_eur: '0.00', due_date: monthEnd, status: 'expected', confidence: 'high', basis: 'user', evidence: 'User-supplied upcoming payment.' }])
  }
  const changes = planChanges(assessment.previous?.plan, plan, mode)
  return <main className="page budget-page">
    <Brand />
    <header className="budget-hero"><div><p className="eyebrow">The rest of your month · {monthLabel(month)}</p><h1>Room to plan.</h1><p>See what is left, protect what matters, and choose how much room to leave.</p></div><button className="secondary-button" type="button" disabled={loading} onClick={() => setRefresh((value) => value + 1)}>Refresh actual spending</button></header>
    {loading && <p role="status" className="budget-note">Reading the latest imported ledger…</p>}
    {error && <p role="alert" className="budget-note is-warning">{error.message} <Link to="/account">Check your import in Account →</Link></p>}
    {viewError && <p role="alert" className="budget-note is-warning">{viewError}</p>}
    {context && !error && <>
      <div className="budget-freshness"><span>Latest recorded transaction: {context.latest_transaction_date || 'None in this window'} · Imported {new Date(live.meta.fetched_at).toLocaleString('en-IE', { timeZone: 'Europe/Dublin' })}</span><span>{context.history_start} to {context.month} · EUR</span></div>
      {(context.missing_months.length > 0 || context.provisional || live.meta.stale) && <p className="budget-note">{context.missing_months.length > 0 && <>History gaps: {context.missing_months.join(', ')}. </>}{context.provisional && 'Accounting is provisional. '}{live.meta.stale && 'The latest import failed; import again before generating a plan. '}Latest transaction date is evidence of recorded activity, not confirmation that all transactions through that date are present.</p>}
      {result?.meta.demo && <p className="budget-note">Illustrative demo plan · no AI assessment or external provider call.</p>}
      {changed && <p className="budget-note">New data or rules are available. Actuals have updated; your limits have stayed fixed. Review expected payments, then Update plan to reassess.</p>}
      {view && <div className="budget-summary"><div><span>Income received</span><strong>{price(view.income)}</strong></div><div><span>Spent so far</span><strong>{price(view.spent)}</strong><small>{price(view.refunds)} in refunds / credits</small></div><div><span>{plan ? 'Projected month-end savings' : 'Net so far'}</span><strong className={view.projectedSavings < 0 ? 'is-negative' : ''}>{price(plan ? view.projectedSavings : view.income + view.refunds - view.spent)}</strong>{plan && <small>Without changes: {price(view.forecastSavings)}</small>}</div><div><span>Expected income still to arrive</span><strong>{plan ? price(view.expectedIncome) : '—'}</strong><small>{plan ? 'Reduced as additional income is recorded' : 'Assessed from your recent history'}</small></div></div>}
      <div className="budget-layout"><section className="budget-chart-panel" aria-labelledby="budget-chart-title">
        <div className="budget-section-heading"><p className="eyebrow">Category spending</p><h2 id="budget-chart-title">Where there is room.</h2><p>Monthly limits stay put until you edit them or update the plan. Existing savings are preserved.</p></div>
        <div className="budget-modes" aria-label="Savings approach">{BUDGET_MODES.map((item) => {
          let projection = null
          if (plan && context) { try { projection = budgetView(context, plan, item.id, item.id === mode ? validOverrides : {}) } catch { /* shown by the main chart validation */ } }
          return <button key={item.id} type="button" aria-pressed={mode === item.id} onClick={() => setMode(item.id)}><strong>{item.label}</strong><span>{item.description}</span>{projection && <b>{price(projection.projectedSavings)} <small>projected savings</small></b>}</button>
        })}</div>
        {plan && <div className="budget-legend"><span><i className="spent-key" />Spent</span><span><i className="limit-key" />Your limit</span><span><i className="forecast-key" />Likely without changes</span></div>}
        {view?.fundingGap > 0 && <p className="budget-note is-warning">This approach is {price(view.fundingGap)} short of your {price(view.cushion)} monthly cushion. Adjust the flexible limits, income assumptions or cushion; existing savings have not been added to make it fit.</p>}
        {!plan && <p className="budget-note">Your actual spending is ready. Choose an approach, then Plan the rest of this month to add suggested limits and a forecast.</p>}
        {view?.rows.map((row) => <CategoryBar key={row.category} row={row} planned={!!plan} draft={overrides[row.category]} onEdit={(value) => setOverrides((items) => ({ ...items, [row.category]: value }))} />)}
        {view && !view.rows.length && <p className="budget-note">No category spending is recorded for this month. A plan can still assess upcoming costs from your history.</p>}
        {plan && <p className="budget-chart-footnote">Each row has its own scale. “Left” is the monthly limit minus gross spending; refunds are credited in the overall savings projection. Weekly figures are an approximate allowance over the remaining {context.days_remaining} days. Expected bills stay reserved until you mark them paid and update the plan.</p>}
      </section><aside className="budget-planner" aria-label="Budget planner">
        <p className="eyebrow">A little foresight</p><h2>{plan ? 'Review your plan.' : 'Plan the rest.'}</h2>
        <p>Your selected AI provider assesses this month and the previous six complete months, including recurring payments, salary changes, one-offs and seasonal needs.</p>
        <label>Anything coming up?<textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} rows={4} placeholder="A trip next week, gifts already bought, a salary change…" /></label>
        <label>Monthly cash cushion (€)<input type="text" inputMode="decimal" value={cushion} onChange={(event) => setCushion(event.target.value)} aria-invalid={!amountPattern.test(cushion)} /><small>Money to leave unallocated from this month’s income. Existing cash reserves are not extra income.</small></label>
        <p className="budget-privacy">Relevant financial history and these notes are sent to your selected AI provider when you generate a plan. Plans stay in this app session and clear on refresh or sign-out.</p>
        <button className="primary-button" type="button" disabled={assessment.busy || loading || !!error || !!live.meta.stale || invalid} onClick={generate}>{assessment.busy ? 'Assessing your month…' : plan ? 'Update plan' : 'Plan the rest of this month'}</button>
        {invalid && <p className="budget-note is-warning">Check the cushion and assumption labels, amounts and dates before updating.</p>}
        {assessment.busy && <p role="status">Preparing all three approaches. You can switch tabs while this finishes.</p>}
        {assessment.error && <div role="alert" className="budget-note is-warning"><p>{assessment.error}</p>{assessment.validationReason && <details><summary>What prevented this plan</summary><p>{assessment.validationReason}</p></details>}{['provider_key_required', 'budget_provider_unavailable', 'settings_service_unavailable', 'credential_service_unavailable'].includes(assessment.errorCode) && <Link to="/account">Check Account →</Link>}</div>}
        {plan?.reconciliation_notes?.length > 0 && <details className="budget-note"><summary>How this plan was reconciled</summary><ul>{plan.reconciliation_notes.map((note) => <li key={note}>{note}</li>)}</ul></details>}
        {plan && <><p className="budget-explanation">{plan.explanation}</p><p className="budget-provenance">{result.meta.provider} / {result.meta.model}<br />Assessed {new Date(result.meta.generated_at).toLocaleString('en-IE')} · rule set v{result.meta.rule_set_version}<br />Snapshot {result.meta.snapshot_id.slice(0, 8)}…</p><button className="secondary-button" type="button" onClick={() => setOverrides({})}>Reset edited limits for this approach</button></>}
        {context.cash_snapshot.available ? <p className="budget-note">Cash snapshot: {eur(context.cash_snapshot.total_eur)} on {context.cash_snapshot.date}. Includes savings accounts; it is not treated as available spending money.</p> : <p className="budget-note">A verified cash balance is unavailable. The plan uses this month’s income and expected receipts.</p>}
      </aside></div>
      <section className="budget-assumptions" aria-labelledby="budget-assumptions-title"><div className="budget-section-heading"><p className="eyebrow">Evidence and judgment</p><h2 id="budget-assumptions-title">What the plan assumes.</h2><p>Correct amounts and dates, or mark a payment already paid / not recurring. Update plan applies your corrections. Seasonal expectations are labelled separately from observed history.</p><button className="secondary-button" type="button" disabled={corrections.length >= 40} onClick={addAssumption}>Add expected income or bill</button></div>
        {!corrections.length && <p className="budget-note">{plan ? 'No individually forecast income or bills in this assessment. Category reasons explain the remaining allowances.' : 'Generate a plan to see the AI’s assumptions, or add a payment you already know about.'}</p>}
        <div className="budget-assumption-grid">{corrections.map((item) => <article key={item.id} className="budget-assumption"><div className="budget-assumption-evidence"><span>{item.basis} · {item.confidence} confidence</span><p>{item.evidence}</p></div>
          <label htmlFor={`label-${item.id}`}>Payment name<input id={`label-${item.id}`} value={item.label} onChange={(event) => updateAssumption(item.id, 'label', event.target.value)} maxLength={120} /></label>
          <div className="budget-assumption-fields"><label>Kind<select value={item.kind} onChange={(event) => updateAssumption(item.id, 'kind', event.target.value)}><option value="income">Income</option><option value="bill">Bill</option></select></label><label>Amount (€)<input inputMode="decimal" value={item.amount_eur} onChange={(event) => updateAssumption(item.id, 'amount_eur', event.target.value)} /></label><label>Expected date<input type="date" value={item.due_date} min={`${month}-01`} max={monthEnd} onChange={(event) => updateAssumption(item.id, 'due_date', event.target.value)} /></label><label>Status<select value={item.status} onChange={(event) => updateAssumption(item.id, 'status', event.target.value)}><option value="expected">Still expected</option><option value="paid">Already paid / received</option><option value="not_recurring">Not recurring</option></select></label></div>
          <label>Category<input value={item.category} onChange={(event) => updateAssumption(item.id, 'category', event.target.value)} maxLength={120} /></label>
        </article>)}</div>
      </section>
      {changes.length > 0 && <section className="budget-changes"><h2>What changed in this update.</h2><ul>{changes.map((item) => <li key={item.category}><strong>{item.category}: {item.change < 0 ? 'reduced' : 'increased'} by {price(Math.abs(item.change))}</strong><p>{item.reason}</p></li>)}</ul></section>}
      {context.warnings.length > 0 && <details className="budget-note"><summary>Imported data notes</summary><ul>{context.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
    </>}
  </main>
}
