import { useState } from 'react';
import { api } from '../services/api.js';
import { Alert, Spinner } from './Feedback.jsx';
import FormField from './FormField.jsx';

const PIN_REGEX = /^\d{6}$/;
const digitsOnly = (value) => value.replace(/\D/g, '').slice(0, 6);
const pinProps = { type: 'password', inputMode: 'numeric', autoComplete: 'off', maxLength: 6, placeholder: '6 digits' };

/**
 * Shared behaviour of the three PIN forms: field state, validation, one submit at a time,
 * server error display.  `rules(values)` returns { field: message } for invalid fields.
 */
function usePinForm(initial, rules, send, onDone) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);

  const bind = (field, transform = (v) => v) => ({
    value: values[field],
    error: errors[field],
    onChange: (event) => {
      setValues((prev) => ({ ...prev, [field]: transform(event.target.value) }));
      setErrors((prev) => ({ ...prev, [field]: undefined }));
      setServerError('');
    },
  });

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return; // no duplicate submissions
    const found = rules(values);
    setErrors(found);
    if (Object.keys(found).length) return;

    setBusy(true);
    setServerError('');
    try {
      await send(values);
      setValues(initial);
      await onDone();
    } catch (err) {
      setServerError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return { bind, submit, busy, serverError };
}

const checkNewPin = (values, field = 'pin') => {
  const found = {};
  if (!PIN_REGEX.test(values[field])) found[field] = 'PIN must be exactly 6 digits';
  else if (values.confirm !== values[field]) found.confirm = 'PINs do not match';
  return found;
};

function FormShell({ onSubmit, busy, serverError, submitLabel, children }) {
  return (
    <form className="form pin-form" onSubmit={onSubmit} noValidate>
      {serverError && <Alert title="Could not save PIN">{serverError}</Alert>}
      {children}
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? <Spinner size={16} label="Saving…" /> : submitLabel}
      </button>
    </form>
  );
}

/** First time: choose a PIN (needs the login password). */
export function SetPinForm({ onDone }) {
  const f = usePinForm(
    { password: '', pin: '', confirm: '' },
    (v) => ({ ...(v.password ? {} : { password: 'Enter your login password' }), ...checkNewPin(v) }),
    (v) => api.setPin({ password: v.password, pin: v.pin }),
    onDone
  );
  return (
    <FormShell {...f} onSubmit={f.submit} submitLabel="Set transaction PIN">
      <FormField label="Login password" type="password" autoComplete="current-password" {...f.bind('password')} />
      <FormField label="New 6-digit PIN" {...pinProps} {...f.bind('pin', digitsOnly)} hint="You will enter this PIN every time you send money." />
      <FormField label="Confirm PIN" {...pinProps} {...f.bind('confirm', digitsOnly)} />
    </FormShell>
  );
}

/** Change: needs the current PIN. */
export function ChangePinForm({ onDone }) {
  const f = usePinForm(
    { currentPin: '', pin: '', confirm: '' },
    (v) => ({ ...(PIN_REGEX.test(v.currentPin) ? {} : { currentPin: 'Enter your current 6-digit PIN' }), ...checkNewPin(v) }),
    (v) => api.changePin({ currentPin: v.currentPin, newPin: v.pin }),
    onDone
  );
  return (
    <FormShell {...f} onSubmit={f.submit} submitLabel="Change PIN">
      <FormField label="Current PIN" {...pinProps} {...f.bind('currentPin', digitsOnly)} />
      <FormField label="New 6-digit PIN" {...pinProps} {...f.bind('pin', digitsOnly)} />
      <FormField label="Confirm new PIN" {...pinProps} {...f.bind('confirm', digitsOnly)} />
    </FormShell>
  );
}

/** Forgot PIN: prove who you are with the login password, then choose a new PIN. */
export function ResetPinForm({ onDone }) {
  const f = usePinForm(
    { password: '', pin: '', confirm: '' },
    (v) => ({ ...(v.password ? {} : { password: 'Enter your login password' }), ...checkNewPin(v) }),
    (v) => api.resetPin({ password: v.password, newPin: v.pin }),
    onDone
  );
  return (
    <FormShell {...f} onSubmit={f.submit} submitLabel="Reset PIN">
      <FormField label="Login password" type="password" autoComplete="current-password" {...f.bind('password')} hint="We ask for your password to make sure it is really you." />
      <FormField label="New 6-digit PIN" {...pinProps} {...f.bind('pin', digitsOnly)} />
      <FormField label="Confirm new PIN" {...pinProps} {...f.bind('confirm', digitsOnly)} />
    </FormShell>
  );
}
