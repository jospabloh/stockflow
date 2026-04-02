/**
 * EAN-13 barcode utilities — pure deterministic logic, zero AI/LLM/credits.
 * Internal-use prefix: "290" (non-GS1, for in-app use only).
 */

/**
 * Stable numeric hash of a string, truncated/padded to 9 digits.
 */
export function stringToNumericSeed(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  // Make positive, keep 9 digits
  const positive = Math.abs(hash) % 1_000_000_000;
  return String(positive).padStart(9, "0");
}

/**
 * Official EAN-13 check digit from a 12-digit base string.
 */
export function calculateEAN13CheckDigit(base12) {
  if (base12.length !== 12) throw new Error("base12 must be 12 digits");
  let oddSum = 0;
  let evenSum = 0;
  for (let i = 0; i < 12; i++) {
    const d = parseInt(base12[i], 10);
    if ((i + 1) % 2 === 1) oddSum += d;
    else evenSum += d;
  }
  const total = oddSum + evenSum * 3;
  return (10 - (total % 10)) % 10;
}

/**
 * Generate a deterministic EAN-13 for a product.
 * @param {object} product - must have .id
 * @param {number} attempt - retry suffix (0 = first try)
 */
export function generateInternalProductEAN13(product, attempt = 0) {
  const prefix = "290";
  const seed = stringToNumericSeed(`${product.id}-${attempt}`);
  const base12 = prefix + seed; // 3 + 9 = 12 digits
  const checkDigit = calculateEAN13CheckDigit(base12);
  return base12 + String(checkDigit);
}