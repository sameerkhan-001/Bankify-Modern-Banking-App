import { Link } from '../router.jsx';

export default function Logo({ to = '/', size = 40 }) {
  return (
    <Link to={to} className="logo" aria-label="Bankify home">
      <span className="logo-mark" style={{ width: size, height: size }}>
        <svg viewBox="0 0 32 32" width={size * 0.6} height={size * 0.6} fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M11 7v18M11 7h6.5a4.5 4.5 0 0 1 0 9H11m6.5 0a4.5 4.5 0 0 1 0 9H11" />
        </svg>
      </span>
      <span className="logo-text">Bankify</span>
    </Link>
  );
}
