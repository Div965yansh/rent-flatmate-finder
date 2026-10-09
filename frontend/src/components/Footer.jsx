import React from 'react';

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white/80 py-8 px-4 text-center text-xs text-slate-500">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <span className="font-semibold text-slate-700">Rent & Flatmate Finder</span> &copy; 2026. All rights reserved.
        </div>
        <div className="flex items-center gap-4 text-slate-500">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-700 font-medium">
            AI Rental & Flatmate Platform
          </span>
          <span>Express • React • Prisma • Vite • Tailwind</span>
        </div>
      </div>
    </footer>
  );
}
