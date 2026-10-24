import Icon from './Icon.jsx';

export function Spinner({ size = 18, label }) {
  return (
    <span className="spinner-wrap" role="status">
      <span className="spinner" style={{ width: size, height: size }} />
      {label && <span className="spinner-label">{label}</span>}
      {!label && <span className="sr-only">Loading</span>}
    </span>
  );
}

export function LoadingBlock({ label = 'Loading…' }) {
  return (
    <div className="loading-block">
      <Spinner size={26} label={label} />
    </div>
  );
}

export function Alert({ tone = 'error', title, children, action, onClose }) {
  const icon = tone === 'success' ? 'check' : tone === 'info' ? 'info' : 'alert';
  return (
    <div className={`alert alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon name={icon} size={18} />
      <div className="alert-body">
        {title && <strong>{title}</strong>}
        {children && <div>{children}</div>}
      </div>
      {action}
      {onClose && (
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Dismiss">
          <Icon name="x" size={16} />
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon = 'inbox', title, children, action }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={26} />
      </span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="empty">
      <span className="empty-icon empty-icon-error">
        <Icon name="alert" size={26} />
      </span>
      <h3>Something went wrong</h3>
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn btn-outline btn-sm" onClick={onRetry}>
          <Icon name="refresh" size={16} /> Try again
        </button>
      )}
    </div>
  );
}
