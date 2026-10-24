import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from '../router.jsx';
import { initial } from '../utils/format.js';
import Icon from './Icon.jsx';
import Logo from './Logo.jsx';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: 'home' },
  { to: '/transfer', label: 'Transfer Money', icon: 'transfer' },
  { to: '/transactions', label: 'Transactions', icon: 'receipt' },
  { to: '/accounts', label: 'My Accounts', icon: 'wallet' },
  { to: '/profile', label: 'Profile', icon: 'user' },
];

function TopSearch() {
  const navigate = useNavigate();
  const params = useSearchParams();
  const { pathname } = useLocation();
  const inputRef = useRef(null);
  const [value, setValue] = useState(pathname === '/transactions' ? params.get('q') || '' : '');

  // Ctrl/Cmd + K focuses the search box
  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const submit = (event) => {
    event.preventDefault();
    const q = value.trim();
    navigate(q ? `/transactions?q=${encodeURIComponent(q)}` : '/transactions');
  };

  return (
    <form className="topsearch" onSubmit={submit} role="search">
      <Icon name="search" size={18} />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search transactions…"
        aria-label="Search transactions"
      />
      <kbd className="kbd">Ctrl K</kbd>
    </form>
  );
}

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  // close the mobile drawer whenever the page changes
  useEffect(() => setNavOpen(false), [pathname]);

  return (
    <div className="shell">
      <aside data-lenis-prevent className={`sidebar${navOpen ? ' open' : ''}`} aria-label="Main navigation">
        <div className="sidebar-head">
          <Logo to="/dashboard" />
          <button type="button" className="icon-btn sidebar-close" onClick={() => setNavOpen(false)} aria-label="Close menu">
            <Icon name="x" size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className="nav-item">
              <Icon name={item.icon} size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <button type="button" className="nav-item nav-logout" onClick={logout}>
          <Icon name="logout" size={20} />
          <span>Logout</span>
        </button>
      </aside>
      {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} />}

      <div className="shell-main">
        <header className="topbar">
          <button type="button" className="icon-btn menu-btn" onClick={() => setNavOpen(true)} aria-label="Open menu">
            <Icon name="menu" size={22} />
          </button>
          <TopSearch />
          <Link to="/profile" className="user-chip" aria-label="Your profile">
            <span className="avatar">{initial(user?.name)}</span>
            <span className="user-chip-text">
              <strong>{user?.name}</strong>
              <small>User</small>
            </span>
          </Link>
        </header>

        <main className="panel">{children}</main>
      </div>
    </div>
  );
}
