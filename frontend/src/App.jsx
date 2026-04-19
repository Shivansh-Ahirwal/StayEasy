import React, { useEffect, useRef, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CalendarCheck, LayoutDashboard, Plus } from './components/Icons';
import ChatBot from './components/ChatBot';
import SiteFooter from './components/SiteFooter';
import HomePage from './pages/HomePage';
import HotelDetailPage from './pages/HotelDetailPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import BookingsPage from './pages/BookingsPage';
import ManagerDashboardPage from './pages/ManagerDashboardPage';
import ListPropertyPage from './pages/ListPropertyPage';
import SearchResultsPage from './pages/SearchResultsPage';
import UserProfilePage from './pages/UserProfilePage';

function canManageProperties(user) {
  return user?.role === 'manager' || user?.role === 'admin';
}

function getInitials(user) {
  if (!user) return '?';
  const first = user.first_name?.trim();
  const last = user.last_name?.trim();
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first) return first[0].toUpperCase();
  return user.email?.[0]?.toUpperCase() ?? '?';
}

function NavBar() {
  const { user, isAuthenticated } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const location = useLocation();

  // close on route change
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  // close on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const close = () => setMenuOpen(false);

  return (
    <header className="site-header" ref={menuRef}>
      <div className="site-header__inner">
        <Link to="/" className="logo" onClick={close}>
          STAY<span>Eazy</span>
        </Link>

        {/* Desktop links */}
        <div className="site-header__links site-header__links--desktop">
          {!canManageProperties(user) && (
            <Link to="/list-property" className="nav-link nav-link--icon-label">
              <Plus size={14} /> List your property
            </Link>
          )}
          {isAuthenticated ? (
            <>
              <Link to="/bookings" className="nav-link nav-link--icon-label">
                <CalendarCheck size={14} /> My bookings
              </Link>
              {canManageProperties(user) && (
                <Link to="/manager" className="nav-link nav-link--icon-label">
                  <LayoutDashboard size={14} /> Property dashboard
                </Link>
              )}
              <Link to="/profile" className="nav-avatar" title={user?.email ?? 'My profile'}>
                {getInitials(user)}
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-link">Login</Link>
              <Link to="/register" className="nav-link nav-link--primary">Sign up</Link>
            </>
          )}
        </div>

        {/* Mobile right side: avatar (if logged in) + hamburger */}
        <div className="site-header__mobile-right">
          {isAuthenticated && (
            <Link to="/profile" className="nav-avatar" title={user?.email ?? 'My profile'} onClick={close}>
              {getInitials(user)}
            </Link>
          )}
          <button
            className={`nav-hamburger${menuOpen ? ' nav-hamburger--open' : ''}`}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span /><span /><span />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <nav className="nav-drawer" aria-label="Mobile navigation">
          {!canManageProperties(user) && (
            <Link to="/list-property" className="nav-drawer__item" onClick={close}>
              <Plus size={16} /> List your property
            </Link>
          )}
          {isAuthenticated ? (
            <>
              <Link to="/bookings" className="nav-drawer__item" onClick={close}>
                <CalendarCheck size={16} /> My bookings
              </Link>
              {canManageProperties(user) && (
                <Link to="/manager" className="nav-drawer__item" onClick={close}>
                  <LayoutDashboard size={16} /> Property dashboard
                </Link>
              )}
              <Link to="/profile" className="nav-drawer__item" onClick={close}>
                👤 My profile
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-drawer__item" onClick={close}>Login</Link>
              <Link to="/register" className="nav-drawer__item nav-drawer__item--primary" onClick={close}>
                Sign up free
              </Link>
            </>
          )}
        </nav>
      )}
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
            path="/profile"
            element={
              <PrivateRoute>
                <UserProfilePage />
              </PrivateRoute>
            }
          />
          <Route
            path="/list-property"
            element={
              <PrivateRoute>
                <ListPropertyPage />
              </PrivateRoute>
            }
          />
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
      <ChatBot />
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
