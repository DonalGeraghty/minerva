import { NavLink } from 'react-router-dom'

const items = [
  { to: '/', label: 'Overview', icon: '◈', end: true },
  { to: '/recovery', label: 'Recovery', icon: '☾' },
  { to: '/activities', label: 'Activities', icon: '↗' },
  { to: '/health', label: 'Health', icon: '♡' },
  { to: '/movement', label: 'Movement', icon: '⌁' },
  { to: '/account', label: 'Account', icon: '●' },
]

export default function Dock() {
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
      </nav>
    </div>
  )
}
