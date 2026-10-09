import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ allowedRoles = [], children }) {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Verifying authentication...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role authorization if allowedRoles are specified
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    const defaultHome =
      user.role === 'OWNER'
        ? '/owner/dashboard'
        : user.role === 'ADMIN'
        ? '/admin'
        : '/search';

    return (
      <div className="max-w-xl mx-auto py-16 px-4">
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-8 text-center space-y-5 shadow-sm">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-100 border border-rose-200 text-rose-700 text-2xl font-bold">
            🛡️
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Access Denied</h1>
            <p className="text-sm text-slate-600 mt-2">
              Your role <span className="font-semibold text-rose-700">[{user.role}]</span> is not authorized to access this section.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Required role(s): {allowedRoles.join(', ')}
            </p>
          </div>
          <div className="pt-2">
            <Link
              to={defaultHome}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all"
            >
              Return to Your Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
