/**
 * Standard rule-based match tier label & color
 * @param {number} score
 */
export function getMatchLabel(score) {
  if (score >= 80) return { label: 'Excellent Match', color: 'emerald' };
  if (score >= 60) return { label: 'Good Match', color: 'cyan' };
  if (score >= 40) return { label: 'Moderate Match', color: 'amber' };
  return { label: 'Low Match', color: 'rose' };
}

/**
 * Format LLM recommendation enum to user-friendly label and color tier
 * @param {string} recommendation - 'excellent' | 'good' | 'moderate' | 'low'
 */
export function formatRecommendation(recommendation) {
  if (!recommendation) return { label: 'Good Match', color: 'cyan' };
  const normalized = String(recommendation).toLowerCase().trim();
  switch (normalized) {
    case 'excellent':
      return { label: 'Excellent Match', color: 'emerald' };
    case 'good':
      return { label: 'Good Match', color: 'cyan' };
    case 'moderate':
      return { label: 'Moderate Match', color: 'amber' };
    case 'low':
      return { label: 'Low Match', color: 'rose' };
    default:
      return {
        label: `${normalized.charAt(0).toUpperCase() + normalized.slice(1)} Match`,
        color: 'indigo',
      };
  }
}
