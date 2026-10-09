import React from 'react';
import { Link } from 'react-router-dom';
import { getMatchLabel, formatRecommendation } from '../utils/compatibility';

/**
 * Compatibility summary badge and progress meter for listing cards.
 * Supports both LLM-enhanced matches and deterministic rule-based matches.
 */
export default function CompatibilityBadge({
  compatData,
  profileMissing,
  compatLoading,
  onViewBreakdown,
  listingId,
}) {
  if (profileMissing) {
    return (
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">Compatibility:</span>
        <Link
          to="/profile"
          className="text-indigo-600 hover:text-indigo-700 text-xs font-semibold underline"
        >
          Set profile for score
        </Link>
      </div>
    );
  }

  const hasScore = compatData && typeof compatData.score === 'number';

  if (!hasScore) {
    if (compatLoading) {
      return (
        <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
          <div className="w-3 h-3 border-2 border-indigo-500/20 border-t-indigo-600 rounded-full animate-spin" />
          <span>Calculating compatibility...</span>
        </div>
      );
    }
    return (
      <div className="text-xs text-slate-500">
        Compatibility unavailable
      </div>
    );
  }

  const isLLM = compatData.source === 'llm' && Boolean(compatData.llm);
  const matchInfo = isLLM && compatData.llm.recommendation
    ? formatRecommendation(compatData.llm.recommendation)
    : getMatchLabel(compatData.score);

  return (
    <div className="space-y-1.5" id={listingId ? `compatibility-${listingId}` : undefined}>
      {/* Score and Tier Badge */}
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-700">
          Compatibility:{' '}
          <strong className="text-slate-900 text-sm">{compatData.score}%</strong>
        </span>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
            matchInfo.color === 'emerald'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : matchInfo.color === 'cyan'
              ? 'bg-sky-50 text-sky-700 border-sky-200'
              : matchInfo.color === 'amber'
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}
        >
          {matchInfo.label}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            matchInfo.color === 'emerald'
              ? 'bg-emerald-500'
              : matchInfo.color === 'cyan'
              ? 'bg-sky-500'
              : matchInfo.color === 'amber'
              ? 'bg-amber-500'
              : 'bg-rose-500'
          }`}
          style={{ width: `${Math.min(100, Math.max(0, compatData.score))}%` }}
        />
      </div>

      {/* AI Indicator / Fallback text + View Breakdown Action */}
      <div className="flex items-center justify-between pt-1">
        {isLLM ? (
          <span
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700"
            data-testid="ai-enhanced-badge"
          >
            <span className="text-[10px]">✨</span> AI-enhanced match
          </span>
        ) : (
          <span className="text-[11px] text-slate-500 font-medium">
            Compatibility based on your profile
          </span>
        )}
        <button
          type="button"
          onClick={onViewBreakdown}
          className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 transition-colors ml-auto cursor-pointer"
        >
          View Breakdown →
        </button>
      </div>
    </div>
  );
}
