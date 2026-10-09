import React from 'react';
import { formatRecommendation } from '../utils/compatibility';

/**
 * Renders the AI Match Analysis insights (recommendation, summary, strengths, concerns)
 * Only rendered when source === 'llm' and valid llm data exists.
 */
export default function LLMCompatibilityInsights({ llm }) {
  if (!llm) return null;

  const recInfo = formatRecommendation(llm.recommendation);
  const hasStrengths = Array.isArray(llm.strengths) && llm.strengths.length > 0;
  const hasConcerns = Array.isArray(llm.concerns) && llm.concerns.length > 0;

  return (
    <div
      id="llm-compatibility-insights"
      className="space-y-4 pt-4 border-t border-slate-100"
      data-testid="llm-insights"
    >
      {/* Header section with AI indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base text-indigo-600">✨</span>
          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900">
            AI Match Analysis
          </h4>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 font-medium">Recommendation:</span>
          <span
            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md border ${
              recInfo.color === 'emerald'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : recInfo.color === 'cyan'
                ? 'bg-sky-50 text-sky-700 border-sky-200'
                : recInfo.color === 'amber'
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
          >
            {recInfo.label}
          </span>
        </div>
      </div>

      {/* Summary Box */}
      {llm.summary && (
        <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs leading-relaxed">
          <span className="text-[10px] uppercase font-bold text-indigo-700 block mb-1">
            Summary
          </span>
          <p className="text-slate-700 break-words leading-relaxed">{llm.summary}</p>
        </div>
      )}

      {/* Strengths Section */}
      {hasStrengths && (
        <div className="space-y-2">
          <h5 className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
            <span>✓</span> Strengths
          </h5>
          <ul className="space-y-1.5">
            {llm.strengths.map((item, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-xs text-slate-700 bg-emerald-50/40 p-2.5 rounded-lg border border-emerald-200/60 break-words"
              >
                <span className="text-emerald-600 font-bold shrink-0">✓</span>
                <span className="leading-snug">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Things to Consider (Concerns) Section - ONLY displayed when non-empty */}
      {hasConcerns && (
        <div className="space-y-2">
          <h5 className="text-[11px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
            <span>•</span> Things to Consider
          </h5>
          <ul className="space-y-1.5">
            {llm.concerns.map((item, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-xs text-slate-700 bg-amber-50/40 p-2.5 rounded-lg border border-amber-200/60 break-words"
              >
                <span className="text-amber-600 font-bold shrink-0">•</span>
                <span className="leading-snug">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
