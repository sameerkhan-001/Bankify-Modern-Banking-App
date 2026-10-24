import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { describeTransaction, formatDateTime, formatMoney } from '../utils/format.js';
import Icon from './Icon.jsx';
import { LoadingBlock, ErrorState } from './Feedback.jsx';
import { CopyButton, TransactionStatus } from './Badges.jsx';

/**
 * Loads GET /transactions/:id. The backend only answers for transactions that involve
 * one of the user's accounts (404 otherwise), so authorization is enforced server-side.
 */
export default function TransactionModal({ transactionId, onClose }) {
  const [state, setState] = useState({ loading: true, error: null, tx: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ loading: true, error: null, tx: null });
    api
      .getTransaction(transactionId)
      .then(({ transaction }) => active && setState({ loading: false, error: null, tx: transaction }))
      .catch((err) =>
        active &&
        setState({
          loading: false,
          error: err.status === 404 ? 'This transaction was not found, or you do not have access to it.' : err.message,
          tx: null,
        })
      );
    return () => {
      active = false;
    };
  }, [transactionId, attempt]);

  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const { tx } = state;
  const view = tx ? describeTransaction(tx) : null;

  const party = (p) => (
    <>
      {p.name && <span>{p.name}{p.owned ? ' (you)' : ''}</span>}
      <span className="mono muted">{p._id}</span>
    </>
  );

  return (
    <div className="modal-overlay" data-lenis-prevent onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="tx-modal-title">
        <div className="modal-head">
          <h2 id="tx-modal-title">Transaction Details</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" size={20} />
          </button>
        </div>

        {state.loading && <LoadingBlock label="Loading transaction…" />}
        {state.error && <ErrorState message={state.error} onRetry={() => setAttempt((n) => n + 1)} />}

        {tx && (
          <>
            <div className="modal-hero">
              <span className={`tx-icon tx-icon-${view.tone}`}>
                <Icon name={view.tone === 'credit' ? 'arrowDownLeft' : view.tone === 'debit' ? 'arrowUpRight' : 'swap'} size={26} />
              </span>
              <div className="modal-title-sm">{view.title}</div>
              <div className={`modal-amount amount-${view.tone}`}>
                {view.sign} {formatMoney(tx.amount)}
              </div>
            </div>

            <dl className="detail-list">
              <div>
                <dt>Transaction ID</dt>
                <dd className="with-copy">
                  <span className="mono">{tx._id}</span>
                  <CopyButton value={tx._id} label="Copy transaction ID" />
                </dd>
              </div>
              <div>
                <dt>From Account</dt>
                <dd className="stack">{party(tx.fromAccount)}</dd>
              </div>
              <div>
                <dt>To Account</dt>
                <dd className="stack">{party(tx.toAccount)}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <TransactionStatus status={tx.status} />
                </dd>
              </div>
              <div>
                <dt>Date &amp; Time</dt>
                <dd>{formatDateTime(tx.createdAt)}</dd>
              </div>
            </dl>
          </>
        )}

        <button type="button" className="btn btn-outline btn-block" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
