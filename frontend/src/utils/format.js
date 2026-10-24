const currencyFormatters = new Map();

export function formatMoney(amount, currency = 'INR') {
  if (typeof amount !== 'number' || Number.isNaN(amount)) return '—';
  if (!currencyFormatters.has(currency)) {
    currencyFormatters.set(
      currency,
      new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 })
    );
  }
  return currencyFormatters.get(currency).format(amount).replace(/ /g, '');
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const timeFormatter = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

export const formatDate = (value) => (value ? dateFormatter.format(new Date(value)) : '—');
export const formatTime = (value) => (value ? timeFormatter.format(new Date(value)) : '');
export const formatDateTime = (value) => (value ? `${formatDate(value)}, ${formatTime(value)}` : '—');

/** 24-hex Mongo ids are long: show the last 8 characters, e.g. …a1b2c3d4 */
export const shortId = (id) => (id ? `…${String(id).slice(-8)}` : '—');

export const firstName = (name) => (name ? name.trim().split(/\s+/)[0] : '');
export const initial = (name) => (name ? name.trim().charAt(0).toUpperCase() : '?');

export const isAccountId = (value) => /^[a-fA-F0-9]{24}$/.test(value);

/** How a transaction should be presented to the logged-in user. */
export function describeTransaction(tx) {
  const name = (party) => party.name || shortId(party._id);

  if (tx.direction === 'CREDIT') {
    return { title: 'Money Received', detail: `From: ${name(tx.fromAccount)}`, sign: '+', tone: 'credit' };
  }
  if (tx.direction === 'DEBIT') {
    return { title: 'Money Sent', detail: `To: ${name(tx.toAccount)}`, sign: '-', tone: 'debit' };
  }
  return {
    title: 'Own Transfer',
    detail: `${shortId(tx.fromAccount._id)} → ${shortId(tx.toAccount._id)}`,
    sign: '',
    tone: 'neutral',
  };
}

export const STATUS_LABELS = { COMPLETED: 'Completed', PENDING: 'Pending', FAILED: 'Failed', REVERSED: 'Reversed' };
export const ACCOUNT_STATUS_LABELS = { ACTIVE: 'Active', FROZEN: 'Frozen', CLOSED: 'Closed' };

export function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}
