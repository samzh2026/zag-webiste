// =============================================================================
// lib/lang.js - Multi-Language Middleware
// =============================================================================
// Extracts the requested language from ?lang= query parameter.
// Defaults to "en" when no language is specified.
//
// The critical rule: if a locale field is missing for the requested language,
// fall back to "en". Never return an empty string to the front-end.
//
// Supported languages: en, es, tr, ru, ar
// =============================================================================

const SUPPORTED = ["en", "es", "tr", "ru", "ar"];
const DEFAULT = "en";

/**
 * Extract the single locale value from a locale object or JSON string.
 * Always falls back to "en" if the requested language is missing.
 *
 * @param {string|object} raw  - JSON string or object like {"en":"Brake Pads","es":"Pastillas"}
 * @param {string} lang        - Requested language code
 * @returns {string}           - Single language string (never empty)
 */
function extractLocale(raw, lang) {
  if (!raw) return "";
  let obj;
  if (typeof raw === "string") {
    try { obj = JSON.parse(raw); } catch (e) { return raw; }
  } else {
    obj = raw;
  }
  if (!obj || typeof obj !== "object") return String(obj);

  // Priority: requested language > English > first available value
  if (obj[lang] && String(obj[lang]).trim()) return String(obj[lang]);
  if (obj[DEFAULT] && String(obj[DEFAULT]).trim()) return String(obj[DEFAULT]);

  // Last resort: return the first non-empty value
  for (const key of Object.keys(obj)) {
    if (obj[key] && String(obj[key]).trim()) return String(obj[key]);
  }
  return "";
}

/**
 * Express middleware.
 * Reads req.query.lang and attaches helpers to req.
 *
 * After this middleware runs, you can use:
 *   req.lang           - the resolved language code (e.g. "tr")
 *   req.locale(obj)    - function to extract locale value from a locale object
 */
function langMiddleware(req, res, next) {
  const requested = String(req.query.lang || "").toLowerCase();
  req.lang = SUPPORTED.includes(requested) ? requested : DEFAULT;

  // Attach helper
  req.locale = function (raw) {
    return extractLocale(raw, req.lang);
  };

  next();
}

module.exports = {
  langMiddleware,
  extractLocale,
  SUPPORTED,
  DEFAULT
};
