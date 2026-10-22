import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Brand from '../components/Brand.jsx'
import { ActivitiesCard, SleepCard, StepsCard } from '../components/GarminOverviewCards.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { localDate } from '../services/garmin.js'
import GarminHealthCard from '../components/GarminHealthCards.jsx'
import DashboardPanels from '../components/DashboardPanels.jsx'
import useDashboardPanels from '../hooks/useDashboardPanels.js'
import { overviewPanels } from '../services/garminHealth.js'
import GarminSummaryCard from '../components/GarminSummaryCards.jsx'
import { useGarminDate } from '../context/GarminDates.js'

const tabs = {
  overview: { title: 'Overview.', description: 'A quick look at your day. Open a summary to explore its charts and details.' },
  recovery: { title: 'Recovery.', description: 'Sleep, Body Battery, stress and HRV, with room to explore the patterns.' },
  activities: { title: 'Activities.', description: 'Recent activities, detailed measurements, split summaries and associated workouts.' },
  health: { title: 'Health.', description: 'Heart rate, weight, hydration and fitness age.' },
  movement: { title: 'Movement.', description: 'Daily steps and your week of distance, floors and intensity minutes.' },
}

export default function GarminPage({ tab = 'overview' }) {
  const { user, logout } = useAuth()
  const preferences = useDashboardPanels(tab === 'overview' ? user : null, logout)
  const [date, setDate] = useGarminDate(tab)
  const [now, setNow] = useState(Date.now)
  const location = useLocation()
  const visible = overviewPanels.filter(([id]) => preferences.current?.panels.includes(id))

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
        <DashboardPanels key={user?.accountId} preferences={preferences} logout={logout} />
        {preferences.current && <div className="garmin-overview-grid overview-summary-grid" key={user?.accountId}>
          {visible.map(([resource]) => <GarminSummaryCard key={resource} resource={resource} date={date} now={now} />)}
          {visible.length === 0 && <p>No overview summaries selected. Use Manage panels to choose what appears. Detailed tabs remain available.</p>}
        </div>}
      </> : <div className="garmin-overview-grid" key={`${user?.accountId}:${tab}`}>
        {tab === 'recovery' && <><SleepCard date={date} now={now} />{['body-battery', 'stress', 'hrv'].map((resource) => <GarminHealthCard key={resource} resource={resource} date={date} now={now} />)}</>}
        {tab === 'activities' && <ActivitiesCard date={date} now={now} />}
        {tab === 'health' && ['heart-rate', 'weight', 'hydration', 'fitness-age'].map((resource) => <GarminHealthCard key={resource} resource={resource} date={date} now={now} />)}
        {tab === 'movement' && <><StepsCard date={date} now={now} /><GarminHealthCard resource="movement" date={date} now={now} /></>}
      </div>}
    </>}
  </main>
}
