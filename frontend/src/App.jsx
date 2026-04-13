import React from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import SiteFooter from './components/SiteFooter';
import HomePage from './pages/HomePage';
import HotelDetailPage from './pages/HotelDetailPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import BookingsPage from './pages/BookingsPage';
import ManagerDashboardPage from './pages/ManagerDashboardPage';
import SearchResultsPage from './pages/SearchResultsPage';

function canManageProperties(user) {
  return user?.role === 'manager' || user?.role === 'admin';
}

function NavBar() {
  const { user, logout, isAuthenticated } = useAuth();
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link to="/" className="logo">
          STAY<span>Eazy</span>
        </Link>
        <div className="site-header__links">
          <a href="#list-property" className="nav-link muted" style={{ fontSize: '0.85rem' }}>
            List your property
          </a>
          {isAuthenticated ? (
            <>
              <span className="nav-user" title={user?.email}>
                {user?.email}
              </span>
              <Link to="/bookings" className="nav-link">
                My bookings
              </Link>
              {canManageProperties(user) ? (
                <Link to="/manager" className="nav-link">
                  Property dashboard
                </Link>
              ) : null}
              <button
                type="button"
                className="nav-link nav-link--cta"
                onClick={logout}
                style={{ border: '1px solid var(--border)', cursor: 'pointer' }}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-link">
                Login
              </Link>
              <Link to="/register" className="nav-link nav-link--primary">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function ManagerRoute({ children }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user) {
    return (
      <div className="section">
        <p className="muted">Loading your account…</p>
      </div>
    );
  }
  if (!canManageProperties(user)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function Shell() {
  return (
    <div className="app-root">
      <NavBar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchResultsPage />} />
          <Route path="/hotels/:id" element={<HotelDetailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/bookings"
            element={
              <PrivateRoute>
                <BookingsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/manager"
            element={
              <ManagerRoute>
                <ManagerDashboardPage />
              </ManagerRoute>
            }
          />
        </Routes>
      </main>
      <SiteFooter />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
