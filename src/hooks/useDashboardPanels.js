import { useEffect, useState } from 'react'
import { defaultPanels, getPanelPreferences } from '../services/garminHealth.js'

export default function useDashboardPanels(user, logout) {
  const [state, setState] = useState(null)
  const [version, setVersion] = useState(0)
  const key = user?.accountId
  useEffect(() => {
    if (!key || user?.isDemo) return
    const controller = new AbortController()
    getPanelPreferences(controller.signal).then((data) => {
      if (!controller.signal.aborted) setState({ key, panels: data.preferences.visible_panels, message: '' })
    }).catch((error) => {
      if (controller.signal.aborted) return
      if (error.status === 401) logout()
      else setState({ key, panels: defaultPanels, message: 'Could not load saved panels. Showing defaults; retry to load your choices.' })
    })
    return () => controller.abort()
  }, [key, user?.isDemo, logout, version])
  const current = state?.key === key ? state : null
  return { current, setState, key, retry: () => setVersion((value) => value + 1) }
}
