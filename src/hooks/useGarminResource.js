import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

export default function useGarminResource(load, date, now) {
  const { user, logout } = useAuth()
  const [request, setRequest] = useState(() => ({ date, refresh: false, version: 0 }))
  const [result, setResult] = useState(null)
  const [failure, setFailure] = useState(null)
  const [busy, setBusy] = useState(true)
  const [retryAt, setRetryAt] = useState(0)
  const key = `${user?.accountId}:${date}`

  useEffect(() => {
    const controller = new AbortController()
    setBusy(true)
    setFailure(null)
    setRetryAt(0)
    load(date, { refresh: request.date === date && request.refresh, signal: controller.signal }).then((data) => {
      if (controller.signal.aborted) return
      setResult({ ...data, key })
      const delay = data.meta.warning?.retry_after || (data.meta.source === 'garmin' ? 10 : 0)
      setRetryAt(delay > 0 ? Date.now() + delay * 1000 : 0)
    }).catch((error) => {
      if (controller.signal.aborted) return
      if (error.status === 401) logout()
      else {
        if (['garmin_connection_changed', 'garmin_connection_required', 'account_unavailable'].includes(error.code)) setResult(null)
        setFailure({ error, key })
        setRetryAt(error.retryAfter > 0 ? Date.now() + error.retryAfter * 1000 : 0)
      }
    }).finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [date, key, load, logout, request])

  const current = result?.key === key ? result : null
  const error = failure?.key === key ? failure.error : null
  const warning = error?.message || current?.meta.warning?.message
  const code = error?.code || current?.meta.warning?.code
  return {
    current, error, busy, warning, code,
    cooldown: Math.max(0, Math.ceil((retryAt - now) / 1000)),
    stale: Boolean(current && (error || current.meta.stale || now / 1000 >= current.meta.fresh_until)),
    reconnect: ['garmin_connection_required', 'garmin_reconnect_required'].includes(code),
    refresh: () => setRequest((previous) => ({ date, refresh: true, version: previous.version + 1 })),
  }
}
