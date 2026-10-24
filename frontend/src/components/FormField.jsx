import { useId, useState } from 'react';
import Icon from './Icon.jsx';

/** Label + input + inline error. `type="password"` gets a show/hide toggle. */
export default function FormField({ label, error, hint, type = 'text', icon, className = '', as, children, ...inputProps }) {
  const id = useId();
  const [reveal, setReveal] = useState(false);
  const isPassword = type === 'password';
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  const common = { id, 'aria-invalid': error ? 'true' : undefined, 'aria-describedby': describedBy, ...inputProps };

  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      <div className={`input-wrap${error ? ' has-error' : ''}`}>
        {icon && <Icon name={icon} size={18} className="input-icon" />}
        {as === 'select' ? (
          <select className="input" {...common}>
            {children}
          </select>
        ) : (
          <input className="input" type={isPassword && reveal ? 'text' : type} {...common} />
        )}
        {isPassword && (
          <button type="button" className="input-action" onClick={() => setReveal((v) => !v)} aria-label={reveal ? 'Hide password' : 'Show password'}>
            <Icon name={reveal ? 'eyeOff' : 'eye'} size={18} />
          </button>
        )}
      </div>
      {error ? (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      ) : (
        hint && (
          <p className="field-hint" id={`${id}-hint`}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}
