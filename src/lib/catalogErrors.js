// Mensajes en español para errores de deleteCatalogItemSafe.
// El backend responde 403 { error: 'system_record_protected' } para registros is_system
// (p. ej. el rubro "Reintegro"); el SDK lo lanza como excepción, así que se lee de ambos lados.
export const SYSTEM_RECORD_PROTECTED = 'system_record_protected';

export function catalogDeleteErrorMessage(source, fallback) {
  const code = source?.response?.data?.error ?? source?.data?.error ?? source?.error;
  if (code === SYSTEM_RECORD_PROTECTED) {
    return 'Este registro es del sistema y no se puede eliminar. Puedes desactivarlo si ya no lo quieres usar.';
  }
  if (code === 'write_blocked') {
    return 'Tu licencia está en modo solo lectura; no se pueden hacer cambios.';
  }
  return fallback;
}
