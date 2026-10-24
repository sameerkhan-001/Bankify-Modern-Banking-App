import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useAccounts } from '../hooks/useAccounts.js';
import { api } from '../services/api.js';
import { Link } from '../router.jsx';
import { describeTransaction, firstName, formatDate, formatMoney, formatTime } from '../utils/format.js';
import Icon from '../components/Icon.jsx';
import { Alert, EmptyState, ErrorState, LoadingBlock, Spinner } from '../components/Feedback.jsx';
import TransactionModal from '../components/TransactionModal.jsx';
import PageHead from '../components/PageHead.jsx';

function StatCard({ icon, tone, label, value, note, loading }) {
  return (
    <div className="stat-card">
      <span className={`stat-icon stat-icon-${tone}`}>
        <Icon name={icon} size={22} />
      </span>
      <div>
        <p className="stat-label">{label}</p>
        <p className="stat-value">{loading ? <span className="skeleton" /> : value}</p>
        {note && <p className="stat-note">{note}</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { accounts, loading: accountsLoading, error: accountsError, reload } = useAccounts();
  const [recent, setRecent] = useState({ loading: true, error: null, items: [], summary: null });
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const loadRecent = useCallback(async () => {
    setRecent((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await api.listTransactions({ limit: 5, summary: 'true' });
      setRecent({ loading: false, error: null, items: data.transactions, summary: data.summary });
    } catch (err) {
      setRecent({ loading: false, error: err.message, items: [], summary: null });
    }
  }, []);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

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

  const totalBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  const anyBalanceMissing = accounts.some((a) => a.balance === null);
  const hasNoAccounts = !accountsLoading && !accountsError && accounts.length === 0;

  return (
    <>
      <PageHead title={`Welcome Back, ${firstName(user?.name)}! 👋`} subtitle="Here's an overview of your account." />

      {accountsError && <ErrorState message={accountsError} onRetry={reload} />}
      {createError && <Alert title="Could not create account">{createError}</Alert>}

      {hasNoAccounts && (
        <EmptyState icon="wallet" title="You don't have an account yet" action={
          <button type="button" className="btn btn-primary" onClick={createAccount} disabled={creating}>
            {creating ? <Spinner size={16} label="Creating…" /> : <><Icon name="plus" size={18} /> Create your first account</>}
          </button>
        }>
          Create an account to receive funds and send money.
        </EmptyState>
      )}

      {!accountsError && !hasNoAccounts && (
        <div className="stats-grid">
          <StatCard
            icon="wallet"
            tone="blue"
            label="Total Balance"
            loading={accountsLoading}
            value={anyBalanceMissing ? `${formatMoney(totalBalance)}*` : formatMoney(totalBalance)}
            note={anyBalanceMissing ? '*some balances could not be loaded' : `Across ${accounts.length} account${accounts.length === 1 ? '' : 's'}`}
          />
          <StatCard icon="arrowDownLeft" tone="green" label="Total Credits" loading={recent.loading} value={recent.summary ? formatMoney(recent.summary.totalCredits) : '—'} note="Completed, from other accounts" />
          <StatCard icon="arrowUpRight" tone="red" label="Total Debits" loading={recent.loading} value={recent.summary ? formatMoney(recent.summary.totalDebits) : '—'} note="Completed, to other accounts" />
        </div>
      )}

      <div className="dash-grid">
        <section className="card">
          <div className="card-head">
            <h2>Recent Transactions</h2>
            <Link to="/transactions" className="link-sm">
              View All
            </Link>
          </div>

          {recent.loading && recent.items.length === 0 && <LoadingBlock />}
          {recent.error && <ErrorState message={recent.error} onRetry={loadRecent} />}
          {!recent.loading && !recent.error && recent.items.length === 0 && (
            <EmptyState icon="receipt" title="No transactions yet">
              Your transfers and received funds will appear here.
            </EmptyState>
          )}

          <ul className="tx-list">
            {recent.items.map((tx) => {
              const view = describeTransaction(tx);
              return (
                <li key={tx._id}>
                  <button type="button" className="tx-item" onClick={() => setOpenId(tx._id)}>
                    <span className={`tx-icon tx-icon-${view.tone}`}>
                      <Icon name={view.tone === 'credit' ? 'arrowDownLeft' : view.tone === 'debit' ? 'arrowUpRight' : 'swap'} size={20} />
                    </span>
                    <span className="tx-main">
                      <strong>{view.title}</strong>
                      <small>{view.detail}</small>
                    </span>
                    <span className="tx-side">
                      <strong className={`amount-${view.tone}`}>
                        {view.sign} {formatMoney(tx.amount)}
                      </strong>
                      <small>
                        {formatDate(tx.createdAt)}, {formatTime(tx.createdAt)}
                      </small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Quick Actions</h2>
          </div>
          <div className="quick-actions">
            <Link to="/transfer" className="quick-action">
              <Icon name="transfer" size={20} /> Send Money
            </Link>
            <Link to="/transactions" className="quick-action">
              <Icon name="receipt" size={20} /> View Transactions
            </Link>
            <Link to="/accounts" className="quick-action">
              <Icon name="wallet" size={20} /> My Accounts
            </Link>
          </div>
        </section>
      </div>

      {openId && <TransactionModal transactionId={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}
