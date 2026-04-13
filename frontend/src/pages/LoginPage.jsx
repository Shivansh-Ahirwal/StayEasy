import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      await login(email, password);
      navigate('/');
    } catch (ex) {
      setErr(
        ex.response?.data?.detail ||
          JSON.stringify(ex.response?.data) ||
          ex.message,
      );
    }
  };

  return (
    <div className="page-narrow">
      <div className="auth-card">
        <Link to="/" className="logo" style={{ marginBottom: '1.25rem', display: 'inline-flex' }}>
          STAY<span>Eazy</span>
        </Link>
        <h1>Login</h1>
        <p className="lead">Access your bookings and member offers.</p>
        <form onSubmit={submit}>
          <div className="form-group">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label htmlFor="login-pass">Password</label>
            <input
              id="login-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          {err && <p className="error">{String(err)}</p>}
          <button type="submit" className="btn-search" style={{ width: '100%', marginTop: '0.5rem' }}>
            Login
          </button>
        </form>
        <p className="muted" style={{ marginTop: '1.25rem', marginBottom: 0 }}>
          New to Yoyo? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
