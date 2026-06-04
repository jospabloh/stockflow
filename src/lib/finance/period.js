// Helpers de fecha compartidos por los módulos financieros (Dashboard, Utilidad).
// México City se trata como UTC-6 fijo (sin horario de verano), igual que el
// resto de la app, para que las fechas de corte coincidan entre vistas.

/** Convierte una fecha ISO/UTC a un Date desplazado a la zona de México (UTC-6 fijo). */
export function convertUTCToLocalDate(isoString) {
  const utcDate = new Date(isoString);
  const mexicoDate = new Date(utcDate.getTime() - 6 * 60 * 60 * 1000);
  return mexicoDate;
}

/** Devuelve la fecha (YYYY-MM-DD) de un ISO/UTC en zona horaria de México. */
export function getDateStringMexico(isoString) {
  const localDate = convertUTCToLocalDate(isoString);
  const year = localDate.getUTCFullYear();
  const month = String(localDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(localDate.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
