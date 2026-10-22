import { useCallback, useEffect, useState } from 'react'
import useGarminResource from '../hooks/useGarminResource.js'
import { getActivityDetail } from '../services/garminHealth.js'
import { format, scaled, humanize, object } from '../services/garminMetrics.js'
import GarminResourceCard from './GarminResourceCard.jsx'

function ReturnedFields({ value, depth = 0 }) {
  if (value === null || value === undefined) return <span>Unavailable</span>
  if (typeof value !== 'object') return <span>{String(value)}</span>
  if (depth >= 3) return <pre>{JSON.stringify(value, null, 2)}</pre>
  if (Array.isArray(value)) return <ol>{value.map((item, index) => <li key={index}><ReturnedFields value={item} depth={depth + 1} /></li>)}</ol>
  return <dl className="health-metrics">{Object.entries(value).map(([key, item]) => <div key={key}><dt>{humanize(key.replace(/([a-z])([A-Z])/g, '$1 $2'))}</dt><dd><ReturnedFields value={item} depth={depth + 1} /></dd></div>)}</dl>
}

function ActivityRead({ activityId, workouts, now }) {
  const load = useCallback((_, options) => getActivityDetail(activityId, workouts, options), [activityId, workouts])
  const state = useGarminResource(load, String(activityId), now)
  const data = state.current?.data
  const summary = object(data?.summaryDTO)
  const splits = Array.isArray(data?.splitSummaries) ? data.splitSummaries.filter((row) => row && typeof row === 'object') : []
  const name = workouts ? 'Associated workouts' : 'Full activity measurements'
  return <GarminResourceCard id={`activity-${activityId}-${workouts ? 'workouts' : 'summary'}`} title={name} resource={workouts ? 'workouts' : 'activity summary'} state={state} now={now} description={workouts ? 'Workouts returned by Garmin for this activity.' : 'Detailed measurements and split summaries from Garmin.'}>
    {workouts ? <>{Array.isArray(data) && data.length ? <ReturnedFields value={data} /> : <p>No workouts are associated with this activity.</p>}</> : <>
      {data ? <><p>{typeof data.description === 'string' ? data.description : 'Recorded activity measurements.'}</p>
        <dl className="health-metrics">{[
          ['Distance', format(scaled(summary.distance, .001), 'km', 2)], ['Duration', format(scaled(summary.duration, 1 / 60), 'min', 1)],
          ['Moving time', format(scaled(summary.movingDuration, 1 / 60), 'min', 1)], ['Average heart rate', format(summary.averageHR, 'bpm')],
          ['Average speed', format(scaled(summary.averageSpeed, 3.6), 'km/h', 1)], ['Average power', format(summary.averagePower ?? summary.avgPower, 'W')],
        ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        {splits.length ? <div className="activity-table-scroll"><table><caption>Recorded split summaries · groups may overlap</caption><thead><tr><th scope="col">Split</th><th scope="col">Distance</th><th scope="col">Duration</th><th scope="col">Average HR</th></tr></thead><tbody>{splits.map((split, index) => <tr key={index}><th scope="row">{typeof split.splitType === 'string' ? humanize(split.splitType) : `Split ${index + 1}`}</th><td>{format(scaled(split.distance, .001), 'km', 2)}</td><td>{format(scaled(split.duration, 1 / 60), 'min', 1)}</td><td>{format(split.averageHR, 'bpm')}</td></tr>)}</tbody></table></div> : <p>No split summaries returned for this activity.</p>}
        <details><summary>All recorded measurements</summary><ReturnedFields value={summary} /></details>
      </> : <p>No detailed measurements available for this activity.</p>}
    </>}
  </GarminResourceCard>
}

export default function FullActivityDetails({ activityId }) {
  // Each resource hook owns its requests; closing this view aborts both reads.
  const [now, setNow] = useState(Date.now)
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer) }, [])
  return <div className="full-activity-details"><ActivityRead activityId={activityId} workouts={false} now={now} /><ActivityRead activityId={activityId} workouts now={now} /></div>
}
