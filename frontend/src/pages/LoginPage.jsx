import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, isAuthenticated, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [clientErrors, setClientErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Helper to determine destination based on role
  const getRoleDestination = (role) => {
    switch (role) {
      case 'OWNER':
        return '/owner/dashboard';
      case 'ADMIN':
        return '/admin';
      case 'TENANT':
      default:
        return '/search';
    }
  };

  // If already authenticated, redirect immediately
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      const from = location.state?.from?.pathname;
      navigate(from || getRoleDestination(user.role), { replace: true });
    }
  }, [authLoading, isAuthenticated, user, navigate, location]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (clientErrors[name]) {
      setClientErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (apiError) {
      setApiError('');
    }
  };

  const validate = () => {
    const errors = {};
    if (!formData.email.trim()) {
      errors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'Please provide a valid email address';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    }

    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');

    if (!validate()) {
      return;
    }

    setSubmitting(true);

    try {
      const { user: loggedInUser } = await login({
        email: formData.email.trim(),
        password: formData.password,
      });

      const destination = getRoleDestination(loggedInUser.role);
      navigate(destination, { replace: true });
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.message ||
        'Unable to log in. Please check your network and credentials.';
      setApiError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-gradient-to-br from-indigo-100/40 to-purple-100/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <span>🔐 Authentication</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Welcome Back</h1>
            <p className="text-xs text-slate-600">
              Sign in with your email and password to access your dashboard.
            </p>
          </div>

          {apiError && (
            <div
              id="login-error-alert"
              className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5"
            >
              <span className="text-base leading-none">⚠️</span>
              <span className="flex-1 font-medium">{apiError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email Address
              </label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                disabled={submitting}
                className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 transition-all ${
                  clientErrors.email
                    ? 'border-rose-400 focus:ring-rose-500/20'
                    : 'border-slate-200 focus:border-indigo-600 focus:ring-indigo-500/20'
                }`}
              />
              {clientErrors.email && (
                <p className="mt-1.5 text-xs text-rose-600 font-medium">{clientErrors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                disabled={submitting}
                className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 transition-all ${
                  clientErrors.password
                    ? 'border-rose-400 focus:ring-rose-500/20'
                    : 'border-slate-200 focus:border-indigo-600 focus:ring-indigo-500/20'
                }`}
              />
              {clientErrors.password && (
                <p className="mt-1.5 text-xs text-rose-600 font-medium">{clientErrors.password}</p>
              )}
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              disabled={submitting}
              className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-xs tracking-wide uppercase bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-600">
              Don't have an account?{' '}
              <Link to="/register" className="text-indigo-600 hover:text-indigo-700 font-semibold underline underline-offset-2">
                Register here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
