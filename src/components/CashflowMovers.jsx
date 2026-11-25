import { useId, useMemo, useState } from 'react'
import { max, scaleBand, scaleLinear } from 'd3'
import { Link } from 'react-router-dom'
import { cashflowChanges } from '../lib/cashflowChanges.js'
import { eur, monthLabel } from '../lib/finance.js'
import './CashflowMovers.css'

const signed = (value) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${eur(Math.abs(value) / 100)}`

export default function CashflowMovers({ flow, categories, stale, error }) {
  const id = useId().replaceAll(':', '')
  const [selectedKey, setSelectedKey] = useState(null)
  const result = useMemo(() => {
    if (error) return { error }
    try { return cashflowChanges(flow, categories) }
    catch (failure) { return { error: failure.message } }
  }, [flow, categories, error])
  const selected = result.rows?.find((row) => row.key === selectedKey) || result.rows?.find((row) => row.change < 0) || result.rows?.[0]
  const width = 900, height = (result.rows?.length || 0) * 54 + 78
  const bound = Math.max(100, max(result.rows || [], (row) => Math.abs(row.change)) || 0)
  const x = scaleLinear([-bound * 1.25, bound * 1.25], [190, width - 90])
  const y = scaleBand((result.rows || []).map((row) => row.key), [54, height - 24]).padding(.42)
  const link = new URLSearchParams({ start: result.month || '', end: result.month || '' })
  const categoryLink = selected?.category && selected.category !== 'Uncategorised'
  if (categoryLink) link.set('category', selected.category)
  return <section className="movers-panel" aria-labelledby={`${id}-heading`}>
    <header className="movers-header"><div><p className="eyebrow">A closer look · cash-flow movers</p><h2 id={`${id}-heading`}>What changed?</h2><p>{result.month ? `${monthLabel(result.month)} compared with ${monthLabel(result.previous)}` : 'Find the categories behind a change in your monthly net.'}</p></div>{result.month && <div className={`movers-net${result.netChange < 0 ? ' is-lower' : ''}`}><span>Change in monthly net</span><strong>{signed(result.netChange)}</strong></div>}</header>
    {result.error || result.empty ? <div className="movers-empty" role={result.error ? 'status' : undefined}><span aria-hidden="true">↔</span><p>{result.error || result.empty}</p>{result.error && <Link to="/account">Check your import ↗</Link>}</div> : !result.rows.length ? <p className="movers-empty">No category movements between these two months.</p> : <>
      <div className="movers-direction" aria-label="Change legend"><span><i />Reduced net cash flow</span><span><i />Improved net cash flow</span></div>
      <div className="movers-scroll" role="region" aria-label="Category comparison, scroll horizontally for the full chart" tabIndex={0}><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Category changes in monthly net cash flow" aria-describedby={`${id}-description`}>
        <title>Category changes in monthly net cash flow</title><desc id={`${id}-description`}>Changes in each category’s signed contribution to monthly net cash flow. Coral bars to the left reduce net cash flow; green bars to the right improve it. Select a row to review its ledger entries. Income, expenses and refunds are included.</desc>
        <defs>{[['lower', '#b66b66', '#e0a49a'], ['higher', '#568e72', '#a7d3b1']].map(([key, from, to]) => <linearGradient key={key} id={`${id}-${key}`}><stop stopColor={from} /><stop offset="100%" stopColor={to} /></linearGradient>)}</defs>
        {x.ticks(5).map((tick) => <g className="movers-grid" key={tick}><line x1={x(tick)} x2={x(tick)} y1={40} y2={height - 18} /><text x={x(tick)} y={26} textAnchor="middle">{new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 }).format(tick / 100)}</text></g>)}
        <line className="movers-zero" x1={x(0)} x2={x(0)} y1={38} y2={height - 18} />
        {result.rows.map((row) => {
          const middle = y(row.key) + y.bandwidth() / 2
          const lower = row.change < 0
          return <g className={`mover-row${selected?.key === row.key ? ' is-selected' : ''}`} key={row.key} role="button" tabIndex={0} aria-pressed={selected?.key === row.key} aria-label={`${row.name}: ${signed(row.change)} change in net cash flow`} onClick={() => setSelectedKey(row.key)} onFocus={() => setSelectedKey(row.key)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedKey(row.key) } }}>
            <title>{row.name}: {eur(row.before / 100)} → {eur(row.after / 100)}; net change {signed(row.change)}</title><rect className="mover-hit" x={0} y={y(row.key) - 8} width={width} height={y.bandwidth() + 16} rx={6} />
            <text className="mover-category" x={15} y={middle + 4}>{row.name.length > 23 ? `${row.name.slice(0, 22)}…` : row.name}</text>
            <rect className="mover-bar" x={Math.min(x(0), x(row.change))} y={middle - 8} width={Math.max(2, Math.abs(x(row.change) - x(0)))} height={16} rx={5} fill={`url(#${id}-${lower ? 'lower' : 'higher'})`} />
            <text className={`mover-value${lower ? ' is-lower' : ''}`} x={x(row.change) + (lower ? -10 : 10)} y={middle + 4} textAnchor={lower ? 'end' : 'start'}>{signed(row.change)}</text>
          </g>
        })}
      </svg></div>
      {selected && <div className="movers-action" aria-live="polite"><div><span>START WITH {selected.name.toUpperCase()}</span><h3>{Math.abs(selected.change) === 0 ? 'No net change' : `${eur(Math.abs(selected.change) / 100)} ${selected.change < 0 ? 'less' : 'more'} toward monthly net`}</h3><p>Recorded contribution: {eur(selected.before / 100)} → {eur(selected.after / 100)}. {categoryLink ? 'Check the entries to see whether this is a one-off or a pattern.' : selected.key === 'other' ? 'Open the whole month to investigate the smaller categories grouped here.' : 'Open the whole month and inspect entries with a blank or Uncategorised category.'}</p></div><Link className="secondary-button" to={`/transactions?${link}`}>{categoryLink ? `Review ${selected.name} entries ↗` : 'Review whole month ↗'}</Link></div>}
      <details className="movers-notes"><summary>How to read this comparison</summary><p>Two consecutive completed calendar months within your selected period. The current month is excluded. Income and refunds can change these figures too; this is a change in net contribution, not a savings target or forecast.</p><p>Only recorded activity is compared. Coverage may be incomplete even after a calendar month ends. Missing categories count as no recorded contribution only when both months have data. {result.categoryCount > 6 && 'The six largest movements are shown separately; remaining movements are combined into Other categories.'} {stale && 'This comparison uses saved data because the latest import failed.'}</p></details>
      <table className="sr-only"><caption>Category contributions and changes in EUR</caption><thead><tr><th>Category</th><th>{monthLabel(result.previous)}</th><th>{monthLabel(result.month)}</th><th>Change</th></tr></thead><tbody>{result.rows.map((row) => <tr key={row.key}><th>{row.name}</th><td>{eur(row.before / 100)}</td><td>{eur(row.after / 100)}</td><td>{signed(row.change)}</td></tr>)}</tbody></table>
    </>}
  </section>
}
