import { eur, isMoneyNegative, monthLabel } from '../services/finance.js'

const WIDTH = 640
const BAR_AREA = 260

export function WaterfallChart({ data }) {
  if (!data?.length) return <p className="finance-empty">No movements in this period.</p>
  const height = 220
  const max = Math.max(...data.map((d) => Math.abs(Number(d.net))), 1)
  const zero = height - 40
  const step = (WIDTH - 40) / data.length
  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label="Monthly net cash flow waterfall" className="finance-chart">
      <line x1={20} y1={zero} x2={WIDTH - 20} y2={zero} className="chart-axis" />
      {data.map((d, i) => {
        const value = Number(d.net)
        const barHeight = Math.max(2, (Math.abs(value) / max) * (BAR_AREA - 40))
        const x = 30 + i * step
        const y = value < 0 ? zero : zero - barHeight
        return (
          <g key={d.month}>
            <rect x={x} y={y} width={Math.max(4, step - 8)} height={barHeight} className={isMoneyNegative(d.net) ? 'bar-negative' : 'bar-positive'} rx={2}>
              <title>{`${monthLabel(d.month)}: ${eur(d.net)}`}</title>
            </rect>
            <text x={x + (step - 8) / 2} y={height - 8} textAnchor="middle" className="chart-label">{monthLabel(d.month)}</text>
            <text x={x + (step - 8) / 2} y={value < 0 ? y + barHeight + 12 : y - 6} textAnchor="middle" className={`chart-value${isMoneyNegative(d.net) ? ' is-negative' : ''}`}>{eur(d.net)}</text>
          </g>
        )
      })}
    </svg>
  )
}

export function Bars({ items, title }) {
  if (!items?.length) return <p className="finance-empty">Nothing to show for this period.</p>
  const max = Math.max(...items.map((i) => Math.abs(Number(i.total))), 0.01)
  return (
    <ul className="finance-bars" aria-label={title}>
      {items.slice(0, 12).map((item) => (
        <li key={item.name}>
          <span className="finance-bar-name">{item.name}</span>
          <span className="finance-bar-track">
            <span className={`finance-bar${isMoneyNegative(item.total) ? ' is-negative' : ''}`} style={{ width: `${(Math.abs(Number(item.total)) / max) * 100}%` }} />
          </span>
          <span className={`finance-bar-value${isMoneyNegative(item.total) ? ' is-negative' : ''}`}>{eur(item.total)}</span>
        </li>
      ))}
    </ul>
  )
}

export function NetTrendChart({ points }) {
  if (!points?.length) return <p className="finance-empty">No trend data.</p>
  const height = 160
  const values = points.map((p) => Number(p.net))
  const max = Math.max(...values.map(Math.abs), 1)
  const step = (WIDTH - 40) / Math.max(points.length - 1, 1)
  const coords = points.map((p, i) => [30 + i * step, height - 20 - (Number(p.net) / max) * (height - 50)])
  const zero = height - 20
  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label="Net cash flow trend" className="finance-chart">
      <line x1={20} y1={zero} x2={WIDTH - 20} y2={zero} className="chart-axis" />
      <polyline points={coords.map((c) => c.join(',')).join(' ')} className="trend-line" />
      {coords.map((c, i) => <circle key={i} cx={c[0]} cy={c[1]} r={3} className="trend-dot"><title>{`${monthLabel(points[i].month)}: ${eur(points[i].net)}`}</title></circle>)}
      {points.map((p, i) => <text key={p.month} x={coords[i][0]} y={height - 4} textAnchor="middle" className="chart-label">{monthLabel(p.month)}</text>)}
    </svg>
  )
}
