import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import AmbientBackground from './components/AmbientBackground.jsx'
import Dock from './components/Dock.jsx'
import { useAuth } from './context/AuthContext.jsx'
import AccountPage from './pages/AccountPage.jsx'
import LoginSplash from './pages/LoginSplash.jsx'
import GarminPage from './pages/GarminPage.jsx'
import GarminDatesProvider from './context/GarminDatesProvider.jsx'

function ProtectedLayout() {
  const { user, loading } = useAuth()
  if (loading) return <main className="auth-loading" role="status"><span className="brand-mark" aria-hidden="true">M</span><p>Restoring your Minerva session…</p></main>
  if (!user) return <LoginSplash />
  return <div className="app-shell" key={user.accountId}><AmbientBackground /><GarminDatesProvider key={user.accountId}><Outlet /></GarminDatesProvider><Dock /></div>
}

function DashboardRedirect() {
  const { search, hash } = useLocation()
  return <Navigate to={{ pathname: '/', search, hash }} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<GarminPage />} />
          <Route path="/activities" element={<GarminPage tab="activities" />} />
          {['recovery', 'health', 'movement'].map((path) => <Route key={path} path={`/${path}`} element={<DashboardRedirect />} />)}
          <Route path="/account" element={<AccountPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
