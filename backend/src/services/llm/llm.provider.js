import * as geminiProvider from './gemini.provider.js';

let customProvider = null;

/**
 * Set a custom provider for testing or alternative engines
 * @param {Function|null} providerFn
 */
export function setCustomProvider(providerFn) {
  customProvider = providerFn;
}

/**
 * Reset custom provider back to default
 */
export function resetCustomProvider() {
  customProvider = null;
}

/**
 * Primary LLM Provider Abstraction
 * Dispatches compatibility analysis requests to the configured provider
 *
 * @param {object} params
 * @param {string} params.prompt - Formatted prompt
 * @param {number} [params.timeoutMs] - Optional timeout in milliseconds
 * @returns {Promise<object>} Parsed JSON response
 */
export async function analyzeCompatibility(params) {
  if (typeof customProvider === 'function') {
    return customProvider(params);
  }

  const providerType = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();

  switch (providerType) {
    case 'gemini':
      return geminiProvider.generateContent(params);
    default:
      throw new Error(`Unsupported LLM provider: "${providerType}". Configured providers: gemini`);
  }
}
