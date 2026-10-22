import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Brand from '../components/Brand.jsx'
import { ActivitiesCard, SleepCard, StepsCard } from '../components/GarminOverviewCards.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { localDate } from '../services/garmin.js'
import GarminHealthCard from '../components/GarminHealthCards.jsx'
import DashboardPanels from '../components/DashboardPanels.jsx'
import useDashboardPanels from '../hooks/useDashboardPanels.js'
import { dashboardPanels } from '../services/garminHealth.js'
import { useGarminDate } from '../context/GarminDates.js'

const tabs = {
  overview: { title: 'Dashboard.', description: 'Steps, sleep, stress, HRV, movement, weight and hydration, together in one place.' },
  activities: { title: 'Activities.', description: 'Recent activities, detailed measurements, split summaries and associated workouts.' },
}

export default function GarminPage({ tab = 'overview' }) {
  const { user, logout } = useAuth()
  const preferences = useDashboardPanels(tab === 'overview' ? user : null, logout)
  const [date, setDate] = useGarminDate(tab)
  const [now, setNow] = useState(Date.now)
  const location = useLocation()
  const visible = dashboardPanels.filter(([id]) => preferences.current?.panels.includes(id))

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const target = location.hash ? document.getElementById(location.hash.slice(1)) : document.querySelector('main')
    target?.scrollIntoView?.({ block: 'start' })
  }, [tab, location.hash])

  return <main className="page garmin-page"><Brand />
    <section className="garmin-hero"><p className="eyebrow">Garmin / {tab === 'overview' ? 'your day' : tab}</p><h1>{tabs[tab].title}</h1><p>{tabs[tab].description}</p></section>
    {user?.isDemo ? <section className="garmin-panel"><h2>Connect your Garmin account.</h2><p>Sign in with a real Janus account to connect Garmin and view your own measurements. This demo does not contact Garmin.</p></section> : <>
      <div className="garmin-date-controls"><label htmlFor="garmin-date">Calendar date<input id="garmin-date" type="date" value={date} max={localDate()} required onChange={(event) => { if (event.target.value) setDate(event.target.value) }} /></label></div>
      {tab === 'overview' ? <>
        <DashboardPanels key={`panels:${user?.accountId}`} preferences={preferences} logout={logout} />
        {preferences.current && <div className="garmin-overview-grid" key={user?.accountId}>
          {visible.map(([resource]) => resource === 'steps' ? <StepsCard key={resource} date={date} now={now} /> : resource === 'sleep' ? <SleepCard key={resource} date={date} now={now} /> : <GarminHealthCard key={resource} resource={resource} date={date} now={now} />)}
          {visible.length === 0 && <p>No dashboard panels selected. Use Manage panels to choose what appears. Activities remains available in its own tab.</p>}
        </div>}
      </> : <div className="garmin-overview-grid" key={`${user?.accountId}:${tab}`}>
        {tab === 'activities' && <ActivitiesCard date={date} now={now} />}
      </div>}
    </>}
  </main>
}
