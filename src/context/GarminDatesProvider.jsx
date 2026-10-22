import { useCallback, useMemo, useState } from 'react'
import { GarminDatesContext } from './GarminDates.js'

export default function GarminDatesProvider({ children }) {
  const [dates, setDates] = useState({})
  const remember = useCallback((tab, value) => setDates((previous) => previous[tab] === value ? previous : { ...previous, [tab]: value }), [])
  const value = useMemo(() => ({ dates, remember }), [dates, remember])
  return <GarminDatesContext.Provider value={value}>{children}</GarminDatesContext.Provider>
}
