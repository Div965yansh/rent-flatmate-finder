import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

/**
 * Phase 9: Admin Dashboard & Platform Management
 *
 * Dedicated admin console for platform metrics, user lifecycle management,
 * listing moderation, and interest inquiry monitoring.
 */
export default function AdminPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user: currentAdmin } = useAuth();

  // Determine active tab from URL path
  const getTabFromPath = () => {
    if (location.pathname.includes('/users')) return 'users';
    if (location.pathname.includes('/listings')) return 'listings';
    if (location.pathname.includes('/interests')) return 'interests';
    return 'overview';
  };

  const activeTab = getTabFromPath();

  // 1. Overview / Statistics State
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState('');

  // 2. User Management State
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userActiveFilter, setUserActiveFilter] = useState('');
  const [userPagination, setUserPagination] = useState({ page: 1, limit: 15, total: 0, hasMore: false });

  // Confirmation modal state for user deactivation/activation
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    user: null,
    targetActive: false,
    processing: false,
    error: '',
  });

  // 3. Listing Management State
  const [listings, setListings] = useState([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [listingsError, setListingsError] = useState('');
  const [listingPage, setListingPage] = useState(1);
  const [listingStatusFilter, setListingStatusFilter] = useState('');
  const [listingPagination, setListingPagination] = useState({ page: 1, limit: 15, total: 0, hasMore: false });
  const [modifyingListingId, setModifyingListingId] = useState(null);

  // 4. Interest Monitoring State
  const [interests, setInterests] = useState([]);
  const [interestsLoading, setInterestsLoading] = useState(false);
  const [interestsError, setInterestsError] = useState('');
  const [interestPage, setInterestPage] = useState(1);
  const [interestStatusFilter, setInterestStatusFilter] = useState('');
  const [interestPagination, setInterestPagination] = useState({ page: 1, limit: 15, total: 0, hasMore: false });

  // Tab change handler
  const handleTabChange = (tab) => {
    if (tab === 'overview') navigate('/admin');
    else navigate(`/admin/${tab}`);
  };

  // --- Fetch Platform Stats ---
  useEffect(() => {
    let isMounted = true;
    async function loadStats() {
      try {
        setStatsLoading(true);
        setStatsError('');
        const res = await api.get('/admin/stats');
        if (isMounted) setStats(res.data);
      } catch (err) {
        if (isMounted) {
          setStatsError(err.response?.data?.error || 'Failed to load platform statistics');
        }
      } finally {
        if (isMounted) setStatsLoading(false);
      }
    }
    loadStats();
    return () => {
      isMounted = false;
    };
  }, []);

  // --- Fetch Users ---
  useEffect(() => {
    if (activeTab !== 'users' && activeTab !== 'overview') return;

    let isMounted = true;
    async function loadUsers() {
      try {
        setUsersLoading(true);
        setUsersError('');
        const params = new URLSearchParams({ page: String(userPage), limit: '15' });
        if (userRoleFilter) params.append('role', userRoleFilter);
        if (userActiveFilter !== '') params.append('isActive', userActiveFilter);

        const res = await api.get(`/admin/users?${params.toString()}`);
        if (isMounted) {
          setUsers(res.data.users || []);
          setUserPagination(res.data.pagination || { page: 1, limit: 15, total: 0, hasMore: false });
        }
      } catch (err) {
        if (isMounted) {
          setUsersError(err.response?.data?.error || 'Failed to load users');
        }
      } finally {
        if (isMounted) setUsersLoading(false);
      }
    }
    loadUsers();
    return () => {
      isMounted = false;
    };
  }, [activeTab, userPage, userRoleFilter, userActiveFilter]);

  // --- Fetch Listings ---
  useEffect(() => {
    if (activeTab !== 'listings') return;

    let isMounted = true;
    async function loadListings() {
      try {
        setListingsLoading(true);
        setListingsError('');
        const params = new URLSearchParams({ page: String(listingPage), limit: '15' });
        if (listingStatusFilter) params.append('status', listingStatusFilter);

        const res = await api.get(`/admin/listings?${params.toString()}`);
        if (isMounted) {
          setListings(res.data.listings || []);
          setListingPagination(res.data.pagination || { page: 1, limit: 15, total: 0, hasMore: false });
        }
      } catch (err) {
        if (isMounted) {
          setListingsError(err.response?.data?.error || 'Failed to load listings');
        }
      } finally {
        if (isMounted) setListingsLoading(false);
      }
    }
    loadListings();
    return () => {
      isMounted = false;
    };
  }, [activeTab, listingPage, listingStatusFilter]);

  // --- Fetch Interests ---
  useEffect(() => {
    if (activeTab !== 'interests') return;

    let isMounted = true;
    async function loadInterests() {
      try {
        setInterestsLoading(true);
        setInterestsError('');
        const params = new URLSearchParams({ page: String(interestPage), limit: '15' });
        if (interestStatusFilter) params.append('status', interestStatusFilter);

        const res = await api.get(`/admin/interests?${params.toString()}`);
        if (isMounted) {
          setInterests(res.data.interests || []);
          setInterestPagination(res.data.pagination || { page: 1, limit: 15, total: 0, hasMore: false });
        }
      } catch (err) {
        if (isMounted) {
          setInterestsError(err.response?.data?.error || 'Failed to load interest inquiries');
        }
      } finally {
        if (isMounted) setInterestsLoading(false);
      }
    }
    loadInterests();
    return () => {
      isMounted = false;
    };
  }, [activeTab, interestPage, interestStatusFilter]);

  // --- Action: Update User Status (Activate/Deactivate) ---
  const handleConfirmUserStatus = async () => {
    const { user: targetUser, targetActive } = confirmModal;
    if (!targetUser) return;

    try {
      setConfirmModal((prev) => ({ ...prev, processing: true, error: '' }));
      const res = await api.patch(`/admin/users/${targetUser.id}/status`, {
        isActive: targetActive,
      });
      const updatedUser = res.data.user;

      // Update state locally
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, isActive: updatedUser.isActive } : u))
      );

      // Also refresh stats active count
      if (stats) {
        setStats((prev) => ({
          ...prev,
          users: {
            ...prev.users,
            active: targetActive ? prev.users.active + 1 : prev.users.active - 1,
          },
        }));
      }

      setConfirmModal({ isOpen: false, user: null, targetActive: false, processing: false, error: '' });
    } catch (err) {
      setConfirmModal((prev) => ({
        ...prev,
        processing: false,
        error: err.response?.data?.error || 'Failed to update user status',
      }));
    }
  };

  // --- Action: Update Listing Status ---
  const handleUpdateListingStatus = async (listingId, newStatus) => {
    try {
      setModifyingListingId(listingId);
      const res = await api.patch(`/admin/listings/${listingId}/status`, {
        status: newStatus,
      });
      const updated = res.data.listing;

      setListings((prev) =>
        prev.map((l) => (l.id === listingId ? { ...l, status: updated.status } : l))
      );
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update listing status');
    } finally {
      setModifyingListingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div className="border-b border-slate-200 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 mb-2">
            <span>🛡️ Platform Governance</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Admin Control Center</h1>
          <p className="text-sm text-slate-600 mt-1">
            Supervise platform metrics, manage user permissions, moderate listings, and monitor inquiries.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 border border-slate-200 rounded-2xl self-start md:self-auto overflow-x-auto">
          {[
            { id: 'overview', label: '📊 Metrics' },
            { id: 'users', label: '👥 Users' },
            { id: 'listings', label: '🏠 Listings' },
            { id: 'interests', label: '💌 Inquiries' },
          ].map((tab) => (
            <button
              key={tab.id}
              id={`admin-tab-${tab.id}`}
              onClick={() => handleTabChange(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ================= 1. OVERVIEW / METRICS SECTION ================= */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {statsLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 border-4 border-rose-200 border-t-rose-600 rounded-full animate-spin" />
              <p className="text-sm text-slate-500 font-medium">Loading platform statistics...</p>
            </div>
          ) : statsError ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {statsError}
            </div>
          ) : stats ? (
            <div className="space-y-6">
              {/* Users Stat Cards */}
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  User Ecosystem
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
                    <span className="text-xs text-slate-500 block font-medium">Total Users</span>
                    <span className="text-2xl font-extrabold text-slate-900 mt-1 block">
                      {stats.users.total.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
                    <span className="text-xs text-indigo-600 block font-medium">Tenants</span>
                    <span className="text-2xl font-extrabold text-slate-900 mt-1 block">
                      {stats.users.tenants.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
                    <span className="text-xs text-emerald-600 block font-medium">Owners</span>
                    <span className="text-2xl font-extrabold text-slate-900 mt-1 block">
                      {stats.users.owners.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
                    <span className="text-xs text-rose-600 block font-medium">Admins</span>
                    <span className="text-2xl font-extrabold text-slate-900 mt-1 block">
                      {stats.users.admins.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
                    <span className="text-xs text-cyan-700 block font-medium">Active Accounts</span>
                    <span className="text-2xl font-extrabold text-slate-900 mt-1 block">
                      {stats.users.active.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Listings Stat Cards */}
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Rental Inventory
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
                    <span className="text-xs text-slate-500 block font-medium">Total Listings</span>
                    <span className="text-2xl font-extrabold text-slate-900 mt-1 block">
                      {stats.listings.total.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
                    <span className="text-xs text-emerald-600 block font-medium">Available</span>
                    <span className="text-2xl font-extrabold text-slate-900 mt-1 block">
                      {stats.listings.available.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
                    <span className="text-xs text-amber-700 block font-medium">Filled</span>
                    <span className="text-2xl font-extrabold text-slate-900 mt-1 block">
                      {stats.listings.filled.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
                    <span className="text-xs text-slate-500 block font-medium">Unavailable</span>
                    <span className="text-2xl font-extrabold text-slate-900 mt-1 block">
                      {stats.listings.unavailable.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Inquiries & Messaging Stat Cards */}
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Interests & Realtime Traffic
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
                    <span className="text-xs text-slate-500 block font-medium">Total Inquiries</span>
                    <span className="text-2xl font-extrabold text-slate-900 mt-1 block">
                      {stats.interests.total.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
                    <span className="text-xs text-amber-700 block font-medium">Pending Review</span>
                    <span className="text-2xl font-extrabold text-slate-900 mt-1 block">
                      {stats.interests.pending.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
                    <span className="text-xs text-emerald-600 block font-medium">Accepted</span>
                    <span className="text-2xl font-extrabold text-slate-900 mt-1 block">
                      {stats.interests.accepted.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
                    <span className="text-xs text-indigo-600 block font-medium">Messages Exchanged</span>
                    <span className="text-2xl font-extrabold text-slate-900 mt-1 block">
                      {stats.messages.total.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ================= 2. USER MANAGEMENT SECTION ================= */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div>
                <label htmlFor="user-role-filter" className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Filter by Role
                </label>
                <select
                  id="user-role-filter"
                  value={userRoleFilter}
                  onChange={(e) => {
                    setUserRoleFilter(e.target.value);
                    setUserPage(1);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-rose-500"
                >
                  <option value="">All Roles</option>
                  <option value="TENANT">Tenant</option>
                  <option value="OWNER">Owner</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              <div>
                <label htmlFor="user-status-filter" className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Filter by Status
                </label>
                <select
                  id="user-status-filter"
                  value={userActiveFilter}
                  onChange={(e) => {
                    setUserActiveFilter(e.target.value);
                    setUserPage(1);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-rose-500"
                >
                  <option value="">All Statuses</option>
                  <option value="true">Active Only</option>
                  <option value="false">Inactive Only</option>
                </select>
              </div>
            </div>

            <div className="text-xs text-slate-500 self-end sm:self-center">
              Total registered: <strong className="text-slate-900">{userPagination.total}</strong>
            </div>
          </div>

          {usersError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {usersError}
            </div>
          )}

          {/* Table */}
          {usersLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 border-4 border-rose-200 border-t-rose-600 rounded-full animate-spin" />
              <p className="text-sm text-slate-500 font-medium">Loading user accounts...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-dashed border-slate-200 bg-white p-8 space-y-2">
              <p className="text-sm font-semibold text-slate-900">No users matching the filters</p>
              <p className="text-xs text-slate-500">Try adjusting your role or status filter.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 uppercase tracking-wider text-[10px] text-slate-600 font-semibold">
                    <tr>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Registered</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((u) => {
                      const isSelf = currentAdmin?.id === u.id;
                      return (
                        <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            <div className="flex items-center gap-2">
                              <span>{u.name}</span>
                              {isSelf && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                                  You
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-500">{u.email}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                u.role === 'ADMIN'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : u.role === 'OWNER'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border ${
                                u.isActive
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  u.isActive ? 'bg-emerald-600' : 'bg-rose-600'
                                }`}
                              />
                              {u.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              id={`toggle-user-status-${u.id}`}
                              type="button"
                              disabled={isSelf}
                              onClick={() =>
                                setConfirmModal({
                                  isOpen: true,
                                  user: u,
                                  targetActive: !u.isActive,
                                  processing: false,
                                  error: '',
                                Huge: '',
                                })
                              }
                              title={isSelf ? 'Cannot deactivate your own admin account' : undefined}
                              className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                                isSelf
                                  ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200'
                                  : u.isActive
                                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {u.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* User Pagination Controls */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <span>
                  Page {userPagination.page} of {Math.max(1, Math.ceil(userPagination.total / userPagination.limit))}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={userPage <= 1}
                    onClick={() => setUserPage((p) => p - 1)}
                    className="px-3 py-1 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 border border-slate-200 shadow-xs transition-all cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    disabled={!userPagination.hasMore}
                    onClick={() => setUserPage((p) => p + 1)}
                    className="px-3 py-1 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 border border-slate-200 shadow-xs transition-all cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= 3. LISTINGS MANAGEMENT SECTION ================= */}
      {activeTab === 'listings' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div>
              <label htmlFor="listing-status-filter" className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Filter by Status
              </label>
              <select
                id="listing-status-filter"
                value={listingStatusFilter}
                onChange={(e) => {
                  setListingStatusFilter(e.target.value);
                  setListingPage(1);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-rose-500"
              >
                <option value="">All Statuses</option>
                <option value="AVAILABLE">Available</option>
                <option value="FILLED">Filled</option>
                <option value="UNAVAILABLE">Unavailable</option>
              </select>
            </div>

            <div className="text-xs text-slate-500">
              Total listings: <strong className="text-slate-900">{listingPagination.total}</strong>
            </div>
          </div>

          {listingsError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {listingsError}
            </div>
          )}

          {/* Table */}
          {listingsLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 border-4 border-rose-200 border-t-rose-600 rounded-full animate-spin" />
              <p className="text-sm text-slate-500 font-medium">Loading property listings...</p>
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-dashed border-slate-200 bg-white p-8 space-y-2">
              <p className="text-sm font-semibold text-slate-900">No listings found matching filter</p>
              <p className="text-xs text-slate-500">Try clearing or selecting a different status.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 uppercase tracking-wider text-[10px] text-slate-600 font-semibold">
                    <tr>
                      <th className="py-3 px-4">Listing</th>
                      <th className="py-3 px-4">Owner</th>
                      <th className="py-3 px-4">Location</th>
                      <th className="py-3 px-4">Rent</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Created</th>
                      <th className="py-3 px-4 text-right">Moderation Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {listings.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900 max-w-[200px] truncate">
                          {l.title}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          <div>{l.owner?.name || 'Owner'}</div>
                          <div className="text-[10px] text-slate-400">{l.owner?.email}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">📍 {l.location}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          ₹{Number(l.rent).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              l.status === 'AVAILABLE'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : l.status === 'FILLED'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {l.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {new Date(l.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <select
                            id={`moderate-listing-${l.id}`}
                            value={l.status}
                            disabled={modifyingListingId === l.id}
                            onChange={(e) => handleUpdateListingStatus(l.id, e.target.value)}
                            className="px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-900 focus:bg-white focus:border-rose-500 cursor-pointer disabled:opacity-50"
                          >
                            <option value="AVAILABLE">AVAILABLE</option>
                            <option value="FILLED">FILLED</option>
                            <option value="UNAVAILABLE">UNAVAILABLE</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Listing Pagination Controls */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <span>
                  Page {listingPagination.page} of {Math.max(1, Math.ceil(listingPagination.total / listingPagination.limit))}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={listingPage <= 1}
                    onClick={() => setListingPage((p) => p - 1)}
                    className="px-3 py-1 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 border border-slate-200 shadow-xs transition-all cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    disabled={!listingPagination.hasMore}
                    onClick={() => setListingPage((p) => p + 1)}
                    className="px-3 py-1 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 border border-slate-200 shadow-xs transition-all cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= 4. INTEREST MONITORING SECTION ================= */}
      {activeTab === 'interests' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div>
              <label htmlFor="interest-status-filter" className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Filter by Status
              </label>
              <select
                id="interest-status-filter"
                value={interestStatusFilter}
                onChange={(e) => {
                  setInterestStatusFilter(e.target.value);
                  setInterestPage(1);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:border-rose-500"
              >
                <option value="">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="DECLINED">Declined</option>
              </select>
            </div>

            <div className="text-xs text-slate-500">
              Total inquiries: <strong className="text-slate-900">{interestPagination.total}</strong>
            </div>
          </div>

          {interestsError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {interestsError}
            </div>
          )}

          {/* Table */}
          {interestsLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 border-4 border-rose-200 border-t-rose-600 rounded-full animate-spin" />
              <p className="text-sm text-slate-500 font-medium">Loading interest inquiries...</p>
            </div>
          ) : interests.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-dashed border-slate-200 bg-white p-8 space-y-2">
              <p className="text-sm font-semibold text-slate-900">No interest inquiries found</p>
              <p className="text-xs text-slate-500">Try choosing a different status filter.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 uppercase tracking-wider text-[10px] text-slate-600 font-semibold">
                    <tr>
                      <th className="py-3 px-4">Tenant</th>
                      <th className="py-3 px-4">Listing</th>
                      <th className="py-3 px-4">Owner</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {interests.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          <div>{item.tenant?.name || 'Tenant'}</div>
                          <div className="text-[10px] text-slate-400">{item.tenant?.email}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          <div className="font-medium text-slate-900">{item.listing?.title}</div>
                          <div className="text-[10px] text-slate-400">📍 {item.listing?.location}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          <div>{item.listing?.owner?.name || 'Owner'}</div>
                          <div className="text-[10px] text-slate-400">{item.listing?.owner?.email}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${
                              item.status === 'ACCEPTED'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : item.status === 'DECLINED'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Interest Pagination Controls */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <span>
                  Page {interestPagination.page} of {Math.max(1, Math.ceil(interestPagination.total / interestPagination.limit))}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={interestPage <= 1}
                    onClick={() => setInterestPage((p) => p - 1)}
                    className="px-3 py-1 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 border border-slate-200 shadow-xs transition-all cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    disabled={!interestPagination.hasMore}
                    onClick={() => setInterestPage((p) => p + 1)}
                    className="px-3 py-1 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 border border-slate-200 shadow-xs transition-all cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= CONFIRMATION MODAL ================= */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md p-6 rounded-2xl bg-white border border-slate-200 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              {confirmModal.targetActive ? 'Activate User Account' : 'Deactivate User Account'}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to{' '}
              <strong className={confirmModal.targetActive ? 'text-emerald-700' : 'text-rose-700'}>
                {confirmModal.targetActive ? 'activate' : 'deactivate'}
              </strong>{' '}
              the account for <strong>{confirmModal.user?.name}</strong> ({confirmModal.user?.email})?
            </p>
            {!confirmModal.targetActive && (
              <p className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                ⚠️ Deactivated users will be immediately rejected from authentication and platform access.
              </p>
            )}

            {confirmModal.error && (
              <p className="text-xs text-rose-600">{confirmModal.error}</p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={confirmModal.processing}
                onClick={() => setConfirmModal({ isOpen: false, user: null, targetActive: false, processing: false, error: '' })}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-modal-submit-btn"
                disabled={confirmModal.processing}
                onClick={handleConfirmUserStatus}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all cursor-pointer ${
                  confirmModal.targetActive
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-sm'
                    : 'bg-rose-600 hover:bg-rose-700 shadow-sm'
                }`}
              >
                {confirmModal.processing
                  ? 'Processing...'
                  : confirmModal.targetActive
                  ? 'Confirm Activation'
                  : 'Confirm Deactivation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
