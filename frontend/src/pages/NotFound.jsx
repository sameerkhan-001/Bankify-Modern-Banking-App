import { Link } from '../router.jsx';

export default function NotFound() {
  return (
    <div className="auth-page">
      <div className="not-found">
        <h1 className="grad-text">404</h1>
        <p>We couldn't find that page.</p>
        <Link to="/" className="btn btn-primary">
          Back to Home
        </Link>
      </div>
    </div>
  );
}
