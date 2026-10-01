// Pure input validation for createMovementSafe (no SDK imports, unit-testable).

export const VALID_MOVEMENT_TYPES = ['entry', 'exit', 'return', 'adjustment'];

export interface ValidationError {
  status: number;
  error: string;
}

/**
 * @param currentStock stock of the referenced product, or null when there is
 *   no product to check against (stock check skipped).
 * Returns null when valid. exit/return both decrease stock (see
 * applyMovementStock), so both are checked against available stock.
 */
export function validateMovementInput(
  input: { type?: unknown; quantity?: unknown },
  currentStock: number | null,
): ValidationError | null {
  const { type, quantity } = input;
  if (typeof type !== 'string' || !VALID_MOVEMENT_TYPES.includes(type)) {
    return { status: 400, error: `Invalid movement type: ${String(type)}` };
  }
  if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) {
    return { status: 400, error: 'quantity must be a number greater than 0' };
  }
  if ((type === 'exit' || type === 'return') && currentStock !== null && quantity > currentStock) {
    return { status: 409, error: `Insufficient stock: available ${currentStock}, requested ${quantity}` };
  }
  return null;
}
