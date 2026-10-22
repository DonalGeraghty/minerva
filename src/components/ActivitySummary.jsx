function numeric(value, signed = false) {
  return typeof value === 'number' && Number.isFinite(value) && (signed || value >= 0) ? value : null
}

function amount(value, unit = '', decimals = 0, signed = false) {
  if (numeric(value, signed) === null) return null
  const formatted = value.toLocaleString(undefined, { maximumFractionDigits: decimals })
  return `${signed && value > 0 ? '+' : ''}${formatted}${unit ? ` ${unit}` : ''}`
}

function time(value) {
  if (numeric(value) === null) return null
  const seconds = Math.round(value)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor(seconds % 3600 / 60)
  const remainder = seconds % 60
  return [hours ? `${hours}h` : '', minutes || hours ? `${minutes}m` : '', remainder || !seconds ? `${remainder}s` : ''].filter(Boolean).join(' ')
}

function label(value) {
  return typeof value === 'string' ? value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : null
}

function converted(value, factor, unit, decimals = 1) {
  return numeric(value) === null ? null : amount(value * factor, unit, decimals)
}

function pace(speed, metres) {
  if (numeric(speed) === null || speed <= 0) return null
  const seconds = Math.round(metres / speed)
  if (!Number.isFinite(seconds)) return null
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function Metrics({ items, className = '' }) {
  return <dl className={`activity-metrics ${className}`}>{items.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value ?? 'Unavailable'}</dd></div>)}</dl>
}

function MetricGroup({ title, items }) {
  const available = items.filter(([, value]) => value !== null)
  return available.length ? <section className="activity-detail-group"><h4>{title}</h4><Metrics items={available} /></section> : null
}

function HeartRateZones({ activity }) {
  const zones = Array.from({ length: 5 }, (_, index) => ({ zone: index + 1, seconds: numeric(activity[`hrTimeInZone_${index + 1}`]) }))
  const total = zones.reduce((sum, item) => sum + (item.seconds ?? 0), 0)
  if (zones.every((item) => item.seconds === null)) return null
  return <section className="activity-detail-group activity-heart-zones" aria-label="Heart rate zones">
    <h4>Heart rate zones</h4>
    <p>Bars show the share of recorded time in each zone. Zone time may differ from activity duration.</p>
    {zones.map(({ zone, seconds }) => <div className="activity-zone" key={zone}>
      <span>Zone {zone}</span><span className="activity-zone-track" aria-hidden="true"><span style={{ width: `${total && seconds !== null ? seconds / total * 100 : 0}%` }} /></span><span>{time(seconds) ?? 'Unavailable'}</span>
    </div>)}
  </section>
}

function ExerciseSummaries({ exercises }) {
  if (!Array.isArray(exercises)) return null
  const rows = exercises.filter((exercise) => exercise && typeof exercise === 'object' && !Array.isArray(exercise))
  if (!rows.length) return null
  return <section className="activity-detail-group activity-exercises"><h4>Exercise summaries</h4>
    <div className="activity-table-scroll"><table><caption>Totals for each recorded exercise group</caption><thead><tr><th scope="col">Exercise</th><th scope="col">Sets</th><th scope="col">Reps</th><th scope="col">Max weight</th><th scope="col">Duration</th></tr></thead>
      <tbody>{rows.map((exercise, index) => <tr key={index}><th scope="row">{label(exercise.subCategory) || label(exercise.category) || 'Exercise'}</th><td>{amount(exercise.sets) ?? '—'}</td><td>{amount(exercise.reps) ?? '—'}</td><td>{converted(exercise.maxWeight, .001, 'kg') ?? '—'}</td><td>{numeric(exercise.duration) === null ? '—' : time(exercise.duration / 1000)}</td></tr>)}</tbody>
    </table></div>
  </section>
}

