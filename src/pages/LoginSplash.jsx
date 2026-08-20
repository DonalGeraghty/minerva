import { useState } from 'react'
import AmbientBackground from '../components/AmbientBackground.jsx'
import Brand from '../components/Brand.jsx'
import { useAuth } from '../context/AuthContext.jsx'

export default function LoginSplash() {
  const { login, loginAsDemo, register } = useAuth()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await (mode === 'login' ? login : register)(email.trim(), password)
    } catch (requestError) {
      setError(requestError.message || 'Could not continue')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-page">
      <AmbientBackground />
      <div className="auth-layout">
        <section className="auth-intro">
          <Brand />
          <div>
            <p className="eyebrow">Your memory, deliberately built</p>
            <h1>Learn what<br />matters.</h1>
            <p>Ask naturally, capture the answer as a flashcard, and let Minerva bring it back at the right time.</p>
          </div>
        </section>
        <section className="auth-panel" aria-labelledby="auth-title">
          <header className="auth-panel-heading"><p className="settings-kicker">Janus account</p><h2 id="auth-title">{mode === 'login' ? 'Welcome back.' : 'Create your account.'}</h2><p>Your account and AI connections are shared with Aether and Nyx.</p></header>
          <div className="auth-tabs" role="tablist" aria-label="Account action">
            <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => { setMode('login'); setError('') }}>Sign in</button>
            <button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => { setMode('register'); setError('') }}>Register</button>
          </div>
          {import.meta.env.DEV && <button className="demo-login-button" type="button" onClick={() => { setError(''); loginAsDemo() }}><strong>Use demo account</strong><span>demo@minerva.local · seeded flashcards</span></button>}
          <form className="auth-form" onSubmit={submit}>
            <label htmlFor="auth-email">Email<input id="auth-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label htmlFor="auth-password">Password<input id="auth-password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength="8" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
          </form>
          {import.meta.env.DEV && <p className="demo-login-note">Local demo only — no API keys, AI calls, or server data.</p>}
        </section>
      </div>
    </main>
  )
}
