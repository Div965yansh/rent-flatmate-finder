import React, { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // Determine role-appropriate navigation links
  const getNavLinks = () => {
    if (!isAuthenticated || !user) {
      return [{ to: '/login', label: 'Explore & Search' }];
    }

    switch (user.role) {
      case 'OWNER':
        return [
          { to: '/owner/dashboard', label: 'Owner Dashboard' },
          { to: '/listings/new', label: 'New Listing' },
          { to: '/inbox', label: 'Interest Inbox' },
        ];
      case 'ADMIN':
        return [
          { to: '/admin', label: 'Admin Dashboard' },
          { to: '/admin/users', label: 'Users' },
          { to: '/admin/listings', label: 'Listings' },
          { to: '/admin/interests', label: 'Interests' },
        ];
      case 'TENANT':
      default:
        return [
          { to: '/search', label: 'Search & Match' },
          { to: '/profile', label: 'My Profile' },
          { to: '/inbox', label: 'My Interests' },
        ];
    }
  };

  const navLinks = getNavLinks();

  const roleBadgeColors = {
    TENANT: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    OWNER: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    ADMIN: 'bg-rose-50 text-rose-700 border-rose-200',
  };

  const defaultHome = isAuthenticated && user
    ? user.role === 'OWNER'
      ? '/owner/dashboard'
      : user.role === 'ADMIN'
      ? '/admin'
      : '/search'
    : '/login';

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/90 border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link to={defaultHome} className="flex items-center gap-3 group">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-indigo-700 flex items-center justify-center font-bold text-white shadow-sm group-hover:scale-105 transition-transform">
              RF
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-base tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors">
                Rent & Flatmate
              </span>
              <span className="text-[10px] uppercase tracking-widest text-indigo-600 font-bold">
                Finder
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* Auth Section */}
          <div className="hidden sm:flex items-center gap-3">
            {isAuthenticated && user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-xs font-semibold text-slate-800">{user.name}</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                      roleBadgeColors[user.role] || roleBadgeColors.TENANT
                    }`}
                  >
                    {user.role}
                  </span>
                </div>
                <button
                  id="nav-logout-btn"
                  onClick={handleLogout}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <NavLink
                  to="/login"
                  className={({ isActive }) =>
                    `px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-slate-100 text-slate-900 border border-slate-300 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`
                  }
                >
                  Login
                </NavLink>
                <NavLink
                  to="/register"
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition-all hover:scale-[1.02]"
                >
                  Register
                </NavLink>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <div className="flex lg:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-3 border-t border-slate-200 flex flex-col gap-1">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg text-sm font-medium ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
            <div className="pt-2 mt-2 border-t border-slate-200 flex items-center gap-2">
              {isAuthenticated && user ? (
                <div className="flex flex-col w-full gap-2">
                  <div className="flex items-center justify-between px-2 py-1 text-xs text-slate-700">
                    <span className="font-semibold">{user.name}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${roleBadgeColors[user.role]}`}>
                      {user.role}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleLogout();
                    }}
                    className="w-full text-center px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 text-rose-600 hover:bg-rose-50 cursor-pointer"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <>
                  <NavLink
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 text-center px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200"
                  >
                    Login
                  </NavLink>
                  <NavLink
                    to="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 text-center px-3 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700"
                  >
                    Register
                  </NavLink>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
