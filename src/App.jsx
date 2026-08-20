import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import AmbientBackground from './components/AmbientBackground.jsx'
import Dock from './components/Dock.jsx'
import { useAuth } from './context/AuthContext.jsx'
import AccountPage from './pages/AccountPage.jsx'
import AskPage from './pages/AskPage.jsx'
import FlashcardsPage from './pages/FlashcardsPage.jsx'
import LoginSplash from './pages/LoginSplash.jsx'

function ProtectedLayout() {
  const { user, loading, logout } = useAuth()
  if (loading) return <main className="auth-loading" role="status"><span className="brand-mark" aria-hidden="true">M</span><p>Restoring your Minerva session…</p></main>
  if (!user) return <LoginSplash />
  return <div className="app-shell"><AmbientBackground /><Outlet /><Dock onLogout={logout} /></div>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<AskPage />} />
          <Route path="/flashcards" element={<FlashcardsPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
