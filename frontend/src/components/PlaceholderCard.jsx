import React from 'react';

export default function PlaceholderCard({
  title,
  subtitle,
  category,
  badgeText = 'Phase 1 Scaffolding',
  features = [],
  highlightColor = 'indigo',
}) {
  const colorMap = {
    indigo: {
      badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      border: 'hover:border-indigo-300',
      bullet: 'bg-indigo-600',
    },
    emerald: {
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      border: 'hover:border-emerald-300',
      bullet: 'bg-emerald-600',
    },
    amber: {
      badge: 'bg-amber-50 text-amber-700 border-amber-200',
      border: 'hover:border-amber-300',
      bullet: 'bg-amber-600',
    },
    rose: {
      badge: 'bg-rose-50 text-rose-700 border-rose-200',
      border: 'hover:border-rose-300',
      bullet: 'bg-rose-600',
    },
    cyan: {
      badge: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      border: 'hover:border-cyan-300',
      bullet: 'bg-cyan-600',
    },
  };

  const scheme = colorMap[highlightColor] || colorMap.indigo;

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 shadow-xs transition-all duration-300 ${scheme.border}`}>
      <div className="relative z-10 flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-semibold tracking-wider uppercase text-slate-500">
            {category}
          </span>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${scheme.badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${scheme.bullet} animate-pulse`} />
            {badgeText}
          </span>
        </div>

        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2">
            {title}
          </h1>
          <p className="text-slate-600 text-base leading-relaxed max-w-2xl">
            {subtitle}
          </p>
        </div>

        {features.length > 0 && (
          <div className="pt-4 border-t border-slate-200">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Planned Capabilities (Later Phases)
            </h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {features.map((feature, idx) => (
                <li
                  key={idx}
                  className="flex items-center gap-2.5 text-sm text-slate-700 bg-slate-50 px-3.5 py-2 rounded-lg border border-slate-200"
                >
                  <span className={`h-2 w-2 rounded-full ${scheme.bullet}`} />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="pt-2">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
            <span>ℹ️ Architecture status: Route mounted & ready for feature integration</span>
          </div>
        </div>
      </div>
    </div>
  );
}

