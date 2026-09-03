import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/**
 * Hooks de datos basados en React Query para las entidades del tenant.
 *
 * Ventaja clave sobre el patrón previo (useState + useEffect + refetch manual):
 * tras cualquier mutación basta con invalidar la queryKey de la entidad y la
 * lista se vuelve a pedir y se re-renderiza sola — el usuario ya no tiene que
 * refrescar el navegador para ver los cambios.
 *
 * La queryKey es siempre [<NombreEntidad>, businessId] para que la invalidación
 * por entidad (useInvalidateEntities) alcance todas las vistas del tenant.
 */

export function useProducts(businessId) {
  return useQuery({
    queryKey: ["Product", businessId],
    queryFn: () =>
      base44.entities.Product.filter({ business_id: businessId }, "-created_date", 500),
    enabled: !!businessId,
  });
}

export function useCategories(businessId) {
  return useQuery({
    queryKey: ["Category", businessId],
    queryFn: () => base44.entities.Category.filter({ business_id: businessId }),
    enabled: !!businessId,
  });
}

export function useSupplierPayments(businessId) {
  return useQuery({
    queryKey: ["SupplierPayment", businessId],
    queryFn: () =>
      base44.entities.SupplierPayment.filter(
        { business_id: businessId },
        "-payment_date",
        1000
      ),
    enabled: !!businessId,
  });
}

export function useMachinerySales(businessId) {
  return useQuery({
    queryKey: ["MachinerySale", businessId],
    queryFn: () =>
      // Ordenado por -created_date y no por -sale_date: una venta en trámite
      // todavía no tiene fecha, y ordenar por un campo vacío la mandaría al
      // fondo de la lista justo cuando es la que hay que terminar de capturar.
      base44.entities.MachinerySale.filter(
        { business_id: businessId },
        "-created_date",
        1000
      ),
    enabled: !!businessId,
  });
}

export function useSuppliers(businessId) {
  return useQuery({
    queryKey: ["Supplier", businessId],
    queryFn: () => base44.entities.Supplier.filter({ business_id: businessId }),
    enabled: !!businessId,
  });
}

export function useQuotations(businessId) {
  return useQuery({
    queryKey: ["Quotation", businessId],
    queryFn: () =>
      base44.entities.Quotation.filter({ business_id: businessId }, "-created_date", 2000),
    enabled: !!businessId,
  });
}

export function useMovements(businessId) {
  return useQuery({
    queryKey: ["Movement", businessId],
    queryFn: () =>
      base44.entities.Movement.filter({ business_id: businessId }, "-created_date", 1000),
    enabled: !!businessId,
  });
}

export function usePaymentMethods(businessId) {
  return useQuery({
    queryKey: ["PaymentMethod", businessId],
    queryFn: () =>
      base44.entities.PaymentMethod.filter({ business_id: businessId, active: true }),
    enabled: !!businessId,
  });
}

/**
 * Devuelve una función para invalidar una o varias entidades por nombre.
 * Úsala en el onSuccess/finally de cualquier mutación para forzar el refetch.
 *
 *   const invalidate = useInvalidateEntities();
 *   await base44.entities.Product.delete(id);
 *   invalidate("Product");
 */
export function useInvalidateEntities() {
  const queryClient = useQueryClient();
  return (...entities) =>
    Promise.all(
      entities.map((entity) =>
        queryClient.invalidateQueries({ queryKey: [entity] })
      )
    );
}

/** Acceso directo al QueryClient para updates optimistas (setQueryData). */
export { useQueryClient };
