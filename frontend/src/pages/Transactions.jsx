import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../services/api.js';
import { useNavigate, useSearchParams } from '../router.jsx';
import { describeTransaction, formatDate, formatMoney, formatTime, shortId, STATUS_LABELS } from '../utils/format.js';
import Icon from '../components/Icon.jsx';
import { EmptyState, ErrorState, LoadingBlock } from '../components/Feedback.jsx';
import { TransactionStatus } from '../components/Badges.jsx';
import TransactionModal from '../components/TransactionModal.jsx';
import PageHead from '../components/PageHead.jsx';

const PAGE_SIZE = 10;
const TABS = [
  { value: '', label: 'All' },
  { value: 'credit', label: 'Credit' },
  { value: 'debit', label: 'Debit' },
];

export default function Transactions() {
  const params = useSearchParams();
  const navigate = useNavigate();
  const q = params.get('q') || '';
  const accountId = params.get('account') || '';

  const [filters, setFilters] = useState({ type: '', status: '', from: '', to: '', page: 1 });
  const [showFilters, setShowFilters] = useState(false);
  const [data, setData] = useState({ loading: true, error: null, items: [], pagination: null });
  const [openId, setOpenId] = useState(null);
  const requestId = useRef(0);

  const setFilter = (patch) => setFilters((prev) => ({ ...prev, page: 1, ...patch }));

  // keep ?q= and ?account= in the URL so links from the top search / My Accounts work
  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    navigate(`/transactions${qs ? `?${qs}` : ''}`, { replace: true });
    if (key === 'account') setFilters((prev) => ({ ...prev, page: 1 }));
  };

  const { type, status, from, to, page } = filters;

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setData((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await api.listTransactions({
        page,
        limit: PAGE_SIZE,
        type,
        status,
        accountId,
        from: from ? new Date(`${from}T00:00:00`).toISOString() : '',
        to: to ? new Date(`${to}T23:59:59.999`).toISOString() : '',
      });
      if (id === requestId.current) setData({ loading: false, error: null, items: res.transactions, pagination: res.pagination });
    } catch (err) {
      if (id === requestId.current) setData({ loading: false, error: err.message, items: [], pagination: null });
    }
  }, [page, type, status, accountId, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  // The search box filters the rows already loaded for the current page.
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return data.items;
    return data.items.filter((tx) => {
      const view = describeTransaction(tx);
      return [view.title, view.detail, tx._id, tx.fromAccount._id, tx.toAccount._id, String(tx.amount), tx.status].join(' ').toLowerCase().includes(needle);
    });
  }, [data.items, q]);

  const activeFilterCount = [status, from, to].filter(Boolean).length;
  const anyFilter = Boolean(type || status || from || to || accountId);
  const pagination = data.pagination;

  const clearAll = () => {
    setFilters({ type: '', status: '', from: '', to: '', page: 1 });
    if (accountId || q) navigate('/transactions', { replace: true });
  };

  return (
    <>
      <PageHead title="Transaction History" subtitle="View and track all your transactions." />

      <section className="card">
        <div className="toolbar">
          <div className="tabs" role="tablist" aria-label="Transaction type">
            {TABS.map((tab) => (
              <button key={tab.value} type="button" role="tab" aria-selected={type === tab.value} className={`tab${type === tab.value ? ' active' : ''}`} onClick={() => setFilter({ type: tab.value })}>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="toolbar-right">
            <div className="input-wrap table-search">
              <Icon name="search" size={18} className="input-icon" />
              <input className="input" placeholder="Search this page…" value={q} onChange={(e) => setParam('q', e.target.value)} aria-label="Search transactions on this page" />
            </div>
            <button type="button" className={`btn btn-outline btn-sm${showFilters ? ' is-on' : ''}`} onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
              <Icon name="filter" size={16} /> Filter{activeFilterCount > 0 && <span className="count-pill">{activeFilterCount}</span>}
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="filter-panel">
            <label className="field">
              <span>Status</span>
              <select className="input" value={status} onChange={(e) => setFilter({ status: e.target.value })}>
                <option value="">All statuses</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>From date</span>
              <input className="input" type="date" value={from} max={to || undefined} onChange={(e) => setFilter({ from: e.target.value })} />
            </label>
            <label className="field">
              <span>To date</span>
              <input className="input" type="date" value={to} min={from || undefined} onChange={(e) => setFilter({ to: e.target.value })} />
            </label>
          </div>
        )}

        {(accountId || anyFilter || q) && (
          <div className="chips">
            {accountId && (
              <button type="button" className="chip" onClick={() => setParam('account', '')}>
                Account {shortId(accountId)} <Icon name="x" size={14} />
              </button>
            )}
            <button type="button" className="chip chip-clear" onClick={clearAll}>
              Clear all filters
            </button>
          </div>
        )}

        {data.loading && data.items.length === 0 && <LoadingBlock label="Loading transactions…" />}
        {data.error && <ErrorState message={data.error} onRetry={load} />}

        {!data.loading && !data.error && data.items.length === 0 && (
          <EmptyState icon="receipt" title={anyFilter ? 'No transactions match these filters' : 'No transactions yet'}>
            {anyFilter ? 'Try changing or clearing the filters.' : 'Transfers you send or receive will appear here.'}
          </EmptyState>
        )}

        {!data.loading && !data.error && data.items.length > 0 && visible.length === 0 && (
          <EmptyState icon="search" title={`No results for “${q}” on this page`}>
            The search only looks at the transactions shown on this page.
          </EmptyState>
        )}

        {!data.error && visible.length > 0 && (
          <div className={`table${data.loading ? ' is-loading' : ''}`} role="table" aria-label="Transactions">
            <div className="table-row table-header tx-cols" role="row">
              <span role="columnheader">Type</span>
              <span role="columnheader">Details</span>
              <span role="columnheader">Amount</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Date</span>
            </div>
            {visible.map((tx) => {
              const view = describeTransaction(tx);
              return (
                <button key={tx._id} type="button" className="table-row tx-cols row-button" role="row" onClick={() => setOpenId(tx._id)} aria-label={`${view.title}, ${formatMoney(tx.amount)}, open details`}>
                  <span role="cell">
                    <span className={`tx-icon tx-icon-${view.tone}`}>
                      <Icon name={view.tone === 'credit' ? 'arrowDownLeft' : view.tone === 'debit' ? 'arrowUpRight' : 'swap'} size={20} />
                    </span>
                  </span>
                  <span role="cell" className="cell-stack">
                    <strong>{view.title}</strong>
                    <small className="muted">{view.detail}</small>
                  </span>
                  <span role="cell" className={`cell-amount amount-${view.tone}`}>
                    {view.sign} {formatMoney(tx.amount)}
                  </span>
                  <span role="cell">
                    <TransactionStatus status={tx.status} />
                  </span>
                  <span role="cell" className="cell-stack">
                    <span>{formatDate(tx.createdAt)}</span>
                    <small className="muted">{formatTime(tx.createdAt)}</small>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {pagination && pagination.total > 0 && (
          <div className="pagination">
            <span className="muted">
              Page {pagination.page} of {pagination.pages} · {pagination.total} transaction{pagination.total === 1 ? '' : 's'}
            </span>
            <div>
              <button type="button" className="btn btn-outline btn-sm" disabled={page <= 1 || data.loading} onClick={() => setFilters((p) => ({ ...p, page: p.page - 1 }))}>
                <Icon name="chevronLeft" size={16} /> Previous
              </button>
              <button type="button" className="btn btn-outline btn-sm" disabled={page >= pagination.pages || data.loading} onClick={() => setFilters((p) => ({ ...p, page: p.page + 1 }))}>
                Next <Icon name="chevronRight" size={16} />
              </button>
            </div>
          </div>
        )}
      </section>

      {openId && <TransactionModal transactionId={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}
