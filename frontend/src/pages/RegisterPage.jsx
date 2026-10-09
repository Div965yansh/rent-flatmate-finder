import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const { register, isAuthenticated, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'tenant', // Default to tenant
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

  // If already authenticated, redirect
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      navigate(getRoleDestination(user.role), { replace: true });
    }
  }, [authLoading, isAuthenticated, user, navigate]);

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
    if (!formData.name.trim()) {
      errors.name = 'Full name is required';
    }

    if (!formData.email.trim()) {
      errors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'Please provide a valid email address';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters long';
    }

    if (formData.role !== 'tenant' && formData.role !== 'owner') {
      errors.role = 'Role must be either Tenant or Property Owner';
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
      const { user: registeredUser } = await register({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role: formData.role,
      });

      const destination = getRoleDestination(registeredUser.role);
      navigate(destination, { replace: true });
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.message ||
        'Failed to register account. Please try again.';
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
              <span>🚀 Get Started</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Create Account</h1>
            <p className="text-xs text-slate-600">
              Join to find flatmates or list your properties.
            </p>
          </div>

          {apiError && (
            <div
              id="register-error-alert"
              className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5"
            >
              <span className="text-base leading-none">⚠️</span>
              <span className="flex-1 font-medium">{apiError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="register-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Full Name
              </label>
              <input
                id="register-name"
                name="name"
                type="text"
                autoComplete="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Alex Mercer"
                disabled={submitting}
                className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 transition-all ${
                  clientErrors.name
                    ? 'border-rose-400 focus:ring-rose-500/20'
                    : 'border-slate-200 focus:border-indigo-600 focus:ring-indigo-500/20'
                }`}
              />
              {clientErrors.name && (
                <p className="mt-1.5 text-xs text-rose-600 font-medium">{clientErrors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="register-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email Address
              </label>
              <input
                id="register-email"
                name="email"
                type="email"
                autoComplete="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="alex@example.com"
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
              <label htmlFor="register-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <input
                id="register-password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={formData.password}
                onChange={handleChange}
                placeholder="At least 6 characters"
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

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                I am registering as:
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label
                  htmlFor="role-tenant"
                  className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-all ${
                    formData.role === 'tenant'
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-900 shadow-xs'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      id="role-tenant"
                      type="radio"
                      name="role"
                      value="tenant"
                      checked={formData.role === 'tenant'}
                      onChange={handleChange}
                      disabled={submitting}
                      className="accent-indigo-600"
                    />
                    <span className="text-xs font-bold text-slate-900">Tenant</span>
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1 pl-5">
                    Looking for rentals or flatmates
                  </span>
                </label>

                <label
                  htmlFor="role-owner"
                  className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-all ${
                    formData.role === 'owner'
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-900 shadow-xs'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      id="role-owner"
                      type="radio"
                      name="role"
                      value="owner"
                      checked={formData.role === 'owner'}
                      onChange={handleChange}
                      disabled={submitting}
                      className="accent-indigo-600"
                    />
                    <span className="text-xs font-bold text-slate-900">Owner</span>
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1 pl-5">
                    Listing rooms or flats for rent
                  </span>
                </label>
              </div>
              {clientErrors.role && (
                <p className="mt-1.5 text-xs text-rose-600 font-medium">{clientErrors.role}</p>
              )}
            </div>

            <button
              id="register-submit-btn"
              type="submit"
              disabled={submitting}
              className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-xs tracking-wide uppercase bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <span>Register Account</span>
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-600">
              Already have an account?{' '}
              <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-semibold underline underline-offset-2">
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
