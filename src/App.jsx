import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import AmbientBackground from './components/AmbientBackground.jsx'
import Dock from './components/Dock.jsx'
import { useAuth } from './context/AuthContext.jsx'
import AccountPage from './pages/AccountPage.jsx'
import AskPage from './pages/AskPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import LoginSplash from './pages/LoginSplash.jsx'
import RulesPage from './pages/RulesPage.jsx'
import TransactionsPage from './pages/TransactionsPage.jsx'

function ProtectedLayout() {
  const { user, loading, sessionError, retrySession } = useAuth()
  if (loading) return <main className="auth-loading" role="status"><span className="brand-mark" aria-hidden="true">M</span><p>Restoring your Minerva session…</p></main>
  if (sessionError) return <main className="auth-loading"><span className="brand-mark" aria-hidden="true">M</span><p role="alert">{sessionError}</p><button className="secondary-button" type="button" onClick={retrySession}>Try again</button></main>
  if (!user) return <LoginSplash />
  return <div className="app-shell" key={user.accountId}><AmbientBackground /><Outlet /><Dock /></div>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/rules" element={<RulesPage />} />
          <Route path="/ask" element={<AskPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
