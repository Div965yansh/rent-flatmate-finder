import React from 'react';
import LLMCompatibilityInsights from './LLMCompatibilityInsights';
import { getMatchLabel, formatRecommendation } from '../utils/compatibility';

/**
 * Modal displaying full compatibility breakdown (deterministic categories + optional LLM insights)
 */
export default function CompatibilityBreakdown({ selectedBreakdown, onClose }) {
  if (!selectedBreakdown) return null;

  const { title, score, breakdown, source, llm } = selectedBreakdown;
  const isLLM = source === 'llm' && Boolean(llm);
  const matchInfo = isLLM && llm.recommendation
    ? formatRecommendation(llm.recommendation)
    : getMatchLabel(score);

  return (
    <div
      id="compatibility-breakdown-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn"
    >
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl space-y-5 overflow-hidden text-slate-900">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider font-bold text-indigo-700">
                Compatibility Breakdown
              </span>
              {isLLM && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <span>✨</span> AI-Enhanced
                </span>
              )}
            </div>
            <h3 className="text-base font-extrabold text-slate-900 truncate max-w-sm mt-0.5">
              {title}
            </h3>
          </div>
          <button
            id="close-breakdown-btn"
            onClick={onClose}
            aria-label="Close breakdown modal"
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-lg transition-colors cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto pr-1 space-y-4 flex-1">
          {/* Overall Score Header */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <span className="text-xs text-slate-500">Overall Match</span>
              <div className="text-2xl font-black text-slate-900">{score}%</div>
            </div>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-md border ${
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

          {/* Deterministic Category Breakdown */}
          {breakdown && (
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50/80 border border-slate-200/80">
                <span className="font-medium text-slate-700">💰 Budget Match</span>
                <span className="font-bold text-slate-900">
                  {breakdown.budget?.score} / {breakdown.budget?.max}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50/80 border border-slate-200/80">
                <span className="font-medium text-slate-700">📍 Location Preference</span>
                <span className="font-bold text-slate-900">
                  {breakdown.location?.score} / {breakdown.location?.max}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50/80 border border-slate-200/80">
                <span className="font-medium text-slate-700">🛏️ Room Type Match</span>
                <span className="font-bold text-slate-900">
                  {breakdown.roomType?.score} / {breakdown.roomType?.max}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50/80 border border-slate-200/80">
                <span className="font-medium text-slate-700">🛋️ Furnishing Preference</span>
                <span className="font-bold text-slate-900">
                  {breakdown.furnishing?.score} / {breakdown.furnishing?.max}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50/80 border border-slate-200/80">
                <span className="font-medium text-slate-700">📅 Move-in Date Availability</span>
                <span className="font-bold text-slate-900">
                  {breakdown.moveInDate?.score} / {breakdown.moveInDate?.max}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50/80 border border-slate-200/80">
                <span className="font-medium text-slate-700">🌿 Lifestyle & Habits</span>
                <span className="font-bold text-slate-900">
                  {breakdown.lifestyle?.score} / {breakdown.lifestyle?.max}
                </span>
              </div>
            </div>
          )}

          {/* AI Match Analysis (when LLM) OR Deterministic Fallback/Profile Banner */}
          {isLLM ? (
            <LLMCompatibilityInsights llm={llm} />
          ) : (
            <div className="pt-3 border-t border-slate-100">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                <span>📊</span>
                <span>Compatibility based on your profile</span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all shadow-sm cursor-pointer"
          >
            Close Breakdown
          </button>
        </div>
      </div>
    </div>
  );
}
