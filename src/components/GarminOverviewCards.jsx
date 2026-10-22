import { useState } from 'react'
import GarminResourceCard from './GarminResourceCard.jsx'
import ActivitySummary from './ActivitySummary.jsx'
import useGarminResource from '../hooks/useGarminResource.js'
import { daysBefore, getGarminActivities, getGarminSleep, getGarminSteps } from '../services/garmin.js'

function measurement(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function duration(value) {
  if (measurement(value) === null) return 'Unavailable'
  const minutes = Math.round(value / 60)
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`
}

export function StepsCard({ date, now }) {
  const state = useGarminResource(getGarminSteps, date, now)
  const row = state.current?.data.find((item) => item.calendarDate === date)
  const steps = measurement(row?.totalSteps)
  return <GarminResourceCard id="steps" title="Daily steps" resource="steps" state={state} now={now} description="Movement recorded on the selected date.">
    <p className="garmin-step-total">{steps === null ? '—' : steps.toLocaleString()} <span>steps</span></p>
    {steps === null ? <p>No steps measurement is available for this date.</p> : measurement(row?.stepGoal) > 0 && <p>Daily goal: {row.stepGoal.toLocaleString()} steps</p>}
  </GarminResourceCard>
}

export function SleepCard({ date, now }) {
  const state = useGarminResource(getGarminSleep, date, now)
  const payload = state.current?.data
  const [selection, setSelection] = useState(null)
  const selected = selection?.end === date ? selection.day : date
  const records = Array.isArray(payload) ? payload : []
  const nights = Array.from({ length: 7 }, (_, index) => {
    const day = daysBefore(date, 6 - index)
    const record = records.find((row) => row.calendarDate === day)
    const sleep = record && Object.hasOwn(record, 'dailySleepDTO') ? record.dailySleepDTO : record
    return { day, sleep, total: measurement(sleep?.sleepTimeSeconds) }
  })
  const sleep = nights.find((night) => night.day === selected)?.sleep
  const total = measurement(sleep?.sleepTimeSeconds)
  const overall = measurement(sleep?.sleepScores?.overall?.value)
  const stages = [['Deep', 'deepSleepSeconds'], ['Light', 'lightSleepSeconds'], ['REM', 'remSleepSeconds'], ['Awake', 'awakeSleepSeconds']]
  return <GarminResourceCard id="sleep" title="Sleep" resource="sleep" state={state} now={now} description={`Seven nights ending ${date}. Select a night to explore its sleep stages.`}>
    <SleepChart nights={nights} selected={selected} onSelect={(day) => setSelection({ end: date, day })} />
    <h3 className="sleep-selected-night">Recorded for {selected}</h3>
    {total === null ? <p>No sleep measurement is available for this date.</p> : <>
      <p className="garmin-step-total">{duration(total)} <span>asleep</span></p>
      <p>Sleep score: <strong>{overall !== null && overall <= 100 ? `${overall}/100` : 'Unavailable'}</strong></p>
      <dl className="garmin-sleep-stages">{stages.map(([label, field]) => <div key={field}><dt>{label}</dt><dd>{duration(sleep[field])}</dd></div>)}</dl>
    </>}
  </GarminResourceCard>
}

function SleepChart({ nights, selected, onSelect }) {
  const recorded = nights.filter((night) => night.total !== null)
  const average = recorded.length ? recorded.reduce((sum, night) => sum + night.total, 0) / recorded.length : null
  const maximum = Math.max(8, ...recorded.map((night) => Math.ceil(night.total / 3600)))
  return <div className="sleep-history">
    <p className="sleep-history-summary">{average === null ? 'No sleep recorded in this seven-day window.' : `Average ${duration(average)} across ${recorded.length} recorded night${recorded.length === 1 ? '' : 's'}.`}</p>
    <p className="sleep-chart-scale">Sleep duration · 0–{maximum} hours</p>
    <div className="sleep-chart" role="group" aria-label="Sleep duration over seven days">
      {nights.map(({ day, sleep, total }) => {
        const score = measurement(sleep?.sleepScores?.overall?.value)
        const label = `${day}: ${total === null ? 'No sleep data' : duration(total)}${score !== null && score <= 100 ? `, sleep score ${score}/100` : ''}`
        const clock = new Date(`${day}T12:00:00Z`)
        return <button key={day} type="button" className="sleep-chart-night" aria-label={label} aria-pressed={selected === day} title={label} onClick={() => onSelect(day)}>
          <span className="sleep-chart-track" aria-hidden="true">{total === null ? <span className="sleep-chart-missing">—</span> : <span className="sleep-chart-bar" style={{ height: `${total / (maximum * 3600) * 100}%` }} />}</span>
          <span className="sleep-chart-weekday">{clock.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' })}</span>
          <span className="sleep-chart-date">{clock.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' })}</span>
        </button>
      })}
    </div>
    <p className="sleep-chart-hint">Select a bar for duration, score and stages. A dash means no data; missing nights are excluded from the average.</p>
  </div>
}

export function ActivitiesCard({ date, now }) {
  const state = useGarminResource(getGarminActivities, date, now)
  const activities = state.current?.data || []
  return <GarminResourceCard id="activities" title="Recent activities" resource="activities" state={state} now={now} description={`Latest 5 activities · ${daysBefore(date, 27)} to ${date}, inclusive. Times are activity local time.`}>
    {activities.length ? <ul className="garmin-activity-list">{activities.map((activity) => <ActivitySummary key={activity.activityId} activity={activity} />)}</ul> : <p>No activities were returned for this 28-day period.</p>}
  </GarminResourceCard>
}
