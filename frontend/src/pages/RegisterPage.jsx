import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const { register, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      await register({
        email,
        password,
        first_name: firstName,
        last_name: lastName,
      });
      await login(email, password);
      navigate('/');
    } catch (ex) {
      setErr(JSON.stringify(ex.response?.data) || ex.message);
    }
  };

  return (
    <div className="page-narrow">
      <div className="auth-card">
        <Link to="/" className="logo" style={{ marginBottom: '1.25rem', display: 'inline-flex' }}>
          STAY<span>Eazy</span>
        </Link>
        <h1>Sign up</h1>
        <p className="lead">Join to book faster and manage your trips.</p>
        <form onSubmit={submit}>
          <div className="form-group">
            <label htmlFor="reg-fn">First name</label>
            <input
              id="reg-fn"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              autoComplete="given-name"
            />
          </div>
          <div className="form-group">
            <label htmlFor="reg-ln">Last name</label>
            <input
              id="reg-ln"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
            />
          </div>
          <div className="form-group">
            <label htmlFor="reg-email">Email</label>
            <input
              id="reg-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label htmlFor="reg-pass">Password (min 8 characters)</label>
            <input
              id="reg-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              autoComplete="new-password"
            />
          </div>
          {err && <p className="error">{String(err)}</p>}
          <button type="submit" className="btn-search" style={{ width: '100%', marginTop: '0.5rem' }}>
            Create account
          </button>
        </form>
        <p className="muted" style={{ marginTop: '1.25rem', marginBottom: 0 }}>
          Already registered? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}
