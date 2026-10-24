/**
 * Tiny History-API router (no dependency). Provides what the app needs:
 * <Router>, <Link>, <NavLink>, <Navigate>, useLocation, useNavigate, useSearchParams.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const RouterContext = createContext(null);

const readLocation = () => ({ pathname: window.location.pathname, search: window.location.search });

export function Router({ children }) {
  const [location, setLocation] = useState(readLocation);

  useEffect(() => {
    const onPop = () => setLocation(readLocation());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to, { replace = false } = {}) => {
    const current = window.location.pathname + window.location.search;
    if (to !== current) window.history[replace ? 'replaceState' : 'pushState'](null, '', to);
    setLocation(readLocation());
    if (window.__lenis) window.__lenis.scrollTo(0, { immediate: true });
    else window.scrollTo(0, 0);
  }, []);

  const value = useMemo(() => ({ location, navigate }), [location, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export const useLocation = () => useContext(RouterContext).location;
export const useNavigate = () => useContext(RouterContext).navigate;

export function useSearchParams() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export function Link({ to, onClick, children, ...rest }) {
  const navigate = useNavigate();

  const handleClick = (event) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(to);
  };

  return (
    <a href={to} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}

export function NavLink({ to, className = '', children, ...rest }) {
  const { pathname } = useLocation();
  const active = pathname === to;
  return (
    <Link to={to} className={`${className}${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined} {...rest}>
      {children}
    </Link>
  );
}

export function Navigate({ to, replace = true }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to, { replace });
  }, [navigate, to, replace]);
  return null;
}
