import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import InterestStatusBadge from '../components/InterestStatusBadge';

export default function InterestInboxPage() {
  const { user } = useAuth();
  const isOwner = user?.role === 'OWNER';
  const isTenant = user?.role === 'TENANT';

  const [interests, setInterests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Action states for owner decisions: { [interestId]: { accepting: boolean, declining: boolean, error: string } }
  const [actionState, setActionState] = useState({});

  const fetchInterests = async () => {
    try {
      setLoading(true);
      setError('');
      const endpoint = isOwner ? '/interests/inbox' : '/interests/mine';
      const res = await api.get(endpoint);
      setInterests(res.data.interests || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load interest inquiries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInterests();
  }, [user?.role]);

  const handleDecision = async (interestId, decision) => {
    const isAccept = decision === 'accept';
    setActionState((prev) => ({
      ...prev,
      [interestId]: {
        accepting: isAccept,
        declining: !isAccept,
        error: '',
      },
    }));

    try {
      const res = await api.patch(`/interests/${interestId}/${decision}`);
      const updated = res.data.interest;

      // Update item in local list immediately without refresh
      setInterests((prev) =>
        prev.map((item) =>
          item.id === interestId ? { ...item, status: updated.status } : item
        )
      );

      setActionState((prev) => ({
        ...prev,
        [interestId]: { accepting: false, declining: false, error: '' },
      }));
    } catch (err) {
      const errMsg = err.response?.data?.error || `Failed to ${decision} interest`;
      setActionState((prev) => ({
        ...prev,
        [interestId]: {
          accepting: false,
          declining: false,
          error: errMsg,
        },
      }));
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-700 mb-2">
            <span>{isOwner ? '📬 Owner Portal' : '💌 Tenant Portal'}</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {isOwner ? 'Interest Inbox' : 'My Interests'}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {isOwner
              ? 'Review tenant inquiries and manage connection requests for your properties.'
              : 'Keep track of properties you have expressed interest in and monitor owner responses.'}
          </p>
        </div>

        {isTenant && (
          <Link
            to="/search"
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm self-start sm:self-auto cursor-pointer"
          >
            Explore More Listings →
          </Link>
        )}
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          {error}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading inquiries...</p>
        </div>
      ) : interests.length === 0 ? (
        /* Empty States */
        <div className="text-center py-20 rounded-2xl border border-dashed border-slate-200 bg-white p-8 space-y-4 max-w-lg mx-auto">
          <div className="text-5xl">{isOwner ? '📥' : '💌'}</div>
          <h2 className="text-xl font-bold text-slate-900">
            {isOwner
              ? 'No interests received yet'
              : "You haven't expressed interest in any listings yet."}
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            {isOwner
              ? 'When prospective flatmate seekers find your rental listings and reach out, their profiles and requests will appear here.'
              : 'Browse verified rentals matching your budget and lifestyle preferences, then click "I\'m Interested" to connect directly with property owners.'}
          </p>
          {isTenant ? (
            <Link
              to="/search"
              className="inline-block px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm"
            >
              Browse Listings
            </Link>
          ) : (
            <Link
              to="/owner/dashboard"
              className="inline-block px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-all"
            >
              View My Listings
            </Link>
          )}
        </div>
      ) : isTenant ? (
        /* ================= TENANT: "MY INTERESTS" LIST ================= */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {interests.map((item) => {
            const listing = item.listing || {};
            const photo =
              listing.photos && listing.photos.length > 0
                ? listing.photos[0]
                : 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80';

            return (
              <div
                key={item.id}
                id={`tenant-interest-${item.id}`}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs hover:shadow-md hover:border-slate-300 transition-all"
              >
                {/* Photo Header */}
                <div className="relative aspect-video w-full overflow-hidden bg-slate-100">
                  <img
                    src={photo}
                    alt={listing.title || 'Rental Listing'}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent opacity-60" />

                  {/* Status Badge */}
                  <div className="absolute top-3 left-3">
                    <InterestStatusBadge status={item.status} role="TENANT" />
                  </div>

                  {/* Rent Tag */}
                  <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-md px-3 py-1 rounded-xl border border-slate-200 text-sm font-extrabold text-slate-900 shadow-sm">
                    ₹{Number(listing.rent || 0).toLocaleString()}
                    <span className="text-[10px] text-slate-500 font-normal"> /mo</span>
                  </div>
                </div>

                {/* Details */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="text-xs text-indigo-600 font-semibold mb-1">
                      📍 {listing.location || 'Location'}
                    </div>
                    <h3 className="text-base font-bold text-slate-900 line-clamp-1">
                      {listing.title || 'Untitled Listing'}
                    </h3>

                    {/* Listing Chips */}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {listing.roomType && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                          {listing.roomType.replace('_', ' ')}
                        </span>
                      )}
                      {listing.furnishing && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                          {listing.furnishing.replace('_', ' ')}
                        </span>
                      )}
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                        Status: {listing.status || 'AVAILABLE'}
                      </span>
                    </div>
                  </div>

                  {/* Footer Meta */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      Sent {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                    {item.status === 'ACCEPTED' ? (
                      <Link
                        id={`open-chat-tenant-${item.id}`}
                        to={`/chat/${item.id}`}
                        state={{ interest: item }}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold transition-all shadow-sm cursor-pointer"
                      >
                        <span>💬</span>
                        <span>Open Chat</span>
                      </Link>
                    ) : item.status === 'DECLINED' ? (
                      <span className="text-rose-600 font-medium">Closed</span>
                    ) : (
                      <span className="text-amber-700 font-medium">In Review</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ================= OWNER: "INTEREST INBOX" LIST ================= */
        <div className="space-y-4">
          {interests.map((item) => {
            const tenant = item.tenant || {};
            const profile = tenant.tenantProfile || {};
            const listing = item.listing || {};
            const action = actionState[item.id] || {};
            const isPending = item.status === 'PENDING';

            return (
              <div
                key={item.id}
                id={`owner-interest-${item.id}`}
                className="p-6 rounded-2xl border border-slate-200 bg-white shadow-xs hover:shadow-md hover:border-slate-300 transition-all space-y-4"
              >
                {/* Header Row: Tenant info + Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-700 flex items-center justify-center font-bold text-white text-sm shadow-sm shrink-0">
                      {(tenant.name || 'T').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900">
                          {tenant.name || 'Prospective Tenant'}
                        </h3>
                        <span className="text-xs text-slate-500 font-medium">
                          ({tenant.email})
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Interested in <strong className="text-indigo-600">{listing.title}</strong>{' '}
                        • 📍 {listing.location}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-start sm:self-auto">
                    <InterestStatusBadge status={item.status} role="OWNER" />
                    <span className="text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Tenant Profile Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-semibold">
                      Budget Range
                    </span>
                    <span className="font-bold text-slate-900">
                      {profile.budgetMin !== null && profile.budgetMax !== null
                        ? `₹${Number(profile.budgetMin).toLocaleString()} - ₹${Number(profile.budgetMax).toLocaleString()}`
                        : profile.budgetMax
                        ? `Up to ₹${Number(profile.budgetMax).toLocaleString()}`
                        : 'Flexible'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-semibold">
                      Preferred Location
                    </span>
                    <span className="font-bold text-slate-900 truncate block">
                      {profile.preferredLocation || 'Any location'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-semibold">
                      Target Move-in
                    </span>
                    <span className="font-bold text-slate-900">
                      {profile.moveInDate
                        ? new Date(profile.moveInDate).toLocaleDateString()
                        : 'Immediate'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-semibold">
                      Room Type
                    </span>
                    <span className="font-bold text-slate-900">
                      {profile.preferredRoomType
                        ? profile.preferredRoomType.replace('_', ' ')
                        : 'Any'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-semibold">
                      Furnishing
                    </span>
                    <span className="font-bold text-slate-900">
                      {profile.preferredFurnishing
                        ? profile.preferredFurnishing.replace('_', ' ')
                        : 'Any'}
                    </span>
                  </div>
                </div>

                {/* Additional notes if present */}
                {profile.notes && (
                  <p className="text-xs text-slate-600 italic bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    "{profile.notes}"
                  </p>
                )}

                {/* Decision Actions (Only for PENDING) */}
                {isPending ? (
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
                    {action.error ? (
                      <span className="text-xs text-rose-600 font-medium">
                        {action.error}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">
                        Respond to tenant request:
                      </span>
                    )}

                    <div className="flex items-center gap-2.5 w-full sm:w-auto">
                      <button
                        id={`decline-interest-${item.id}`}
                        type="button"
                        disabled={action.accepting || action.declining}
                        onClick={() => handleDecision(item.id, 'decline')}
                        className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 border border-slate-200 hover:border-rose-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                      >
                        {action.declining ? 'Declining...' : 'Decline'}
                      </button>

                      <button
                        id={`accept-interest-${item.id}`}
                        type="button"
                        disabled={action.accepting || action.declining}
                        onClick={() => handleDecision(item.id, 'accept')}
                        className="flex-1 sm:flex-none px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all cursor-pointer"
                      >
                        {action.accepting ? 'Accepting...' : 'Accept'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-500">
                    <span>
                      Decision recorded:{' '}
                      <strong
                        className={
                          item.status === 'ACCEPTED' ? 'text-emerald-700' : 'text-rose-600'
                        }
                      >
                        {item.status === 'ACCEPTED' ? 'Accepted' : 'Declined'}
                      </strong>
                    </span>
                    {item.status === 'ACCEPTED' ? (
                      <Link
                        id={`open-chat-owner-${item.id}`}
                        to={`/chat/${item.id}`}
                        state={{ interest: item }}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                      >
                        <span>💬</span>
                        <span>Open Chat</span>
                      </Link>
                    ) : (
                      <span className="text-slate-400">No further action required</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
