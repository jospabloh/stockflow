import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";

const BusinessContext = createContext(null);

export function BusinessProvider({ children }) {
  const [user, setUser] = useState(null);
  const [businessId, setBusinessId] = useState(null);
  const [businessName, setBusinessName] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  // Módulo 18 (jospabloh/acacia-app-standard → STANDARD.md): las Membership
  // propias del usuario — cero o una fila para casi todos (el caso de
  // siempre), más de una en cuanto alguien se une o crea un segundo negocio.
  const [memberships, setMemberships] = useState([]);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const u = await base44.auth.me();
        setUser(u);
        const bid = u?.business_id || null;
        setBusinessId(bid);
        if (bid) {
          const businesses = await base44.entities.Business.list();
          const biz = businesses?.find(b => b.id === bid) || businesses?.[0];
          if (biz?.name) setBusinessName(biz.name);
        }
        if (u?.id) {
          // Membership.read RLS keys on data.user_id — el propio usuario
          // siempre puede leer sus propias filas, sin importar cuál sea su
          // business_id activo ahora mismo.
          const own = await base44.entities.Membership.filter({ user_id: u.id }, '-created_date').catch(() => []);
          setMemberships(own || []);
        }
      } catch {
        // not logged in or no business
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const refreshBusiness = () => globalThis.location.reload();

  // Único camino para mover el business_id activo entre negocios a los que
  // el usuario ya pertenece — recarga completa al terminar, mismo motivo que
  // el resto del portafolio (Módulo 18 §5): cada pantalla ya cargó datos del
  // negocio anterior por business_id, y un reset en el lugar es justo donde
  // un valor viejo sobrevive en un closure.
  const switchBusiness = useCallback(async (targetBusinessId) => {
    setSwitching(true);
    try {
      await base44.functions.invoke('business', { action: 'switchBusinessSafe', business_id: targetBusinessId });
      globalThis.location.reload();
    } finally {
      setSwitching(false);
    }
  }, []);

  return (
    <BusinessContext.Provider value={{
      user, businessId, businessName, isLoading, refreshBusiness,
      memberships, switchBusiness, switching,
    }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusinessContext() {
  return useContext(BusinessContext);
}
