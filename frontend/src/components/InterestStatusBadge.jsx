import React from 'react';

/**
 * Reusable Interest Status Badge for Tenant and Owner views.
 *
 * @param {Object} props
 * @param {'PENDING' | 'ACCEPTED' | 'DECLINED'} props.status
 * @param {'TENANT' | 'OWNER'} [props.role='TENANT']
 * @param {string} [props.className='']
 */
export default function InterestStatusBadge({ status, role = 'TENANT', className = '' }) {
  let label = 'Pending';
  let badgeClasses = 'bg-amber-50 text-amber-800 border-amber-200';
  let dotColor = 'bg-amber-500';

  switch (status) {
    case 'ACCEPTED':
      label = role === 'TENANT' ? 'Interest Accepted' : 'Accepted';
      badgeClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      dotColor = 'bg-emerald-500';
      break;

    case 'DECLINED':
      label = role === 'TENANT' ? 'Interest Declined' : 'Declined';
      badgeClasses = 'bg-rose-50 text-rose-700 border-rose-200';
      dotColor = 'bg-rose-500';
      break;

    case 'PENDING':
    default:
      label = role === 'TENANT' ? 'Waiting for owner' : 'Pending Review';
      badgeClasses = 'bg-amber-50 text-amber-800 border-amber-200';
      dotColor = 'bg-amber-500';
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${badgeClasses} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      <span>{label}</span>
    </span>
  );
}
