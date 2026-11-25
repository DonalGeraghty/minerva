import { useId, useMemo, useState } from 'react'
import { extent, scaleBand, scaleLinear } from 'd3'
import { eur, monthLabel } from '../lib/finance.js'
import { waterfallSteps } from './waterfall.js'

function signedEuro(cents, decimals = 2) {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', signDisplay: 'exceptZero', maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(cents / 100)
}

export default function CashflowWaterfall({ data, total }) {
  const id = useId().replaceAll(':', '')
  const [activeKey, setActiveKey] = useState(null)
  const model = useMemo(() => {
    try { return { steps: waterfallSteps(data, total) } }
    catch (error) { return { error: error.message } }
  }, [data, total])
  if (!data.length) return <div className="waterfall-empty"><span aria-hidden="true">↗</span><h3>No recorded months in this period.</h3><p>Choose a different period or import your latest data in Account.</p></div>
  if (model.error) return <p className="settings-message is-error" role="alert">{model.error}</p>
  const { steps } = model
  const width = Math.max(800, steps.length * 105 + 100)
  const height = 385
  const margin = { top: 50, right: 25, bottom: 66, left: 67 }
  const x = scaleBand(steps.map((step) => step.key), [margin.left, width - margin.right]).padding(0.4)
  const [low, high] = extent([0, ...steps.flatMap((step) => [step.start, step.end])])
  const span = Math.max(high - low, 10000)
  const y = scaleLinear([Math.min(0, low) - span * .12, Math.max(0, high) + span * .18], [height - margin.bottom, margin.top]).nice(5)
  const active = steps.find((step) => step.key === activeKey)
  const describe = (step) => `${step.total ? 'Net total' : monthLabel(step.key)}: ${signedEuro(step.change)}${step.total ? '' : `; running net ${eur(step.end / 100)}`}`
  const ticks = y.ticks(5)
  if (!ticks.includes(0)) ticks.push(0)
  return <div className="waterfall-visual">
    <div className="waterfall-scroll" role="region" aria-label="Cash flow waterfall, scroll horizontally for more months" tabIndex={0}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ minWidth: Math.max(620, steps.length * 85) }} role="img" aria-label="Monthly net cash flow waterfall" aria-describedby={`${id}-description`}>
        <title>Monthly net cash flow waterfall</title><desc id={`${id}-description`}>Starting at zero for this period, each month adds or subtracts its net cash flow. The gold column is the total. This is not an account balance.</desc>
        <defs>{[['positive', '#9bd6b5', '#579d7b'], ['negative', '#e5a09a', '#bb6c68'], ['total', '#e7d4a2', '#ad9156']].map(([name, from, to]) => <linearGradient key={name} id={`${id}-${name}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={from} /><stop offset="100%" stopColor={to} /></linearGradient>)}</defs>
        {ticks.map((tick) => <g key={tick} className={tick === 0 ? 'waterfall-zero' : 'waterfall-grid'}><line x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} /><text x={margin.left - 15} y={y(tick) + 4} textAnchor="end">{new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 }).format(tick / 100)}</text></g>)}
        {steps.slice(0, -1).map((step, index) => <line key={step.key} className="waterfall-connector" x1={x(step.key) + x.bandwidth()} x2={x(steps[index + 1].key)} y1={y(step.end)} y2={y(step.end)} />)}
        {steps.map((step) => {
          const top = y(Math.max(step.start, step.end))
          const bottom = y(Math.min(step.start, step.end))
          const label = step.total ? 'Net total' : monthLabel(step.key).split(' ')[0]
          const kind = step.total ? 'total' : step.change < 0 ? 'negative' : 'positive'
          return <g key={step.key} className={`waterfall-step is-${kind}${activeKey && activeKey !== step.key ? ' is-muted' : ''}`} tabIndex={0} role="img" aria-label={describe(step)} onMouseEnter={() => setActiveKey(step.key)} onMouseLeave={() => setActiveKey(null)} onFocus={() => setActiveKey(step.key)} onBlur={() => setActiveKey(null)} onKeyDown={(event) => { if (event.key === 'Escape') setActiveKey(null) }}>
            <title>{describe(step)}</title><rect className="waterfall-hit-area" x={x(step.key) - 10} y={margin.top - 25} width={x.bandwidth() + 20} height={height - margin.top - 15} fill="transparent" />
            <rect className="waterfall-column" x={x(step.key)} y={top} width={x.bandwidth()} height={Math.max(2, bottom - top)} rx={4} fill={`url(#${id}-${kind})`} />
            <text className="waterfall-value" x={x(step.key) + x.bandwidth() / 2} y={step.change < 0 && !step.total ? bottom + 20 : top - 13} textAnchor="middle">{signedEuro(step.change, 0)}</text>
            <text className="waterfall-month" x={x(step.key) + x.bandwidth() / 2} y={height - 30} textAnchor="middle">{label}</text><text className="waterfall-year" x={x(step.key) + x.bandwidth() / 2} y={height - 12} textAnchor="middle">{step.total ? 'Selected period' : step.key.slice(0, 4)}</text>
          </g>
        })}
      </svg>
    </div>
    <div className="waterfall-insight" aria-live="polite">{active ? <><span>{active.total ? 'Selected period' : monthLabel(active.key)}</span><strong>{signedEuro(active.change)}</strong><span>{active.total ? 'Net cash flow' : `Running net ${eur(active.end / 100)}`}</span></> : <span>Hover over a month or focus a column for the exact figures.</span>}</div>
    <table className="sr-only"><caption>Monthly cash flow figures in EUR</caption><thead><tr><th>Month</th><th>Net cash flow</th><th>Running net</th></tr></thead><tbody>{steps.map((step) => <tr key={step.key}><th>{step.total ? 'Total' : monthLabel(step.key)}</th><td>{signedEuro(step.change)}</td><td>{eur(step.end / 100)}</td></tr>)}</tbody></table>
  </div>
}
