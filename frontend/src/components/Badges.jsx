import { useState } from 'react';
import Icon from './Icon.jsx';
import { ACCOUNT_STATUS_LABELS, STATUS_LABELS } from '../utils/format.js';

const TX_TONE = { COMPLETED: 'success', PENDING: 'warning', FAILED: 'danger', REVERSED: 'muted' };
const ACCOUNT_TONE = { ACTIVE: 'success', FROZEN: 'warning', CLOSED: 'danger' };

export function TransactionStatus({ status }) {
  return <span className={`badge badge-${TX_TONE[status] || 'muted'}`}>{STATUS_LABELS[status] || status}</span>;
}

export function AccountStatus({ status }) {
  return <span className={`badge badge-${ACCOUNT_TONE[status] || 'muted'}`}>{ACCOUNT_STATUS_LABELS[status] || status}</span>;
}

/** Copies `value` to the clipboard and briefly confirms. */
export function CopyButton({ value, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);

  const copy = async (event) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable (e.g. insecure context) - nothing to do */
    }
  };

  return (
    <button type="button" className="icon-btn" onClick={copy} aria-label={copied ? 'Copied' : label} title={copied ? 'Copied' : label}>
      <Icon name={copied ? 'check' : 'copy'} size={16} />
    </button>
  );
}
