import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import ActivitySummary from './ActivitySummary.jsx'

afterEach(cleanup)

function show(activity) {
  return render(<ul><ActivitySummary activity={{ activityId: 1, activityName: 'Test activity', ...activity }} /></ul>)
}

function metric(name) {
  return screen.getByText(name, { selector: 'dt' }).nextElementSibling
}

describe('Activity details', () => {
  it.each([
    ['running', 2.669, 'Average pace (min/km)', '6:15'],
    ['indoor_rowing', 4, 'Average pace (min/500 m)', '2:05'],
    ['lap_swimming', 1.25, 'Average pace (min/100 m)', '1:20'],
  ])('uses the correct pace distance for %s', (typeKey, averageSpeed, name, expected) => {
    show({ activityType: { typeKey }, averageSpeed })
    expect(metric(name)).toHaveTextContent(expected)
  })

  it('converts walking measurements and opens details without fetching more data', async () => {
    const user = userEvent.setup()
    show({ activityType: { typeKey: 'walking' }, startTimeLocal: '2026-10-14 12:38:00',
      distance: 5025.59, duration: 4148.61, movingDuration: 3777, elapsedDuration: 4148.61,
      averageSpeed: 1.211, averageHR: 100, maxHR: 123, calories: 367,
      elevationGain: 56, elevationLoss: 57, steps: 6764, averageRunningCadenceInStepsPerMinute: 94.0625,
      aerobicTrainingEffect: 1.200000047, anaerobicTrainingEffect: 0, activityTrainingLoad: 11.14198,
      differenceBodyBattery: -2, trainingEffectLabel: 'RECOVERY',
      hrTimeInZone_1: 3565.57, hrTimeInZone_2: 6.999, hrTimeInZone_3: 0,
    })
    expect(metric('Distance')).toHaveTextContent('5.03 km')
    expect(metric('Duration')).toHaveTextContent('1h 9m 9s')
    expect(metric('Average heart rate')).toHaveTextContent('100 bpm')
    expect(metric('Calories')).toHaveTextContent('367 kcal')
    const summary = screen.getByText('Activity details · Test activity')
    expect(summary.parentElement).not.toHaveAttribute('open')
    await user.click(summary)
    expect(summary.parentElement).toHaveAttribute('open')
    expect(metric('Moving time')).toHaveTextContent('1h 2m 57s')
    expect(metric('Average pace (min/km)')).toHaveTextContent('13:46')
    expect(metric('Average speed')).toHaveTextContent('4.4 km/h')
    expect(metric('Ascent')).toHaveTextContent('56 m')
    expect(metric('Steps')).toHaveTextContent('6,764')
    expect(metric('Aerobic effect')).toHaveTextContent('1.2')
    expect(metric('Anaerobic effect')).toHaveTextContent('0')
    expect(metric('Body Battery change')).toHaveTextContent('-2 points')
    const zones = within(screen.getByRole('region', { name: 'Heart rate zones' }))
    expect(zones.getByText('59m 26s')).toBeInTheDocument()
    expect(zones.getByText('7s')).toBeInTheDocument()
    expect(zones.getByText('0s')).toBeInTheDocument()
  })

  it('shows rowing and strength data, preserving zeros without inventing pace', async () => {
    const user = userEvent.setup()
    show({ activityType: { typeKey: 'indoor_rowing' }, distance: 0, averageSpeed: 0,
      movingDuration: 0, strokes: 464, maxStrokeCadence: 33,
      totalSets: 8, totalReps: 61, activeSets: 8,
      summarizedExerciseSets: [{ subCategory: 'GOBLET_SQUAT', maxWeight: 14000, duration: 166748, sets: 3, reps: 23 }],
    })
    expect(metric('Distance')).toHaveTextContent('0 km')
    expect(metric('Moving time')).toHaveTextContent('0s')
    expect(metric('Strokes')).toHaveTextContent('464')
    expect(metric('Maximum stroke cadence')).toHaveTextContent('33 strokes/min')
    expect(metric('Total sets')).toHaveTextContent('8')
    expect(screen.queryByText('Average pace (min/500 m)')).not.toBeInTheDocument()
    await user.click(screen.getByText('Activity details · Test activity'))
    const table = within(screen.getByRole('table'))
    expect(table.getByText('Goblet Squat')).toBeInTheDocument()
    expect(table.getByText('14 kg')).toBeInTheDocument()
    expect(table.getByText('2m 47s')).toBeInTheDocument()
  })

  it('handles missing and malformed optional fields without NaN or misleading zero values', () => {
    const { container } = show({ distance: null, duration: -1, averageHR: '100', calories: Infinity,
      averageSpeed: 0, elevationGain: -1, differenceBodyBattery: -4,
      hrTimeInZone_1: null, summarizedExerciseSets: [null, false, 'invalid'],
    })
    for (const name of ['Distance', 'Duration', 'Average heart rate', 'Calories']) expect(metric(name)).toHaveTextContent('Unavailable')
    expect(screen.queryByText('Ascent')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Heart rate zones' })).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(container.textContent).not.toMatch(/NaN|Infinity/)
  })
})
