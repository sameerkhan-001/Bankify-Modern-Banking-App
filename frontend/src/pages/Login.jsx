import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Link, useNavigate } from '../router.jsx';
import { Alert, Spinner } from '../components/Feedback.jsx';
import FormField from '../components/FormField.jsx';
import AuthLayout from './AuthLayout.jsx';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  const update = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const validate = () => {
    const next = {};
    if (!EMAIL_REGEX.test(form.email.trim())) next.email = 'Enter a valid email address';
    if (!form.password) next.password = 'Enter your password';
    return next;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return; // no duplicate submissions

    const found = validate();
    setErrors(found);
    setServerError('');
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      await login(form.email.trim(), form.password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setServerError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome Back"
      subtitle="Login to access your account"
      art={{ title: 'Your Finances Our Priority', text: 'Secure, fast and reliable banking for everyone.' }}
    >
      <form onSubmit={onSubmit} noValidate className="form">
        {serverError && <Alert title="Login failed">{serverError}</Alert>}

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
          autoComplete="current-password"
          placeholder="Your password"
          value={form.password}
          onChange={update('password')}
          error={errors.password}
        />

        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? <Spinner size={16} label="Signing in…" /> : 'Login'}
        </button>
      </form>

      <p className="auth-switch">
        Don't have an account? <Link to="/register">Register</Link>
      </p>
    </AuthLayout>
  );
}
