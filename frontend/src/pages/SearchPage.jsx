import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import CompatibilityBadge from '../components/CompatibilityBadge';
import CompatibilityBreakdown from '../components/CompatibilityBreakdown';
import InterestButton from '../components/InterestButton';

export default function SearchPage() {
  const { user, isAuthenticated } = useAuth();
  const isTenant = isAuthenticated && user?.role === 'TENANT';

  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Compatibility scores state keyed by listingId
  const [compatibilityScores, setCompatibilityScores] = useState({});
  const [compatLoading, setCompatLoading] = useState(false);
  const [profileMissing, setProfileMissing] = useState(false);
  const [selectedBreakdown, setSelectedBreakdown] = useState(null);

  // Tenant interests state keyed by listingId
  const [interestsByListingId, setInterestsByListingId] = useState({});
  const [interestSubmitting, setInterestSubmitting] = useState({});
  const [interestErrors, setInterestErrors] = useState({});

  // Filters state
  const [filters, setFilters] = useState({
    location: '',
    minRent: '',
    maxRent: '',
    roomType: '',
    furnishing: '',
    availableFrom: '',
  });

  const fetchAvailableListings = async () => {
    try {
      setLoading(true);
      setError('');
      const params = {};
      if (filters.location.trim()) params.location = filters.location.trim();
      if (filters.minRent) params.minRent = filters.minRent;
      if (filters.maxRent) params.maxRent = filters.maxRent;
      if (filters.roomType) params.roomType = filters.roomType;
      if (filters.furnishing) params.furnishing = filters.furnishing;
      if (filters.availableFrom) params.availableFrom = filters.availableFrom;

      const res = await api.get('/listings', { params });
      const fetchedListings = res.data.listings || [];
      setListings(fetchedListings);

      // Trigger batch compatibility calculation if user is a TENANT
      if (isTenant && fetchedListings.length > 0) {
        fetchBatchCompatibility(fetchedListings.map((l) => l.id));
      } else {
        setCompatibilityScores({});
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch available listings');
    } finally {
      setLoading(false);
    }
  };

  const fetchBatchCompatibility = async (listingIds) => {
    // If we already know profile is missing for this tenant session, avoid repeated failed calls
    if (profileMissing) return;

    try {
      setCompatLoading(true);
      const res = await api.get('/compatibility', {
        params: { listingIds: listingIds.join(',') },
      });

      if (res.data && res.data.scores) {
        setCompatibilityScores(res.data.scores);
        setProfileMissing(false);
      }
    } catch (err) {
      if (
        err.response?.status === 404 &&
        err.response?.data?.error?.toLowerCase().includes('tenant profile')
      ) {
        setProfileMissing(true);
      }
      // Non-fatal: do not block listing display
    } finally {
      setCompatLoading(false);
    }
  };

  const fetchTenantInterests = async () => {
    if (!isTenant) return;
    try {
      const res = await api.get('/interests/mine');
      if (res.data && Array.isArray(res.data.interests)) {
        const mapping = {};
        for (const item of res.data.interests) {
          if (item.listingId) {
            mapping[item.listingId] = item;
          }
        }
        setInterestsByListingId(mapping);
      }
    } catch (err) {
      // Non-fatal: listing search and compatibility continue functioning
      console.error('Failed to fetch tenant interests', err);
    }
  };

  const handleExpressInterest = async (listingId) => {
    try {
      setInterestSubmitting((prev) => ({ ...prev, [listingId]: true }));
      setInterestErrors((prev) => ({ ...prev, [listingId]: '' }));

      const res = await api.post('/interests', { listingId });
      if (res.data && res.data.interest) {
        setInterestsByListingId((prev) => ({
          ...prev,
          [listingId]: res.data.interest,
        }));
      }
    } catch (err) {
      if (err.response?.status === 409) {
        // Already exists: refresh state
        await fetchTenantInterests();
      } else {
        const message = err.response?.data?.error || 'Failed to express interest';
        setInterestErrors((prev) => ({ ...prev, [listingId]: message }));
      }
    } finally {
      setInterestSubmitting((prev) => ({ ...prev, [listingId]: false }));
    }
  };

  useEffect(() => {
    fetchAvailableListings();
    if (isTenant) {
      fetchTenantInterests();
    } else {
      setInterestsByListingId({});
    }
  }, [filters, isTenant]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleResetFilters = () => {
    setFilters({
      location: '',
      minRent: '',
      maxRent: '',
      roomType: '',
      furnishing: '',
      availableFrom: '',
    });
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-8">
      {/* Header Banner */}
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-700">
          <span>✨ Verified Active Vacancies Only</span>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
          Explore Available Rentals & Rooms
        </h1>
        <p className="text-sm text-slate-600">
          Discover verified flats and rooms for rent with instant rule-based compatibility scoring.
        </p>
      </div>

      {/* Profile missing banner for authenticated TENANT */}
      {isTenant && profileMissing && (
        <div
          id="profile-missing-banner"
          className="p-5 rounded-2xl bg-indigo-50/80 border border-indigo-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Create your tenant profile to see compatibility scores.
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Set your budget range, preferred locations, and lifestyle preferences to unlock personalized match percentages for every listing.
              </p>
            </div>
          </div>
          <Link
            to="/profile"
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all whitespace-nowrap shadow-sm"
          >
            Create Profile
          </Link>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Location input */}
          <div className="lg:col-span-2">
            <label htmlFor="search-location" className="block text-[11px] font-semibold text-slate-700 mb-1">
              Location / Neighborhood
            </label>
            <input
              id="search-location"
              name="location"
              type="text"
              value={filters.location}
              onChange={handleFilterChange}
              placeholder="e.g. Indiranagar, Noida..."
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-colors"
            />
          </div>

          {/* Min Rent */}
          <div>
            <label htmlFor="search-minRent" className="block text-[11px] font-semibold text-slate-700 mb-1">
              Min Rent (₹)
            </label>
            <input
              id="search-minRent"
              name="minRent"
              type="number"
              min="0"
              value={filters.minRent}
              onChange={handleFilterChange}
              placeholder="e.g. 8000"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-colors"
            />
          </div>

          {/* Max Rent */}
          <div>
            <label htmlFor="search-maxRent" className="block text-[11px] font-semibold text-slate-700 mb-1">
              Max Rent (₹)
            </label>
            <input
              id="search-maxRent"
              name="maxRent"
              type="number"
              min="0"
              value={filters.maxRent}
              onChange={handleFilterChange}
              placeholder="e.g. 25000"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-colors"
            />
          </div>

          {/* Room Type */}
          <div>
            <label htmlFor="search-roomType" className="block text-[11px] font-semibold text-slate-700 mb-1">
              Room Type
            </label>
            <select
              id="search-roomType"
              name="roomType"
              value={filters.roomType}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-colors"
            >
              <option value="">All Room Types</option>
              <option value="SINGLE">Single Room</option>
              <option value="SHARED">Shared Room</option>
              <option value="ENTIRE_FLAT">Entire Flat / House</option>
            </select>
          </div>

          {/* Furnishing */}
          <div>
            <label htmlFor="search-furnishing" className="block text-[11px] font-semibold text-slate-700 mb-1">
              Furnishing
            </label>
            <select
              id="search-furnishing"
              name="furnishing"
              value={filters.furnishing}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-colors"
            >
              <option value="">All Furnishings</option>
              <option value="FULLY_FURNISHED">Fully Furnished</option>
              <option value="SEMI_FURNISHED">Semi Furnished</option>
              <option value="UNFURNISHED">Unfurnished</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <span>Found <strong className="text-slate-900">{listings.length}</strong> available vacancies</span>
          {(filters.location || filters.minRent || filters.maxRent || filters.roomType || filters.furnishing || filters.availableFrom) && (
            <button
              onClick={handleResetFilters}
              className="text-indigo-600 hover:text-indigo-700 font-semibold cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          {error}
        </div>
      )}

      {/* Results Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading available rentals...</p>
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-20 rounded-2xl border border-dashed border-slate-200 bg-white p-8 space-y-3">
          <div className="text-5xl">🔎</div>
          <h2 className="text-xl font-bold text-slate-900">No available listings match your criteria</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Try adjusting your filters or search a broader location. When property owners add new listings or re-open vacancies, they will appear here instantly.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map((item) => {
            const primaryPhoto =
              item.photos && item.photos.length > 0
                ? item.photos[0]
                : 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80';

            const compatData = compatibilityScores[item.id];

            return (
              <div
                key={item.id}
                id={`listing-card-${item.id}`}
                className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs hover:shadow-md hover:border-slate-300 transition-all"
              >
                {/* Photo Preview */}
                <div className="relative aspect-video w-full overflow-hidden bg-slate-100">
                  <img
                    src={primaryPhoto}
                    alt={item.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent opacity-60" />

                  {/* Available badge */}
                  <div className="absolute top-3 left-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-md bg-white/95 text-emerald-700 border border-emerald-200 shadow-xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Available
                    </span>
                  </div>

                  {/* Rent badge */}
                  <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-md px-3 py-1 rounded-xl border border-slate-200 text-sm font-extrabold text-slate-900 shadow-sm">
                    ₹{Number(item.rent).toLocaleString()}
                    <span className="text-[10px] text-slate-500 font-normal"> /mo</span>
                  </div>
                </div>

                {/* Details */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-xs text-indigo-600 font-semibold mb-1">
                      <span>📍 {item.location}</span>
                      <span className="text-slate-500 text-[10px]">
                        Owner: {item.owner?.name || 'Verified Owner'}
                      </span>
                    </div>

                    <h2 className="text-lg font-bold text-slate-900 tracking-tight line-clamp-1">
                      {item.title}
                    </h2>

                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>

                    {/* Meta chips */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                        {item.roomType.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                        {item.furnishing.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                        Move-in: {new Date(item.availableFrom).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Compatibility & Interest Section (Only for TENANT) */}
                  {isTenant && (
                    <div className="pt-3 border-t border-slate-100 space-y-3">
                      <CompatibilityBadge
                        compatData={compatData}
                        profileMissing={profileMissing}
                        compatLoading={compatLoading}
                        listingId={item.id}
                        onViewBreakdown={() =>
                          setSelectedBreakdown({
                            title: item.title,
                            score: compatData.score,
                            breakdown: compatData.breakdown,
                            source: compatData.source,
                            llm: compatData.llm,
                          })
                        }
                      />
                      <InterestButton
                        listingId={item.id}
                        interest={interestsByListingId[item.id]}
                        onExpressInterest={handleExpressInterest}
                        isSubmitting={Boolean(interestSubmitting[item.id])}
                        errorMessage={interestErrors[item.id]}
                      />
                    </div>
                  )}

                  {/* Footer card */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span>{item.photos?.length || 1} photo(s)</span>
                    <span className="text-indigo-600 font-semibold">Vacant & Ready</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Compatibility Breakdown Modal */}
      <CompatibilityBreakdown
        selectedBreakdown={selectedBreakdown}
        onClose={() => setSelectedBreakdown(null)}
      />
    </div>
  );
}
