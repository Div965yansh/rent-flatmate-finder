/**
 * Google Gemini Provider for Compatibility Analysis
 */

const DEFAULT_MODEL = 'gemini-1.5-flash';
const DEFAULT_TIMEOUT_MS = 6000;

/**
 * Call Google Gemini API to generate structured content
 * @param {object} params
 * @param {string} params.prompt - Formatted prompt requesting structured JSON
 * @param {string} [params.model] - Gemini model identifier
 * @param {number} [params.timeoutMs] - Request timeout in milliseconds
 * @param {string} [params.apiKey] - Optional explicit API key override
 * @returns {Promise<object>} Raw parsed JSON object from model
 */
export async function generateContent({
  prompt,
  model = process.env.GEMINI_MODEL || DEFAULT_MODEL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  apiKey = process.env.GEMINI_API_KEY,
}) {
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    throw new Error('GEMINI_API_KEY is not configured or empty');
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

  const payload = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  };

  const signal = AbortSignal.timeout(timeoutMs);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Gemini API returned HTTP ${res.status}: ${errorText.slice(0, 300)}`);
  }

  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Gemini API response did not contain text content');
  }

  try {
    return JSON.parse(rawText.trim());
  } catch (err) {
    throw new Error(`Failed to parse Gemini response as JSON: ${err.message}`);
  }
}
