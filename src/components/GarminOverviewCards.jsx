import GarminResourceCard from './GarminResourceCard.jsx'
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
  const sleep = payload && Object.hasOwn(payload, 'dailySleepDTO') ? payload.dailySleepDTO : payload
  const total = measurement(sleep?.sleepTimeSeconds)
  const overall = measurement(sleep?.sleepScores?.overall?.value)
  const stages = [['Deep', 'deepSleepSeconds'], ['Light', 'lightSleepSeconds'], ['REM', 'remSleepSeconds'], ['Awake', 'awakeSleepSeconds']]
  return <GarminResourceCard id="sleep" title="Sleep" resource="sleep" state={state} now={now} description="Main sleep recorded for the selected Garmin calendar date.">
    {total === null ? <p>No sleep measurement is available for this date.</p> : <>
      <p className="garmin-step-total">{duration(total)} <span>asleep</span></p>
      <p>Sleep score: <strong>{overall !== null && overall <= 100 ? `${overall}/100` : 'Unavailable'}</strong></p>
      <dl className="garmin-sleep-stages">{stages.map(([label, field]) => <div key={field}><dt>{label}</dt><dd>{duration(sleep[field])}</dd></div>)}</dl>
    </>}
  </GarminResourceCard>
}

function activityTime(value) {
  if (typeof value !== 'string') return 'Date unavailable'
  // Preserve the recorded local clock rather than interpreting it as UTC.
  return value.replace('T', ' ').slice(0, 16)
}

export function ActivitiesCard({ date, now }) {
  const state = useGarminResource(getGarminActivities, date, now)
  const activities = state.current?.data || []
  return <GarminResourceCard id="activities" title="Recent activities" resource="activities" state={state} now={now} description={`Latest 5 activities · ${daysBefore(date, 27)} to ${date}, inclusive. Times are activity local time.`}>
    {activities.length ? <ul className="garmin-activity-list">{activities.map((activity) => {
      const type = typeof activity.activityType?.typeKey === 'string' ? activity.activityType.typeKey.replaceAll('_', ' ') : 'Activity'
      const distance = measurement(activity.distance)
      return <li key={activity.activityId}>
        <div><h3>{activity.activityName || type}</h3><p>{type} · <span>{activityTime(activity.startTimeLocal)}</span></p></div>
        <dl><div><dt>Duration</dt><dd>{duration(activity.duration)}</dd></div><div><dt>Distance</dt><dd>{distance === null ? 'Unavailable' : `${(distance / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} km`}</dd></div></dl>
      </li>
    })}</ul> : <p>No activities were returned for this 28-day period.</p>}
  </GarminResourceCard>
}
