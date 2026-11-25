import { PERIODS } from '../lib/finance.js'

export default function PeriodPicker({ period, setPeriod, start, setStart, end, setEnd }) {
  return (
    <div className="period-picker">
      <label htmlFor="period-select">Period
        <select id="period-select" value={period} onChange={(event) => setPeriod(event.target.value)}>
          {PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </label>
      {period === 'custom' && (
        <>
          <label htmlFor="period-start">From (YYYY-MM)
            <input id="period-start" type="month" value={start} onChange={(event) => setStart(event.target.value)} required />
          </label>
          <label htmlFor="period-end">To (YYYY-MM)
            <input id="period-end" type="month" value={end} onChange={(event) => setEnd(event.target.value)} required />
          </label>
        </>
      )}
    </div>
  )
}
