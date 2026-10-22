import { useEffect, useState } from 'react'
import Brand from '../components/Brand.jsx'
import { ActivitiesCard, SleepCard, StepsCard } from '../components/GarminOverviewCards.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { localDate } from '../services/garmin.js'

export default function GarminPage() {
  const { user } = useAuth()
  const [date, setDate] = useState(localDate)
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return <main className="page garmin-page"><Brand />
    <section className="garmin-hero"><p className="eyebrow">Garmin / movement and recovery</p><h1>Overview.</h1><p>Your daily steps, sleep, and recent activities. Every card updates independently.</p></section>
    {user?.isDemo ? <section className="garmin-panel"><h2>Connect your Garmin account.</h2><p>Sign in with a real Janus account to connect Garmin and view your own measurements. This demo does not contact Garmin.</p></section> : <>
      <div className="garmin-date-controls"><label htmlFor="garmin-date">Calendar date<input id="garmin-date" type="date" value={date} max={localDate()} required onChange={(event) => { if (event.target.value) setDate(event.target.value) }} /></label></div>
      <div className="garmin-overview-grid" key={user?.accountId}><StepsCard date={date} now={now} /><SleepCard date={date} now={now} /><ActivitiesCard date={date} now={now} /></div>
    </>}
  </main>
}
