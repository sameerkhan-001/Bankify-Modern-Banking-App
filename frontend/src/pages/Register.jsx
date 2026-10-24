import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Link, useNavigate } from '../router.jsx';
import { Alert, Spinner } from '../components/Feedback.jsx';
import FormField from '../components/FormField.jsx';
import AuthLayout from './AuthLayout.jsx';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  const update = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  // mirrors the backend rules (name required, valid email, password 6-128 chars)
  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = 'Enter your full name';
    else if (form.name.trim().length > 100) next.name = 'Name can be at most 100 characters';
    if (!EMAIL_REGEX.test(form.email.trim())) next.email = 'Enter a valid email address';
    if (form.password.length < 6) next.password = 'Password must be at least 6 characters';
    else if (form.password.length > 128) next.password = 'Password can be at most 128 characters';
    return next;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const found = validate();
    setErrors(found);
    setServerError('');
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      await register(form.name.trim(), form.email.trim(), form.password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setServerError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create Account"
      subtitle="Join us and start your banking journey"
      art={{ title: 'Start Your Financial Journey', text: 'Create an account and experience modern banking.' }}
    >
      <form onSubmit={onSubmit} noValidate className="form">
        {serverError && <Alert title="Registration failed">{serverError}</Alert>}

        <FormField label="Full Name" icon="user" autoComplete="name" placeholder="John Doe" value={form.name} onChange={update('name')} error={errors.name} />
        <FormField
          label="Email"
          type="email"
          icon="mail"
          autoComplete="email"
          placeholder="user@example.com"
          value={form.email}
          onChange={update('email')}
          error={errors.email}
        />
        <FormField
          label="Password"
          type="password"
          icon="lock"
          autoComplete="new-password"
          placeholder="At least 6 characters"
          value={form.password}
          onChange={update('password')}
          error={errors.password}
        />

        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? <Spinner size={16} label="Creating account…" /> : 'Register'}
        </button>
      </form>

      <p className="auth-switch">
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </AuthLayout>
  );
}
