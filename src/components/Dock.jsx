import { NavLink } from 'react-router-dom'

const items = [
  { to: '/', label: 'Ask', icon: '✦', end: true },
  { to: '/flashcards', label: 'Flashcards', icon: '▱' },
  { to: '/account', label: 'Account', icon: '●' },
]

export default function Dock({ onLogout }) {
  return (
    <div className="dock-outer">
      <nav className="dock" aria-label="Primary navigation">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `dock-item${isActive ? ' is-current' : ''}`}
            aria-label={item.label}
          >
            <span className="dock-label">{item.label}</span>
            <span className="dock-icon" aria-hidden="true">{item.icon}</span>
          </NavLink>
        ))}
        <span className="dock-divider" aria-hidden="true" />
        <button className="dock-item" type="button" onClick={onLogout} aria-label="Sign out">
          <span className="dock-label">Sign out</span>
          <span className="dock-icon" aria-hidden="true">↪</span>
        </button>
      </nav>
    </div>
  )
}
