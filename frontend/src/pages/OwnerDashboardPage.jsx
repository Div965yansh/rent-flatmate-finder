import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function OwnerDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchListings = async () => {
    try {
      setError('');
      const res = await api.get('/listings/my-listings');
      setListings(res.data.listings || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load your listings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, []);

  const handleToggleStatus = async (listingId, currentStatus) => {
    const nextStatus = currentStatus === 'AVAILABLE' ? 'FILLED' : 'AVAILABLE';
    setActionLoadingId(listingId);
    try {
      const res = await api.patch(`/listings/${listingId}/status`, {
        status: nextStatus,
      });

      // Update state locally
      setListings((prev) =>
        prev.map((item) =>
          item.id === listingId ? { ...item, status: res.data.listing.status } : item
        )
      );
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update status');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteListing = async (listingId) => {
    if (!window.confirm('Are you sure you want to delete this listing? This action cannot be undone.')) {
      return;
    }

    setActionLoadingId(listingId);
    try {
      await api.delete(`/listings/${listingId}`);
      setListings((prev) => prev.filter((item) => item.id !== listingId));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete listing');
    } finally {
      setActionLoadingId(null);
    }
  };

  const availableCount = listings.filter((l) => l.status === 'AVAILABLE').length;
  const filledCount = listings.filter((l) => l.status === 'FILLED').length;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-8">
      {/* Header & Quick Stats */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 mb-2">
            <span>🏡 Property Portfolio</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Owner Dashboard
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Welcome back, <span className="text-slate-900 font-semibold">{user?.name}</span>. Manage your rental listings, mark vacancies as filled, and track tenant reach.
          </p>
        </div>

        <div>
          <Link
            id="owner-create-listing-btn"
            to="/listings/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>+ Create New Listing</span>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Listings</span>
          <div className="text-3xl font-black text-slate-900 mt-1">{listings.length}</div>
        </div>

        <div className="p-5 rounded-2xl border border-emerald-200 bg-emerald-50/60 shadow-sm">
          <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Active Vacancies (Available)</span>
          <div className="text-3xl font-black text-emerald-700 mt-1">{availableCount}</div>
        </div>

        <div className="p-5 rounded-2xl border border-purple-200 bg-purple-50/60 shadow-sm">
          <span className="text-xs font-semibold text-purple-800 uppercase tracking-wider">Filled / Occupied</span>
          <div className="text-3xl font-black text-purple-700 mt-1">{filledCount}</div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          {error}
        </div>
      )}

      {/* Listings Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Fetching your listings...</p>
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-20 rounded-2xl border border-dashed border-slate-200 bg-white p-8 space-y-4">
          <div className="text-5xl">🏢</div>
          <h2 className="text-xl font-bold text-slate-900">No properties listed yet</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            You haven't published any rooms or flats yet. Publish your first listing to start receiving inquiries from compatible tenants!
          </p>
          <div className="pt-2">
            <Link
              to="/listings/new"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider shadow-sm transition-all"
            >
              <span>+ Create Listing Now</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map((item) => {
            const isAvailable = item.status === 'AVAILABLE';
            const primaryPhoto =
              item.photos && item.photos.length > 0
                ? item.photos[0]
                : 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80';

            return (
              <div
                key={item.id}
                className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs hover:shadow-md hover:border-slate-300 transition-all"
              >
                {/* Photo Header */}
                <div className="relative aspect-video w-full overflow-hidden bg-slate-100">
                  <img
                    src={primaryPhoto}
                    alt={item.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent opacity-60" />

                  {/* Status Badge */}
                  <div className="absolute top-3 left-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-md border shadow-xs ${
                        isAvailable
                          ? 'bg-white/95 text-emerald-700 border-emerald-200'
                          : 'bg-white/95 text-purple-700 border-purple-200'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isAvailable ? 'bg-emerald-500' : 'bg-purple-500'
                        }`}
                      />
                      {item.status}
                    </span>
                  </div>

                  {/* Rent Tag */}
                  <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-md px-3 py-1 rounded-xl border border-slate-200 text-sm font-extrabold text-slate-900 shadow-sm">
                    ₹{Number(item.rent).toLocaleString()}
                    <span className="text-[10px] text-slate-500 font-normal"> /mo</span>
                  </div>
                </div>

                {/* Details Body */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-indigo-600 font-semibold mb-1">
                      <span>📍 {item.location}</span>
                    </div>

                    <h2 className="text-lg font-bold text-slate-900 tracking-tight line-clamp-1">
                      {item.title}
                    </h2>

                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>

                    {/* Chips */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                        {item.roomType.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                        {item.furnishing.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                        Available: {new Date(item.availableFrom).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    {/* Mark as Filled / Re-open Toggle Button */}
                    <button
                      id={`toggle-status-${item.id}`}
                      type="button"
                      disabled={actionLoadingId === item.id}
                      onClick={() => handleToggleStatus(item.id, item.status)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isAvailable
                          ? 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {actionLoadingId === item.id
                        ? 'Updating...'
                        : isAvailable
                        ? 'Mark as Filled'
                        : 'Re-open Vacancy'}
                    </button>

                    {/* Edit button */}
                    <Link
                      to={`/listings/edit/${item.id}`}
                      className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 border border-slate-200 transition-all cursor-pointer"
                      title="Edit listing"
                    >
                      Edit
                    </Link>

                    {/* Delete button */}
                    <button
                      type="button"
                      disabled={actionLoadingId === item.id}
                      onClick={() => handleDeleteListing(item.id)}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 hover:border-rose-200 text-xs transition-all cursor-pointer"
                      title="Delete listing"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
