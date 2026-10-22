import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { localDate } from '../services/garmin.js'

export const GarminDatesContext = createContext(null)

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || value > localDate()) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export function useGarminDate(tab) {
  const shared = useContext(GarminDatesContext)
  const [localDates, setLocalDates] = useState({})
  const rememberLocal = useCallback((key, value) => setLocalDates((previous) => previous[key] === value ? previous : { ...previous, [key]: value }), [])
  const remember = shared?.remember || rememberLocal
  const [parameters, setParameters] = useSearchParams()
  const requested = parameters.get('date')
  const queryDate = validDate(requested) ? requested : null
  const date = queryDate || (shared?.dates || localDates)[tab] || localDate()
  useEffect(() => { if (queryDate) remember(tab, queryDate) }, [queryDate, tab, remember])
  function selectDate(value) {
    if (!validDate(value)) return
    remember(tab, value)
    setParameters((previous) => { const next = new URLSearchParams(previous); next.set('date', value); return next }, { replace: true })
  }
  return [date, selectDate]
}
