import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import OwnerDashboardPage from './pages/OwnerDashboardPage';
import ListingFormPage from './pages/ListingFormPage';
import TenantProfilePage from './pages/TenantProfilePage';
import SearchPage from './pages/SearchPage';
import InterestInboxPage from './pages/InterestInboxPage';
import ChatPage from './pages/ChatPage';
import AdminPage from './pages/AdminPage';
import NotFoundPage from './pages/NotFoundPage';

// Root index redirector based on authentication and role
function RootRedirect() {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  switch (user.role) {
    case 'OWNER':
      return <Navigate to="/owner/dashboard" replace />;
    case 'ADMIN':
      return <Navigate to="/admin" replace />;
    case 'TENANT':
    default:
      return <Navigate to="/search" replace />;
  }
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900">
          <Navbar />
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Routes>
              {/* Root redirect */}
              <Route path="/" element={<RootRedirect />} />

              {/* Public Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Protected Routes for TENANT */}
              <Route
                path="/search"
                element={
                  <ProtectedRoute allowedRoles={['TENANT', 'ADMIN']}>
                    <SearchPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute allowedRoles={['TENANT']}>
                    <TenantProfilePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inbox"
                element={
                  <ProtectedRoute allowedRoles={['TENANT', 'OWNER']}>
                    <InterestInboxPage />
                  </ProtectedRoute>
                }
              />

              {/* Protected Routes for OWNER */}
              <Route
                path="/owner/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['OWNER']}>
                    <OwnerDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/listings/new"
                element={
                  <ProtectedRoute allowedRoles={['OWNER']}>
                    <ListingFormPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/listings/edit/:id"
                element={
                  <ProtectedRoute allowedRoles={['OWNER']}>
                    <ListingFormPage />
                  </ProtectedRoute>
                }
              />

              {/* Protected Routes for ADMIN */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <AdminPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <AdminPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/listings"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <AdminPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/interests"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <AdminPage />
                  </ProtectedRoute>
                }
              />

              {/* Protected Chat Routes for TENANT and OWNER */}
              <Route
                path="/chat/:interestId"
                element={
                  <ProtectedRoute allowedRoles={['TENANT', 'OWNER']}>
                    <ChatPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/chat"
                element={<Navigate to="/inbox" replace />}
              />

              {/* 404 Fallback */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
