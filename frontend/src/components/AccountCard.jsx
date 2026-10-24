import { formatMoney } from '../utils/format.js';
import Icon from './Icon.jsx';
import { AccountStatus, CopyButton } from './Badges.jsx';

// Cards cycle through the three palette variants from the design; inactive accounts are always the muted one.
const VARIANTS = ['blue', 'violet'];

export function accountVariant(account) {
  if (account.status !== 'ACTIVE') return 'slate';
  return VARIANTS[(account.number - 1) % VARIANTS.length];
}

export default function AccountCard({ account }) {
  const variant = accountVariant(account);
  return (
    <article className={`account-card account-card-${variant}`}>
      <span className={`bank-tile bank-tile-${variant}`}>
        <Icon name="bank" size={26} />
      </span>
      <div className="account-card-body">
        <div className="account-card-top">
          <h3>Account {account.number}</h3>
          <CopyButton value={account._id} label="Copy account ID" />
        </div>
        <p className="mono account-id" title={account._id}>
          {account._id}
        </p>
        <p className="account-balance">{account.balance === null ? '—' : formatMoney(account.balance, account.currency)}</p>
        <AccountStatus status={account.status} />
      </div>
    </article>
  );
}
