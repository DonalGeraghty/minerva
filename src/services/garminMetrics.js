export function number(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

export function format(value, unit = '', digits = 0) {
  return number(value) === null ? 'Unavailable' : `${value.toLocaleString(undefined, { maximumFractionDigits: digits })}${unit ? ` ${unit}` : ''}`
}

export function object(value) {
  if (typeof value === 'string') { try { value = JSON.parse(value) } catch { return {} } }
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

export function humanize(value) {
  return typeof value === 'string' ? value.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Unavailable'
}

export function sum(values) {
  const recorded = values.map(number).filter((value) => value !== null)
  return recorded.length ? recorded.reduce((total, value) => total + value, 0) : null
}

export function scaled(value, factor) { return number(value) === null ? null : value * factor }

export function timeline(rows, descriptors, key, indexField = 'index', keyField = 'key') {
  if (!Array.isArray(rows) || !Array.isArray(descriptors)) return []
  const normalized = (value) => typeof value === 'string' ? value.toLowerCase().replace(/[^a-z]/g, '') : ''
  const timestamp = descriptors.find((item) => normalized(item?.[keyField]) === 'timestamp')?.[indexField]
  const measurement = descriptors.find((item) => normalized(item?.[keyField]) === normalized(key))?.[indexField]
  if (!Number.isInteger(timestamp) || timestamp < 0 || !Number.isInteger(measurement) || measurement < 0) return []
  return rows.filter((row) => Array.isArray(row) && number(row[timestamp]) !== null && Number.isFinite(new Date(row[timestamp]).getTime())).map((row) => ({
    x: row[timestamp], label: new Date(row[timestamp]).toISOString().slice(11, 16), value: number(row[measurement]),
  })).sort((a, b) => a.x - b.x)
}
