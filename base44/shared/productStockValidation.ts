// Validación del stock de un producto en createProductSafe / updateProductSafe.
// Sin imports de SDK para poder probarse con deno test.
// Devuelve el mensaje de error, o null si el valor es válido (ausente, 0 o positivo).
export function validateProductStock(stock: unknown): string | null {
  if (stock == null) return null;
  const n = typeof stock === 'number' || typeof stock === 'string' ? Number(stock) : NaN;
  if (!Number.isFinite(n)) return 'El stock debe ser un número válido';
  if (n < 0) return 'El stock no puede ser negativo';
  return null;
}
