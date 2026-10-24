import { Link } from '../router.jsx';
import Icon from '../components/Icon.jsx';
import Logo from '../components/Logo.jsx';
import { BankArt } from '../components/Illustrations.jsx';

/** Split layout shared by Login and Register: brand panel on the left, form on the right. */
export default function AuthLayout({ title, subtitle, art, children }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <aside className="auth-aside">
          <Link to="/" className="back-link">
            <Icon name="arrowLeft" size={16} /> Back to Home
          </Link>
          <BankArt />
          <h2>{art.title}</h2>
          <p>{art.text}</p>
        </aside>

        <section className="auth-form-side">
          <Logo size={34} />
          <h1>{title}</h1>
          <p className="auth-sub">{subtitle}</p>
          {children}
        </section>
      </div>
    </div>
  );
}
