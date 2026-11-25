import { useEffect, useId, useRef, useState } from 'react'
import { scaleLinear } from 'd3'
import { eurCents, moneyCents } from '../lib/finance.js'
import './BudgetChart.css'

const axisFormatter = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

export default function BudgetChart({ rows, plan, context, selected, onSelect }) {
  const root = useRef(null)
  const detail = useRef(null)
  const buttons = useRef(new Map())
  const [width, setWidth] = useState(800)
  const detailId = useId()
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(entry.contentRect.width)
    })
    observer.observe(root.current)
    return () => observer.disconnect()
  }, [])
  const active = rows.find((row) => row.category === selected)
  const activeCategory = active?.category
  useEffect(() => {
    if (activeCategory) detail.current?.focus({ preventScroll: true })
  }, [activeCategory])
  const close = () => {
    onSelect(null)
    buttons.current.get(selected)?.focus({ preventScroll: true })
  }
  const canvasWidth = Math.max(width, 280)
  const x = scaleLinear().domain([0, Math.max(10000, ...rows.flatMap((row) => [row.spent, row.limit || 0]))]).nice(4).range([0, canvasWidth - 32])
  const ticks = x.ticks(width < 500 ? 3 : 5)
  const merchants = new Map()
  for (const item of context.merchant_patterns || []) {
    if (item.month !== context.month || item.category !== selected || item.type !== 'Expense') continue
    const amount = moneyCents(item.signed_amount_eur)
    if (amount < 0) merchants.set(item.merchant, (merchants.get(item.merchant) || 0) - amount)
  }
  const payments = plan?.assumptions.filter((item) => item.kind === 'bill' && item.category === selected && item.status === 'expected') || []
  return <div className="budget-chart" ref={root}>
    <div className="budget-chart-heading"><span>Spending by category</span><div className="budget-legend"><span><i />Spent</span>{plan && <span><i className="limit-key" />AI limit</span>}</div></div>
    {active && <section className="budget-detail" ref={detail} tabIndex={-1} aria-label={`${active.category} breakdown`} id={detailId} onKeyDown={(event) => { if (event.key === 'Escape') close() }}>
      <div className="budget-detail-heading"><h3>{active.category}</h3><button type="button" onClick={close} aria-label="Close category breakdown">×</button></div>
      <p>{active.suggestion?.reason || (plan ? 'This category has no allowance in the current plan. Update with AI to reassess.' : 'Update with AI to get a suggested limit for this category.')}</p>
      <div className="budget-detail-amounts"><span>Spent <b>{eurCents(active.spent)}</b></span>{plan && <span>Monthly limit <b>{eurCents(active.limit)}</b></span>}{active.refunds > 0 && <span>Refunds <b>{eurCents(active.refunds)}</b></span>}</div>
      {merchants.size > 0 && <div className="budget-merchants"><p>Largest recorded merchants{context.merchant_patterns_truncated ? ' · sample' : ''}</p><ul>{[...merchants].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, amount]) => <li key={name}><span>{name}</span><b>{eurCents(amount)}</b></li>)}</ul></div>}
      {payments.length > 0 && <p className="budget-detail-evidence">Reserved for expected bills: {payments.map((item) => `${item.label} (${eurCents(moneyCents(item.amount_eur))}, ${item.due_date})`).join(' · ')}. Included in your limit.</p>}
      {active.suggestion && <p className="budget-detail-evidence">{active.suggestion.confidence} confidence{active.suggestion.fixed ? ' · Fixed cost across all modes' : ''}. Estimates use your imported history.</p>}
    </section>}
    {!rows.length ? <p className="budget-empty">No spending recorded this month. Update with AI to look ahead at upcoming costs.</p> : <svg className="budget-svg" viewBox={`0 0 ${canvasWidth} ${rows.length * 100 + 32}`} width="100%" aria-label="Category spending and monthly limits">
      <g transform="translate(16,0)">
        {ticks.map((tick, index) => <g key={tick} className="budget-grid" transform={`translate(${x(tick)},0)`}><line y1="4" y2={rows.length * 100 - 4} /><text y={rows.length * 100 + 20} textAnchor={tick === 0 ? 'start' : index === ticks.length - 1 ? 'end' : 'middle'}>{axisFormatter.format(tick / 100)}</text></g>)}
        {rows.map((row, index) => {
          const over = row.remaining < 0
          const label = `${row.category}: ${eurCents(row.spent)} spent${plan ? `, ${eurCents(row.limit)} limit, ${eurCents(Math.abs(row.remaining))} ${over ? 'over' : 'left'}` : ''}`
          const categoryWidth = Math.max(9, Math.floor((canvasWidth - 160) / 9))
          return <g key={row.category} transform={`translate(0,${index * 100})`} role="button" tabIndex={0} aria-label={label} aria-expanded={selected === row.category} aria-controls={selected === row.category ? detailId : undefined} className={`budget-chart-row${over ? ' is-over' : ''}${selected === row.category ? ' is-selected' : ''}`} ref={(element) => { if (element) buttons.current.set(row.category, element); else buttons.current.delete(row.category) }} onClick={() => onSelect(selected === row.category ? null : row.category)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(selected === row.category ? null : row.category) } }}>
            <title>{label}</title>
            <rect className="budget-row-hit" x="-8" y="4" width={canvasWidth - 16} height="90" rx="10" />
            <text className="budget-row-name" y="28">{row.category.length > categoryWidth ? `${row.category.slice(0, categoryWidth - 1)}…` : row.category}</text>
            <text className="budget-row-amount" x={canvasWidth - 32} y="28" textAnchor="end">{eurCents(row.spent)} spent</text>
            <rect className="budget-row-track" y="51" width={canvasWidth - 32} height="12" rx="6" />
            {plan && <rect className="budget-row-allowance" y="51" height="12" rx="6" style={{ width: `${x(row.limit)}px` }} />}
            <rect className="budget-row-spent" y="51" height="12" rx="6" style={{ width: `${x(row.spent)}px` }} />
            {plan && <g className="budget-row-limit" style={{ transform: `translateX(${x(row.limit)}px)` }}><line y1="45" y2="69" /><circle cy="45" r="2.5" /></g>}
            <text className="budget-row-left" x={canvasWidth - 32} y="84" textAnchor="end">{plan ? `${eurCents(Math.abs(row.remaining))} ${over ? 'over limit' : 'left'}` : 'View category →'}</text>
          </g>
        })}
      </g>
    </svg>}
    {rows.length > 0 && <p className="budget-chart-hint">Select a category to look closer · All bars use the same scale</p>}
  </div>
}
