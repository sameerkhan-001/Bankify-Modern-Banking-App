import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { Navigate, Router, useLocation } from './router.jsx';
import AppShell from './components/AppShell.jsx';
import { LoadingBlock } from './components/Feedback.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Transfer from './pages/Transfer.jsx';
import Transactions from './pages/Transactions.jsx';
import Accounts from './pages/Accounts.jsx';
import Profile from './pages/Profile.jsx';
import NotFound from './pages/NotFound.jsx';

// access: 'public' (anyone) | 'guest' (logged-out only) | 'private' (needs a session)
const ROUTES = {
  '/': { page: Landing, access: 'public' },
  '/login': { page: Login, access: 'guest' },
  '/register': { page: Register, access: 'guest' },
  '/dashboard': { page: Dashboard, access: 'private' },
  '/transfer': { page: Transfer, access: 'private' },
  '/transactions': { page: Transactions, access: 'private' },
  '/accounts': { page: Accounts, access: 'private' },
  '/profile': { page: Profile, access: 'private' },
};

function Routes() {
  const { pathname } = useLocation();
  const { user, loading } = useAuth();
  const route = ROUTES[pathname.replace(/\/+$/, '') || '/'];

  if (!route) return <NotFound />;

  if (loading) {
    return (
      <div className="splash">
        <LoadingBlock label="Loading Bankify…" />
      </div>
    );
  }

  const Page = route.page;

  if (route.access === 'private') {
    if (!user) return <Navigate to="/login" />;
    return (
      <AppShell>
        <Page />
      </AppShell>
    );
  }

  if (route.access === 'guest' && user) return <Navigate to="/dashboard" />;

  return <Page />;
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes />
      </AuthProvider>
    </Router>
  );
}
