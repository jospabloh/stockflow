import confetti from "canvas-confetti";

/**
 * Dispara un efecto de confeti para confirmar visualmente una creación exitosa.
 * Es puramente decorativo: nunca debe romper el flujo si la librería falla.
 */
export function celebrate() {
  try {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#4F46E5", "#06B6D4", "#10B981"],
    });
  } catch (_) {
    // El confeti es decorativo; ignorar cualquier error para no afectar la operación.
  }
}
