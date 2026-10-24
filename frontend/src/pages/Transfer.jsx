import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useAccounts } from '../hooks/useAccounts.js';
import { api } from '../services/api.js';
import { Link } from '../router.jsx';
import { formatMoney, isAccountId, newIdempotencyKey, shortId } from '../utils/format.js';
import Icon from '../components/Icon.jsx';
import { Alert, EmptyState, ErrorState, LoadingBlock, Spinner } from '../components/Feedback.jsx';
import FormField from '../components/FormField.jsx';
import TransactionModal from '../components/TransactionModal.jsx';
import PinDialog from '../components/PinDialog.jsx';
import { SetPinForm } from '../components/PinForms.jsx';
import PageHead from '../components/PageHead.jsx';

const AMOUNT_REGEX = /^\d+(\.\d{1,2})?$/;

export default function Transfer() {
  const { user, refreshUser } = useAuth();
  const { accounts, loading, error, reload } = useAccounts();
  const [form, setForm] = useState({ from: '', to: '', amount: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { type: 'success', tx } | { type: 'error', message, uncertain }
  const [openId, setOpenId] = useState(null);
  const [pinOpen, setPinOpen] = useState(false); // PIN dialog
  const [pinError, setPinError] = useState('');

  // One idempotency key per "intent". It only changes when the user edits the form, so
  // re-submitting the SAME form after a timeout can never create a second transfer.
  const keyRef = useRef(newIdempotencyKey());
  useEffect(() => {
    keyRef.current = newIdempotencyKey();
  }, [form.from, form.to, form.amount]);

  const sendable = accounts.filter((a) => a.status === 'ACTIVE');

  // default sender = first active account
  useEffect(() => {
    if (!form.from && sendable.length) setForm((prev) => ({ ...prev, from: sendable[0]._id }));
  }, [sendable, form.from]);

  const sender = accounts.find((a) => a._id === form.from);
  const update = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = () => {
    const next = {};
    const to = form.to.trim();
    if (!form.from) next.from = 'Choose the account to send from';
    if (!to) next.to = 'Enter the receiver account ID';
    else if (!isAccountId(to)) next.to = 'Account IDs are 24 characters (letters a-f and digits)';
    else if (to.toLowerCase() === form.from.toLowerCase()) next.to = 'Choose a different account than the sender';

    if (!form.amount) next.amount = 'Enter an amount';
    else if (!AMOUNT_REGEX.test(form.amount)) next.amount = 'Enter a positive amount with at most 2 decimals';
    else if (Number(form.amount) <= 0) next.amount = 'Amount must be greater than zero';
    else if (sender && sender.balance !== null && Number(form.amount) > sender.balance) next.amount = `Amount exceeds the available balance (${formatMoney(sender.balance, sender.currency)})`;
    return next;
  };

  // Step 1: validate the form, then ask for the transaction PIN.
  const onSubmit = (event) => {
    event.preventDefault();
    if (submitting) return; // no duplicate submissions

    const found = validate();
    setErrors(found);
    setResult(null);
    if (Object.keys(found).length) return;

    setPinError('');
    setPinOpen(true);
  };

  // Step 2: the PIN is sent WITH the transfer; the backend verifies it (never only the browser).
  const sendWithPin = async (pin) => {
    if (submitting) return;
    setSubmitting(true);
    setPinError('');
    try {
      const data = await api.createTransaction({
        fromAccount: form.from,
        toAccount: form.to.trim(),
        amount: Number(form.amount),
        idempotencyKey: keyRef.current, // unchanged on a wrong PIN, so a retry is still ONE transfer
        pin,
      });
      setPinOpen(false);
      setResult({ type: 'success', tx: data.transaction, amount: Number(form.amount), to: form.to.trim() });
      setForm((prev) => ({ ...prev, to: '', amount: '' }));
      keyRef.current = newIdempotencyKey();
      reload(); // pick up the new balance from the server
    } catch (err) {
      const code = err.data?.code;
      if (code === 'PIN_INVALID' || code === 'PIN_LOCKED' || code === 'PIN_REQUIRED') {
        setPinError(err.message); // stay in the dialog and show why
      } else if (code === 'PIN_NOT_SET') {
        setPinOpen(false);
        refreshUser().catch(() => {});
      } else {
        setPinOpen(false);
        setResult({ type: 'error', message: err.message, uncertain: err.status === 0 });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const amountNumber = AMOUNT_REGEX.test(form.amount) ? Number(form.amount) : null;

  return (
    <>
      <PageHead title="Transfer Money" subtitle="Send money to any Bankify account securely" />

      {loading && <LoadingBlock label="Loading your accounts…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && sendable.length === 0 && (
        <EmptyState
          icon="wallet"
          title="No active account to send from"
          action={
            <Link to="/accounts" className="btn btn-primary">
              Go to My Accounts
            </Link>
          }
        >
          You need an active account before you can transfer money.
        </EmptyState>
      )}

      {!error && sendable.length > 0 && !user.hasPin && (
        <section className="card">
          <div className="card-head">
            <h2>Set a transaction PIN</h2>
          </div>
          <p className="muted">For your safety every transfer needs a 6-digit PIN. Create yours once to start sending money.</p>
          <SetPinForm onDone={refreshUser} />
        </section>
      )}

      {!error && sendable.length > 0 && user.hasPin && (
        <div className="transfer-grid">
          <form className="card form" onSubmit={onSubmit} noValidate>
            {result?.type === 'success' && (
              <Alert
                tone="success"
                title="Transfer completed"
                action={
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpenId(result.tx._id)}>
                    View details
                  </button>
                }
              >
                {formatMoney(result.amount)} sent to {shortId(result.to)}.
              </Alert>
            )}
            {result?.type === 'error' && (
              <Alert title="Transfer failed">
                {result.message}
                {result.uncertain && ' If you are unsure whether it went through, check Transactions first; pressing Send again with the same details is safe and will not charge you twice.'}
              </Alert>
            )}

            <FormField label="From Account" as="select" value={form.from} onChange={update('from')} error={errors.from}>
              {sendable.map((a) => (
                <option key={a._id} value={a._id}>
                  Account {a.number} — {shortId(a._id)} — {a.balance === null ? 'balance unavailable' : formatMoney(a.balance, a.currency)}
                </option>
              ))}
            </FormField>

            <FormField
              label="To Account"
              icon="search"
              placeholder="Enter receiver account ID"
              value={form.to}
              onChange={update('to')}
              error={errors.to}
              hint="Ask the receiver for their account ID (My Accounts → copy)."
              autoComplete="off"
              spellCheck="false"
            />

            <FormField label="Amount (₹)" icon="wallet" inputMode="decimal" placeholder="0.00" value={form.amount} onChange={update('amount')} error={errors.amount} autoComplete="off" />

            <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
              {submitting ? <Spinner size={16} label="Sending…" /> : 'Send Money'}
            </button>
          </form>

          <aside className="card summary" aria-label="Transfer summary">
            <h2>Transfer Summary</h2>
            <dl className="summary-list">
              <div>
                <dt><Icon name="wallet" size={16} /> From</dt>
                <dd>{sender ? <>Account {sender.number}<small className="mono muted">{shortId(sender._id)}</small></> : '—'}</dd>
              </div>
              <div>
                <dt><Icon name="user" size={16} /> To</dt>
                <dd>{isAccountId(form.to.trim()) ? <span className="mono">{shortId(form.to.trim())}</span> : '—'}</dd>
              </div>
              <div>
                <dt><Icon name="layers" size={16} /> Amount</dt>
                <dd>{amountNumber ? formatMoney(amountNumber) : '—'}</dd>
              </div>
            </dl>
            <div className="summary-note">
              <Icon name="info" size={18} />
              <span>The amount is checked against your balance and processed securely. Completed transfers can't be undone from the app.</span>
            </div>
          </aside>
        </div>
      )}

      {pinOpen && (
        <PinDialog
          description={`Confirm sending ${amountNumber ? formatMoney(amountNumber) : 'this amount'} to ${shortId(form.to.trim())}.`}
          error={pinError}
          busy={submitting}
          onSubmit={sendWithPin}
          onClose={() => setPinOpen(false)}
        />
      )}

      {openId && <TransactionModal transactionId={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}
