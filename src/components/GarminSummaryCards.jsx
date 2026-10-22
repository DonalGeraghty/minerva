import { Link } from 'react-router-dom'
import GarminResourceCard from './GarminResourceCard.jsx'
import useGarminResource from '../hooks/useGarminResource.js'
import { getGarminSteps, getGarminSleep, getGarminActivities } from '../services/garmin.js'
import { healthLoaders } from '../services/garminHealth.js'
import { number, format, scaled, timeline } from '../services/garminMetrics.js'

const summaries = {
  steps: { title: 'Daily steps', load: getGarminSteps, path: '/movement', anchor: 'steps', link: 'View steps in Movement', description: 'Movement recorded on the selected date.' },
  sleep: { title: 'Sleep', load: getGarminSleep, path: '/recovery', anchor: 'sleep', link: 'View sleep in Recovery', description: 'Main sleep recorded for the selected Garmin calendar date.' },
  'body-battery': { title: 'Body Battery', load: healthLoaders['body-battery'], path: '/recovery', anchor: 'body-battery', link: 'View Body Battery in Recovery', description: 'Your latest recorded energy level for the selected day.' },
  'heart-rate': { title: 'Heart rate', load: healthLoaders['heart-rate'], path: '/health', anchor: 'heart-rate', link: 'View heart rate in Health', description: 'Resting heart rate for the selected day.' },
  activities: { title: 'Latest activity', load: getGarminActivities, path: '/activities', anchor: 'activities', link: 'View recent activities', description: 'Latest activity within the 28-day window ending on the selected date.' },
}

function sleepDuration(value) {
  if (number(value) === null) return 'Unavailable'
  const minutes = Math.round(value / 60)
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`
}

function SummaryValue({ resource, data, date }) {
  if (resource === 'steps') {
    const row = data?.find((item) => item.calendarDate === date)
    return <>{number(row?.totalSteps) === null ? <p>No steps measurement is available for this date.</p> : null}<p className="overview-summary-value">{number(row?.totalSteps) === null ? '—' : format(row.totalSteps)} <span>steps</span></p>{number(row?.stepGoal) > 0 && <p>Daily goal: {format(row.stepGoal)} steps</p>}</>
  }
  if (resource === 'sleep') {
    const record = Array.isArray(data) ? data.find((row) => row.calendarDate === date) : null
    const sleep = record?.dailySleepDTO ?? record
    const score = number(sleep?.sleepScores?.overall?.value)
    return number(sleep?.sleepTimeSeconds) === null ? <p>No sleep measurement is available for this date.</p> : <><p className="overview-summary-value">{sleepDuration(sleep.sleepTimeSeconds)}</p><p>Sleep score: {score !== null && score <= 100 ? `${score}/100` : 'Unavailable'}</p></>
  }
  if (resource === 'body-battery') {
    const report = data?.reports?.find((row) => row.date === date)
    const points = timeline(report?.bodyBatteryValuesArray, report?.bodyBatteryValueDescriptorDTOList, 'bodyBatteryLevel', 'bodyBatteryValueDescriptorIndex', 'bodyBatteryValueDescriptorKey')
    const latest = data?.summary?.bodyBatteryMostRecentValue ?? points.filter((point) => point.value !== null).at(-1)?.value
    return <><p className="overview-summary-value">{format(latest)} <span>/100</span></p><p>Charged {format(report?.charged, 'points')} · Drained {format(report?.drained, 'points')}</p>{data?.summary_warning && <p>{data.summary_warning}</p>}</>
  }
  if (resource === 'heart-rate') return <><p className="overview-summary-value">{format(data?.daily?.restingHeartRate)} <span>bpm resting</span></p><p>Seven-day average: {format(data?.daily?.lastSevenDaysAvgRestingHeartRate, 'bpm')}</p></>
  const activity = Array.isArray(data) ? data[0] : null
  return activity ? <><h3 className="overview-activity-name">{activity.activityName || 'Activity'}</h3><p>{typeof activity.startTimeLocal === 'string' ? activity.startTimeLocal.replace('T', ' ').slice(0, 16) : 'Date unavailable'} · activity local time</p><p>{sleepDuration(activity.duration)} · {format(scaled(activity.distance, .001), 'km', 2)}</p></> : <p>No activities were returned for this 28-day period.</p>
}

export default function GarminSummaryCard({ resource, date, now }) {
  const summary = summaries[resource]
  const state = useGarminResource(summary.load, date, now)
  return <GarminResourceCard id={`overview-${resource}`} title={summary.title} resource={resource} state={state} now={now} description={summary.description} footer={<p className="overview-summary-link"><Link to={`${summary.path}?date=${date}#${summary.anchor}`}>{summary.link} →</Link></p>}>
    <SummaryValue resource={resource} data={state.current?.data} date={date} />
  </GarminResourceCard>
}
