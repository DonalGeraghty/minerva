import { number, format } from '../services/garminMetrics.js'

export default function GarminTrendChart({ points, title, unit = '', maximum, minimum = 0 }) {
  const valid = points.filter((point) => number(point.value) !== null)
  if (!valid.length) return <p>No measurements available for this chart.</p>
  const low = minimum === null ? Math.min(...valid.map((point) => point.value)) * .98 : minimum
  const high = Math.max(low + 1, maximum ?? Math.max(...valid.map((point) => point.value)) * 1.05)
  const first = points[0]?.x ?? 0
  const last = points.at(-1)?.x ?? Math.max(1, points.length - 1)
  const x = (point, index) => 40 + ((point.x ?? index) - first) / Math.max(1, last - first) * 380
  const y = (point) => 125 - (point.value - low) / (high - low) * 105
  let path = '', connected = false
  points.forEach((point, index) => {
    if (number(point.value) === null) { connected = false; return }
    path += `${connected ? ' L' : ' M'}${x(point, index)},${y(point)}`
    connected = true
  })
  return <figure className="garmin-trend-chart"><figcaption>{title}</figcaption>
    <svg viewBox="0 0 460 155" role="img" aria-label={`${title}, ${valid.length} recorded measurements. Open chart values for exact readings.`}>
      {[0, .5, 1].map((position) => <g key={position}><line x1="40" x2="420" y1={125 - position * 105} y2={125 - position * 105} className="trend-grid" /><text x="34" y={129 - position * 105} textAnchor="end">{format(low + position * (high - low), '', 1)}</text></g>)}
      <path d={path} className="trend-line" />
      {points.map((point, index) => number(point.value) === null ? null : <circle key={index} cx={x(point, index)} cy={y(point)} r={valid.length > 100 ? 1 : 3} className="trend-dot"><title>{point.label}: {format(point.value, unit, 1)}</title></circle>)}
      <text x="40" y="149">{points[0]?.label}</text><text x="420" y="149" textAnchor="end">{points.at(-1)?.label}</text>
    </svg>
    <details><summary>Chart values · {title}</summary><div className="activity-table-scroll"><table><caption>{title}{unit ? ` (${unit})` : ''}</caption><thead><tr><th scope="col">Date or time</th><th scope="col">Value</th></tr></thead><tbody>{points.map((point, index) => <tr key={index}><th scope="row">{point.label}</th><td>{format(point.value, unit, 1)}</td></tr>)}</tbody></table></div></details>
  </figure>
}
