/**
 * Utility functions for Indian phone numbers (+91).
 * The UI always renders a fixed non-editable `+91` prefix badge outside the input box,
 * and the input box strictly accepts and displays the 10-digit subscriber number (e.g. 9876543210).
 */

/**
 * Extracts the pure 10-digit phone subscriber number, cleanly stripping any +91 country code prefix,
 * spaces, dashes, or formatting.
 *
 * Examples:
 * - "+91 9876543210" -> "9876543210"
 * - "+91 9" -> "9" (typing in progress)
 * - "+91" or "+91 " -> "" (empty)
 * - "919876543210" (12 digits starting with 91) -> "9876543210"
 * - "09876543210" (11 digits starting with 0) -> "9876543210"
 * - "9876543210" -> "9876543210"
 * - "" / undefined / null -> ""
 */
export function extractPhoneDigits(phone: string | undefined | null): string {
  if (!phone) return "";
  let s = String(phone).trim();

  // Strip +91 country code prefix if present (+91, +91-, + 91, etc.)
  s = s.replace(/^(\+91|\+ 91)\s*[-\s]?/, "");

  let digits = s.replace(/\D/g, "");

  // If someone entered/pasted 12 digits starting with 91, strip country code
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    // Leading 0
    digits = digits.slice(1);
  }

  return digits.slice(0, 10);
}

/**
 * Formats a phone input string or digits with the standard "+91 " prefix for storage.
 * If there are no digits, returns an empty string "" (never just "+91" or "+91 ").
 *
 * Examples:
 * - "9876543210" -> "+91 9876543210"
 * - "9" -> "+91 9"
 * - "" -> ""
 */
export function formatPhoneWithCountryCode(val: string | undefined | null): string {
  const digits = extractPhoneDigits(val);
  return digits ? `+91 ${digits}` : "";
}

/**
 * Validates whether the given phone string contains a complete 10-digit Indian mobile number.
 */
export function isValid10DigitPhone(phone: string | undefined | null): boolean {
  return extractPhoneDigits(phone).length === 10;
}
