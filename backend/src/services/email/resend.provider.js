/**
 * Resend HTTP REST Provider
 * Direct integration with Resend API (https://api.resend.com/emails)
 * without requiring external SDKs.
 */

const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'Rent & Flatmate Finder <onboarding@resend.dev>';
const DEFAULT_TIMEOUT_MS = 6000;

/**
 * Sends an email via Resend REST API
 *
 * @param {object} params
 * @param {string|string[]} params.to - Recipient email(s)
 * @param {string} params.subject - Email subject
 * @param {string} params.html - HTML body content
 * @param {string} [params.text] - Plain text body fallback
 * @param {string} [params.from] - Sender address
 * @param {number} [params.timeoutMs] - Request timeout
 * @returns {Promise<{ sent: boolean, id?: string, reason?: string }>}
 */
export async function sendEmail({ to, subject, html, text, from, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const apiKey = (process.env.RESEND_API_KEY || '').trim();

  // Graceful no-op fallback when API key is unconfigured
  if (!apiKey) {
    return {
      sent: false,
      reason: 'RESEND_API_KEY is not configured. Email delivery skipped in fallback mode.',
    };
  }

  const fromAddress = from || process.env.EMAIL_FROM || DEFAULT_FROM;
  const recipients = Array.isArray(to) ? to : [to];

  const payload = {
    from: fromAddress,
    to: recipients,
    subject,
    html,
  };

  if (text) {
    payload.text = text;
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      let errorMessage = `Resend API HTTP ${response.status}`;
      try {
        const errorBody = await response.json();
        if (errorBody && errorBody.message) {
          errorMessage = `${errorMessage}: ${errorBody.message}`;
        }
      } catch {
        // Non-JSON error response
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return {
      sent: true,
      id: data.id,
    };
  } catch (error) {
    // Sanitized error logging without leaking secrets or auth headers
    const isTimeout = error.name === 'TimeoutError' || error.name === 'AbortError';
    const sanitizedMessage = isTimeout
      ? 'Resend request timed out'
      : (error.message || 'Unknown network error');

    return {
      sent: false,
      reason: sanitizedMessage,
    };
  }
}
