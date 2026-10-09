/**
 * Transactional Email Templates
 *
 * All user-supplied text values are escaped to prevent HTML/XSS injection.
 * Sensitive data such as password hashes, JWTs, or auth credentials
 * are never included in email templates.
 */

/**
 * Escapes HTML characters to prevent script injection in email clients
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format rent amount nicely
 * @param {number|string} rent
 * @returns {string}
 */
function formatRent(rent) {
  const num = Number(rent);
  if (Number.isNaN(num) || num <= 0) return 'N/A';
  return `₹${num.toLocaleString('en-IN')}/month`;
}

/**
 * Template wrapper with consistent styling
 */
function wrapEmailHtml({ headline, bodyContent, callToActionText, callToActionHint }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(headline)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="background-color: #0f172a; padding: 24px 32px; text-align: left;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">
                Rent &amp; Flatmate Finder
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 16px; font-size: 18px; font-weight: 600; color: #0f172a;">
                ${escapeHtml(headline)}
              </h2>
              ${bodyContent}
              ${callToActionText ? `
              <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
                <p style="margin: 0; font-size: 14px; color: #475569; font-weight: 500;">
                  ${escapeHtml(callToActionText)}
                </p>
                ${callToActionHint ? `
                <p style="margin: 4px 0 0; font-size: 13px; color: #94a3b8;">
                  ${escapeHtml(callToActionHint)}
                </p>` : ''}
              </div>` : ''}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #64748b;">
                Rent &amp; Flatmate Finder Notifications &bull; This is an automated transactional message.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * 1. Template: Interest Received (Sent to Listing Owner)
 */
export function buildInterestReceivedTemplate({ ownerName, tenantName, listingTitle, listingLocation, rent }) {
  const safeOwner = escapeHtml(ownerName || 'Property Owner');
  const safeTenant = escapeHtml(tenantName || 'A seeker');
  const safeTitle = escapeHtml(listingTitle || 'your listing');
  const safeLocation = escapeHtml(listingLocation || 'Not specified');
  const safeRent = formatRent(rent);

  const subject = `New interest in your listing: ${listingTitle || 'Your Property'}`;

  const html = wrapEmailHtml({
    headline: 'You have a new interested tenant!',
    bodyContent: `
      <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.5; color: #334155;">
        Hello <strong>${safeOwner}</strong>,
      </p>
      <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.5; color: #334155;">
        <strong>${safeTenant}</strong> has expressed interest in your rental listing.
      </p>
      <div style="background-color: #f1f5f9; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px;">
        <p style="margin: 0 0 8px; font-size: 14px; color: #64748b;">Listing Details</p>
        <p style="margin: 0 0 4px; font-size: 16px; font-weight: 600; color: #0f172a;">${safeTitle}</p>
        <p style="margin: 0 0 4px; font-size: 14px; color: #334155;">📍 ${safeLocation}</p>
        <p style="margin: 0; font-size: 14px; font-weight: 600; color: #059669;">💰 ${safeRent}</p>
      </div>
      <p style="margin: 0; font-size: 15px; line-height: 1.5; color: #334155;">
        Please log in to your account and visit the <strong>Interest Inbox</strong> to review this request and decide whether to accept or decline.
      </p>
    `,
    callToActionText: 'Next Step: Review request in your Interest Inbox',
    callToActionHint: 'Navigate to "Interests" in the navigation bar to manage incoming tenant requests.',
  });

  const text = `Hello ${ownerName || 'Property Owner'},\n\n` +
    `${tenantName || 'A seeker'} has expressed interest in your listing: "${listingTitle}".\n\n` +
    `Listing: ${listingTitle}\n` +
    `Location: ${listingLocation}\n` +
    `Rent: ${safeRent}\n\n` +
    `Please log in to Rent & Flatmate Finder and check your Interest Inbox to review and accept or decline this request.\n\n` +
    `Best regards,\nRent & Flatmate Finder Team`;

  return { subject, html, text };
}

/**
 * 2. Template: Interest Accepted (Sent to Tenant)
 */
export function buildInterestAcceptedTemplate({ tenantName, ownerName, listingTitle, listingLocation, rent }) {
  const safeTenant = escapeHtml(tenantName || 'Tenant');
  const safeOwner = escapeHtml(ownerName || 'The property owner');
  const safeTitle = escapeHtml(listingTitle || 'the listing');
  const safeLocation = escapeHtml(listingLocation || 'Not specified');
  const safeRent = formatRent(rent);

  const subject = `Your interest has been accepted: ${listingTitle || 'Rental Listing'}`;

  const html = wrapEmailHtml({
    headline: 'Great news! Your interest was accepted.',
    bodyContent: `
      <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.5; color: #334155;">
        Hello <strong>${safeTenant}</strong>,
      </p>
      <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.5; color: #334155;">
        <strong>${safeOwner}</strong> has accepted your interest for the following listing:
      </p>
      <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px;">
        <p style="margin: 0 0 4px; font-size: 16px; font-weight: 600; color: #065f46;">${safeTitle}</p>
        <p style="margin: 0 0 4px; font-size: 14px; color: #047857;">📍 ${safeLocation}</p>
        <p style="margin: 0; font-size: 14px; font-weight: 600; color: #059669;">💰 ${safeRent}</p>
      </div>
      <p style="margin: 0; font-size: 15px; line-height: 1.5; color: #334155;">
        You can now continue in the application to coordinate further steps and view updated status.
      </p>
    `,
    callToActionText: 'Next Step: You can continue in the application.',
    callToActionHint: 'Check your "My Interests" page in Rent & Flatmate Finder.',
  });

  const text = `Hello ${tenantName || 'Tenant'},\n\n` +
    `Great news! ${ownerName || 'The owner'} has accepted your interest for "${listingTitle}".\n\n` +
    `Listing: ${listingTitle}\n` +
    `Location: ${listingLocation}\n` +
    `Rent: ${safeRent}\n\n` +
    `You can now continue in the application to view your updated status.\n\n` +
    `Best regards,\nRent & Flatmate Finder Team`;

  return { subject, html, text };
}

/**
 * 3. Template: Interest Declined (Sent to Tenant)
 */
export function buildInterestDeclinedTemplate({ tenantName, listingTitle, listingLocation }) {
  const safeTenant = escapeHtml(tenantName || 'Tenant');
  const safeTitle = escapeHtml(listingTitle || 'the listing');
  const safeLocation = escapeHtml(listingLocation || 'Not specified');

  const subject = `Update on your rental interest: ${listingTitle || 'Rental Listing'}`;

  const html = wrapEmailHtml({
    headline: 'Update on your rental interest',
    bodyContent: `
      <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.5; color: #334155;">
        Hello <strong>${safeTenant}</strong>,
      </p>
      <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.5; color: #334155;">
        Thank you for your interest in <strong>${safeTitle}</strong> (${safeLocation}). The owner has reviewed your request and is unable to proceed at this time.
      </p>
      <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
        <p style="margin: 0; font-size: 14px; color: #475569;">
          Don't worry! New rooms and flats are added every day. We recommend browsing other available listings that match your preferences and compatibility profile.
        </p>
      </div>
    `,
    callToActionText: 'Next Step: Explore other available listings',
    callToActionHint: 'Visit the "Find a Home" search page to discover more places.',
  });

  const text = `Hello ${tenantName || 'Tenant'},\n\n` +
    `Thank you for your interest in "${listingTitle}" (${listingLocation}). The owner has reviewed your request and is unable to proceed at this time.\n\n` +
    `We encourage you to explore other available listings on Rent & Flatmate Finder to find a great match.\n\n` +
    `Best regards,\nRent & Flatmate Finder Team`;

  return { subject, html, text };
}
