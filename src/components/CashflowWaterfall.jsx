import { useTabState } from '../context/TabSessionContext.jsx'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { extent, scaleBand, scaleLinear } from 'd3'
import { getCashflowBreakdown } from '../services/finance.js'
import { eur, monthLabel } from '../lib/finance.js'
import { categoryWaterfallSteps, waterfallSteps } from './waterfall.js'

function signedEuro(cents, decimals = 2) {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', signDisplay: 'exceptZero', maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(cents / 100)
}

function labelLines(label) {
  const words = label.match(/\S.{0,16}(?:\s|$)|\S{1,17}/g) || [label]
  return words.slice(0, 3).map((line, index) => index === 2 && words.length > 3 ? `${line.trim()}…` : line.trim())
}

export default function CashflowWaterfall({ data, total, meta }) {
  const id = useId().replaceAll(':', '')
  const [activeKey, setActiveKey] = useState(null)
  const [selectedMonth, setSelectedMonth] = useTabState('dashboard.drilldown', null)
  const [detail, setDetail] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [chartSize, setChartSize] = useState({ width: 800, height: 385 })
  const backButton = useRef(null)
  const monthButtons = useRef(new Map())
  const scroll = useRef(null)
  const [savedScroll, setSavedScroll] = useTabState('dashboard.monthScroll', 0)
  const selected = data.find((row) => row.month === selectedMonth)
  useEffect(() => {
    const element = scroll.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) setChartSize({ width, height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [selectedMonth, detail?.steps, data.length])
  useEffect(() => {
    if (!selectedMonth) return
    const controller = new AbortController()
    getCashflowBreakdown(selectedMonth, controller.signal).then((result) => {
      if (controller.signal.aborted) return
      if (result.meta?.snapshot_id !== meta?.snapshot_id || result.meta?.rule_set_version !== meta?.rule_set_version) {
        throw new Error('Your data changed. Go back and refresh the dashboard before drilling down.')
      }
      const matches = result.cashflow?.filter((row) => row.month === selectedMonth)
      if (matches?.length !== 1 || !selected) throw new Error('The category breakdown is unavailable for this month.')
      setDetail({ steps: categoryWaterfallSteps(matches[0].items, selected.net) })
    }).catch((error) => {
      if (!controller.signal.aborted) setDetail({ error: error.message || 'Could not load the category breakdown.' })
    })
    return () => controller.abort()
  }, [selectedMonth, selected, meta?.snapshot_id, meta?.rule_set_version, attempt])
  useEffect(() => {
    if (selectedMonth) {
      backButton.current?.focus()
      if (scroll.current) scroll.current.scrollLeft = 0
    }
  }, [selectedMonth])
  const openMonth = (month) => {
    setSavedScroll(scroll.current?.scrollLeft || 0)
    setActiveKey(null)
    setDetail(null)
    setSelectedMonth(month)
  }
  const goBack = () => {
    const month = selectedMonth
    setSelectedMonth(null)
    setDetail(null)
    setActiveKey(null)
    requestAnimationFrame(() => {
      monthButtons.current.get(month)?.focus({ preventScroll: true })
      if (scroll.current) scroll.current.scrollLeft = savedScroll
    })
  }
  const model = useMemo(() => {
    try { return { steps: waterfallSteps(data, total) } }
    catch (error) { return { error: error.message } }
  }, [data, total])
  if (!data.length) return <div className="waterfall-empty"><span aria-hidden="true">↗</span><h3>No recorded months in this period.</h3><p>Choose a different period or import your latest data in Account.</p></div>
  if (model.error) return <p className="settings-message is-error" role="alert">{model.error}</p>
  const steps = selectedMonth ? (detail?.steps || []) : model.steps
  const chartTitle = selectedMonth ? `${monthLabel(selectedMonth)} category cash flow waterfall` : 'Monthly net cash flow waterfall'
  const toolbar = selectedMonth && <div className="waterfall-drilldown"><button ref={backButton} className="secondary-button" type="button" onClick={goBack}>← Back to months</button><h3>{monthLabel(selectedMonth)} breakdown</h3><p>Income, spending and refunds by category · Net {eur(selected?.net)}</p></div>
  if (selectedMonth && !detail) return <div className="waterfall-visual">{toolbar}<div className="waterfall-detail-message" role="status">Loading {monthLabel(selectedMonth)} breakdown…</div></div>
  if (selectedMonth && detail?.error) return <div className="waterfall-visual">{toolbar}<div className="waterfall-detail-message"><p role="alert">{detail.error}</p><button className="secondary-button" type="button" onClick={() => { setDetail(null); setAttempt((value) => value + 1) }}>Try again</button></div></div>
  const width = Math.max(chartSize.width, steps.length * (selectedMonth ? 150 : 95) + 95)
  const height = chartSize.height
  const margin = { top: 50, right: 25, bottom: selectedMonth ? 110 : 66, left: 67 }
  const x = scaleBand(steps.map((step) => step.key), [margin.left, width - margin.right]).padding(0.4)
  const columnWidth = Math.min(120, x.bandwidth())
  const columnX = (key) => x(key) + (x.bandwidth() - columnWidth) / 2
  const [low, high] = extent([0, ...steps.flatMap((step) => [step.start, step.end])])
  const span = Math.max(high - low, 10000)
  const y = scaleLinear([Math.min(0, low) - span * .12, Math.max(0, high) + span * .18], [height - margin.bottom, margin.top]).nice(5)
  const active = steps.find((step) => step.key === activeKey)
  const stepLabel = (step) => step.total ? 'Net total' : selectedMonth ? `${step.type} · ${step.label}` : monthLabel(step.key)
  const describe = (step) => `${stepLabel(step)}: ${signedEuro(step.change)}${step.total ? '' : `; running net ${eur(step.end / 100)}`}`
  const ticks = y.ticks(5)
  if (!ticks.includes(0)) ticks.push(0)
  return <div className="waterfall-visual">{toolbar}
    <div ref={scroll} data-tab-scroll="waterfall" className="waterfall-scroll" role="region" aria-label="Cash flow waterfall, scroll horizontally for more columns" tabIndex={0}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height }} role="group" aria-label={chartTitle} aria-describedby={`${id}-description`}>
        <title>{chartTitle}</title><desc id={`${id}-description`}>{selectedMonth ? "Starting at zero, income, spending categories and refunds build to the selected month’s net cash flow." : "Starting at zero for this period, each month adds or subtracts its net cash flow. Select a month for its category breakdown."} The gold column is the net total. This is not an account balance.</desc>
        <defs>{[['positive', '#9bd6b5', '#579d7b'], ['negative', '#e5a09a', '#bb6c68'], ['total', '#e7d4a2', '#ad9156']].map(([name, from, to]) => <linearGradient key={name} id={`${id}-${name}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={from} /><stop offset="100%" stopColor={to} /></linearGradient>)}</defs>
        {ticks.map((tick) => <g key={tick} className={tick === 0 ? 'waterfall-zero' : 'waterfall-grid'}><line x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} /><text x={margin.left - 15} y={y(tick) + 4} textAnchor="end">{new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 }).format(tick / 100)}</text></g>)}
        {steps.slice(0, -1).map((step, index) => <line key={step.key} className="waterfall-connector" x1={columnX(step.key) + columnWidth} x2={columnX(steps[index + 1].key)} y1={y(step.end)} y2={y(step.end)} />)}
        {steps.map((step) => {
          const top = y(Math.max(step.start, step.end))
          const bottom = y(Math.min(step.start, step.end))
          const label = step.total ? 'Net total' : selectedMonth ? step.label : monthLabel(step.key).split(' ')[0]
          const interactive = !selectedMonth && !step.total
          const kind = step.total ? 'total' : step.change < 0 ? 'negative' : 'positive'
          return <g key={step.key} ref={(element) => { if (interactive) { if (element) monthButtons.current.set(step.key, element); else monthButtons.current.delete(step.key) } }} role={interactive ? 'button' : 'img'} tabIndex={0} onClick={interactive ? () => openMonth(step.key) : undefined} className={`waterfall-step${interactive ? ' is-interactive' : ''} is-${kind}${activeKey && activeKey !== step.key ? ' is-muted' : ''}`} aria-label={`${describe(step)}${interactive ? '; Show category breakdown' : ''}`} onMouseEnter={() => setActiveKey(step.key)} onMouseLeave={() => setActiveKey(null)} onFocus={() => setActiveKey(step.key)} onBlur={() => setActiveKey(null)} onKeyDown={(event) => { if (interactive && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openMonth(step.key) } else if (event.key === 'Escape') { if (selectedMonth) goBack(); else setActiveKey(null) } }}>
            <title>{describe(step)}</title><rect className="waterfall-hit-area" x={x(step.key) - 10} y={margin.top - 25} width={x.bandwidth() + 20} height={height - margin.top - 15} fill="transparent" />
            <rect className="waterfall-column" x={columnX(step.key)} y={top} width={columnWidth} height={Math.max(2, bottom - top)} rx={4} fill={`url(#${id}-${kind})`} />
            <text className="waterfall-value" x={x(step.key) + x.bandwidth() / 2} y={step.change < 0 && !step.total ? bottom + 20 : top - 13} textAnchor="middle">{signedEuro(step.change, 0)}</text>
            <text className="waterfall-month" x={x(step.key) + x.bandwidth() / 2} y={selectedMonth ? height - 75 : height - 30} textAnchor="middle">{selectedMonth ? labelLines(label).map((line, index) => <tspan key={index} x={x(step.key) + x.bandwidth() / 2} dy={index ? 18 : 0}>{line}</tspan>) : label}</text><text className="waterfall-year" x={x(step.key) + x.bandwidth() / 2} y={height - 12} textAnchor="middle">{step.total ? (selectedMonth ? monthLabel(selectedMonth) : 'Selected period') : selectedMonth ? step.type : step.key.slice(0, 4)}</text>
          </g>
        })}
      </svg>
    </div>
    <div className="waterfall-insight" aria-live="polite">{active ? <><span>{stepLabel(active)}</span><strong>{signedEuro(active.change)}</strong><span>{active.total ? 'Net cash flow' : `Running net ${eur(active.end / 100)}`}{!selectedMonth && !active.total && ' · Select for category breakdown'}</span></> : <span>{selectedMonth ? 'Income rises, spending falls, and refunds contribute to the final monthly net. Hover or focus a column for exact figures.' : 'Select a month to see income, spending categories and refunds.'}</span>}</div>
    <table className="sr-only"><caption>{selectedMonth ? `${monthLabel(selectedMonth)} category cash flow figures in EUR` : 'Monthly cash flow figures in EUR'}</caption><thead><tr><th>{selectedMonth ? 'Category' : 'Month'}</th><th>Net cash flow</th><th>Running net</th></tr></thead><tbody>{steps.map((step) => <tr key={step.key}><th>{stepLabel(step)}</th><td>{signedEuro(step.change)}</td><td>{eur(step.end / 100)}</td></tr>)}</tbody></table>
  </div>
}
