import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../services/api';

export default function ListingFormPage() {
  const navigate = useNavigate();
  const { id } = useParams(); // If id is present, we are in edit mode
  const isEditMode = Boolean(id);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    rent: '',
    availableFrom: '',
    roomType: 'SINGLE',
    furnishing: 'FULLY_FURNISHED',
  });

  const [existingPhotos, setExistingPhotos] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [addedUrlPhotos, setAddedUrlPhotos] = useState([]);

  const [loadingInitial, setLoadingInitial] = useState(isEditMode);
  const [submitting, setSubmitting] = useState(false);
  const [clientErrors, setClientErrors] = useState({});
  const [apiError, setApiError] = useState('');

  // If in edit mode, fetch existing listing details
  useEffect(() => {
    if (isEditMode) {
      let isMounted = true;
      async function fetchListing() {
        try {
          const res = await api.get(`/listings/${id}`);
          if (isMounted && res.data.listing) {
            const l = res.data.listing;
            setFormData({
              title: l.title || '',
              description: l.description || '',
              location: l.location || '',
              rent: l.rent || '',
              availableFrom: l.availableFrom ? l.availableFrom.split('T')[0] : '',
              roomType: l.roomType || 'SINGLE',
              furnishing: l.furnishing || 'FULLY_FURNISHED',
            });
            setExistingPhotos(l.photos || []);
          }
        } catch (err) {
          if (isMounted) {
            setApiError(err.response?.data?.error || 'Failed to load listing details');
          }
        } finally {
          if (isMounted) setLoadingInitial(false);
        }
      }
      fetchListing();
      return () => {
        isMounted = false;
      };
    }
  }, [id, isEditMode]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (clientErrors[name]) {
      setClientErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (apiError) setApiError('');
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const newPreviewUrls = files.map((file) => URL.createObjectURL(file));
    setSelectedFiles((prev) => [...prev, ...files]);
    setPreviewUrls((prev) => [...prev, ...newPreviewUrls]);
  };

  const handleRemoveSelectedFile = (index) => {
    URL.revokeObjectURL(previewUrls[index]);
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddUrlPhoto = () => {
    if (!photoUrlInput.trim()) return;
    setAddedUrlPhotos((prev) => [...prev, photoUrlInput.trim()]);
    setPhotoUrlInput('');
  };

  const handleRemoveUrlPhoto = (index) => {
    setAddedUrlPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveExistingPhoto = (index) => {
    setExistingPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const validate = () => {
    const errors = {};
    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    } else if (formData.title.trim().length < 3) {
      errors.title = 'Title must be at least 3 characters long';
    }

    if (!formData.description.trim()) {
      errors.description = 'Description is required';
    } else if (formData.description.trim().length < 5) {
      errors.description = 'Description must be at least 5 characters long';
    }

    if (!formData.location.trim()) {
      errors.location = 'Location is required';
    }

    if (!formData.rent || isNaN(Number(formData.rent)) || Number(formData.rent) <= 0) {
      errors.rent = 'Valid monthly rent amount is required';
    }

    if (!formData.availableFrom) {
      errors.availableFrom = 'Available date is required';
    }

    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');

    if (!validate()) return;

    setSubmitting(true);

    try {
      const data = new FormData();
      data.append('title', formData.title.trim());
      data.append('description', formData.description.trim());
      data.append('location', formData.location.trim());
      data.append('rent', formData.rent);
      data.append('availableFrom', new Date(formData.availableFrom).toISOString());
      data.append('roomType', formData.roomType);
      data.append('furnishing', formData.furnishing);

      // Append file photos for Cloudinary upload
      selectedFiles.forEach((file) => {
        data.append('photos', file);
      });

      // Also support URL photos
      const combinedUrls = [...existingPhotos, ...addedUrlPhotos];
      combinedUrls.forEach((url) => {
        data.append('photos', url);
      });

      if (isEditMode) {
        await api.put(`/listings/${id}`, data, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await api.post('/listings', data, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      // Success redirect to Owner Dashboard
      navigate('/owner/dashboard');
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.message ||
        'Failed to save listing. Please check the inputs.';
      setApiError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-sm text-slate-400">Loading listing details...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            to="/owner/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-semibold mb-2"
          >
            &larr; Back to Owner Dashboard
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            {isEditMode ? 'Edit Rental Listing' : 'Create New Rental Listing'}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Provide comprehensive property details and photos to attract qualified flatmates and tenants.
          </p>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        {apiError && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
            <span className="text-base leading-none">⚠️</span>
            <span className="flex-1 font-medium">{apiError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          {/* Title */}
          <div>
            <label htmlFor="listing-title" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Listing Title *
            </label>
            <input
              id="listing-title"
              name="title"
              type="text"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. Spacious Sunny Master Bedroom with Private Bath"
              className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 transition-all ${
                clientErrors.title
                  ? 'border-rose-400 focus:ring-rose-500/20'
                  : 'border-slate-200 focus:border-indigo-600 focus:ring-indigo-500/20'
              }`}
            />
            {clientErrors.title && (
              <p className="mt-1 text-xs text-rose-600 font-medium">{clientErrors.title}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="listing-description" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Description *
            </label>
            <textarea
              id="listing-description"
              name="description"
              rows={4}
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe the room, house amenities, flatmate vibe, parking, utilities included, etc."
              className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 transition-all ${
                clientErrors.description
                  ? 'border-rose-400 focus:ring-rose-500/20'
                  : 'border-slate-200 focus:border-indigo-600 focus:ring-indigo-500/20'
              }`}
            />
            {clientErrors.description && (
              <p className="mt-1 text-xs text-rose-600 font-medium">{clientErrors.description}</p>
            )}
          </div>

          {/* Location & Rent */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="listing-location" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Location / Neighborhood *
              </label>
              <input
                id="listing-location"
                name="location"
                type="text"
                value={formData.location}
                onChange={handleChange}
                placeholder="e.g. Indiranagar, Bangalore or Downtown Core"
                className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 transition-all ${
                  clientErrors.location
                    ? 'border-rose-400 focus:ring-rose-500/20'
                    : 'border-slate-200 focus:border-indigo-600 focus:ring-indigo-500/20'
                }`}
              />
              {clientErrors.location && (
                <p className="mt-1 text-xs text-rose-600 font-medium">{clientErrors.location}</p>
              )}
            </div>

            <div>
              <label htmlFor="listing-rent" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Monthly Rent (₹ or $) *
              </label>
              <input
                id="listing-rent"
                name="rent"
                type="number"
                min="1"
                step="any"
                value={formData.rent}
                onChange={handleChange}
                placeholder="e.g. 15000"
                className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 transition-all ${
                  clientErrors.rent
                    ? 'border-rose-400 focus:ring-rose-500/20'
                    : 'border-slate-200 focus:border-indigo-600 focus:ring-indigo-500/20'
                }`}
              />
              {clientErrors.rent && (
                <p className="mt-1 text-xs text-rose-600 font-medium">{clientErrors.rent}</p>
              )}
            </div>
          </div>

          {/* Available From, Room Type, Furnishing */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="listing-availableFrom" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Available From *
              </label>
              <input
                id="listing-availableFrom"
                name="availableFrom"
                type="date"
                value={formData.availableFrom}
                onChange={handleChange}
                className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 transition-all ${
                  clientErrors.availableFrom
                    ? 'border-rose-400 focus:ring-rose-500/20'
                    : 'border-slate-200 focus:border-indigo-600 focus:ring-indigo-500/20'
                }`}
              />
              {clientErrors.availableFrom && (
                <p className="mt-1 text-xs text-rose-600 font-medium">{clientErrors.availableFrom}</p>
              )}
            </div>

            <div>
              <label htmlFor="listing-roomType" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Room Type
              </label>
              <select
                id="listing-roomType"
                name="roomType"
                value={formData.roomType}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="SINGLE">Single Room (Private)</option>
                <option value="SHARED">Shared Room</option>
                <option value="ENTIRE_FLAT">Entire Flat / House</option>
              </select>
            </div>

            <div>
              <label htmlFor="listing-furnishing" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Furnishing
              </label>
              <select
                id="listing-furnishing"
                name="furnishing"
                value={formData.furnishing}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="FULLY_FURNISHED">Fully Furnished</option>
                <option value="SEMI_FURNISHED">Semi Furnished</option>
                <option value="UNFURNISHED">Unfurnished</option>
              </select>
            </div>
          </div>

          {/* Photos Upload & Cloudinary */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Property Photos (Cloudinary Upload)
            </label>
            <p className="text-xs text-slate-500 mb-3">
              Upload photos from your computer or provide direct image links.
            </p>

            {/* File upload input */}
            <div className="flex items-center gap-3 mb-4">
              <label
                htmlFor="photo-upload-input"
                className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-all shadow-xs"
              >
                <span>📷 Choose Photo Files</span>
                <input
                  id="photo-upload-input"
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              <span className="text-xs text-slate-500">
                {selectedFiles.length > 0 ? `${selectedFiles.length} file(s) selected` : 'No new files chosen'}
              </span>
            </div>

            {/* URL input */}
            <div className="flex items-center gap-2 mb-4">
              <input
                type="url"
                value={photoUrlInput}
                onChange={(e) => setPhotoUrlInput(e.target.value)}
                placeholder="Or paste an image URL (e.g. https://images.unsplash.com/...)"
                className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-indigo-600"
              />
              <button
                type="button"
                onClick={handleAddUrlPhoto}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-indigo-700 border border-slate-200 transition-all cursor-pointer"
              >
                Add URL
              </button>
            </div>

            {/* Photo Previews */}
            {(existingPhotos.length > 0 || previewUrls.length > 0 || addedUrlPhotos.length > 0) && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                {/* Existing photos */}
                {existingPhotos.map((url, idx) => (
                  <div key={`existing-${idx}`} className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-100">
                    <img src={url} alt={`Existing ${idx}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveExistingPhoto(idx)}
                      className="absolute top-1.5 right-1.5 bg-black/70 hover:bg-rose-600 text-white p-1 rounded-full text-xs transition-colors cursor-pointer"
                      title="Remove photo"
                    >
                      &times;
                    </button>
                    <span className="absolute bottom-1 left-1.5 text-[9px] bg-black/60 text-slate-100 px-1.5 py-0.5 rounded">
                      Saved
                    </span>
                  </div>
                ))}

                {/* Local preview files */}
                {previewUrls.map((url, idx) => (
                  <div key={`new-${idx}`} className="relative group rounded-xl overflow-hidden border border-indigo-200 aspect-video bg-slate-100">
                    <img src={url} alt={`New upload ${idx}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveSelectedFile(idx)}
                      className="absolute top-1.5 right-1.5 bg-black/70 hover:bg-rose-600 text-white p-1 rounded-full text-xs transition-colors cursor-pointer"
                      title="Remove file"
                    >
                      &times;
                    </button>
                    <span className="absolute bottom-1 left-1.5 text-[9px] bg-indigo-600 text-white px-1.5 py-0.5 rounded">
                      To Upload
                    </span>
                  </div>
                ))}

                {/* URL photos */}
                {addedUrlPhotos.map((url, idx) => (
                  <div key={`url-${idx}`} className="relative group rounded-xl overflow-hidden border border-sky-200 aspect-video bg-slate-100">
                    <img src={url} alt={`URL Photo ${idx}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveUrlPhoto(idx)}
                      className="absolute top-1.5 right-1.5 bg-black/70 hover:bg-rose-600 text-white p-1 rounded-full text-xs transition-colors cursor-pointer"
                      title="Remove URL"
                    >
                      &times;
                    </button>
                    <span className="absolute bottom-1 left-1.5 text-[9px] bg-sky-600 text-white px-1.5 py-0.5 rounded">
                      Web Link
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit buttons */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <Link
              to="/owner/dashboard"
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all cursor-pointer"
            >
              Cancel
            </Link>
            <button
              id="listing-submit-btn"
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold uppercase tracking-wider shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>{isEditMode ? 'Updating...' : 'Publishing...'}</span>
                </>
              ) : (
                <span>{isEditMode ? 'Update Listing' : 'Publish Listing'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
