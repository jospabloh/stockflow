// Pure validator (no SDK imports) so it can be unit-tested directly.
export function validatePettyCashAmount(amount: unknown): string | null {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return 'El monto debe ser un número mayor a cero';
  }
  return null;
}
