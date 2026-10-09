import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="max-w-md mx-auto py-20 px-4 text-center space-y-6">
      <div className="text-6xl font-black text-indigo-600">404</div>
      <h1 className="text-2xl font-bold text-slate-900">Page Not Found</h1>
      <p className="text-sm text-slate-600">
        The requested path does not exist in the platform route map.
      </p>
      <div>
        <Link
          to="/"
          className="inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all"
        >
          Return to Home
        </Link>
      </div>
    </div>
  );
}
