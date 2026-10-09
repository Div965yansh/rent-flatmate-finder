import * as resendProvider from './resend.provider.js';

let customProvider = null;

/**
 * Set a custom provider for testing or alternative delivery methods
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
 * Provider-agnostic transactional email dispatcher
 *
 * @param {object} params
 * @param {string|string[]} params.to - Recipient email(s)
 * @param {string} params.subject - Email subject
 * @param {string} params.html - HTML body content
 * @param {string} [params.text] - Plain text body fallback
 * @param {string} [params.from] - Sender address
 * @returns {Promise<{ sent: boolean, id?: string, reason?: string }>}
 */
export async function sendEmail(params) {
  if (typeof customProvider === 'function') {
    return customProvider(params);
  }

  const providerType = (process.env.EMAIL_PROVIDER || 'resend').trim().toLowerCase();

  try {
    switch (providerType) {
      case 'resend':
        return await resendProvider.sendEmail(params);
      case 'disabled':
      case 'none':
      case '':
        return {
          sent: false,
          reason: `Email provider is disabled (${providerType || 'empty'}). Delivery skipped.`,
        };
      default:
        return {
          sent: false,
          reason: `Unsupported email provider "${providerType}". Delivery skipped.`,
        };
    }
  } catch (error) {
    const sanitizedReason = error?.message
      ? error.message.replace(/re_[a-zA-Z0-9_-]+/gi, '[REDACTED]')
      : 'Unexpected provider failure';

    return {
      sent: false,
      reason: sanitizedReason,
    };
  }
}
