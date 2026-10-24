import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api.js';

/**
 * Loads the user's accounts (GET /accounts) and each balance (GET /accounts/balance/:id).
 * A failed balance request only affects that account (balance === null).
 *
 * Stale-while-revalidate: the last result is kept in a module-level cache, so moving
 * between pages shows the accounts INSTANTLY and refreshes them silently in the
 * background (no spinner flash). The cache is cleared on login/logout so one user
 * can never see another user's accounts.
 */
let cache = null; // { accounts }

export function clearAccountsCache() {
  cache = null;
}

async function fetchAccounts() {
  const { accounts } = await api.listAccounts();
  const ordered = [...accounts].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  return Promise.all(
    ordered.map(async (account, index) => {
      try {
        const { balance } = await api.getBalance(account._id);
        return { ...account, number: index + 1, balance };
      } catch {
        return { ...account, number: index + 1, balance: null };
      }
    })
  );
}

export function useAccounts() {
  const [state, setState] = useState(() =>
    cache ? { loading: false, refreshing: true, error: null, accounts: cache.accounts } : { loading: true, refreshing: false, error: null, accounts: [] }
  );
  const mounted = useRef(true);

  const load = useCallback(async () => {
    // Only show the big loading state when there is nothing to show yet.
    setState((prev) => (prev.accounts.length || cache ? { ...prev, refreshing: true, error: null } : { ...prev, loading: true, error: null }));
    try {
      const accounts = await fetchAccounts();
      cache = { accounts };
      if (mounted.current) setState({ loading: false, refreshing: false, error: null, accounts });
    } catch (err) {
      if (mounted.current) {
        // keep showing stale data if we have it, otherwise show the error
        setState((prev) => (prev.accounts.length ? { ...prev, refreshing: false } : { loading: false, refreshing: false, error: err.message, accounts: [] }));
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  return { ...state, reload: load };
}
