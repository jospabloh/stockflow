import { base44 } from "@/api/base44Client";

/**
 * Carga un catálogo sembrando sus valores predeterminados de forma idempotente.
 *
 * - Si la colección está vacía, crea los predeterminados (is_system: true).
 * - Limpia duplicados entre los predeterminados (por ejemplo si dos pestañas
 *   sembraron a la vez), conservando el registro más antiguo. Solo de-duplica
 *   registros is_system para no tocar los que el usuario haya creado a mano.
 *
 * @param {Object} params
 * @param {string} params.entity      Nombre de la entidad (ej. "Rubro").
 * @param {string} params.businessId  ID del negocio.
 * @param {Array}  params.defaults    Predeterminados a sembrar (sin business_id/active/is_system).
 * @param {(item:Object)=>string} params.keyOf  Clave para detectar duplicados.
 * @returns {Promise<Array>} Registros finales del catálogo.
 */
export async function seedAndDedupeCatalog({ entity, businessId, defaults, keyOf }) {
  const Entity = base44.entities[entity];
  let data = await Entity.filter({ business_id: businessId });

  // Sembrar predeterminados solo cuando no existe ninguno todavía.
  if (!data || data.length === 0) {
    await Promise.all(
      defaults.map((d) =>
        Entity.create({ ...d, active: true, is_system: true, business_id: businessId })
      )
    );
    data = await Entity.filter({ business_id: businessId });
  }

  // De-duplicar predeterminados (auto-reparación ante una posible carrera).
  const systemItems = (data || [])
    .filter((x) => x.is_system === true)
    .sort((a, b) => String(a.created_date || "").localeCompare(String(b.created_date || "")));

  const seen = new Set();
  const dupes = [];
  for (const item of systemItems) {
    const k = keyOf(item);
    if (seen.has(k)) dupes.push(item);
    else seen.add(k);
  }

  if (dupes.length > 0) {
    await Promise.all(dupes.map((d) => Entity.delete(d.id).catch(() => {})));
    const dupeIds = new Set(dupes.map((d) => d.id));
    data = (data || []).filter((x) => !dupeIds.has(x.id));
  }

  return data || [];
}
