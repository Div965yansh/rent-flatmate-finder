import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Interest button / status indicator rendered on listing cards for authenticated TENANT users.
 *
 * @param {Object} props
 * @param {string} props.listingId
 * @param {Object|null} props.interest - Existing interest object if already expressed
 * @param {Function} props.onExpressInterest - Callback to express interest
 * @param {boolean} [props.isSubmitting=false] - Whether POST /api/interests is in flight
 * @param {string} [props.errorMessage=''] - Safe error message if POST failed
 */
export default function InterestButton({
  listingId,
  interest,
  onExpressInterest,
  isSubmitting = false,
  errorMessage = '',
}) {
  // If interest already exists, display status badge or active chat button
  if (interest) {
    if (interest.status === 'ACCEPTED') {
      return (
        <div className="w-full space-y-1.5">
          <div
            id={`interest-status-${listingId}`}
            className="w-full py-1.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-default transition-all bg-emerald-50 text-emerald-700 border-emerald-200"
          >
            <span>✓</span>
            <span>Interest Accepted</span>
          </div>
          <Link
            id={`open-chat-listing-${listingId}`}
            to={`/chat/${interest.id}`}
            state={{ interest }}
            className="w-full py-1.5 px-3 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>💬</span>
            <span>Open Chat</span>
          </Link>
        </div>
      );
    }

    let label = 'Interest Pending';
    let containerClasses = 'bg-amber-50 text-amber-800 border-amber-200';
    let icon = '⏳';

    if (interest.status === 'DECLINED') {
      label = 'Interest Declined';
      containerClasses = 'bg-slate-100 text-slate-600 border-slate-200';
      icon = '✕';
    }

    return (
      <div className="w-full">
        <div
          id={`interest-status-${listingId}`}
          className={`w-full py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-default transition-all ${containerClasses}`}
        >
          <span>{icon}</span>
          <span>{label}</span>
        </div>
      </div>
    );
  }

  // Active "I'm Interested" button
  return (
    <div className="w-full space-y-1">
      <button
        id={`interest-btn-${listingId}`}
        type="button"
        disabled={isSubmitting}
        onClick={() => onExpressInterest(listingId)}
        className="w-full py-2 px-4 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-all shadow-sm active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
      >
        {isSubmitting ? (
          <>
            <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <span>Sending Interest...</span>
          </>
        ) : (
          <>
            <span>💌</span>
            <span>I'm Interested</span>
          </>
        )}
      </button>

      {errorMessage && (
        <p className="text-[11px] text-rose-600 font-medium text-center">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
