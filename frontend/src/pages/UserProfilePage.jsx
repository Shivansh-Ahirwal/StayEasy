import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const ROLE_LABELS = {
  admin: { label: 'Admin', color: '#7c3aed', bg: '#f5f3ff' },
  manager: { label: 'Property Manager', color: '#b45309', bg: '#fffbeb' },
  user: { label: 'Guest', color: '#0369a1', bg: '#f0f9ff' },
};

function getInitials(user) {
  if (!user) return '?';
  const first = user.first_name?.trim();
  const last = user.last_name?.trim();
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first) return first[0].toUpperCase();
  return user.email?.[0]?.toUpperCase() ?? '?';
}

function getDisplayName(user) {
  if (!user) return '';
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
  return name || user.email;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function UserProfilePage() {
  const navigate = useNavigate();
  const { user, refreshMe, logout } = useAuth();

  // Edit profile
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileErr, setProfileErr] = useState('');

  // Change password
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Seed form when user loads
  useEffect(() => {
    if (user) {
      setFirstName(user.first_name ?? '');
      setLastName(user.last_name ?? '');
    }
  }, [user]);

  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileErr('');
    setProfileSuccess('');
    setProfileBusy(true);
    try {
      await api.patch('/auth/me/', {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });
      await refreshMe();
      setProfileSuccess('Profile updated successfully.');
    } catch (ex) {
      const body = ex.response?.data;
      setProfileErr(
        body?.detail || (typeof body === 'object' ? JSON.stringify(body) : ex.message),
      );
    } finally {
      setProfileBusy(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPwErr('');
    setPwSuccess('');
    if (newPassword !== confirmPassword) {
      setPwErr('New passwords do not match.');
      return;
    }
    setPwBusy(true);
    try {
      await api.post('/auth/change-password/', {
        old_password: oldPassword,
        new_password: newPassword,
      });
      setPwSuccess('Password changed. You will need to log in again.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      // Delay logout so the user can read the message
      setTimeout(() => logout(), 2500);
    } catch (ex) {
      const body = ex.response?.data;
      setPwErr(
        body?.old_password?.[0] ||
        body?.new_password?.[0] ||
        body?.detail ||
        (typeof body === 'object' ? JSON.stringify(body) : ex.message),
      );
    } finally {
      setPwBusy(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!user) {
    return (
      <div className="section">
        <p className="muted">Loading your profile…</p>
      </div>
    );
  }

  const role = ROLE_LABELS[user.role] ?? ROLE_LABELS.user;
  const initials = getInitials(user);
  const displayName = getDisplayName(user);

  return (
    <div className="up-page">

      {/* Profile hero */}
      <div className="up-hero">
        <div className="up-hero__inner">
          <div className="up-avatar">{initials}</div>
          <div className="up-hero__text">
            <h1 className="up-hero__name">{displayName}</h1>
            <div className="up-hero__email">{user.email}</div>
            <span
              className="up-role-badge"
              style={{ color: role.color, background: role.bg }}
            >
              {role.label}
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="up-body">
        <div className="up-body__inner">

          {/* Left: forms */}
          <div className="up-main">

            {/* Edit profile */}
            <div className="panel up-section">
              <div className="up-section__head">
                <div className="up-section__icon">✏️</div>
                <div>
                  <h2 className="up-section__title">Edit Profile</h2>
                  <p className="up-section__sub">Update your display name.</p>
                </div>
              </div>

              {profileErr && (
                <div className="up-alert up-alert--error" role="alert">
                  <span>⚠</span> {profileErr}
                </div>
              )}
              {profileSuccess && (
                <div className="up-alert up-alert--success" role="status">
                  <span>✓</span> {profileSuccess}
                </div>
              )}

              <form onSubmit={saveProfile} noValidate>
                <div className="up-field-row">
                  <div className="lp-field">
                    <label className="lp-label" htmlFor="up-first">First name</label>
                    <input
                      id="up-first"
                      className="lp-input"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="First name"
                      autoComplete="given-name"
                    />
                  </div>
                  <div className="lp-field">
                    <label className="lp-label" htmlFor="up-last">Last name</label>
                    <input
                      id="up-last"
                      className="lp-input"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Last name"
                      autoComplete="family-name"
                    />
                  </div>
                </div>

                <div className="lp-field">
                  <label className="lp-label">Email address</label>
                  <input
                    className="lp-input up-input--readonly"
                    value={user.email}
                    readOnly
                    tabIndex={-1}
                  />
                  <div className="up-field-hint">Email cannot be changed.</div>
                </div>

                <button
                  type="submit"
                  className="btn-search up-save-btn"
                  disabled={profileBusy}
                >
                  {profileBusy ? 'Saving…' : 'Save changes'}
                </button>
              </form>
            </div>

            {/* Change password */}
            <div className="panel up-section">
              <div className="up-section__head">
                <div className="up-section__icon">🔒</div>
                <div>
                  <h2 className="up-section__title">Change Password</h2>
                  <p className="up-section__sub">
                    Use a strong password — at least 8 characters. You will be logged out after changing.
                  </p>
                </div>
              </div>

              {pwErr && (
                <div className="up-alert up-alert--error" role="alert">
                  <span>⚠</span> {pwErr}
                </div>
              )}
              {pwSuccess && (
                <div className="up-alert up-alert--success" role="status">
                  <span>✓</span> {pwSuccess}
                </div>
              )}

              <form onSubmit={changePassword} noValidate>
                <div className="lp-field">
                  <label className="lp-label" htmlFor="up-old-pw">Current password</label>
                  <div className="up-pw-wrap">
                    <input
                      id="up-old-pw"
                      className="lp-input"
                      type={showOld ? 'text' : 'password'}
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="up-pw-toggle"
                      onClick={() => setShowOld((v) => !v)}
                      aria-label={showOld ? 'Hide password' : 'Show password'}
                    >
                      {showOld ? '🙈' : '👁'}
                    </button>
                  </div>
                </div>

                <div className="lp-field">
                  <label className="lp-label" htmlFor="up-new-pw">New password</label>
                  <div className="up-pw-wrap">
                    <input
                      id="up-new-pw"
                      className="lp-input"
                      type={showNew ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      minLength={8}
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="up-pw-toggle"
                      onClick={() => setShowNew((v) => !v)}
                      aria-label={showNew ? 'Hide password' : 'Show password'}
                    >
                      {showNew ? '🙈' : '👁'}
                    </button>
                  </div>
                </div>

                <div className="lp-field">
                  <label className="lp-label" htmlFor="up-confirm-pw">Confirm new password</label>
                  <div className="up-pw-wrap">
                    <input
                      id="up-confirm-pw"
                      className={`lp-input${confirmPassword && confirmPassword !== newPassword ? ' up-input--error' : ''}`}
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="up-pw-toggle"
                      onClick={() => setShowConfirm((v) => !v)}
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    >
                      {showConfirm ? '🙈' : '👁'}
                    </button>
                  </div>
                  {confirmPassword && confirmPassword !== newPassword && (
                    <div className="up-field-hint up-field-hint--error">Passwords do not match.</div>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn-search up-save-btn up-save-btn--danger"
                  disabled={pwBusy || !oldPassword || !newPassword || newPassword !== confirmPassword}
                >
                  {pwBusy ? 'Updating…' : 'Update password'}
                </button>
              </form>
            </div>

            {/* Danger zone */}
            <div className="panel up-danger-zone">
              <div className="up-section__head">
                <div className="up-section__icon">🚪</div>
                <div>
                  <h2 className="up-section__title up-section__title--danger">Sign out</h2>
                  <p className="up-section__sub">
                    You will be returned to the home page and will need to log in again.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="up-logout-btn"
                onClick={handleLogout}
              >
                Log out of STAYEazy
              </button>
            </div>
          </div>

          {/* Right: account info */}
          <aside className="up-aside">
            <div className="panel up-info-card">
              <div className="up-info-card__title">Account details</div>

              <div className="up-info-row">
                <span className="up-info-row__label">Member since</span>
                <span className="up-info-row__val">{formatDate(user.date_joined)}</span>
              </div>
              <div className="up-info-row">
                <span className="up-info-row__label">Account type</span>
                <span
                  className="up-role-badge up-role-badge--sm"
                  style={{ color: role.color, background: role.bg }}
                >
                  {role.label}
                </span>
              </div>
              <div className="up-info-row">
                <span className="up-info-row__label">User ID</span>
                <span className="up-info-row__val up-info-row__val--mono">#{user.id}</span>
              </div>
            </div>

            <div className="panel up-quicklinks-card">
              <div className="up-info-card__title">Quick links</div>
              <nav className="up-quicklinks">
                <Link to="/bookings" className="up-quicklink">
                  <span className="up-quicklink__icon">📋</span>
                  <span>My bookings</span>
                  <span className="up-quicklink__arrow">›</span>
                </Link>
                {(user.role === 'manager' || user.role === 'admin') && (
                  <Link to="/manager" className="up-quicklink">
                    <span className="up-quicklink__icon">🏨</span>
                    <span>Property dashboard</span>
                    <span className="up-quicklink__arrow">›</span>
                  </Link>
                )}
                <Link to="/list-property" className="up-quicklink">
                  <span className="up-quicklink__icon">➕</span>
                  <span>List a property</span>
                  <span className="up-quicklink__arrow">›</span>
                </Link>
                <Link to="/" className="up-quicklink">
                  <span className="up-quicklink__icon">🔍</span>
                  <span>Browse hotels</span>
                  <span className="up-quicklink__arrow">›</span>
                </Link>
              </nav>
            </div>
          </aside>

        </div>
      </div>
    </div>
  );
}
