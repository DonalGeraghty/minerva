import { useCallback, useEffect, useState } from 'react'
import Brand from '../components/Brand.jsx'
import PeriodPicker from '../components/PeriodPicker.jsx'
import { getTransactions } from '../services/finance.js'
import { eur, monthLabel } from '../lib/finance.js'

const TYPES = ['Income', 'Expense', 'Refund', 'Transfer']

export default function TransactionsPage() {
  const [period, setPeriod] = useState('all')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [month, setMonth] = useState('')
  const [type, setType] = useState('')
  const [category, setCategory] = useState('')
  const [merchant, setMerchant] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('date')
  const [order, setOrder] = useState('desc')
  const [offset, setOffset] = useState(0)
  const limit = 50
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (signal) => {
    setLoading(true)
    setError('')
    try {
      const result = await getTransactions(
        { period, start, end, month, type, category, merchant, search, sort, order, limit, offset }, signal)
      if (!signal.aborted) setData(result)
    } catch (requestError) {
      if (!signal.aborted && requestError.name !== 'AbortError') setError(requestError.message || 'Could not load transactions')
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [period, start, end, month, type, category, merchant, search, sort, order, offset])

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  const changeFilter = (setter) => (value) => { setter(value); setOffset(0) }
  const filter = (setter) => (event) => changeFilter(setter)(event.target.value)
  const months = data?.meta?.coverage?.months || []

  return (
    <main className="page finance-page">
      <Brand />
      <section className="page-hero">
        <p className="eyebrow">Finance &middot; transactions</p>
        <h1>Ledger.</h1>
        <p>Every row from the synced sheet, with the rule that interpreted it.</p>
      </section>
      <section className="app-panel" aria-label="Transaction filters">
        <div className="form-actions finance-filters">
          <PeriodPicker period={period} setPeriod={changeFilter(setPeriod)} start={start} setStart={changeFilter(setStart)} end={end} setEnd={changeFilter(setEnd)} />
          <label>Month
            <select value={month} onChange={filter(setMonth)}>
              <option value="">All</option>
              {[...months].reverse().map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          </label>
          <label>Type
            <select value={type} onChange={filter(setType)}>
              <option value="">All</option>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label>Category<input value={category} onChange={filter(setCategory)} placeholder="e.g. Groceries" /></label>
          <label>Merchant<input value={merchant} onChange={filter(setMerchant)} placeholder="e.g. Spar" /></label>
          <label>Search<input value={search} onChange={filter(setSearch)} placeholder="description, ID…" /></label>
          <label>Sort
            <select value={`${sort}:${order}`} onChange={(event) => { const [s, o] = event.target.value.split(':'); setSort(s); setOrder(o); setOffset(0) }}>
              <option value="date:desc">Newest</option>
              <option value="date:asc">Oldest</option>
              <option value="amount_eur:desc">Largest amount</option>
              <option value="amount_eur:asc">Smallest amount</option>
            </select>
          </label>
        </div>
        {error && <p className="settings-message is-error" role="alert">{error}</p>}
        {loading ? <p role="status">Loading transactions…</p> : !error && data && (
          <>
            <table className="finance-table">
              <caption>{data.total} matching rows · snapshot {data.meta.snapshot_id?.slice(0, 8)}… · rule set v{data.meta.rule_set_version}</caption>
              <thead>
                <tr><th>Date</th><th>ID</th><th>Description</th><th>Merchant</th><th>Category</th><th>Original amount</th><th>Budget amount</th><th>Type</th><th>Rule</th></tr>
              </thead>
              <tbody>
                {data.transactions.map((row) => (
                  <tr key={`${row.transaction_id}:${row.row}`} className={row.derived?.excluded ? 'is-excluded' : ''}>
                    <td>{row.date || '—'}</td>
                    <td>{row.transaction_id || '—'}</td>
                    <td>{row.description || '—'}</td>
                    <td>{row.merchant || '—'}</td>
                    <td>{row.derived?.category || row.category || '—'}</td>
                    <td className={Number(row.amount_eur) < 0 ? 'is-negative' : ''}>{eur(row.amount_eur)}</td>
                    <td className={Number(row.derived?.effective_budget_amount_eur) < 0 ? 'is-negative' : ''}>{eur(row.derived?.effective_budget_amount_eur)}</td>
                    <td>{row.derived?.type || row.type || '—'}</td>
                    <td>{row.derived?.rule_id ? `${row.derived.rule_id} ${row.derived.action}${row.derived.excluded ? ' (excluded)' : ''}${row.derived.review ? ' (review)' : ''}` : (row.derived?.excluded ? 'excluded' : '—')}{row.derived?.exclusion_reason && <small> · {row.derived.exclusion_reason.replaceAll('_', ' ')}</small>}</td>
                  </tr>
                ))}
                {data.transactions.length === 0 && <tr><td colSpan={9}>No transactions match.</td></tr>}
              </tbody>
            </table>
            <div className="form-actions finance-pager">
              <button className="secondary-button" type="button" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - limit))}>Previous</button>
              <span>Showing {offset + 1}–{Math.min(offset + limit, data.total)} of {data.total}</span>
              <button className="secondary-button" type="button" disabled={offset + limit >= data.total || loading} onClick={() => setOffset(offset + limit)}>Next</button>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
