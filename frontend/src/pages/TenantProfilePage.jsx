import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const LIFESTYLE_OPTIONS = [
  { key: 'nonSmoking', label: 'Non-Smoking', icon: '🚭', desc: 'Prefer a smoke-free home' },
  { key: 'smoking', label: 'Smoking Friendly', icon: '🚬', desc: 'Comfortable around smokers' },
  { key: 'pets', label: 'Pet Friendly', icon: '🐾', desc: 'Comfortable with dogs or cats' },
  { key: 'vegetarian', label: 'Vegetarian', icon: '🥗', desc: 'Vegetarian / vegan preference' },
  { key: 'quiet', label: 'Quiet Living', icon: '🤫', desc: 'Low noise, study & work friendly' },
  { key: 'social', label: 'Social', icon: '🎉', desc: 'Enjoys hangouts & hosting friends' },
  { key: 'earlyRiser', label: 'Early Riser', icon: '🌅', desc: 'Morning routine, early nights' },
  { key: 'nightOwl', label: 'Night Owl', icon: '🦉', desc: 'Productive and awake late' },
];

export default function TenantProfilePage() {
  const { user } = useAuth();

  // Form inputs state
  const [formData, setFormData] = useState({
    preferredLocation: '',
    budgetMin: '',
    budgetMax: '',
    moveInDate: '',
    roomType: '',
    furnishing: '',
    notes: '',
  });

  // Lifestyle selections state (boolean map)
  const [lifestyle, setLifestyle] = useState({});

  // UI state
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [apiError, setApiError] = useState('');
  const [clientErrors, setClientErrors] = useState({});
  const [isExistingProfile, setIsExistingProfile] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Fetch tenant profile on mount
  useEffect(() => {
    let isMounted = true;

    async function fetchProfile() {
      try {
        setLoadingInitial(true);
        setApiError('');
        const res = await api.get('/tenant-profile');

        if (isMounted && res.data && res.data.profile) {
          const p = res.data.profile;
          setIsExistingProfile(true);
          setLastUpdated(p.updatedAt ? new Date(p.updatedAt).toLocaleString() : null);

          setFormData({
            preferredLocation: p.preferredLocation || '',
            budgetMin: p.budgetMin !== null && p.budgetMin !== undefined ? String(p.budgetMin) : '',
            budgetMax: p.budgetMax !== null && p.budgetMax !== undefined ? String(p.budgetMax) : '',
            moveInDate: p.moveInDate ? p.moveInDate.split('T')[0] : '',
            roomType: p.preferredRoomType || p.roomType || '',
            furnishing: p.preferredFurnishing || p.furnishing || '',
            notes: p.notes || '',
          });

          // Restore lifestyle preferences
          if (p.lifestyle && typeof p.lifestyle === 'object') {
            const restoredLifestyle = {};
            LIFESTYLE_OPTIONS.forEach((opt) => {
              if (p.lifestyle[opt.key] !== undefined) {
                restoredLifestyle[opt.key] = Boolean(p.lifestyle[opt.key]);
              } else if (Array.isArray(p.lifestyle.tags) && p.lifestyle.tags.includes(opt.label)) {
                restoredLifestyle[opt.key] = true;
              }
            });
            setLifestyle(restoredLifestyle);
          }
        } else {
          setIsExistingProfile(false);
        }
      } catch (err) {
        if (isMounted) {
          setApiError(err.response?.data?.error || 'Failed to load tenant profile');
        }
      } finally {
        if (isMounted) {
          setLoadingInitial(false);
        }
      }
    }

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear client error for this field
    if (clientErrors[name]) {
      setClientErrors((prev) => ({ ...prev, [name]: '' }));
    }
    // Also clear cross-field budget error if changing budgets
    if (name === 'budgetMin' || name === 'budgetMax') {
      if (clientErrors.budget) {
        setClientErrors((prev) => ({ ...prev, budget: '' }));
      }
    }
    if (apiError) setApiError('');
    if (successMessage) setSuccessMessage('');
  };

  const toggleLifestyle = (key) => {
    setLifestyle((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    if (successMessage) setSuccessMessage('');
  };

  const validate = () => {
    const errors = {};

    // Validate location max length
    if (formData.preferredLocation && formData.preferredLocation.length > 150) {
      errors.preferredLocation = 'Preferred location must be at most 150 characters';
    }

    // Validate budget numbers
    const min = formData.budgetMin !== '' ? Number(formData.budgetMin) : null;
    const max = formData.budgetMax !== '' ? Number(formData.budgetMax) : null;

    if (min !== null) {
      if (isNaN(min)) {
        errors.budgetMin = 'Minimum budget must be a valid number';
      } else if (min < 0) {
        errors.budgetMin = 'Minimum budget cannot be negative';
      }
    }

    if (max !== null) {
      if (isNaN(max)) {
        errors.budgetMax = 'Maximum budget must be a valid number';
      } else if (max < 0) {
        errors.budgetMax = 'Maximum budget cannot be negative';
      }
    }

    if (min !== null && max !== null && !isNaN(min) && !isNaN(max)) {
      if (min > max) {
        errors.budget = 'Minimum budget cannot be greater than maximum budget';
      }
    }

    // Validate notes length
    if (formData.notes && formData.notes.length > 1000) {
      errors.notes = 'Notes must be at most 1000 characters';
    }

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMessage('');
    setApiError('');

    // Client-side validation
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setClientErrors(errors);
      return;
    }
    setClientErrors({});

    // Construct payload
    const minVal = formData.budgetMin.trim() !== '' ? Number(formData.budgetMin) : null;
    const maxVal = formData.budgetMax.trim() !== '' ? Number(formData.budgetMax) : null;

    // Collect active lifestyle tags
    const activeTags = LIFESTYLE_OPTIONS.filter((opt) => lifestyle[opt.key]).map((opt) => opt.label);

    const payload = {
      preferredLocation: formData.preferredLocation.trim() || null,
      budgetMin: minVal,
      budgetMax: maxVal,
      moveInDate: formData.moveInDate ? new Date(formData.moveInDate).toISOString() : null,
      preferredRoomType: formData.roomType || null,
      roomType: formData.roomType || null,
      preferredFurnishing: formData.furnishing || null,
      furnishing: formData.furnishing || null,
      lifestyle: {
        ...lifestyle,
        tags: activeTags,
      },
      notes: formData.notes.trim() || null,
    };

    setSaving(true);
    try {
      const res = await api.put('/tenant-profile', payload);
      if (res.data && res.data.profile) {
        const updated = res.data.profile;
        setIsExistingProfile(true);
        setLastUpdated(new Date().toLocaleString());

        // Sync state with returned profile
        setFormData({
          preferredLocation: updated.preferredLocation || '',
          budgetMin: updated.budgetMin !== null && updated.budgetMin !== undefined ? String(updated.budgetMin) : '',
          budgetMax: updated.budgetMax !== null && updated.budgetMax !== undefined ? String(updated.budgetMax) : '',
          moveInDate: updated.moveInDate ? updated.moveInDate.split('T')[0] : '',
          roomType: updated.preferredRoomType || updated.roomType || '',
          furnishing: updated.preferredFurnishing || updated.furnishing || '',
          notes: updated.notes || '',
        });

        setSuccessMessage('Tenant profile saved successfully!');
        // Scroll smoothly to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Failed to save profile. Please check your inputs.';
      setApiError(msg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4">
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-sm text-slate-400 font-medium">Loading your profile preferences...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 sm:px-6">
      {/* Header section */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <span>👤</span> TENANT PROFILE
            </span>
            {isExistingProfile && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Active Profile
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">
            Tenant & Matching Profile
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-xl">
            Configure your neighborhood preferences, budget range, and daily lifestyle to find ideal flatmates and properties.
          </p>
        </div>

        {/* User Card */}
        {user && (
          <div className="bg-white border border-slate-200 rounded-xl p-3 text-xs flex sm:flex-col items-center sm:items-start justify-between gap-1 shadow-sm">
            <span className="text-slate-500">Signed in as:</span>
            <span className="font-semibold text-slate-900 truncate max-w-[180px]">{user.name}</span>
            <span className="text-[11px] text-slate-500 truncate max-w-[180px]">{user.email}</span>
            {lastUpdated && (
              <span className="text-[10px] text-slate-400 mt-1">Saved: {lastUpdated}</span>
            )}
          </div>
        )}
      </div>

      {/* Success banner */}
      {successMessage && (
        <div
          id="profile-success-alert"
          className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-3 shadow-sm animate-fadeIn"
        >
          <span className="text-lg">✅</span>
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {/* Backend API error banner */}
      {apiError && (
        <div
          id="profile-error-alert"
          className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center gap-3 shadow-sm animate-fadeIn"
        >
          <span className="text-lg">⚠️</span>
          <span className="font-medium">{apiError}</span>
        </div>
      )}

      {/* Cross-field budget error */}
      {clientErrors.budget && (
        <div className="mb-6 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <span>❌</span>
          <span>{clientErrors.budget}</span>
        </div>
      )}

      {/* Form Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Location & Budget */}
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-600" />
              1. Location & Budget Constraints
            </h2>

            <div className="space-y-4">
              {/* Preferred Location */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="profile-location" className="block text-xs font-semibold text-slate-700">
                    Preferred Location / Neighborhood
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {formData.preferredLocation.length}/150
                  </span>
                </div>
                <input
                  id="profile-location"
                  name="preferredLocation"
                  type="text"
                  maxLength={150}
                  value={formData.preferredLocation}
                  onChange={handleChange}
                  placeholder="e.g. Indiranagar, Bangalore or Sector 62, Noida"
                  className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 transition-all ${
                    clientErrors.preferredLocation
                      ? 'border-rose-400 focus:ring-rose-500/20'
                      : 'border-slate-200 focus:border-indigo-600 focus:ring-indigo-500/20'
                  }`}
                />
                {clientErrors.preferredLocation && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{clientErrors.preferredLocation}</p>
                )}
              </div>

              {/* Min & Max Budget */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="profile-budget-min" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Minimum Monthly Budget (₹)
                  </label>
                  <input
                    id="profile-budget-min"
                    name="budgetMin"
                    type="number"
                    min="0"
                    step="any"
                    value={formData.budgetMin}
                    onChange={handleChange}
                    placeholder="e.g. 8000"
                    className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 transition-all ${
                      clientErrors.budgetMin || clientErrors.budget
                        ? 'border-rose-400 focus:ring-rose-500/20'
                        : 'border-slate-200 focus:border-indigo-600 focus:ring-indigo-500/20'
                    }`}
                  />
                  {clientErrors.budgetMin && (
                    <p className="mt-1 text-xs text-rose-600 font-medium">{clientErrors.budgetMin}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="profile-budget-max" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Maximum Monthly Budget (₹)
                  </label>
                  <input
                    id="profile-budget-max"
                    name="budgetMax"
                    type="number"
                    min="0"
                    step="any"
                    value={formData.budgetMax}
                    onChange={handleChange}
                    placeholder="e.g. 20000"
                    className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 transition-all ${
                      clientErrors.budgetMax || clientErrors.budget
                        ? 'border-rose-400 focus:ring-rose-500/20'
                        : 'border-slate-200 focus:border-indigo-600 focus:ring-indigo-500/20'
                    }`}
                  />
                  {clientErrors.budgetMax && (
                    <p className="mt-1 text-xs text-rose-600 font-medium">{clientErrors.budgetMax}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Move-in & Space Preference */}
          <div className="pt-4 border-t border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sky-500" />
              2. Timeline & Space Preferences
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Move-in Date */}
              <div>
                <label htmlFor="profile-move-in-date" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Target Move-in Date
                </label>
                <input
                  id="profile-move-in-date"
                  name="moveInDate"
                  type="date"
                  value={formData.moveInDate}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>

              {/* Preferred Room Type */}
              <div>
                <label htmlFor="profile-room-type" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Preferred Room Type
                </label>
                <select
                  id="profile-room-type"
                  name="roomType"
                  value={formData.roomType}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">Any / Flexible</option>
                  <option value="SINGLE">Single Room (Private)</option>
                  <option value="SHARED">Shared Room</option>
                  <option value="ENTIRE_FLAT">Entire Flat / House</option>
                </select>
              </div>

              {/* Preferred Furnishing */}
              <div>
                <label htmlFor="profile-furnishing" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Preferred Furnishing
                </label>
                <select
                  id="profile-furnishing"
                  name="furnishing"
                  value={formData.furnishing}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">Any / Flexible</option>
                  <option value="FULLY_FURNISHED">Fully Furnished</option>
                  <option value="SEMI_FURNISHED">Semi Furnished</option>
                  <option value="UNFURNISHED">Unfurnished</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Lifestyle & Living Preferences */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-violet-500" />
                3. Lifestyle & Living Habits
              </h2>
              <span className="text-xs text-slate-500">Click to toggle traits</span>
            </div>
            <p className="text-xs text-slate-600 mb-4">
              Select lifestyle traits that describe your routine or living preferences. These are stored directly in your profile for matchmaking.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {LIFESTYLE_OPTIONS.map((opt) => {
                const active = Boolean(lifestyle[opt.key]);
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => toggleLifestyle(opt.key)}
                    id={`lifestyle-toggle-${opt.key}`}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 cursor-pointer ${
                      active
                        ? 'bg-indigo-50 border-indigo-300 text-slate-900 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/80 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xl">{opt.icon}</span>
                      <span
                        className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[9px] ${
                          active
                            ? 'bg-indigo-600 border-indigo-600 text-white font-bold'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {active && '✓'}
                      </span>
                    </div>
                    <div>
                      <div className="text-xs font-semibold leading-tight text-slate-900">{opt.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{opt.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 4: Notes & Bio */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="profile-notes" className="block text-xs font-semibold text-slate-700">
                Additional Notes / Flatmate Expectations
              </label>
              <span className="text-[11px] text-slate-400">{formData.notes.length}/1000</span>
            </div>
            <textarea
              id="profile-notes"
              name="notes"
              rows={4}
              maxLength={1000}
              value={formData.notes}
              onChange={handleChange}
              placeholder="Tell prospective flatmates about yourself: your profession, hobbies, cooking habits, preferred lease duration, or expectations from roomies."
              className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 transition-all ${
                clientErrors.notes
                  ? 'border-rose-400 focus:ring-rose-500/20'
                  : 'border-slate-200 focus:border-indigo-600 focus:ring-indigo-500/20'
              }`}
            />
            {clientErrors.notes && (
              <p className="mt-1 text-xs text-rose-600 font-medium">{clientErrors.notes}</p>
            )}
          </div>

          {/* Submit Action */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-slate-500 text-center sm:text-left">
              Changes are immediately saved to PostgreSQL and used for discovery.
            </span>

            <button
              id="profile-submit-btn"
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto px-7 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Saving Profile...</span>
                </>
              ) : (
                <span>Save Profile</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
