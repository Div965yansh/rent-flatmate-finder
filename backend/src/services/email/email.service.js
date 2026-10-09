import { sendEmail } from './email.provider.js';
import {
  buildInterestReceivedTemplate,
  buildInterestAcceptedTemplate,
  buildInterestDeclinedTemplate,
} from './email.templates.js';

/**
 * Sanitizes log messages to ensure API keys, tokens, or hashes are never exposed
 * @param {string} message
 * @returns {string}
 */
function sanitizeErrorMessage(message) {
  if (!message) return 'Unknown error';
  return String(message)
    .replace(/re_[a-zA-Z0-9_\-]+/gi, '[REDACTED_API_KEY]')
    .replace(/bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED_TOKEN]')
    .replace(/eyJ[a-zA-Z0-9_\-\.]+/gi, '[REDACTED_JWT]');
}

/**
 * Low-level transactional email sender.
 * Wraps provider calls, catches all errors, and guarantees the caller never crashes.
 *
 * @param {object} params
 * @param {string} params.to - Recipient email address
 * @param {string} params.subject - Subject line
 * @param {string} params.html - HTML body
 * @param {string} [params.text] - Fallback plain text body
 * @returns {Promise<{ sent: boolean, reason?: string, id?: string }>}
 */
export async function sendTransactionalEmail({ to, subject, html, text }) {
  if (!to || typeof to !== 'string' || !to.includes('@')) {
    const reason = 'Invalid or missing recipient email address';
    console.warn(`[EmailService] Skipping email delivery: ${reason} (to: "${to}")`);
    return { sent: false, reason };
  }

  try {
    const result = await sendEmail({ to: to.trim(), subject, html, text });

    if (result.sent) {
      console.log(`[EmailService] Email sent successfully to ${to} (Subject: "${subject}") [ID: ${result.id || 'n/a'}]`);
    } else {
      console.info(`[EmailService] Email skipped or not delivered to ${to}: ${result.reason}`);
    }

    return result;
  } catch (error) {
    const sanitizedReason = sanitizeErrorMessage(error?.message);
    console.error(`[EmailService] Unexpected error sending email to ${to}:`, sanitizedReason);
    return {
      sent: false,
      reason: sanitizedReason,
    };
  }
}

/**
 * Workflow 1: Notify listing owner when a tenant expresses interest
 *
 * @param {object} params
 * @param {string} params.ownerEmail
 * @param {string} [params.ownerName]
 * @param {string} [params.tenantName]
 * @param {string} params.listingTitle
 * @param {string} params.listingLocation
 * @param {number|string} params.rent
 * @returns {Promise<{ sent: boolean, reason?: string, id?: string }>}
 */
export async function notifyOwnerInterestReceived({
  ownerEmail,
  ownerName,
  tenantName,
  listingTitle,
  listingLocation,
  rent,
}) {
  const { subject, html, text } = buildInterestReceivedTemplate({
    ownerName,
    tenantName,
    listingTitle,
    listingLocation,
    rent,
  });

  return sendTransactionalEmail({
    to: ownerEmail,
    subject,
    html,
    text,
  });
}

/**
 * Workflow 2: Notify tenant when owner accepts interest
 *
 * @param {object} params
 * @param {string} params.tenantEmail
 * @param {string} [params.tenantName]
 * @param {string} [params.ownerName]
 * @param {string} params.listingTitle
 * @param {string} params.listingLocation
 * @param {number|string} params.rent
 * @returns {Promise<{ sent: boolean, reason?: string, id?: string }>}
 */
export async function notifyTenantInterestAccepted({
  tenantEmail,
  tenantName,
  ownerName,
  listingTitle,
  listingLocation,
  rent,
}) {
  const { subject, html, text } = buildInterestAcceptedTemplate({
    tenantName,
    ownerName,
    listingTitle,
    listingLocation,
    rent,
  });

  return sendTransactionalEmail({
    to: tenantEmail,
    subject,
    html,
    text,
  });
}

/**
 * Workflow 3: Notify tenant when owner declines interest
 *
 * @param {object} params
 * @param {string} params.tenantEmail
 * @param {string} [params.tenantName]
 * @param {string} params.listingTitle
 * @param {string} params.listingLocation
 * @returns {Promise<{ sent: boolean, reason?: string, id?: string }>}
 */
export async function notifyTenantInterestDeclined({
  tenantEmail,
  tenantName,
  listingTitle,
  listingLocation,
}) {
  const { subject, html, text } = buildInterestDeclinedTemplate({
    tenantName,
    listingTitle,
    listingLocation,
  });

  return sendTransactionalEmail({
    to: tenantEmail,
    subject,
    html,
    text,
  });
}
