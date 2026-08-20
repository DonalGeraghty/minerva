import { useState } from 'react'
import { Link } from 'react-router-dom'
import AISettings from '../components/AISettings.jsx'
import Brand from '../components/Brand.jsx'
import MinervaContextSettings from '../components/MinervaContextSettings.jsx'
import { useAuth } from '../context/AuthContext.jsx'

export default function AccountPage() {
  const { user, deleteAccount } = useAuth()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const removeAccount = async (event) => {
    event.preventDefault()
    if (!password) return setError('Enter your password to confirm.')
    if (!window.confirm('Delete your account permanently? All Minerva, Nyx, and Aether server data for this Janus account will be removed.')) return
    setBusy(true)
    setError('')
    try {
      await deleteAccount(password)
    } catch (requestError) {
      setError(requestError.message || 'Could not delete account')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="page account-page">
      <Brand />
      <section className="account-hero"><div><p className="eyebrow">Identity · connections</p><h1>Account.</h1></div><div className="account-identity"><span>Signed in as</span><strong>{user?.email}</strong><Link to="/">← Back to Minerva</Link></div></section>
      <AISettings />
      <MinervaContextSettings />
      {user?.isDemo ? <section className="demo-account-note"><p className="settings-kicker">Local demo</p><h2>Safe to explore.</h2><p>Cards are kept only in this browser. Sign out to return to the normal Minerva sign-in screen.</p></section> : <section className="danger-card" aria-labelledby="danger-heading"><div><p className="settings-kicker">Danger zone</p><h2 id="danger-heading">Delete account.</h2><p>This permanently removes the shared Janus account and its cards, nutrition entries, workouts, and encrypted AI connections.</p></div><form onSubmit={removeAccount}><label htmlFor="delete-password">Confirm with your password</label><input id="delete-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Current password" disabled={busy} />{error && <p className="settings-message is-error" role="alert">{error}</p>}<button className="secondary-button" type="submit" disabled={busy}>{busy ? 'Deleting…' : 'Delete my account'}</button></form></section>}
    </main>
  )
}
