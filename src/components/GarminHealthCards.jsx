import { useState } from 'react'
import GarminResourceCard from './GarminResourceCard.jsx'
import GarminTrendChart from './GarminTrendChart.jsx'
import useGarminResource from '../hooks/useGarminResource.js'
import { healthLoaders, healthPanels } from '../services/garminHealth.js'
import { daysBefore } from '../services/garmin.js'
import { number, format, object, humanize, sum, scaled } from '../services/garminMetrics.js'

function Metrics({ items }) {
  return <dl className="health-metrics">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
}

function WeekChart({ date, rows, title, unit, value, minimum = 0, maximum }) {
  const points = Array.from({ length: 7 }, (_, index) => {
    const day = daysBefore(date, 6 - index)
    return { label: day, x: index, value: number(value(rows.find((row) => row.calendarDate === day))) }
  })
  return <GarminTrendChart points={points} title={title} unit={unit} minimum={minimum} maximum={maximum} />
}

function Stress({ data, date }) {
  const rows = Array.isArray(data) ? data : []
  const today = rows.find((row) => row.calendarDate === date)?.stress
  return <><Metrics items={[
    ['Average stress', format(today?.avgLevel)], ['Maximum stress', format(today?.maxLevel)], ['Garmin status', humanize(today?.qualifier)],
    ...[['Rest', 'restDurationInMillis'], ['Low stress', 'lowStressDurationInMillis'], ['Medium stress', 'mediumStressDurationInMillis'], ['High stress', 'highStressDurationInMillis']].map(([label, key]) => [label, format(scaled(today?.[key], 1 / 60000), 'min')]),
  ]} /><WeekChart date={date} rows={rows} title="Average stress · seven days" maximum={100} value={(row) => row?.stress?.avgLevel} /></>
}

function Hrv({ data, date }) {
  const rows = Array.isArray(data) ? data : []
  const today = rows.find((row) => row.calendarDate === date)
  const baseline = today?.baseline
  return <><Metrics items={[
    ['Overnight average', format(today?.lastNightAvg, 'ms')], ['Seven-day average HRV', format(today?.weeklyAvg, 'ms')],
    ['Best five minutes', format(today?.lastNight5MinHigh, 'ms')], ['Garmin HRV status', humanize(today?.status)],
    ['Balanced baseline', number(baseline?.balancedLow) !== null && number(baseline?.balancedUpper) !== null ? `${baseline.balancedLow}–${baseline.balancedUpper} ms` : 'Unavailable'],
  ]} /><WeekChart date={date} rows={rows} title="Overnight HRV · seven days" unit="ms" value={(row) => row?.lastNightAvg} /></>
}

function Movement({ data, date }) {
  const rows = Array.isArray(data) ? data : []
  const movement = (row) => object(row?.movement)
  return <><Metrics items={[
    ['Recorded days', String(rows.length)], ['Steps in window', format(sum(rows.map((row) => movement(row).steps?.value)))],
    ['Distance in window', format(scaled(sum(rows.map((row) => movement(row).steps?.distanceInMeters)), .001), 'km', 2)],
    ['Floors climbed', format(sum(rows.map((row) => movement(row).floorsAscended?.value)))],
    ['Moderate intensity minutes', format(sum(rows.map((row) => row.intensityMinutes?.moderate)), 'min')],
    ['Vigorous intensity minutes', format(sum(rows.map((row) => row.intensityMinutes?.vigorous)), 'min')],
  ]} /><WeekChart date={date} rows={rows} title="Daily steps · seven days" unit="steps" value={(row) => movement(row).steps?.value} /><p>Totals include only recorded days in this seven-day window.</p></>
}

function Weight({ data }) {
  const rows = Array.isArray(data?.dailyWeightSummaries) ? data.dailyWeightSummaries : []
  const [selection, setSelection] = useState(null)
  const latest = rows.find((row) => row.summaryDate === selection) ?? rows.at(-1)
  const reading = latest?.latestWeight
  return <>{rows.length ? <label className="health-reading-picker">Measurement date<select value={latest?.summaryDate} onChange={(event) => setSelection(event.target.value)}>{rows.map((row) => <option key={row.summaryDate} value={row.summaryDate}>{row.summaryDate}</option>)}</select></label> : <p>No weight measurements in this 28-day window.</p>}
    <Metrics items={[
      ['Weight', format(reading?.weight, 'kg', 2)], ['BMI', format(reading?.bmi, '', 1)], ['Body fat', format(reading?.bodyFat, '%', 1)], ['Body water', format(reading?.bodyWater, '%', 1)],
      ['Range average weight', format(data?.totalAverage?.weight, 'kg', 2)], ['Metabolic age', format(reading?.metabolicAge, 'years', 1)],
    ]} /><GarminTrendChart points={rows.map((row) => ({ label: row.summaryDate, x: Date.parse(`${row.summaryDate}T00:00:00Z`), value: number(row.latestWeight?.weight) }))} title="Weight · 28-day window" unit="kg" minimum={null} /></>
}

function Hydration({ data, date }) {
  const rows = Array.isArray(data) ? data : []
  const today = rows.find((row) => row.calendarDate === date)
  const intake = number(today?.valueInML), goal = number(today?.goalInML)
  return <><Metrics items={[
    ['Recorded intake', format(intake, 'ml')], ['Garmin goal', format(goal, 'ml')], ['Sweat loss', format(today?.sweatLossInML, 'ml')], ['Activity intake', format(today?.activityIntakeInML, 'ml')],
  ]} />{intake !== null && goal > 0 && <><progress max={goal} value={Math.min(intake, goal)} aria-label="Hydration goal progress" /><p>{format(intake / goal * 100, '%')} of recorded Garmin goal</p></>}
    <WeekChart date={date} rows={rows} title="Recorded hydration · seven days" unit="ml" value={(row) => row?.valueInML} /></>
}

const views = { stress: Stress, hrv: Hrv, movement: Movement, weight: Weight, hydration: Hydration }

export default function GarminHealthCard({ resource, date, now }) {
  const state = useGarminResource(healthLoaders[resource], date, now)
  const View = views[resource]
  const title = healthPanels.find(([id]) => id === resource)[1]
  const description = `${resource === 'weight' ? '28' : '7'}-day window ending ${date}. Missing measurements remain unavailable.`
  return <GarminResourceCard id={resource} title={title} resource={resource} state={state} now={now} description={description}><View key={date} data={state.current?.data} date={date} /></GarminResourceCard>
}