export default function ActivitySummary({ activity }) {
  const typeKey = typeof activity.activityType?.typeKey === 'string' ? activity.activityType.typeKey : ''
  const type = label(typeKey) || 'Activity'
  const started = typeof activity.startTimeLocal === 'string' ? activity.startTimeLocal.replace('T', ' ').slice(0, 16) : 'Date unavailable'
  const paceMetres = /running|walking|hiking/.test(typeKey) ? 1000 : /rowing/.test(typeKey) ? 500 : /swimming/.test(typeKey) ? 100 : null
  const averagePace = paceMetres === null ? null : pace(activity.averageSpeed, paceMetres)
  const title = typeof activity.activityName === 'string' && activity.activityName ? activity.activityName : type
  return <li className="activity-summary">
    <div className="activity-summary-heading"><h3>{title}</h3><p>{type} · <span>{started}</span>{typeof activity.locationName === 'string' && activity.locationName ? ` · ${activity.locationName}` : ''}</p></div>
    <Metrics className="activity-primary-metrics" items={[
      ['Duration', time(activity.duration)], ['Distance', converted(activity.distance, .001, 'km', 2)],
      ['Average heart rate', amount(activity.averageHR, 'bpm')], ['Calories', amount(activity.calories, 'kcal')],
    ]} />
    <details className="activity-details"><summary>Activity details · {title}</summary>
      <div className="activity-detail-grid">
        <MetricGroup title="Time and movement" items={[
          ['Moving time', time(activity.movingDuration)], ['Elapsed time', time(activity.elapsedDuration)],
          [`Average pace (${paceMetres === 1000 ? 'min/km' : `min/${paceMetres} m`})`, averagePace],
          ['Average speed', converted(activity.averageSpeed, 3.6, 'km/h')], ['Maximum speed', converted(activity.maxSpeed, 3.6, 'km/h')],
          ['Ascent', amount(activity.elevationGain, 'm')], ['Descent', amount(activity.elevationLoss, 'm')],
          ['Steps', amount(activity.steps)], ['Laps', amount(activity.lapCount)],
        ]} />
        <MetricGroup title="Training and recovery" items={[
          ['Training focus', label(activity.trainingEffectLabel)], ['Training load', amount(activity.activityTrainingLoad, '', 1)],
          ['Aerobic effect', amount(activity.aerobicTrainingEffect, '', 1)], ['Anaerobic effect', amount(activity.anaerobicTrainingEffect, '', 1)],
          ['Maximum heart rate', amount(activity.maxHR, 'bpm')], ['Body Battery change', amount(activity.differenceBodyBattery, 'points', 0, true)],
          ['Moderate intensity', amount(activity.moderateIntensityMinutes, 'min')], ['Vigorous intensity', amount(activity.vigorousIntensityMinutes, 'min')],
          ['Estimated water', amount(activity.waterEstimated, 'ml')],
        ]} />
        <MetricGroup title="Sport metrics" items={[
          ['Average step cadence', amount(activity.averageRunningCadenceInStepsPerMinute, 'steps/min')],
          ['Maximum step cadence', amount(activity.maxRunningCadenceInStepsPerMinute, 'steps/min')],
          ['Average cycling cadence', amount(activity.averageBikingCadenceInRevPerMinute, 'rpm')],
          ['Maximum cycling cadence', amount(activity.maxBikingCadenceInRevPerMinute, 'rpm')],
          ['Average stroke cadence', amount(activity.avgStrokeCadence, 'strokes/min')], ['Maximum stroke cadence', amount(activity.maxStrokeCadence, 'strokes/min')],
          ['Strokes', amount(activity.strokes)], ['Stride length', amount(activity.avgStrideLength, 'cm', 1)],
          ['Ground contact time', amount(activity.avgGroundContactTime, 'ms')], ['Vertical oscillation', amount(activity.avgVerticalOscillation, 'cm', 1)],
          ['Average power', amount(activity.avgPower, 'W')], ['Maximum power', amount(activity.maxPower, 'W')], ['Normalized power', amount(activity.normPower, 'W')],
          ['Total sets', amount(activity.totalSets)], ['Active sets', amount(activity.activeSets)], ['Total reps', amount(activity.totalReps)],
        ]} />
        <HeartRateZones activity={activity} />
      </div>
      <ExerciseSummaries exercises={activity.summarizedExerciseSets} />
    </details>
  </li>
}
