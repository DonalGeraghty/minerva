import { Link } from 'react-router-dom'
import { freshnessText } from '../services/garmin.js'

export default function GarminResourceCard({ id, title, resource, state, now, description, children, footer }) {
  const { current, error, busy, warning, code, cooldown, stale, reconnect, refresh } = state
  return <section id={id} className={`garmin-panel garmin-card garmin-${resource}-card`} aria-labelledby={`${id}-heading`} aria-busy={busy}>
    <header><h2 id={`${id}-heading`}>{title}</h2><span className="garmin-badge">{busy ? 'Loading…' : stale ? 'Needs refresh' : current ? 'Up to date' : 'Not loaded'}</span></header>
    <div className="garmin-card-toolbar"><p>{description}</p><button className="secondary-button" type="button" disabled={busy || cooldown > 0} onClick={refresh}>{busy && current ? 'Refreshing…' : cooldown ? `Refresh in ${cooldown}s` : `Refresh ${resource}`}</button></div>
    {current && <>
      {children}
      <p className="garmin-freshness"><time dateTime={new Date(current.meta.fetched_at * 1000).toISOString()} title={new Date(current.meta.fetched_at * 1000).toLocaleString()}>{freshnessText(current.meta.fetched_at, now)}</time><span>{stale ? 'Saved data · may be out of date' : current.meta.source === 'cache' ? 'Saved copy' : 'Fetched from Garmin'}</span></p>
      <details><summary>Exact update time and returned data</summary><p>{new Date(current.meta.fetched_at * 1000).toLocaleString()}</p><pre>{JSON.stringify(current.data, null, 2)}</pre></details>
    </>}
    {busy && !current && <p role="status">Loading {resource}…</p>}
    {warning && <p className="settings-message is-error" role="alert">{current ? 'Showing saved data. ' : ''}{warning}</p>}
    {reconnect && <p><Link to="/account">{code === 'garmin_connection_required' ? 'Connect Garmin in Account' : 'Replace your Garmin key in Account'}</Link></p>}
    {!current && error && !reconnect && <p>The other dashboard sections remain available. You can retry this section.</p>}
    {footer}
  </section>
}
