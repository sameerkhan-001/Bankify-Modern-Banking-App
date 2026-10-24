import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { Spinner } from './Feedback.jsx';

/**
 * Asks for the 6-digit transaction PIN before money is sent.
 * `onSubmit(pin)` does the real request; the parent keeps the dialog open and passes
 * `error` when the server says the PIN is wrong / locked.
 */
export default function PinDialog({ title = 'Enter your transaction PIN', description, error, busy, onSubmit, onClose }) {
  const [pin, setPin] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (event) => event.key === 'Escape' && !busy && onClose();
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose, busy]);

  // a wrong PIN clears the box so the user can type again straight away
  useEffect(() => {
    if (error) {
      setPin('');
      inputRef.current?.focus();
    }
  }, [error]);

  const submit = (event) => {
    event.preventDefault();
    if (busy || pin.length !== 6) return;
    onSubmit(pin);
  };

  return (
    <div className="modal-overlay" data-lenis-prevent onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <form className="modal pin-modal" role="dialog" aria-modal="true" aria-labelledby="pin-title" onSubmit={submit}>
        <div className="modal-head">
          <h2 id="pin-title">
            <Icon name="lock" size={18} /> {title}
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} disabled={busy} aria-label="Close">
            <Icon name="x" size={20} />
          </button>
        </div>

        {description && <p className="muted">{description}</p>}

        <input
          ref={inputRef}
          className="input pin-input"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          placeholder="••••••"
          aria-label="6-digit transaction PIN"
          aria-invalid={error ? 'true' : undefined}
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
        />

        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={busy || pin.length !== 6}>
          {busy ? <Spinner size={16} label="Sending…" /> : 'Confirm & Send'}
        </button>
      </form>
    </div>
  );
}
