import { useAuth } from '../context/AuthContext.jsx';
import { Link } from '../router.jsx';
import Icon from '../components/Icon.jsx';
import Logo from '../components/Logo.jsx';
import { CardArt } from '../components/Illustrations.jsx';

// Every feature below describes something the backend actually does.
const FEATURES = [
  { icon: 'shieldCheck', title: 'Secure sign-in', text: 'Your password is stored securely and your session is protected, so only you can access your accounts.' },
  { icon: 'transfer', title: 'Safe transfers', text: 'Every payment needs your personal transaction PIN, and a retry can never charge you twice.' },
  { icon: 'layers', title: 'Ledger-based balances', text: 'Every rupee is recorded in a permanent ledger, so your balance always matches your transactions.' },
  { icon: 'receipt', title: 'Full history', text: 'Filter and review every credit and debit, and open the details of any transaction.' },
];

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="landing">
      <header className="landing-nav">
        <Logo />
        <nav className="landing-links" aria-label="Sections">
          <a href="#home">Home</a>
          <a href="#features">Features</a>
          <a href="#about">About</a>
        </nav>
        <div className="landing-actions">
          {user ? (
            <Link to="/dashboard" className="btn btn-primary btn-sm">
              Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-outline btn-sm">
                Login
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Get Started
              </Link>
            </>
          )}
        </div>
      </header>

      <section className="hero" id="home">
        <div className="hero-copy">
          <span className="eyebrow">
            <Icon name="shield" size={14} /> Secure · Fast · Reliable
          </span>
          <h1>
            Modern Banking
            <br />
            for a <span className="grad-text">Better Tomorrow</span>
          </h1>
          <p>Send, receive and manage your money with complete security. Built for everyone, powered by modern technology.</p>
          <div className="hero-cta">
            <Link to={user ? '/dashboard' : '/register'} className="btn btn-primary">
              {user ? 'Open Dashboard' : 'Get Started'} <Icon name="arrowRight" size={18} />
            </Link>
            <a href="#features" className="btn btn-outline">
              Learn More
            </a>
          </div>
        </div>
        <CardArt />
      </section>

      <section className="section" id="features">
        <h2>Everything you need</h2>
        <p className="section-sub">Everything you need for everyday banking, in one place.</p>
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <article key={f.title} className="feature-card">
              <span className="feature-icon">
                <Icon name={f.icon} size={22} />
              </span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section about" id="about">
        <h2>About Bankify</h2>
        <p className="section-sub">
          Bankify is a modern digital banking platform. Manage multiple accounts, transfer funds in seconds with your personal
          PIN, and keep a clear record of every payment, all in one place.
        </p>
        {!user && (
          <Link to="/register" className="btn btn-primary">
            Create your account
          </Link>
        )}
      </section>

      <footer className="landing-footer">
        <Logo size={30} />
        <span>© {new Date().getFullYear()} Bankify. All rights reserved.</span>
      </footer>
    </div>
  );
}
