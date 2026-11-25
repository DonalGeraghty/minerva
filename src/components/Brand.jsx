import { Link } from 'react-router-dom'

export default function Brand() {
  return (
    <Link className="brand" to="/" aria-label="Minerva home">
      <span className="brand-mark" aria-hidden="true">M</span>
      <span className="brand-wordmark">Minerva<small>Your finance agent</small></span>
    </Link>
  )
}
