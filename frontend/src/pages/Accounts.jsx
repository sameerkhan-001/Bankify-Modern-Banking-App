import { useMemo, useState } from 'react';
import { useAccounts } from '../hooks/useAccounts.js';
import { api } from '../services/api.js';
import { Link } from '../router.jsx';
import { formatDate, formatMoney, formatTime } from '../utils/format.js';
import Icon from '../components/Icon.jsx';
import { Alert, EmptyState, ErrorState, LoadingBlock, Spinner } from '../components/Feedback.jsx';
import AccountCard, { accountVariant } from '../components/AccountCard.jsx';
import { AccountStatus, CopyButton } from '../components/Badges.jsx';
import PageHead from '../components/PageHead.jsx';

export default function Accounts() {
  const { accounts, loading, error, reload } = useAccounts();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const createAccount = async () => {
    if (creating) return;
    setCreating(true);
    setCreateError('');
    try {
      await api.createAccount();
      await reload();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) => a._id.toLowerCase().includes(q) || `account ${a.number}`.includes(q) || a.status.toLowerCase().includes(q));
  }, [accounts, search]);

  return (
    <>
      <PageHead
        title="My Accounts"
        subtitle="Manage and view your accounts"
        action={
          <button type="button" className="btn btn-primary" onClick={createAccount} disabled={creating}>
            {creating ? <Spinner size={16} label="Creating…" /> : <><Icon name="plus" size={18} /> Create New Account</>}
          </button>
        }
      />

      {createError && <Alert title="Could not create account" onClose={() => setCreateError('')}>{createError}</Alert>}
      {loading && <LoadingBlock label="Loading accounts…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && accounts.length === 0 && (
        <EmptyState icon="wallet" title="No accounts yet">
          Create your first account to start receiving and sending money.
        </EmptyState>
      )}

      {!loading && !error && accounts.length > 0 && (
        <>
          <div className="account-cards">
            {accounts.map((account) => (
              <AccountCard key={account._id} account={account} />
            ))}
          </div>

          <section className="card">
            <div className="card-head card-head-wrap">
              <div>
                <h2>All Accounts</h2>
                <p className="muted">View and manage all your accounts in one place</p>
              </div>
              <div className="input-wrap table-search">
                <Icon name="search" size={18} className="input-icon" />
                <input className="input" placeholder="Search accounts…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search accounts" />
              </div>
            </div>

            <div className="table" role="table" aria-label="All accounts">
              <div className="table-row table-header accounts-cols" role="row">
                <span role="columnheader">#</span>
                <span role="columnheader">Account ID</span>
                <span role="columnheader">Balance</span>
                <span role="columnheader">Status</span>
                <span role="columnheader">Created At</span>
                <span role="columnheader">Actions</span>
              </div>

              {filtered.length === 0 && <EmptyState icon="search" title="No matching accounts" />}

              {filtered.map((account) => (
                <div key={account._id} className="table-row accounts-cols" role="row">
                  <span role="cell" className="cell-index">{account.number}</span>
                  <span role="cell" className="cell-account">
                    <span className={`bank-tile bank-tile-sm bank-tile-${accountVariant(account)}`}>
                      <Icon name="bank" size={20} />
                    </span>
                    <span className="cell-stack">
                      <strong>Account {account.number}</strong>
                      <span className="mono muted id-wrap">{account._id}</span>
                    </span>
                  </span>
                  <span role="cell" className={`cell-balance${account.balance > 0 ? ' amount-credit' : ''}`} data-label="Balance">
                    {account.balance === null ? '—' : formatMoney(account.balance, account.currency)}
                  </span>
                  <span role="cell" data-label="Status">
                    <AccountStatus status={account.status} />
                  </span>
                  <span role="cell" className="cell-stack" data-label="Created">
                    <span>{formatDate(account.createdAt)}</span>
                    <small className="muted">{formatTime(account.createdAt)}</small>
                  </span>
                  <span role="cell" className="cell-actions">
                    <Link to={`/transactions?account=${account._id}`} className="btn btn-outline btn-sm">
                      <Icon name="receipt" size={16} /> View Transactions
                    </Link>
                    <CopyButton value={account._id} label="Copy account ID" />
                  </span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}
