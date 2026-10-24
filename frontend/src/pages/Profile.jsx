import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDate, initial } from '../utils/format.js';
import Icon from '../components/Icon.jsx';
import { CopyButton } from '../components/Badges.jsx';
import { CardArt } from '../components/Illustrations.jsx';
import PageHead from '../components/PageHead.jsx';
import { Alert } from '../components/Feedback.jsx';
import { ChangePinForm, ResetPinForm, SetPinForm } from '../components/PinForms.jsx';

/**
 * Shows exactly the fields GET /auth/me provides (name, email, id, member since, hasPin).
 * The personal details are read-only; the only thing you can manage here is the transaction PIN.
 */
export default function Profile() {
  const { user, logout, refreshUser } = useAuth();
  const [pinMode, setPinMode] = useState(null); // null | 'change' | 'reset'
  const [pinDone, setPinDone] = useState('');

  const afterPinSaved = (message) => async () => {
    setPinMode(null);
    setPinDone(message);
    await refreshUser().catch(() => {});
  };

  return (
    <>
      <PageHead
        title="My Profile"
        subtitle="View your account information"
        action={
          <div className="readonly-badge">
            <Icon name="lock" size={18} />
            <div>
              <strong>Read-only profile</strong>
              <small>Your information is securely stored</small>
            </div>
          </div>
        }
      />

      <section className="profile-hero">
        <span className="avatar avatar-lg">{initial(user.name)}</span>
        <div className="profile-hero-text">
          <h2>{user.name}</h2>
          <p>{user.email}</p>
          <span className="badge badge-success">
            <span className="dot" /> Signed in
          </span>
        </div>
        <div className="profile-hero-art">
          <CardArt />
        </div>
      </section>

      <div className="profile-grid">
        <section className="card">
          <div className="card-head-icon">
            <span className="feature-icon"><Icon name="user" size={20} /></span>
            <div>
              <h2>Personal Information</h2>
              <p className="muted">Your basic account details</p>
            </div>
          </div>
          <dl className="info-list">
            <div>
              <dt><Icon name="user" size={18} /> Full Name</dt>
              <dd>{user.name}</dd>
            </div>
            <div>
              <dt><Icon name="mail" size={18} /> Email Address</dt>
              <dd className="id-wrap">{user.email}</dd>
            </div>
            <div>
              <dt><Icon name="calendar" size={18} /> Member Since</dt>
              <dd>{formatDate(user.createdAt)}</dd>
            </div>
            <div>
              <dt><Icon name="idCard" size={18} /> User ID</dt>
              <dd className="with-copy">
                <span className="mono id-wrap">{user._id}</span>
                <CopyButton value={user._id} label="Copy user ID" />
              </dd>
            </div>
          </dl>
        </section>

        <section className="card">
          <div className="card-head-icon">
            <span className="feature-icon"><Icon name="shield" size={20} /></span>
            <div>
              <h2>Security</h2>
              <p className="muted">Your account security information</p>
            </div>
          </div>
          <dl className="info-list">
            <div>
              <dt><Icon name="lock" size={18} /> Password</dt>
              <dd>••••••••••</dd>
            </div>
          </dl>
          <p className="field-hint">Your password is never displayed. Changing it is not available in this app.</p>

          <button type="button" className="logout-row" onClick={logout}>
            <Icon name="logout" size={20} />
            <span>
              <strong>Logout</strong>
              <small>Sign out from your account</small>
            </span>
            <Icon name="chevronRight" size={18} />
          </button>
        </section>

        <section className="card profile-wide">
          <div className="card-head-icon">
            <span className="feature-icon"><Icon name="shieldCheck" size={20} /></span>
            <div>
              <h2>Transaction PIN</h2>
              <p className="muted">A 6-digit PIN that protects every money transfer</p>
            </div>
          </div>

          {pinDone && <Alert tone="success" title={pinDone} onClose={() => setPinDone('')} />}

          {!user.hasPin ? (
            <>
              <p className="muted">You have not set a PIN yet. You need one before you can send money.</p>
              <SetPinForm onDone={afterPinSaved('Transaction PIN set')} />
            </>
          ) : (
            <>
              <div className="pin-status">
                <span className="badge badge-success"><span className="dot" /> PIN is set</span>
                <div className="tabs" role="tablist" aria-label="PIN actions">
                  <button type="button" className={`tab${pinMode === 'change' ? ' active' : ''}`} onClick={() => setPinMode(pinMode === 'change' ? null : 'change')}>
                    Change PIN
                  </button>
                  <button type="button" className={`tab${pinMode === 'reset' ? ' active' : ''}`} onClick={() => setPinMode(pinMode === 'reset' ? null : 'reset')}>
                    Forgot PIN
                  </button>
                </div>
              </div>
              {pinMode === 'change' && <ChangePinForm onDone={afterPinSaved('Transaction PIN changed')} />}
              {pinMode === 'reset' && <ResetPinForm onDone={afterPinSaved('Transaction PIN reset')} />}
            </>
          )}
        </section>
      </div>
    </>
  );
}
